// Modèles de messages : remplis automatiquement avec le prénom et les critères,
// ils ouvrent l'application SMS ou e-mail du téléphone avec le texte prêt.
const Messages = (() => {
  const { esc } = UI;

  const SIGNATURE_DEFAUT = 'Anaïs Scheffel — Maya Immo — 06 32 99 30 58';

  const MODELES_DEFAUT = [
    {
      id: 'relance',
      titre: 'Relance simple',
      sujet: 'Votre recherche immobilière',
      texte: `Bonjour [prénom],

Je reviens vers vous au sujet de votre recherche de [type] à [communes]. Où en est votre projet ? De mon côté, je reste attentive aux nouveaux biens et je vous tiens au courant dès qu'une belle opportunité se présente.

N'hésitez pas à me dire si vos critères ont évolué.

Bien cordialement,
[signature]`,
    },
    {
      id: 'nouveau-bien',
      titre: 'Nouveau bien',
      sujet: 'Un bien qui correspond à votre recherche',
      texte: `Bonjour [prénom],

Un nouveau bien vient d'arriver et il correspond à votre recherche : [bien].
[lien]

Souhaitez-vous le visiter ? Je vous propose volontiers quelques créneaux.

Bien cordialement,
[signature]`,
    },
    {
      id: 'apres-visite',
      titre: 'Suivi après visite',
      sujet: 'Suite à notre visite',
      texte: `Bonjour [prénom],

Merci encore pour la visite de [bien]. Qu'en avez-vous pensé, à tête reposée ?

Je reste à votre disposition pour organiser une seconde visite ou répondre à vos questions.

Bien cordialement,
[signature]`,
    },
    {
      id: 'financement',
      titre: 'Point financement',
      sujet: 'Le financement de votre projet',
      texte: `Bonjour [prénom],

Je me permets de revenir vers vous au sujet du financement de votre projet. Avez-vous pu avancer avec [banque] ?

Avec un accord de principe en main, nous pourrons nous positionner plus rapidement lorsque le bon bien se présentera.

Bien cordialement,
[signature]`,
    },
    {
      id: 'silencieux',
      titre: 'Toujours d\'actualité ?',
      sujet: 'Votre recherche est-elle toujours d\'actualité ?',
      texte: `Bonjour [prénom],

Nous n'avons pas échangé depuis un moment. Votre recherche de [type] à [communes] est-elle toujours d'actualité ?

Si votre projet a évolué ou s'il est en pause, dites-le-moi simplement : je mettrai votre dossier à jour.

Bien cordialement,
[signature]`,
    },
  ];

  const VARIABLES = [
    ['[prénom]', 'le ou les prénoms (« Julie et Thomas »)'],
    ['[type]', 'le type de bien recherché (« maison ou terrain »)'],
    ['[communes]', 'les communes recherchées (« Waldighofen ou Illtal »)'],
    ['[budget]', 'le budget (« 220 k€ – 280 k€ »)'],
    ['[bien]', 'le bien concerné (dernier bien visité, ou bien proposé)'],
    ['[lien]', 'le lien vers l\'annonce'],
    ['[banque]', 'la banque ou le courtier'],
    ['[signature]', 'votre signature'],
  ];

  let personnalises = {}; // { id: { sujet, texte } }
  let signature = SIGNATURE_DEFAUT;

  async function charger() {
    const m = await DB.lire('reglages', 'modeles');
    personnalises = (m && m.valeur) || {};
    const s = await DB.lire('reglages', 'signature');
    signature = (s && s.valeur) || SIGNATURE_DEFAUT;
  }

  const modeles = () => MODELES_DEFAUT.map((m) => ({ ...m, ...(personnalises[m.id] || {}), modifie: !!personnalises[m.id] }));
  const modele = (id) => modeles().find((m) => m.id === id) || modeles()[0];

  async function enregistrerModele(id, champ, valeur) {
    const origine = MODELES_DEFAUT.find((m) => m.id === id);
    const actuel = { sujet: modele(id).sujet, texte: modele(id).texte, [champ]: valeur };
    if (actuel.sujet === origine.sujet && actuel.texte === origine.texte) delete personnalises[id];
    else personnalises[id] = actuel;
    await DB.ecrire('reglages', { cle: 'modeles', valeur: personnalises });
  }

  async function retablir(id) {
    delete personnalises[id];
    await DB.ecrire('reglages', { cle: 'modeles', valeur: personnalises });
  }

  async function enregistrerSignature(valeur) {
    signature = valeur.trim() || SIGNATURE_DEFAUT;
    await DB.ecrire('reglages', { cle: 'signature', valeur: signature });
  }

  // ---------- Remplissage ----------

  const liste = (mots, lien = 'ou') => (mots.length <= 1 ? mots.join('') : `${mots.slice(0, -1).join(', ')} ${lien} ${mots[mots.length - 1]}`);

  function dernierBienVisite(a) {
    const v = Echanges.tries(a).find((e) => e.type === 'visite' && e.bien);
    return v ? v.bien : '';
  }

  // extra : { bien, lien } pour un bien précis (étape « Biens »).
  function valeurs(a, extra = {}) {
    const r = a.recherche;
    const prenoms = a.personnes.map((p) => p.prenom || p.nom).filter(Boolean);
    return {
      '[prénom]': liste(prenoms, 'et') || 'Madame, Monsieur',
      '[type]': liste(r.types.map((t) => libelle(TYPES_BIEN, t).toLowerCase())) || 'bien',
      '[communes]': liste(r.communes) || 'Waldighofen et alentours',
      '[budget]': Acq.budget(r),
      '[bien]': extra.bien || dernierBienVisite(a),
      '[lien]': extra.lien || '',
      '[banque]': a.financement.banque || 'votre banque',
      '[signature]': signature,
    };
  }

  // Les variables sans valeur restent visibles, pour être complétées à la main.
  function remplir(texte, a, extra) {
    const v = valeurs(a, extra);
    let t = texte.replace(/\[[^\]\n]+\]/g, (cle) => {
      const k = cle.toLowerCase().replace('prenom', 'prénom');
      if (!(k in v)) return cle;
      if (k === '[lien]') return v[k];
      return v[k] || cle;
    });
    return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
  }

  // Modèle proposé selon la situation de l'acquéreur.
  function suggestion(a) {
    const depuis = (e) => (Date.now() - new Date(e.date)) / 86400000;
    const tous = Echanges.tries(a);
    const visite = tous.find((e) => e.type === 'visite');
    if (visite && depuis(visite) <= 7) return 'apres-visite';
    if (!tous.length) return 'relance';
    return depuis(tous[0]) > 45 ? 'silencieux' : 'relance';
  }

  // ---------- Liens SMS / e-mail ----------

  const estApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

  function lienSms(numero, texte) {
    const num = numero.replace(/[^\d+]/g, '');
    return `sms:${num}${estApple() ? '&' : '?'}body=${encodeURIComponent(texte)}`;
  }
  const lienEmail = (adresse, sujet, texte) => `mailto:${adresse}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(texte)}`;

  // ---------- Fenêtre « Envoyer un message » ----------

  let contexte = null; // { a, extra }

  function destinataires(a, canal) {
    const champ = canal === 'sms' ? 'telephone' : 'email';
    const vus = new Set();
    return a.personnes
      .filter((p) => p[champ] && !vus.has(p[champ]) && vus.add(p[champ]))
      .map((p) => ({ valeur: p[champ], label: `${p.prenom || p.nom} · ${p[champ]}` }));
  }

  function canalPossible(a, canal) {
    return destinataires(a, canal).length > 0;
  }

  function ouvrir({ id, canal = 'sms', modele: idModele = null, extra = {} }) {
    const a = Acq.trouver(id);
    if (!canalPossible(a, canal)) canal = canal === 'sms' ? 'email' : 'sms';
    if (!canalPossible(a, canal)) {
      UI.toast('Aucun téléphone ni e-mail sur cette fiche.');
      return;
    }
    contexte = { a, extra };
    const m = modele(idModele || suggestion(a));
    const canaux = [{ id: 'sms', label: 'SMS' }, { id: 'email', label: 'E-mail' }].filter((c) => canalPossible(a, c.id));

    const el = document.getElementById('feuille');
    el.innerHTML = `
      <div class="feuille-fond" data-feuille="fermer"></div>
      <form class="feuille-boite" id="form-message" data-id="${a.id}" novalidate>
        <div class="feuille-tete">
          <h3>Message à ${esc(Acq.nomAffiche(a))}</h3>
          <button type="button" class="btn-icone" data-feuille="fermer" aria-label="Fermer">${UI.icone('fermer', 22)}</button>
        </div>
        ${UI.pastilles('modele', modeles().map((x) => ({ id: x.id, label: x.titre })), m.id, { unique: true, legende: 'Modèle' })}
        ${canaux.length > 1 ? UI.pastilles('canal', canaux, canal, { unique: true, legende: 'Envoyer par' }) : `<input type="hidden" name="canal" value="${canal}">`}
        <div id="message-destinataires"></div>
        <div data-si="canal:email">
          ${UI.champ('Objet', `<input id="message-sujet" name="sujet" autocomplete="off">`)}
        </div>
        <label class="champ">
          <span>Texte (modifiable avant l'envoi)</span>
          <textarea id="message-texte" name="texte" rows="10"></textarea>
        </label>
        <p id="message-alerte" class="message-alerte" hidden></p>
        <div class="feuille-actions">
          <button type="button" class="btn btn-secondaire" data-message="copier">Copier le texte</button>
          <a id="message-envoyer" class="btn" href="#" data-message="envoyer">Ouvrir</a>
        </div>
      </form>`;
    el.hidden = false;
    document.body.classList.add('feuille-ouverte');
    const form = el.querySelector('form');
    appliquerModele(form, m.id);
    majCanal(form);
  }

  function appliquerModele(form, idModele) {
    const m = modele(idModele);
    const { a, extra } = contexte;
    form.querySelector('#message-sujet').value = remplir(m.sujet, a, extra);
    form.querySelector('#message-texte').value = remplir(m.texte, a, extra);
    majLien(form);
  }

  function majCanal(form) {
    const canal = new FormData(form).get('canal');
    const dest = destinataires(contexte.a, canal);
    form.querySelector('#message-destinataires').innerHTML = dest.length > 1
      ? UI.pastilles('destinataire', dest.map((d) => ({ id: d.valeur, label: d.label })), dest[0].valeur, { unique: true, legende: 'Destinataire' })
      : `<input type="hidden" name="destinataire" value="${esc(dest[0].valeur)}"><p class="discret">À : ${esc(dest[0].label)}</p>`;
    Acq.majConditions(form);
    majLien(form);
  }

  function majLien(form) {
    const d = new FormData(form);
    const canal = d.get('canal');
    const texte = String(d.get('texte') || '');
    const dest = String(d.get('destinataire') || '');
    const lien = form.querySelector('#message-envoyer');
    lien.href = canal === 'sms' ? lienSms(dest, texte) : lienEmail(dest, String(d.get('sujet') || ''), texte);
    lien.textContent = canal === 'sms' ? 'Ouvrir dans SMS' : 'Ouvrir dans E-mail';
    const manquants = [...new Set((texte + ' ' + (canal === 'email' ? d.get('sujet') : '')).match(/\[[^\]\n]+\]/g) || [])];
    const alerte = form.querySelector('#message-alerte');
    alerte.hidden = !manquants.length;
    alerte.textContent = manquants.length ? `À compléter avant l'envoi : ${manquants.join(', ')}` : '';
  }

  async function copier(form) {
    const zone = form.querySelector('#message-texte');
    try {
      await navigator.clipboard.writeText(zone.value);
      UI.toast('Texte copié');
    } catch (e) {
      zone.focus();
      zone.select();
      UI.toast('Texte sélectionné : utilisez « Copier »');
    }
  }

  document.addEventListener('input', (e) => {
    const form = e.target.closest('#form-message');
    if (!form) return;
    if (e.target.name === 'modele') appliquerModele(form, e.target.value);
    else if (e.target.name === 'canal') majCanal(form);
    else majLien(form);
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-message]');
    if (!b) return;
    const form = b.closest('form');
    if (b.dataset.message === 'copier') copier(form);
    if (b.dataset.message === 'envoyer') {
      // Le lien ouvre l'application SMS ou e-mail ; au retour, l'échange est prêt à être noté.
      const d = new FormData(form);
      const titre = modele(d.get('modele')).titre;
      const id = form.dataset.id;
      const canal = d.get('canal');
      setTimeout(() => Echanges.ouvrir({ id, type: canal, focus: false, texte: `Message « ${titre} » envoyé.` }), 400);
    }
  });

  // ---------- Réglages ----------

  function vueReglages() {
    return `
      <section class="bloc bloc-modeles">
        <h3>Modèles de messages</h3>
        <p class="discret">Les mots entre crochets sont remplacés automatiquement pour chaque acquéreur. Vos modifications sont enregistrées au fur et à mesure.</p>
        <details class="aide-variables">
          <summary>Voir les mots remplacés automatiquement</summary>
          <dl>${VARIABLES.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        </details>
        ${UI.champ('Signature', `<input id="signature" value="${esc(signature)}" autocomplete="off">`)}
        ${modeles().map((m) => `
          <details class="modele" ${m.modifie ? 'data-modifie' : ''}>
            <summary><span>${esc(m.titre)}</span>${m.modifie ? '<span class="tag-fixe">personnalisé</span>' : ''}</summary>
            <div class="modele-corps">
              ${UI.champ('Objet de l\'e-mail', `<input id="modele-${m.id}-sujet" data-modele="${m.id}" data-champ="sujet" value="${esc(m.sujet)}" autocomplete="off">`)}
              ${UI.champ('Texte', `<textarea id="modele-${m.id}-texte" data-modele="${m.id}" data-champ="texte" rows="12">${esc(m.texte)}</textarea>`)}
              ${m.modifie ? `<button type="button" class="lien" data-action="retablir-modele" data-modele="${m.id}">Rétablir le texte d'origine</button>` : ''}
            </div>
          </details>`).join('')}
      </section>`;
  }

  // Enregistrement à la sortie du champ.
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'signature') {
      await enregistrerSignature(e.target.value);
      UI.toast('Signature enregistrée');
    } else if (e.target.dataset.modele && e.target.dataset.champ) {
      await enregistrerModele(e.target.dataset.modele, e.target.dataset.champ, e.target.value);
      UI.toast('Modèle enregistré');
    }
  });

  return { charger, ouvrir, vueReglages, retablir, remplir, modeles };
})();
