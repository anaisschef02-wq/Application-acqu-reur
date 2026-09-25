// Fiches acquéreurs : données, liste, fiche détaillée et formulaire.
const Acq = (() => {
  const { esc } = UI;
  let tous = [];
  let communesAjoutees = [];
  const filtre = { texte: '', statut: 'actifs', type: '', commune: '', budgetMin: null, budgetMax: null };

  // ---------- Données ----------

  async function charger() {
    tous = (await DB.tout('acquereurs')) || [];
    const r = await DB.lire('reglages', 'communes');
    communesAjoutees = (r && r.valeur) || [];
  }

  const trouver = (id) => tous.find((a) => a.id === id);
  const liste = () => tous;

  async function enregistrer(a) {
    a.modifieLe = new Date().toISOString();
    await DB.ecrire('acquereurs', a);
    const i = tous.findIndex((x) => x.id === a.id);
    if (i >= 0) tous[i] = a; else tous.push(a);
    return a;
  }

  async function supprimer(id) {
    await DB.supprimer('acquereurs', id);
    tous = tous.filter((a) => a.id !== id);
  }

  function communes() {
    const autres = new Set(communesAjoutees);
    // Les communes saisies sur des fiches restent proposées, même si elles ont été retirées des réglages.
    tous.forEach((a) => (a.recherche.communes || []).forEach((c) => autres.add(c)));
    COMMUNES_SECTEUR.forEach((c) => autres.delete(c));
    return [...COMMUNES_SECTEUR, ...[...autres].sort((x, y) => x.localeCompare(y, 'fr'))];
  }
  const communesSupplementaires = () => communesAjoutees.slice();

  async function ajouterCommune(nom) {
    nom = nom.trim().replace(/\s+/g, ' ');
    if (!nom) return null;
    const existante = communes().find((c) => UI.sansAccents(c) === UI.sansAccents(nom));
    if (existante) return existante;
    nom = nom.charAt(0).toUpperCase() + nom.slice(1);
    communesAjoutees.push(nom);
    await DB.ecrire('reglages', { cle: 'communes', valeur: communesAjoutees });
    return nom;
  }

  async function retirerCommune(nom) {
    communesAjoutees = communesAjoutees.filter((c) => c !== nom);
    await DB.ecrire('reglages', { cle: 'communes', valeur: communesAjoutees });
  }

  function vide() {
    const maintenant = new Date().toISOString();
    return {
      id: nouvelId(),
      creeLe: maintenant,
      modifieLe: maintenant,
      statut: 'nouveau',
      raisonAbandon: '',
      echanges: [],
      relanceFixee: '',
      frequenceRelance: null,
      personnes: [{ prenom: '', nom: '', telephone: '', email: '' }],
      adresse: '',
      recherche: { types: [], budgetMin: null, budgetMax: null, surfaceMin: null, chambresMin: null, terrainMin: null, options: [], travaux: '', communes: [], delai: '', important: '' },
      financement: { demarche: '', banque: '', accordMontant: null, accordDate: '', apport: null, bienAVendre: '', venteEtat: '' },
    };
  }

  // ---------- Textes résumés ----------

  function nomAffiche(a) {
    const p = a.personnes.filter((x) => x.prenom || x.nom);
    if (!p.length) return 'Sans nom';
    if (p.length === 2 && p[0].nom && p[0].nom === p[1].nom) return `${p[0].prenom} et ${p[1].prenom} ${p[0].nom}`.trim();
    return p.map((x) => `${x.prenom} ${x.nom}`.trim()).join(' et ');
  }

  function budget(r) {
    const { budgetMin: min, budgetMax: max } = r;
    if (min && max) return `${UI.kEuros(min)} – ${UI.kEuros(max)}`;
    if (max) return `jusqu'à ${UI.kEuros(max)}`;
    if (min) return `à partir de ${UI.kEuros(min)}`;
    return '';
  }

  function resumeRecherche(a) {
    const r = a.recherche;
    const morceaux = [];
    if (r.types.length) morceaux.push(r.types.map((t) => libelle(TYPES_BIEN, t)).join(' / '));
    if (budget(r)) morceaux.push(budget(r));
    if (r.chambresMin) morceaux.push(`${r.chambresMin} ch. min`);
    if (r.communes.length) {
      const c = r.communes.slice(0, 3).join(', ');
      morceaux.push(r.communes.length > 3 ? `${c} +${r.communes.length - 3}` : c);
    }
    return morceaux.join(' · ') || 'Recherche à préciser';
  }

  // ---------- Liste ----------

  function panneauListe() {
    return `
      <div class="liste-tete">
        <button type="button" class="btn btn-note-rapide" data-action="note-rapide">
          ${UI.icone('micro', 22)}Note rapide
        </button>
        <label class="recherche">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input id="recherche-nom" type="search" placeholder="Rechercher un nom, un téléphone…" value="${esc(filtre.texte)}" autocomplete="off" aria-label="Rechercher un acquéreur">
        </label>
        <div class="filtres" id="filtres" role="group" aria-label="Filtrer par statut"></div>
        <details class="criteres" id="criteres">
          <summary>Qui cherche… ? <span id="criteres-resume"></span></summary>
          <div class="criteres-corps">
            <div class="grille-2">
              ${UI.champ('Type de bien', `<select id="critere-type" class="champ-select"><option value="">Tous les types</option>${TYPES_BIEN.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select>`)}
              ${UI.champ('Commune', `<select id="critere-commune" class="champ-select"><option value="">Toutes les communes</option>${communes().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>`)}
            </div>
            <div class="grille-2">
              ${UI.champ('Budget à partir de', `<span class="avec-unite"><input id="critere-budget-min" inputmode="numeric" autocomplete="off" data-nombre><em>€</em></span>`)}
              ${UI.champ('Budget jusqu\'à', `<span class="avec-unite"><input id="critere-budget-max" inputmode="numeric" autocomplete="off" data-nombre><em>€</em></span>`)}
            </div>
            <button type="button" class="lien" data-action="effacer-criteres">Effacer les critères</button>
          </div>
        </details>
        <a class="btn btn-nouveau-bureau" href="#/nouveau">+ Nouvel acquéreur</a>
      </div>
      <div id="liste-items" class="liste-items"></div>`;
  }

  function correspond(a) {
    if (filtre.statut === 'actifs' && STATUTS_CLOS.includes(a.statut)) return false;
    if (!['actifs', 'tous'].includes(filtre.statut) && a.statut !== filtre.statut) return false;
    const r = a.recherche;
    if (filtre.type && r.types.length && !r.types.includes(filtre.type)) return false;
    if (filtre.commune && r.communes.length && !r.communes.includes(filtre.commune)) return false;
    if (filtre.budgetMin || filtre.budgetMax) {
      const budget = r.budgetMax || r.budgetMin;
      if (!budget) return false;
      if (filtre.budgetMin && budget < filtre.budgetMin) return false;
      if (filtre.budgetMax && budget > filtre.budgetMax) return false;
    }
    const q = UI.sansAccents(filtre.texte).trim();
    if (!q) return true;
    const botte = UI.sansAccents(a.personnes.map((p) => `${p.prenom} ${p.nom} ${p.nom} ${p.prenom} ${p.email}`).join(' '));
    const tel = a.personnes.map((p) => (p.telephone || '').replace(/\D/g, '')).join(' ');
    const qTel = q.replace(/\D/g, '');
    return q.split(/\s+/).every((mot) => botte.includes(mot)) || (qTel.length >= 3 && tel.includes(qTel));
  }

  function rendreListe(idActif) {
    const filtres = document.getElementById('filtres');
    const items = document.getElementById('liste-items');
    if (!filtres || !items) return;

    const compte = (f) => tous.filter((a) => (f === 'actifs' ? !STATUTS_CLOS.includes(a.statut) : f === 'tous' ? true : a.statut === f)).length;
    const choix = [{ id: 'actifs', label: 'En cours' }, { id: 'tous', label: 'Tous' }, ...STATUTS];
    filtres.innerHTML = choix
      .filter((c) => ['actifs', 'tous'].includes(c.id) || compte(c.id) > 0)
      .map((c) => `<button type="button" class="filtre ${filtre.statut === c.id ? 'actif' : ''}" data-filtre="${c.id}" aria-pressed="${filtre.statut === c.id}">${esc(c.label)} <span>${compte(c.id)}</span></button>`)
      .join('');

    if (!tous.length) {
      items.innerHTML = `
        <div class="vide">
          <p><strong>Aucun acquéreur pour l'instant.</strong></p>
          <p>Créez votre première fiche, ou chargez quelques acquéreurs fictifs pour découvrir l'application.</p>
          <div class="vide-actions">
            <a class="btn" href="#/nouveau">Créer une fiche</a>
            <button type="button" class="btn btn-secondaire" data-action="charger-exemples">Charger des exemples</button>
          </div>
        </div>`;
      return;
    }

    const visibles = tous.filter(correspond).sort((x, y) => (y.modifieLe || '').localeCompare(x.modifieLe || ''));
    const criteres = [
      filtre.type && libelle(TYPES_BIEN, filtre.type).toLowerCase(),
      filtre.commune && `à ${filtre.commune}`,
      filtre.budgetMin && `dès ${UI.kEuros(filtre.budgetMin)}`,
      filtre.budgetMax && `jusqu'à ${UI.kEuros(filtre.budgetMax)}`,
    ].filter(Boolean);
    const resume = document.getElementById('criteres-resume');
    if (resume) resume.textContent = criteres.length ? `${criteres.join(', ')} : ${visibles.length} résultat${visibles.length > 1 ? 's' : ''}` : '';
    if (!visibles.length) {
      items.innerHTML = `<div class="vide"><p>Aucun acquéreur ne correspond${filtre.texte ? ` à « ${esc(filtre.texte)} »` : ' à ces critères'}.</p></div>`;
      return;
    }
    items.innerHTML = `<ul class="liste">${visibles.map((a) => `
      <li>
        <a class="ligne ${a.id === idActif ? 'selectionnee' : ''}" href="#/a/${a.id}">
          <span class="ligne-haut">
            <span class="ligne-nom">${esc(nomAffiche(a))}</span>
            ${UI.badgeStatut(a.statut)}
          </span>
          <span class="ligne-resume">${esc(resumeRecherche(a))}</span>
          ${Relances.mentionListe(a)}
          ${a.demo ? '<span class="tag-exemple">Exemple</span>' : ''}
        </a>
      </li>`).join('')}</ul>`;
  }

  // ---------- Fiche détaillée ----------

  const ligne = (label, valeur) => (valeur ? `<div><dt>${esc(label)}</dt><dd>${valeur}</dd></div>` : '');

  function fiche(a) {
    const r = a.recherche;
    const f = a.financement;
    const personnes = a.personnes.filter((p) => p.prenom || p.nom || p.telephone || p.email);

    const lignesRecherche = [
      ligne('Type de bien', esc(r.types.map((t) => libelle(TYPES_BIEN, t)).join(', '))),
      ligne('Budget', esc(budget(r))),
      ligne('Surface habitable', r.surfaceMin ? `${UI.nombre(r.surfaceMin)} m² min` : ''),
      ligne('Chambres', r.chambresMin ? `${r.chambresMin}${r.chambresMin >= 5 ? ' et plus' : ' min'}` : ''),
      ligne('Terrain', r.terrainMin ? `${UI.nombre(r.terrainMin)} m² min` : ''),
      ligne('Options', esc(r.options.map((o) => libelle(OPTIONS_BIEN, o)).join(', '))),
      ligne('Travaux', esc(libelle(TRAVAUX, r.travaux))),
      ligne('Communes', esc(r.communes.join(', '))),
      ligne('Délai', esc(libelle(DELAIS, r.delai))),
    ].join('');

    const lignesFinancement = [
      ligne('Démarche bancaire', esc(libelle(DEMARCHES, f.demarche))),
      ligne('Banque ou courtier', esc(f.banque)),
      ligne('Accord de principe', f.accordMontant ? esc(UI.euros(f.accordMontant) + (f.accordDate ? ` (le ${UI.date(f.accordDate)})` : '')) : ''),
      ligne('Apport personnel', esc(UI.euros(f.apport))),
      ligne('Bien à vendre avant', f.bienAVendre === 'oui' ? 'Oui' : f.bienAVendre === 'non' ? 'Non' : ''),
      ligne('Où en est la vente', esc(f.bienAVendre === 'oui' ? f.venteEtat : '')),
    ].join('');

    return `
      <article class="fiche">
        <a class="btn-retour" href="${App.retour()}">‹ Retour</a>
        <header class="fiche-tete">
          <div class="fiche-titre">
            <h2>${esc(nomAffiche(a))}</h2>
            ${a.demo ? '<span class="tag-exemple">Exemple</span>' : ''}
          </div>
          <p class="discret">Fiche créée le ${UI.date(a.creeLe)}</p>
          <div class="fiche-outils">
            <label class="statut-rapide">
              <span class="visuellement-cache">Statut</span>
              <span class="statut-point" data-statut="${a.statut}" aria-hidden="true"></span>
              <select id="statut-rapide" data-id="${a.id}">
                ${STATUTS.map((s) => `<option value="${s.id}" ${s.id === a.statut ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
              </select>
            </label>
            <a class="btn btn-secondaire" href="#/a/${a.id}/modifier">Modifier la fiche</a>
          </div>
          ${Relances.contacts(a)}
          ${a.statut === 'abandonne' && a.raisonAbandon ? `<p class="raison">Raison de l'abandon : ${esc(a.raisonAbandon)}</p>` : ''}
        </header>

        ${Relances.blocFiche(a)}

        ${Echanges.blocFiche(a)}

        ${Biens.blocAcquereur(a)}

        <section class="bloc">
          <h3>Coordonnées</h3>
          ${personnes.length ? personnes.map((p) => `
            <div class="personne">
              <strong>${esc(`${p.prenom} ${p.nom}`.trim() || 'Sans nom')}</strong>
              ${p.telephone ? `<a class="contact" href="tel:${esc(p.telephone.replace(/[^\d+]/g, ''))}">${esc(p.telephone)}</a>` : ''}
              ${p.email ? `<a class="contact" href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}
            </div>`).join('') : '<p class="discret">Non renseigné</p>'}
          ${a.adresse ? `<p class="adresse">${esc(a.adresse)}</p>` : ''}
        </section>

        <section class="bloc">
          <h3>Recherche</h3>
          ${lignesRecherche ? `<dl class="infos">${lignesRecherche}</dl>` : '<p class="discret">Recherche à préciser</p>'}
          ${r.important ? `<div class="important"><span>Ce qui compte vraiment pour eux</span><p>${esc(r.important)}</p></div>` : ''}
        </section>

        <section class="bloc">
          <h3>Financement</h3>
          ${lignesFinancement ? `<dl class="infos">${lignesFinancement}</dl>` : '<p class="discret">Non renseigné</p>'}
        </section>

        <button type="button" class="lien-danger" data-action="supprimer" data-id="${a.id}">Supprimer cette fiche</button>
      </article>`;
  }

  async function changerStatut(id, statut) {
    const a = trouver(id);
    if (!a || a.statut === statut) return;
    if (statut === 'abandonne') {
      const raison = await UI.modale({ titre: 'Abandon de la recherche', champ: 'Pour quelle raison ? (facultatif)', ok: 'Enregistrer' });
      if (raison === null) return false;
      a.raisonAbandon = raison;
    }
    a.statut = statut;
    await enregistrer(a);
    UI.toast(`Statut : ${libelle(STATUTS, statut)}`);
    return true;
  }

  // ---------- Formulaire ----------

  function champsPersonne(n, p) {
    return `
      <div class="grille-2">
        ${UI.champ('Prénom', `<input id="p${n}-prenom" name="p${n}-prenom" autocomplete="off" autocapitalize="words" value="${esc(p.prenom)}">`)}
        ${UI.champ('Nom', `<input id="p${n}-nom" name="p${n}-nom" autocomplete="off" autocapitalize="words" value="${esc(p.nom)}">`)}
      </div>
      <div class="grille-2">
        ${UI.champ('Téléphone', `<input id="p${n}-telephone" name="p${n}-telephone" type="tel" inputmode="tel" autocomplete="off" value="${esc(p.telephone)}">`)}
        ${UI.champ('E-mail', `<input id="p${n}-email" name="p${n}-email" type="email" inputmode="email" autocomplete="off" autocapitalize="off" value="${esc(p.email)}">`)}
      </div>`;
  }

  const champMontant = (id, label, valeur, unite = '€') =>
    UI.champ(label, `<span class="avec-unite"><input id="${id}" name="${id}" inputmode="numeric" autocomplete="off" data-nombre value="${esc(UI.nombre(valeur))}"><em>${unite}</em></span>`);

  function formulaire(a) {
    const nouveau = !a;
    a = a || vide();
    const [p1, p2] = a.personnes;
    const r = a.recherche;
    const f = a.financement;
    const chambres = [{ id: '', label: 'Indifférent' }, { id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }, { id: '5', label: '5 et +' }];
    const communesProposees = [...new Set([...communes(), ...r.communes])];

    return `
      <form id="form-acq" class="formulaire" data-id="${a.id}" data-nouveau="${nouveau}" novalidate>
        <a class="btn-retour" href="${nouveau ? App.retour() : `#/a/${a.id}`}">‹ Annuler</a>
        <h2>${nouveau ? 'Nouvel acquéreur' : 'Modifier la fiche'}</h2>

        <fieldset class="bloc">
          <legend>Coordonnées</legend>
          ${champsPersonne(1, p1)}
          <input type="hidden" id="avec-p2" name="avec-p2" value="${p2 ? '1' : '0'}">
          <div id="bloc-p2" class="personne-2" ${p2 ? '' : 'hidden'}>
            <p class="sous-titre">Deuxième personne</p>
            ${champsPersonne(2, p2 || {})}
            <button type="button" class="lien" data-action="retirer-p2">Retirer la deuxième personne</button>
          </div>
          <button type="button" id="ajouter-p2" class="btn btn-secondaire btn-large" data-action="ajouter-p2" ${p2 ? 'hidden' : ''}>+ Ajouter une deuxième personne (couple)</button>
          ${UI.champ('Adresse actuelle (facultatif)', `<input id="adresse" name="adresse" autocomplete="off" value="${esc(a.adresse)}">`)}
        </fieldset>

        <fieldset class="bloc">
          <legend>Recherche</legend>
          ${UI.pastilles('types', TYPES_BIEN, r.types, { legende: 'Type de bien' })}
          <div class="grille-2">
            ${champMontant('budgetMin', 'Budget minimum', r.budgetMin)}
            ${champMontant('budgetMax', 'Budget maximum', r.budgetMax)}
          </div>
          <div class="grille-2">
            ${champMontant('surfaceMin', 'Surface habitable min', r.surfaceMin, 'm²')}
            ${champMontant('terrainMin', 'Terrain min', r.terrainMin, 'm²')}
          </div>
          ${UI.pastilles('chambresMin', chambres, r.chambresMin == null ? '' : String(r.chambresMin), { unique: true, legende: 'Chambres minimum' })}
          ${UI.pastilles('options', OPTIONS_BIEN, r.options, { legende: 'Options souhaitées' })}
          ${UI.pastilles('travaux', TRAVAUX, r.travaux, { unique: true, legende: 'Travaux' })}
          <fieldset class="groupe">
            <legend>Communes recherchées</legend>
            <div class="pastilles" id="communes">
              ${communesProposees.map((c) => UI.pastille('communes', c, c, r.communes.includes(c))).join('')}
            </div>
            <div class="ajout-commune">
              <input id="nouvelle-commune" placeholder="Autre commune…" autocomplete="off" autocapitalize="words" aria-label="Ajouter une commune">
              <button type="button" class="btn btn-secondaire" data-action="ajouter-commune">Ajouter</button>
            </div>
          </fieldset>
          ${UI.pastilles('delai', DELAIS, r.delai, { unique: true, legende: 'Délai souhaité' })}
          ${Dictee.champ('Ce qui compte vraiment pour eux', 'important', r.important)}
        </fieldset>

        <fieldset class="bloc">
          <legend>Financement</legend>
          ${UI.pastilles('demarche', DEMARCHES, f.demarche, { unique: true, legende: 'Démarche bancaire' })}
          <div data-si="demarche:rdv,accord,courtier">
            ${UI.champ('Banque ou courtier', `<input id="banque" name="banque" autocomplete="off" value="${esc(f.banque)}">`)}
          </div>
          <div class="grille-2" data-si="demarche:accord,courtier">
            ${champMontant('accordMontant', 'Montant de l\'accord', f.accordMontant)}
            ${UI.champ('Date de l\'accord', `<input id="accordDate" name="accordDate" type="date" value="${esc(f.accordDate)}">`)}
          </div>
          ${champMontant('apport', 'Apport personnel', f.apport)}
          ${UI.pastilles('bienAVendre', [{ id: 'non', label: 'Non' }, { id: 'oui', label: 'Oui' }], f.bienAVendre, { unique: true, legende: 'Bien à vendre avant d\'acheter ?' })}
          <div data-si="bienAVendre:oui">
            ${UI.champ('Où en est la vente ?', `<textarea id="venteEtat" name="venteEtat" rows="2">${esc(f.venteEtat)}</textarea>`)}
          </div>
        </fieldset>

        <fieldset class="bloc">
          <legend>Statut</legend>
          ${UI.pastilles('statut', STATUTS, a.statut, { unique: true })}
          <div data-si="statut:abandonne">
            ${UI.champ('Raison de l\'abandon', `<textarea id="raisonAbandon" name="raisonAbandon" rows="2">${esc(a.raisonAbandon)}</textarea>`)}
          </div>
        </fieldset>

        <div class="barre-actions">
          <a class="btn btn-secondaire" href="${nouveau ? App.retour() : `#/a/${a.id}`}">Annuler</a>
          <button type="submit" class="btn">Enregistrer</button>
        </div>
      </form>`;
  }

  // Affiche ou masque les champs qui dépendent d'un choix (data-si="nom:valeur1,valeur2").
  function majConditions(form) {
    const donnees = new FormData(form);
    form.querySelectorAll('[data-si]').forEach((el) => {
      const [nom, valeurs] = el.dataset.si.split(':');
      el.hidden = !valeurs.split(',').includes(donnees.get(nom) || '');
    });
  }

  function lireFormulaire(form) {
    const d = new FormData(form);
    const txt = (n) => String(d.get(n) || '').trim();
    const num = (n) => UI.lireNombre(d.get(n));
    const personne = (n) => ({ prenom: txt(`p${n}-prenom`), nom: txt(`p${n}-nom`), telephone: txt(`p${n}-telephone`), email: txt(`p${n}-email`) });
    const personnes = [personne(1)];
    if (d.get('avec-p2') === '1') personnes.push(personne(2));
    const statut = txt('statut') || 'nouveau';
    const demarche = txt('demarche');
    const bienAVendre = txt('bienAVendre');

    return {
      statut,
      raisonAbandon: statut === 'abandonne' ? txt('raisonAbandon') : '',
      personnes,
      adresse: txt('adresse'),
      recherche: {
        types: d.getAll('types'),
        budgetMin: num('budgetMin'),
        budgetMax: num('budgetMax'),
        surfaceMin: num('surfaceMin'),
        chambresMin: num('chambresMin'),
        terrainMin: num('terrainMin'),
        options: d.getAll('options'),
        travaux: txt('travaux'),
        communes: d.getAll('communes'),
        delai: txt('delai'),
        important: txt('important'),
      },
      financement: {
        demarche,
        banque: ['rdv', 'accord', 'courtier'].includes(demarche) ? txt('banque') : '',
        accordMontant: ['accord', 'courtier'].includes(demarche) ? num('accordMontant') : null,
        accordDate: ['accord', 'courtier'].includes(demarche) ? txt('accordDate') : '',
        apport: num('apport'),
        bienAVendre,
        venteEtat: bienAVendre === 'oui' ? txt('venteEtat') : '',
      },
    };
  }

  async function soumettre(form) {
    const valeurs = lireFormulaire(form);
    const p1 = valeurs.personnes[0];
    if (!p1.prenom && !p1.nom) {
      UI.toast('Indiquez au moins un prénom ou un nom.');
      form.querySelector('#p1-prenom').focus();
      return null;
    }
    const b = valeurs.recherche;
    if (b.budgetMin && b.budgetMax && b.budgetMin > b.budgetMax) {
      UI.toast('Le budget minimum est plus élevé que le maximum.');
      form.querySelector('#budgetMin').focus();
      return null;
    }
    const existant = trouver(form.dataset.id);
    const a = existant ? { ...existant, ...valeurs } : { ...vide(), id: form.dataset.id, ...valeurs };
    await enregistrer(a);
    UI.toast(existant ? 'Fiche mise à jour' : 'Acquéreur ajouté');
    return a;
  }

  async function ajouterCommuneDepuisFormulaire(form) {
    const champ = form.querySelector('#nouvelle-commune');
    const nom = await ajouterCommune(champ.value);
    champ.value = '';
    if (!nom) return;
    const zone = form.querySelector('#communes');
    let case_ = [...zone.querySelectorAll('input')].find((i) => i.value === nom);
    if (!case_) {
      zone.insertAdjacentHTML('beforeend', UI.pastille('communes', nom, nom, true));
      case_ = zone.lastElementChild.querySelector('input');
    }
    case_.checked = true;
    UI.toast(`${nom} ajoutée`);
  }

  async function chargerExemples() {
    for (const a of acquereursExemples()) await enregistrer(a);
    UI.toast('Exemples ajoutés');
  }

  async function supprimerExemples() {
    for (const a of tous.filter((x) => x.demo)) await supprimer(a.id);
  }

  return {
    charger, liste, trouver, enregistrer, supprimer, changerStatut, nomAffiche, resumeRecherche, budget,
    communes, communesSupplementaires, ajouterCommune, retirerCommune,
    panneauListe, rendreListe, filtre,
    fiche, formulaire, majConditions, soumettre, ajouterCommuneDepuisFormulaire,
    chargerExemples, supprimerExemples,
  };
})();
