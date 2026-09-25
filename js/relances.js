// Relances : calcul des dates, écran « Ma journée », boutons Appeler / SMS / E-mail.
//
// Règles :
// - un acquéreur actif est à relancer tous les 15 jours (réglable par fiche) après son dernier échange ;
// - une date précise (« rappeler lundi ») remplace ce calcul ; elle s'efface dès qu'un échange est noté à partir de ce jour-là ;
// - « Acheté » et « Abandonné » ne sont jamais relancés ; « En pause » seulement si une date précise est fixée.
const Relances = (() => {
  const { esc } = UI;
  const FREQUENCE_DEFAUT = 15;
  const FREQUENCES = [7, 10, 15, 21, 30, 45, 60];

  // ---------- Dates ----------

  const minuit = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const aujourdhui = () => minuit(new Date());
  const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const isoJour = (d) => dateLocale(d).slice(0, 10);
  // « 2026-09-29 » est lu comme une date locale (et non en heure universelle).
  function lireJour(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : minuit(new Date(s));
  }
  // Nombre de jours entre aujourd'hui et la date (positif = dans le futur).
  const ecart = (d) => Math.round((minuit(d) - aujourdhui()) / 86400000);
  const jourSemaine = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
  const dateLongue = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  function ilYa(d) {
    const n = -ecart(d);
    if (n <= 0) return 'aujourd\'hui';
    if (n === 1) return 'hier';
    return `il y a ${n} jours`;
  }

  // ---------- Calculs ----------

  const frequence = (a) => a.frequenceRelance || FREQUENCE_DEFAUT;
  const dernierEchange = (a) => Echanges.tries(a)[0] || null;

  function prochaine(a) {
    if (STATUTS_CLOS.includes(a.statut)) return null;
    if (a.relanceFixee) return { date: lireJour(a.relanceFixee), fixee: true };
    if (a.statut === 'pause') return null;
    const d = dernierEchange(a);
    const base = d ? lireJour(d.date) : minuit(new Date(a.creeLe));
    return { date: plus(base, frequence(a)), fixee: false };
  }

  function etat(a) {
    const p = prochaine(a);
    if (!p) return null;
    const e = ecart(p.date);
    if (e < 0) return 'retard';
    if (e === 0) return 'aujourdhui';
    return e <= 7 ? 'semaine' : 'plustard';
  }

  // Nombre de relances en retard ou du jour (pastille de l'onglet et de l'icône).
  const aFaire = () => Acq.liste().filter((a) => ['retard', 'aujourdhui'].includes(etat(a))).length;

  // Appelé après l'enregistrement d'un échange : la date fixée est « consommée ».
  function apresEchange(a) {
    if (a.relanceFixee && lireJour(a.relanceFixee) <= aujourdhui()) a.relanceFixee = '';
  }

  function quand(p) {
    const e = ecart(p.date);
    if (e < -1) return `En retard de ${-e} jours`;
    if (e === -1) return 'En retard depuis hier';
    if (e === 0) return 'Aujourd\'hui';
    if (e === 1) return 'Demain';
    return jourSemaine(p.date);
  }

  // ---------- Boutons de contact ----------

  function contacts(a) {
    const tel = a.personnes.map((p) => p.telephone).find(Boolean);
    const mail = a.personnes.map((p) => p.email).find(Boolean);
    const num = tel ? tel.replace(/[^\d+]/g, '') : '';
    const inactif = (type, label) => `<span class="btn-contact inactif" aria-disabled="true" title="Non renseigné">${UI.icone(type, 20)}<span>${label}</span></span>`;
    // SMS et E-mail ouvrent d'abord le choix du modèle de message.
    const message = (ok, canal, label) => (ok
      ? `<button type="button" class="btn-contact" data-action="message" data-canal="${canal}" data-id="${a.id}">${UI.icone(canal, 20)}<span>${label}</span></button>`
      : inactif(canal, label));
    return `
      <div class="contacts">
        ${tel ? `<a class="btn-contact" href="tel:${esc(num)}" data-contact="appel" data-id="${a.id}">${UI.icone('appel', 20)}<span>Appeler</span></a>` : inactif('appel', 'Appeler')}
        ${message(tel, 'sms', 'SMS')}
        ${message(mail, 'email', 'E-mail')}
      </div>`;
  }

  // ---------- Écran « Ma journée » ----------

  function ligne({ a, p }) {
    const dernier = texteDernier(a);
    return `
      <li class="relance">
        <a class="relance-infos" href="#/a/${a.id}">
          <span class="ligne-haut">
            <span class="ligne-nom">${esc(Acq.nomAffiche(a))}</span>
            <span class="relance-quand">${esc(quand(p))}</span>
          </span>
          <span class="ligne-resume">${esc(Acq.resumeRecherche(a))}</span>
          <span class="relance-dernier">${esc(dernier)}${p.fixee ? ' · <span class="tag-fixe">date fixée</span>' : ''}</span>
        </a>
        ${contacts(a)}
      </li>`;
  }

  function section(id, titre, items) {
    if (!items.length) return '';
    return `
      <section class="groupe-relances" data-etat="${id}">
        <h3>${esc(titre)} <span class="compte">${items.length}</span></h3>
        <ul class="relances">${items.map(ligne).join('')}</ul>
      </section>`;
  }

  // Relances en retard, du jour et des 7 prochains jours.
  function groupes() {
    const aVenir = Acq.liste()
      .map((a) => ({ a, p: prochaine(a) }))
      .filter((x) => x.p)
      .map((x) => ({ ...x, e: ecart(x.p.date) }))
      .sort((x, y) => x.e - y.e || Acq.nomAffiche(x.a).localeCompare(Acq.nomAffiche(y.a), 'fr'));
    return {
      retard: aVenir.filter((x) => x.e < 0),
      auj: aVenir.filter((x) => x.e === 0),
      semaine: aVenir.filter((x) => x.e >= 1 && x.e <= 7),
    };
  }

  function texteDernier(a) {
    const d = dernierEchange(a);
    return d ? `Dernier échange : ${libelle(TYPES_ECHANGE, d.type)}, ${ilYa(lireJour(d.date))}` : 'Aucun échange pour l\'instant';
  }

  function vueJournee() {
    const { retard, auj, semaine } = groupes();
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    let message = '';
    if (!Acq.liste().length) {
      message = `
        <div class="vide">
          <p><strong>Bienvenue !</strong></p>
          <p>Créez votre première fiche acquéreur, ou chargez quelques exemples pour découvrir l'application.</p>
          <div class="vide-actions">
            <a class="btn" href="#/nouveau">Créer une fiche</a>
            <button type="button" class="btn btn-secondaire" data-action="charger-exemples">Charger des exemples</button>
          </div>
        </div>`;
    } else if (!retard.length && !auj.length) {
      message = `<p class="journee-calme">Aucune relance pour aujourd'hui.${semaine.length ? '' : ' Rien de prévu cette semaine non plus.'}</p>`;
    }

    return `
      <div class="journee">
        <header class="journee-tete">
          <h2>Ma journée</h2>
          <p class="discret">${esc(date.charAt(0).toUpperCase() + date.slice(1))}</p>
        </header>
        ${Sauvegarde.rappel()}
        <button type="button" class="btn btn-note-rapide" data-action="note-rapide">${UI.icone('micro', 22)}Note rapide</button>
        ${message}
        ${section('retard', 'En retard', retard)}
        ${section('aujourdhui', 'Aujourd\'hui', auj)}
        ${section('semaine', 'Cette semaine', semaine)}
        ${Acq.liste().length ? Agenda.actionsJournee(retard.length + auj.length + semaine.length) : ''}
      </div>`;
  }

  // ---------- Sur la fiche ----------

  function blocFiche(a) {
    if (STATUTS_CLOS.includes(a.statut)) {
      return `
        <section class="bloc bloc-relance">
          <h3>Relance</h3>
          <p class="relance-etat">Pas de relance : acquéreur « ${esc(libelle(STATUTS, a.statut))} ».</p>
        </section>`;
    }
    const p = prochaine(a);
    const e = p ? ecart(p.date) : null;
    let texte;
    if (!p) texte = 'En pause : pas de relance automatique. Vous pouvez fixer une date de rappel.';
    else if (e < 0) texte = `En retard depuis le ${dateCourte(p.date)}`;
    else if (e === 0) texte = 'À relancer aujourd\'hui';
    else texte = `Prochaine relance : ${dateLongue(p.date)} (${e === 1 ? 'demain' : `dans ${e} jours`})`;

    const jusquaLundi = ((8 - new Date().getDay()) % 7) || 7;
    const raccourcis = [['Demain', 1], ['Lundi', jusquaLundi], ['Dans 1 semaine', 7], ['Dans 1 mois', 30]];

    return `
      <section class="bloc bloc-relance" data-etat="${p ? etat(a) : 'aucune'}">
        <h3>Relance</h3>
        <p class="relance-etat">${esc(texte)}${p && p.fixee ? ' <span class="tag-fixe">date fixée</span>' : ''}</p>
        <div class="relance-raccourcis" role="group" aria-label="Rappeler">
          <span>Rappeler :</span>
          ${raccourcis.map(([label, n]) => `<button type="button" class="chip-bouton" data-action="fixer-relance" data-id="${a.id}" data-jours="${n}">${label}</button>`).join('')}
        </div>
        <div class="grille-2">
          ${UI.champ('Ou à une date précise', `<input id="relance-date" type="date" data-id="${a.id}" min="${isoJour(aujourdhui())}" value="${esc(a.relanceFixee || '')}">`)}
          ${UI.champ('Rythme des relances', `<select id="relance-frequence" class="champ-select" data-id="${a.id}">${FREQUENCES.map((n) => `<option value="${n}" ${n === frequence(a) ? 'selected' : ''}>Tous les ${n} jours${n === FREQUENCE_DEFAUT ? ' (normal)' : ''}</option>`).join('')}</select>`)}
        </div>
        ${a.relanceFixee ? `<button type="button" class="lien" data-action="effacer-relance" data-id="${a.id}">Annuler la date fixée</button>` : ''}
        ${p ? Agenda.boutonsFiche(a, p) : ''}
      </section>`;
  }

  // Petite mention dans la liste des acquéreurs.
  function mentionListe(a) {
    const e = etat(a);
    if (e === 'retard') return '<span class="relance-mini" data-etat="retard">Relance en retard</span>';
    if (e === 'aujourdhui') return '<span class="relance-mini" data-etat="aujourdhui">À relancer aujourd\'hui</span>';
    return '';
  }

  // ---------- Modifications ----------

  async function fixer(id, jourIso) {
    const a = Acq.trouver(id);
    a.relanceFixee = jourIso || '';
    await Acq.enregistrer(a);
    UI.toast(jourIso ? `Rappel fixé au ${dateLongue(lireJour(jourIso))}` : 'Retour au rythme normal');
  }
  const fixerDans = (id, jours) => fixer(id, isoJour(plus(aujourdhui(), jours)));

  async function changerFrequence(id, n) {
    const a = Acq.trouver(id);
    a.frequenceRelance = n === FREQUENCE_DEFAUT ? null : n;
    await Acq.enregistrer(a);
    UI.toast(`Relance tous les ${n} jours`);
  }

  // Pastille sur l'icône de l'application (si le téléphone le permet).
  function majBadge() {
    const n = aFaire();
    try {
      if (n && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
      else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    } catch (e) { /* non pris en charge */ }
    return n;
  }

  return {
    prochaine, etat, aFaire, groupes, texteDernier, quand, frequence, dateLongue, apresEchange, contacts, vueJournee, blocFiche, mentionListe,
    fixer, fixerDans, changerFrequence, majBadge, isoJour, plus, aujourdhui,
  };
})();
