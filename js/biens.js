// Biens et rapprochement automatique avec les acquéreurs.
const Biens = (() => {
  const { esc } = UI;
  let tous = [];
  let marge = 10; // tolérance sur le budget, en %
  let filtreStatut = 'actifs';
  let photoEnCours = null; // photo du formulaire en cours (ou '' si retirée)
  const SEUIL = 60; // score minimum pour « correspondre »
  const MARGES = [0, 5, 10, 15, 20];

  // ---------- Données ----------

  async function charger() {
    tous = (await DB.tout('biens')) || [];
    const m = await DB.lire('reglages', 'marge');
    if (m && m.valeur != null) marge = m.valeur;
  }
  const liste = () => tous;
  const trouver = (id) => tous.find((b) => b.id === id);

  async function enregistrer(b) {
    b.modifieLe = new Date().toISOString();
    await DB.ecrire('biens', b);
    const i = tous.findIndex((x) => x.id === b.id);
    if (i >= 0) tous[i] = b; else tous.push(b);
    return b;
  }

  async function supprimer(id) {
    await DB.supprimer('biens', id);
    tous = tous.filter((b) => b.id !== id);
  }

  async function changerMarge(n) {
    marge = n;
    await DB.ecrire('reglages', { cle: 'marge', valeur: n });
  }

  async function chargerExemples() {
    for (const b of biensExemples()) await enregistrer(b);
  }
  async function supprimerExemples() {
    for (const b of tous.filter((x) => x.demo)) await supprimer(b.id);
  }

  // ---------- Textes ----------

  function titre(b) {
    return `${libelle(TYPES_BIEN, b.type) || 'Bien'} · ${b.commune || 'commune ?'}`;
  }

  function caracteristiques(b) {
    return [
      b.surface ? `${UI.nombre(b.surface)} m²` : '',
      b.chambres ? `${b.chambres} ch.` : '',
      b.terrain ? `terrain ${UI.nombre(b.terrain)} m²` : '',
    ].filter(Boolean).join(' · ');
  }

  // Phrase utilisée dans le message « Nouveau bien ».
  function description(b) {
    const type = (libelle(TYPES_BIEN, b.type) || 'bien').toLowerCase();
    const morceaux = [b.surface ? `${type} de ${UI.nombre(b.surface)} m²` : type];
    if (b.chambres) morceaux.push(`${b.chambres} chambre${b.chambres > 1 ? 's' : ''}`);
    if (b.terrain) morceaux.push(`terrain de ${UI.nombre(b.terrain)} m²`);
    const opts = (b.options || []).map((o) => libelle(OPTIONS_BIEN, o).toLowerCase());
    if (opts.length > 1) morceaux.push(`${opts.slice(0, -1).join(', ')} et ${opts[opts.length - 1]}`);
    else if (opts.length) morceaux.push(opts[0]);
    let t = morceaux.join(', ');
    if (b.commune) t += `, à ${b.commune}`;
    if (b.prix) t += `, au prix de ${UI.euros(b.prix)}`;
    if (b.reference) t += ` (réf. ${b.reference})`;
    return t;
  }

  // ---------- Rapprochement ----------
  // Score sur 100 : type 20, budget 25, commune 25, chambres 10, surface 10, terrain 5, options 5.
  // Un type non recherché ou un prix au-delà du budget + marge écarte l'acquéreur.
  function score(a, b) {
    const r = a.recherche;
    const raisons = [];
    let pts = 0;

    if (r.types.length) {
      if (!r.types.includes(b.type)) return null;
      raisons.push(['oui', libelle(TYPES_BIEN, b.type)]);
    }
    pts += 20;

    if (r.budgetMax && b.prix) {
      if (b.prix > r.budgetMax * (1 + marge / 100)) return null;
      if (b.prix <= r.budgetMax) { pts += 25; raisons.push(['oui', 'Dans le budget']); }
      else { pts += 12; raisons.push(['moyen', `${Math.ceil((b.prix / r.budgetMax - 1) * 100)} % au-dessus du budget`]); }
    } else pts += 25;

    if (r.communes.length && b.commune) {
      if (r.communes.includes(b.commune)) { pts += 25; raisons.push(['oui', b.commune]); }
      else raisons.push(['non', `Pas à ${b.commune}`]);
    } else pts += 25;

    const minimum = (voulu, reel, poids, format) => {
      if (!voulu) { pts += poids; return; }
      if (reel == null || reel === '') { pts += poids / 2; return; }
      if (reel >= voulu) { pts += poids; raisons.push(['oui', format(reel)]); }
      else if (reel >= voulu * 0.9 || voulu - reel === 1) { pts += poids * 0.4; raisons.push(['moyen', `${format(reel)} au lieu de ${UI.nombre(voulu)}`]); }
      else raisons.push(['non', `${format(reel)} seulement`]);
    };
    minimum(r.chambresMin, b.chambres, 10, (n) => `${n} ch.`);
    minimum(r.surfaceMin, b.surface, 10, (n) => `${UI.nombre(n)} m²`);
    minimum(r.terrainMin, b.terrain, 5, (n) => `terrain ${UI.nombre(n)} m²`);

    if (r.options.length) {
      const presentes = r.options.filter((o) => (b.options || []).includes(o));
      pts += (5 * presentes.length) / r.options.length;
      r.options.filter((o) => !presentes.includes(o)).forEach((o) => raisons.push(['non', `Sans ${libelle(OPTIONS_BIEN, o).toLowerCase()}`]));
    } else pts += 5;

    return { score: Math.round(pts), raisons };
  }

  const dateProposition = (a, b) => ((a.propositions || []).find((p) => p.bienId === b.id) || {}).date || '';
  const visite = (a, b) => (a.echanges || []).find((e) => e.type === 'visite' && e.bienId === b.id);

  function correspondancesBien(b) {
    if (b.statut === 'vendu') return [];
    return Acq.liste()
      .filter((a) => !STATUTS_CLOS.includes(a.statut))
      .map((a) => ({ a, ...(score(a, b) || { score: -1 }) }))
      .filter((x) => x.score >= SEUIL)
      .sort((x, y) => y.score - x.score);
  }

  function correspondancesAcquereur(a) {
    return tous
      .filter((b) => b.statut === 'disponible')
      .map((b) => ({ b, ...(score(a, b) || { score: -1 }) }))
      .filter((x) => x.score >= SEUIL && !dateProposition(a, x.b) && !visite(a, x.b))
      .sort((x, y) => y.score - x.score);
  }

  async function marquerPropose(idAcq, idBien) {
    const a = Acq.trouver(idAcq);
    a.propositions = (a.propositions || []).filter((p) => p.bienId !== idBien);
    a.propositions.push({ bienId: idBien, date: dateLocale() });
    await Acq.enregistrer(a);
  }

  async function annulerProposition(idAcq, idBien) {
    const a = Acq.trouver(idAcq);
    a.propositions = (a.propositions || []).filter((p) => p.bienId !== idBien);
    await Acq.enregistrer(a);
  }

  // Ouvre le message « Nouveau bien » pré-rempli pour cet acquéreur.
  function proposer(idAcq, idBien, canal = 'sms') {
    const b = trouver(idBien);
    Messages.ouvrir({ id: idAcq, canal, modele: 'nouveau-bien', extra: { bien: description(b), lien: b.lien || '', bienId: b.id } });
  }

  // ---------- Petits éléments ----------

  const badgeStatut = (s) => `<span class="statut-bien" data-statut="${esc(s)}">${esc(libelle(STATUTS_BIEN, s))}</span>`;
  const vignette = (b, classe = 'vignette') => (b.photo
    ? `<img class="${classe}" src="${b.photo}" alt="">`
    : `<span class="${classe} vignette-vide" aria-hidden="true">${UI.icone('visite', 28)}</span>`);
  const pastilleScore = (n) => `<span class="score" data-niveau="${n >= 85 ? 'fort' : 'moyen'}">${n} %</span>`;
  const raisonsHtml = (raisons) => `<span class="raisons">${raisons.map(([niv, t]) => `<span class="raison-${niv}">${esc(t)}</span>`).join('')}</span>`;

  // ---------- Liste des biens ----------

  function vueListe() {
    const compte = (f) => tous.filter((b) => (f === 'actifs' ? b.statut !== 'vendu' : f === 'tous' || b.statut === f)).length;
    const choix = [{ id: 'actifs', label: 'En vente' }, ...STATUTS_BIEN, { id: 'tous', label: 'Tous' }];
    const visibles = tous
      .filter((b) => (filtreStatut === 'actifs' ? b.statut !== 'vendu' : filtreStatut === 'tous' || b.statut === filtreStatut))
      .sort((x, y) => (y.creeLe || '').localeCompare(x.creeLe || ''));

    return `
      <div class="journee">
        <header class="entete-biens">
          <h2>Mes biens</h2>
          <a class="btn" href="#/biens/nouveau">+ Nouveau bien</a>
        </header>
        <div class="filtres" role="group" aria-label="Filtrer les biens">
          ${choix.map((c) => `<button type="button" class="filtre ${filtreStatut === c.id ? 'actif' : ''}" data-action="filtre-biens" data-filtre-bien="${c.id}" aria-pressed="${filtreStatut === c.id}">${esc(c.label)} <span>${compte(c.id)}</span></button>`).join('')}
        </div>
        ${!tous.length ? `
          <div class="vide">
            <p><strong>Aucun bien enregistré.</strong></p>
            <p>Ajoutez un bien : l'application vous dira aussitôt quels acquéreurs il peut intéresser.</p>
            <div class="vide-actions"><a class="btn" href="#/biens/nouveau">Ajouter un bien</a></div>
          </div>` : !visibles.length ? '<p class="journee-calme">Aucun bien dans cette catégorie.</p>' : `
          <ul class="liste">${visibles.map((b) => {
            const n = correspondancesBien(b).length;
            return `
            <li>
              <a class="ligne ligne-bien" href="#/b/${b.id}">
                ${vignette(b)}
                <span class="ligne-bien-corps">
                  <span class="ligne-haut">
                    <span class="ligne-nom">${esc(titre(b))}</span>
                    ${badgeStatut(b.statut)}
                  </span>
                  <span class="ligne-prix">${esc(UI.euros(b.prix))}${b.reference ? ` <span class="discret">· réf. ${esc(b.reference)}</span>` : ''}</span>
                  <span class="ligne-resume">${esc(caracteristiques(b))}</span>
                  ${b.statut !== 'vendu' ? `<span class="ligne-correspond">${n ? `Correspond à ${n} acquéreur${n > 1 ? 's' : ''}` : 'Aucun acquéreur correspondant'}</span>` : ''}
                  ${b.demo ? '<span class="tag-exemple">Exemple</span>' : ''}
                </span>
              </a>
            </li>`;
          }).join('')}</ul>`}
      </div>`;
  }

  const filtrer = (f) => { filtreStatut = f; };

  // ---------- Fiche d'un bien ----------

  function fiche(b) {
    const corr = correspondancesBien(b);
    const ligne = (label, valeur) => (valeur ? `<div><dt>${esc(label)}</dt><dd>${valeur}</dd></div>` : '');
    return `
      <article class="fiche">
        <a class="btn-retour" href="#/biens">‹ Mes biens</a>
        ${b.photo ? `<img class="photo-bien" src="${b.photo}" alt="Photo du bien ${esc(b.reference)}">` : ''}
        <header class="fiche-tete">
          <div class="fiche-titre">
            <h2>${esc(titre(b))}</h2>
            ${b.demo ? '<span class="tag-exemple">Exemple</span>' : ''}
          </div>
          <p class="prix-bien">${esc(UI.euros(b.prix))}${b.reference ? ` <span class="discret">· réf. ${esc(b.reference)}</span>` : ''}</p>
          <div class="fiche-outils">
            <label class="statut-rapide">
              <span class="visuellement-cache">Statut du bien</span>
              <select id="statut-bien" data-id="${b.id}">
                ${STATUTS_BIEN.map((s) => `<option value="${s.id}" ${s.id === b.statut ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
              </select>
            </label>
            <a class="btn btn-secondaire" href="#/b/${b.id}/modifier">Modifier le bien</a>
            ${b.lien ? `<a class="btn btn-secondaire" href="${esc(b.lien)}" target="_blank" rel="noopener">Voir l'annonce</a>` : ''}
          </div>
        </header>

        <section class="bloc bloc-correspondances">
          <h3>${b.statut === 'vendu' ? 'Bien vendu' : corr.length ? `Ce bien correspond à ${corr.length} acquéreur${corr.length > 1 ? 's' : ''}` : 'Aucun acquéreur ne correspond'}</h3>
          ${b.statut === 'vendu' ? '<p class="discret">Un bien vendu n\'est plus proposé aux acquéreurs.</p>' : corr.length ? `
            <p class="discret">Du plus pertinent au moins pertinent (marge de ${marge} % sur le budget). Touchez « Proposer » pour envoyer le message « Nouveau bien ».</p>
            <ul class="correspondances">${corr.map((x) => ligneAcquereur(x, b)).join('')}</ul>`
            : `<p class="discret">Aucun acquéreur en cours ne recherche ce type de bien dans ce budget (marge de ${marge} %).</p>`}
        </section>

        <section class="bloc">
          <h3>Caractéristiques</h3>
          <dl class="infos">
            ${ligne('Type', esc(libelle(TYPES_BIEN, b.type)))}
            ${ligne('Commune', esc(b.commune))}
            ${ligne('Prix', esc(UI.euros(b.prix)))}
            ${ligne('Surface habitable', b.surface ? `${UI.nombre(b.surface)} m²` : '')}
            ${ligne('Chambres', b.chambres ? String(b.chambres) : '')}
            ${ligne('Terrain', b.terrain ? `${UI.nombre(b.terrain)} m²` : '')}
            ${ligne('Options', esc((b.options || []).map((o) => libelle(OPTIONS_BIEN, o)).join(', ')))}
          </dl>
          ${b.notes ? `<div class="important"><span>Notes</span><p>${esc(b.notes)}</p></div>` : ''}
        </section>

        <button type="button" class="lien-danger" data-action="supprimer-bien" data-id="${b.id}">Supprimer ce bien</button>
      </article>`;
  }

  function ligneAcquereur({ a, score: s, raisons }, b) {
    const propose = dateProposition(a, b);
    const vu = visite(a, b);
    let etat = '';
    if (vu) etat = `<span class="tag-fixe">Visité ${esc(UI.dateEchange(vu.date).split(' · ')[0])}</span>`;
    else if (propose) etat = `<span class="tag-fixe">Proposé ${esc(UI.dateEchange(propose).split(' · ')[0])}</span>`;
    return `
      <li class="correspondance">
        <a class="correspondance-infos" href="#/a/${a.id}">
          <span class="ligne-haut">
            <span class="ligne-nom">${esc(Acq.nomAffiche(a))}</span>
            ${pastilleScore(s)}
          </span>
          ${raisonsHtml(raisons)}
          ${a.statut === 'pause' ? '<span class="discret">En pause</span>' : ''}
          ${etat}
        </a>
        <div class="correspondance-actions">
          <button type="button" class="btn ${propose || vu ? 'btn-secondaire' : ''}" data-action="proposer-bien" data-id="${a.id}" data-bien="${b.id}">${propose || vu ? 'Reproposer' : 'Proposer'}</button>
          ${propose
            ? `<button type="button" class="lien" data-action="annuler-proposition" data-id="${a.id}" data-bien="${b.id}">Retirer « proposé »</button>`
            : vu ? '' : `<button type="button" class="lien" data-action="marquer-propose" data-id="${a.id}" data-bien="${b.id}">Déjà proposé (téléphone…)</button>`}
        </div>
      </li>`;
  }

  // ---------- Sur la fiche acquéreur ----------

  function blocAcquereur(a) {
    const corr = STATUTS_CLOS.includes(a.statut) ? [] : correspondancesAcquereur(a);
    const deja = tous
      .map((b) => ({ b, propose: dateProposition(a, b), vu: visite(a, b) }))
      .filter((x) => x.propose || x.vu)
      .sort((x, y) => ((y.vu && y.vu.date) || y.propose).localeCompare((x.vu && x.vu.date) || x.propose));
    if (!corr.length && !deja.length && !tous.length) return '';
    const ligneBien = (b, droite, bas = '') => `
      <li>
        <a class="ligne ligne-bien compacte" href="#/b/${b.id}">
          ${vignette(b)}
          <span class="ligne-bien-corps">
            <span class="ligne-haut"><span class="ligne-nom">${esc(titre(b))}</span>${droite}</span>
            <span class="ligne-resume">${esc(UI.euros(b.prix))}${caracteristiques(b) ? ` · ${esc(caracteristiques(b))}` : ''}</span>
            ${bas}
          </span>
        </a>
      </li>`;
    return `
      <section class="bloc bloc-biens-acq">
        <h3>Biens</h3>
        <p class="sous-titre">À lui proposer ${corr.length ? `<span class="compte">${corr.length}</span>` : ''}</p>
        ${corr.length ? `<ul class="liste">${corr.map((x) => ligneBien(x.b, pastilleScore(x.score), raisonsHtml(x.raisons))).join('')}</ul>`
          : '<p class="discret">Aucun bien disponible ne correspond pour l\'instant.</p>'}
        ${deja.length ? `
          <p class="sous-titre">Déjà proposés ou visités</p>
          <ul class="liste">${deja.map(({ b, propose, vu }) => ligneBien(b, badgeStatut(b.statut),
            `<span class="tag-fixe">${vu ? `Visité ${esc(UI.dateEchange(vu.date).split(' · ')[0])}${vu.avis ? ` · ${esc(libelle(AVIS_VISITE, vu.avis))}` : ''}` : `Proposé ${esc(UI.dateEchange(propose).split(' · ')[0])}`}</span>`)).join('')}</ul>` : ''}
      </section>`;
  }

  // Liste déroulante des biens, dans la saisie d'une visite.
  function optionsVisite(idChoisi) {
    const proposes = tous.filter((b) => b.statut !== 'vendu' || b.id === idChoisi)
      .sort((x, y) => titre(x).localeCompare(titre(y), 'fr'));
    if (!proposes.length) return '';
    return `
      <label class="champ">
        <span>Bien de mon portefeuille (facultatif)</span>
        <select id="echange-bien-id" name="bienId" class="champ-select">
          <option value="">— Autre bien —</option>
          ${proposes.map((b) => `<option value="${b.id}" ${b.id === idChoisi ? 'selected' : ''} data-libelle="${esc(`${titre(b)}${b.reference ? ` (réf. ${b.reference})` : ''}`)}">${esc(titre(b))} · ${esc(UI.kEuros(b.prix))}${b.reference ? ` · ${esc(b.reference)}` : ''}</option>`).join('')}
        </select>
      </label>`;
  }

  // ---------- Formulaire ----------

  const champMontant = (id, label, valeur, unite) =>
    UI.champ(label, `<span class="avec-unite"><input id="${id}" name="${id}" inputmode="numeric" autocomplete="off" data-nombre value="${esc(UI.nombre(valeur))}"><em>${unite}</em></span>`);

  function formulaire(b) {
    const nouveau = !b;
    b = b || { id: nouvelId(), reference: '', type: 'maison', commune: '', prix: null, surface: null, chambres: null, terrain: null, options: [], lien: '', photo: '', notes: '', statut: 'disponible' };
    photoEnCours = null;
    const retour = nouveau ? '#/biens' : `#/b/${b.id}`;
    const communes = [...new Set([...Acq.communes(), ...(b.commune ? [b.commune] : [])])];
    return `
      <form id="form-bien" class="formulaire" data-id="${b.id}" novalidate>
        <a class="btn-retour" href="${retour}">‹ Annuler</a>
        <h2>${nouveau ? 'Nouveau bien' : 'Modifier le bien'}</h2>
        <fieldset class="bloc">
          <legend>Le bien</legend>
          ${UI.pastilles('type', TYPES_BIEN, b.type, { unique: true, legende: 'Type de bien' })}
          <div class="grille-2">
            ${UI.champ('Commune', `<input id="bien-commune" name="commune" list="liste-communes" autocomplete="off" autocapitalize="words" value="${esc(b.commune)}"><datalist id="liste-communes">${communes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`)}
            ${UI.champ('Référence', `<input id="bien-reference" name="reference" autocomplete="off" value="${esc(b.reference)}">`)}
          </div>
          <div class="grille-2">
            ${champMontant('prix', 'Prix', b.prix, '€')}
            ${champMontant('surface', 'Surface habitable', b.surface, 'm²')}
          </div>
          <div class="grille-2">
            ${champMontant('chambres', 'Chambres', b.chambres, 'ch.')}
            ${champMontant('terrain', 'Terrain', b.terrain, 'm²')}
          </div>
          ${UI.pastilles('options', OPTIONS_BIEN, b.options || [], { legende: 'Options' })}
          ${UI.champ('Lien vers l\'annonce', `<input id="bien-lien" name="lien" type="url" inputmode="url" autocomplete="off" autocapitalize="off" placeholder="https://…" value="${esc(b.lien)}">`)}
          <div class="champ">
            <span class="champ-titre">Photo (facultatif)</span>
            <div class="photo-zone" id="photo-zone">${apercuPhoto(b.photo)}</div>
            <label class="btn btn-secondaire btn-fichier">
              <input id="bien-photo" type="file" accept="image/*">
              ${b.photo ? 'Changer la photo' : 'Ajouter une photo'}
            </label>
          </div>
          ${Dictee.champ('Notes', 'bien-notes', b.notes, { name: 'notes', lignes: 3 })}
        </fieldset>
        <fieldset class="bloc">
          <legend>Statut</legend>
          ${UI.pastilles('statut', STATUTS_BIEN, b.statut, { unique: true })}
        </fieldset>
        <div class="barre-actions">
          <a class="btn btn-secondaire" href="${retour}">Annuler</a>
          <button type="submit" class="btn">Enregistrer</button>
        </div>
      </form>`;
  }

  const apercuPhoto = (src) => (src
    ? `<img src="${src}" alt="Aperçu de la photo"><button type="button" class="lien" data-action="retirer-photo">Retirer la photo</button>`
    : '');

  // La photo est réduite (900 px maximum) pour ne pas encombrer l'appareil.
  async function lirePhoto(fichier) {
    const url = URL.createObjectURL(fichier);
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
      const r = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * r);
      c.height = Math.round(img.naturalHeight * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.75);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function choisirPhoto(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      photoEnCours = await lirePhoto(f);
      document.getElementById('photo-zone').innerHTML = apercuPhoto(photoEnCours);
    } catch (e) {
      UI.toast('Cette image n\'a pas pu être lue.');
    }
  }

  function retirerPhoto() {
    photoEnCours = '';
    document.getElementById('photo-zone').innerHTML = '';
  }

  async function soumettre(form) {
    const d = new FormData(form);
    const txt = (n) => String(d.get(n) || '').trim();
    const num = (n) => UI.lireNombre(d.get(n));
    const commune = txt('commune');
    if (!commune) {
      UI.toast('Indiquez la commune du bien.');
      form.querySelector('#bien-commune').focus();
      return null;
    }
    // Une commune nouvelle rejoint la liste proposée partout.
    const communeRetenue = (await Acq.ajouterCommune(commune)) || commune;
    const existant = trouver(form.dataset.id);
    const b = {
      ...(existant || { id: form.dataset.id, creeLe: new Date().toISOString(), photo: '' }),
      type: txt('type') || 'autre',
      commune: communeRetenue,
      reference: txt('reference'),
      prix: num('prix'),
      surface: num('surface'),
      chambres: num('chambres'),
      terrain: num('terrain'),
      options: d.getAll('options'),
      lien: txt('lien'),
      notes: txt('notes'),
      statut: txt('statut') || 'disponible',
    };
    if (photoEnCours !== null) b.photo = photoEnCours;
    await enregistrer(b);
    photoEnCours = null;
    UI.toast(existant ? 'Bien mis à jour' : 'Bien ajouté');
    return b;
  }

  // ---------- Réglages ----------

  function vueReglages() {
    return `
      <section class="bloc">
        <h3>Rapprochement biens / acquéreurs</h3>
        <p class="discret">Un bien un peu plus cher que le budget d'un acquéreur peut quand même lui être proposé, dans la limite de cette marge.</p>
        ${UI.champ('Marge sur le budget', `<select id="reglage-marge" class="champ-select">${MARGES.map((n) => `<option value="${n}" ${n === marge ? 'selected' : ''}>${n === 0 ? 'Aucune : budget strict' : `Jusqu'à ${n} % au-dessus du budget`}</option>`).join('')}</select>`)}
      </section>`;
  }

  return {
    charger, liste, trouver, enregistrer, supprimer, changerMarge, chargerExemples, supprimerExemples,
    titre, description, correspondancesBien, correspondancesAcquereur, marquerPropose, annulerProposition, proposer,
    vueListe, filtrer, fiche, blocAcquereur, optionsVisite, formulaire, choisirPhoto, retirerPhoto, soumettre, vueReglages,
  };
})();
