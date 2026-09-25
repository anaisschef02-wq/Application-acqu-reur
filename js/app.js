// Navigation entre les écrans et gestion des clics.
const App = (() => {
  const panneauListe = () => document.getElementById('panneau-liste');
  const panneauDetail = () => document.getElementById('panneau-detail');
  let route = { ecran: 'journee' };
  let retourHash = '#/';
  let dernierHash = null;
  const ECRANS_RACINE = ['journee', 'acquereurs', 'biens'];

  function lireRoute() {
    const morceaux = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (morceaux[0] === 'acquereurs') return { ecran: 'acquereurs' };
    if (morceaux[0] === 'biens') return { ecran: morceaux[1] === 'nouveau' ? 'bien-nouveau' : 'biens' };
    if (morceaux[0] === 'b' && morceaux[1]) return { ecran: morceaux[2] === 'modifier' ? 'bien-modifier' : 'bien', idBien: morceaux[1] };
    if (morceaux[0] === 'nouveau') return { ecran: 'nouveau' };
    if (morceaux[0] === 'reglages') return { ecran: 'reglages' };
    if (morceaux[0] === 'a' && morceaux[1]) return { ecran: morceaux[2] === 'modifier' ? 'modifier' : 'fiche', id: morceaux[1] };
    return { ecran: 'journee' };
  }

  const aller = (hash) => {
    if (location.hash === hash) rendre();
    else location.hash = hash;
  };

  function rendre() {
    Dictee.arreter();
    const ancienHash = dernierHash;
    dernierHash = location.hash;
    route = lireRoute();
    const detail = panneauDetail();
    let a = null;
    if (route.id) {
      a = Acq.trouver(route.id);
      if (!a) route = { ecran: 'journee' };
    }
    let b = null;
    if (route.idBien) {
      b = Biens.trouver(route.idBien);
      if (!b) route = { ecran: 'biens' };
    }

    const racine = ECRANS_RACINE.includes(route.ecran);
    if (racine) retourHash = { journee: '#/', acquereurs: '#/acquereurs', biens: '#/biens' }[route.ecran];
    document.body.className = `${route.ecran === 'acquereurs' ? 'vue-liste' : 'vue-detail'}${racine ? ' vue-racine' : ''}`;

    switch (route.ecran) {
      case 'fiche':
        detail.innerHTML = Acq.fiche(a);
        break;
      case 'modifier':
      case 'nouveau':
        detail.innerHTML = Acq.formulaire(a);
        Acq.majConditions(detail.querySelector('form'));
        break;
      case 'reglages':
        detail.innerHTML = Reglages.vue();
        break;
      case 'biens':
        detail.innerHTML = Biens.vueListe();
        break;
      case 'bien':
        detail.innerHTML = Biens.fiche(b);
        break;
      case 'bien-nouveau':
      case 'bien-modifier':
        detail.innerHTML = Biens.formulaire(b);
        break;
      default:
        detail.innerHTML = Relances.vueJournee();
    }
    Acq.rendreListe(route.id);
    majOnglets();
    if (ancienHash !== dernierHash) window.scrollTo(0, 0);
  }

  function majOnglets() {
    document.querySelectorAll('[data-onglet]').forEach((o) => {
      const actif = o.dataset.onglet === route.ecran;
      o.classList.toggle('actif', actif);
      if (actif) o.setAttribute('aria-current', 'page'); else o.removeAttribute('aria-current');
    });
    const n = Relances.majBadge();
    const compteur = document.querySelector('[data-onglet="journee"] .compteur');
    compteur.textContent = n;
    compteur.hidden = !n;
  }

  async function action(nom, el) {
    const form = el.closest('form');
    switch (nom) {
      case 'note-rapide':
        Echanges.ouvrir({ rapide: true, id: route.id || '' });
        break;
      case 'message':
        Messages.ouvrir({ id: el.dataset.id, canal: el.dataset.canal });
        break;
      case 'retablir-modele':
        await Messages.retablir(el.dataset.modele);
        UI.toast('Texte d\'origine rétabli');
        rendre();
        break;
      case 'nouvel-echange':
        Echanges.ouvrir({ id: el.dataset.id, type: el.dataset.type });
        break;
      case 'modifier-echange':
        Echanges.ouvrir({ id: el.dataset.id, idEchange: el.dataset.echange });
        break;
      case 'fixer-relance':
        await Relances.fixerDans(el.dataset.id, +el.dataset.jours);
        rendre();
        break;
      case 'effacer-relance':
        await Relances.fixer(el.dataset.id, '');
        rendre();
        break;
      case 'deplier-historique':
        Echanges.basculerDepli(el.dataset.id);
        rendre();
        break;
      case 'ajouter-p2':
        form.querySelector('#bloc-p2').hidden = false;
        form.querySelector('#avec-p2').value = '1';
        el.hidden = true;
        form.querySelector('#p2-prenom').focus();
        break;
      case 'retirer-p2':
        form.querySelector('#bloc-p2').hidden = true;
        form.querySelector('#avec-p2').value = '0';
        form.querySelector('#ajouter-p2').hidden = false;
        break;
      case 'ajouter-commune':
        await Acq.ajouterCommuneDepuisFormulaire(form);
        break;
      case 'reglages-ajouter-commune': {
        const champ = document.getElementById('reglages-commune');
        const nom = await Acq.ajouterCommune(champ.value);
        if (nom) UI.toast(`${nom} ajoutée`);
        rendre();
        break;
      }
      case 'retirer-commune':
        await Acq.retirerCommune(el.dataset.commune);
        rendre();
        break;
      case 'charger-exemples':
        await Acq.chargerExemples();
        await Biens.chargerExemples();
        rendre();
        break;
      case 'installer':
        await Reglages.installer();
        rendre();
        break;
      case 'sauvegarder':
        await Sauvegarde.telecharger();
        rendre();
        break;
      case 'partager-sauvegarde':
        await Sauvegarde.partager();
        rendre();
        break;
      case 'agenda-ics':
        Agenda.icsAcquereur(el.dataset.id);
        break;
      case 'agenda-semaine':
        Agenda.icsSemaine();
        break;
      case 'filtre-biens':
        Biens.filtrer(el.dataset.filtreBien);
        rendre();
        break;
      case 'proposer-bien':
        Biens.proposer(el.dataset.id, el.dataset.bien);
        break;
      case 'marquer-propose':
        await Biens.marquerPropose(el.dataset.id, el.dataset.bien);
        UI.toast('Noté comme proposé');
        rendre();
        break;
      case 'annuler-proposition':
        await Biens.annulerProposition(el.dataset.id, el.dataset.bien);
        rendre();
        break;
      case 'retirer-photo':
        Biens.retirerPhoto();
        break;
      case 'effacer-criteres':
        Object.assign(Acq.filtre, { type: '', commune: '', budgetMin: null, budgetMax: null });
        ['critere-type', 'critere-commune', 'critere-budget-min', 'critere-budget-max'].forEach((i) => { document.getElementById(i).value = ''; });
        Acq.rendreListe(route.id);
        break;
      case 'supprimer-bien': {
        const bien = Biens.trouver(el.dataset.id);
        const ok = await UI.modale({ titre: `Supprimer le bien ${Biens.titre(bien)} ?`, texte: 'Cette action est définitive.', ok: 'Supprimer', danger: true });
        if (!ok) return;
        await Biens.supprimer(bien.id);
        UI.toast('Bien supprimé');
        aller('#/biens');
        break;
      }
      case 'supprimer-exemples': {
        const ok = await UI.modale({ titre: 'Supprimer les exemples ?', texte: 'Seuls les acquéreurs marqués « Exemple » seront supprimés. Vos vraies fiches ne sont pas touchées.', ok: 'Supprimer', danger: true });
        if (!ok) return;
        await Acq.supprimerExemples();
        await Biens.supprimerExemples();
        UI.toast('Exemples supprimés');
        rendre();
        break;
      }
      case 'supprimer': {
        const a = Acq.trouver(el.dataset.id);
        const ok = await UI.modale({ titre: `Supprimer la fiche de ${Acq.nomAffiche(a)} ?`, texte: 'Cette action est définitive.', ok: 'Supprimer', danger: true });
        if (!ok) return;
        await Acq.supprimer(a.id);
        UI.toast('Fiche supprimée');
        aller(retourHash);
        break;
      }
    }
  }

  function brancherEvenements() {
    window.addEventListener('hashchange', () => { Echanges.fermer(); rendre(); });
    // Au retour dans l'application (le lendemain, par exemple), « Ma journée » est recalculée.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ECRANS_RACINE.includes(route.ecran) && document.getElementById('feuille').hidden) rendre();
    });

    document.addEventListener('click', (e) => {
      const f = e.target.closest('[data-filtre]');
      if (f) {
        Acq.filtre.statut = f.dataset.filtre;
        Acq.rendreListe(route.id);
        return;
      }
      const el = e.target.closest('[data-action]');
      if (el) action(el.dataset.action, el);
      // Après Appeler / SMS / E-mail : la fenêtre pour noter l'échange attend au retour.
      const c = e.target.closest('[data-contact]');
      if (c) setTimeout(() => Echanges.ouvrir({ id: c.dataset.id, type: c.dataset.contact, focus: false }), 400);
    });

    document.addEventListener('input', (e) => {
      if (e.target.id === 'recherche-nom') {
        Acq.filtre.texte = e.target.value;
        Acq.rendreListe(route.id);
      }
      const criteres = { 'critere-type': 'type', 'critere-commune': 'commune', 'critere-budget-min': 'budgetMin', 'critere-budget-max': 'budgetMax' };
      if (criteres[e.target.id]) {
        const cle = criteres[e.target.id];
        Acq.filtre[cle] = cle.startsWith('budget') ? UI.lireNombre(e.target.value) : e.target.value;
        Acq.rendreListe(route.id);
      }
      const form = e.target.closest('#form-acq');
      if (form) Acq.majConditions(form);
    });

    // Montants : affichage avec espaces (250 000) en sortant du champ.
    document.addEventListener('focusout', (e) => {
      if (e.target.matches('[data-nombre]')) e.target.value = UI.nombre(UI.lireNombre(e.target.value));
    });

    document.addEventListener('change', async (e) => {
      if (e.target.id === 'relance-date') {
        await Relances.fixer(e.target.dataset.id, e.target.value);
        rendre();
      }
      if (e.target.id === 'relance-frequence') {
        await Relances.changerFrequence(e.target.dataset.id, +e.target.value);
        rendre();
      }
      if (e.target.id === 'statut-bien') {
        const bien = Biens.trouver(e.target.dataset.id);
        bien.statut = e.target.value;
        await Biens.enregistrer(bien);
        UI.toast(`Statut : ${libelle(STATUTS_BIEN, bien.statut)}`);
        rendre();
      }
      if (e.target.id === 'reglage-marge') {
        await Biens.changerMarge(+e.target.value);
        UI.toast('Marge enregistrée');
      }
      if (e.target.id === 'bien-photo') Biens.choisirPhoto(e.target);
      if (e.target.id === 'fichier-restauration' && (await Sauvegarde.restaurer(e.target))) {
        await Acq.charger();
        await Biens.charger();
        await Messages.charger();
        await Agenda.charger();
        document.getElementById('panneau-liste').innerHTML = Acq.panneauListe();
        rendre();
      }
      if (e.target.id === 'statut-rapide') {
        const ok = await Acq.changerStatut(e.target.dataset.id, e.target.value);
        rendre();
        if (ok === false) UI.toast('Statut inchangé');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'nouvelle-commune') {
        e.preventDefault();
        Acq.ajouterCommuneDepuisFormulaire(e.target.closest('form'));
      } else if (e.target.id === 'reglages-commune') {
        e.preventDefault();
        action('reglages-ajouter-commune', e.target);
      }
    });

    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'form-bien') {
        e.preventDefault();
        const bien = await Biens.soumettre(e.target);
        if (bien) aller(`#/b/${bien.id}`);
        return;
      }
      if (e.target.id !== 'form-acq') return;
      e.preventDefault();
      const a = await Acq.soumettre(e.target);
      if (a) aller(`#/a/${a.id}`);
    });
  }

  async function demarrer() {
    // Demande au navigateur de ne pas effacer les données de lui-même.
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* sans importance */ }

    await Acq.charger();
    await Messages.charger();
    await Biens.charger();
    await Agenda.charger();
    await Sauvegarde.charger();

    if (!(await DB.estPersistant())) {
      const b = document.getElementById('bandeau');
      b.textContent = 'Attention : ce navigateur n\'autorise pas l\'enregistrement. Les fiches seront perdues à la fermeture de la page.';
      b.hidden = false;
    }

    // Version de démonstration : on la remplit d'exemples au premier lancement.
    // Quand les exemples évoluent (nouvelle étape), on remplace les anciens exemples.
    const VERSION_DEMO = 4;
    if (window.DEMO_AUTO) {
      const deja = await DB.lire('reglages', 'demoInit');
      const version = deja ? (deja.valeur === true ? 1 : deja.valeur) : 0;
      if (version < VERSION_DEMO && (!Acq.liste().length || Acq.liste().some((a) => a.demo))) {
        await Acq.supprimerExemples();
        await Biens.supprimerExemples();
        await Acq.chargerExemples();
        await Biens.chargerExemples();
      }
      await DB.ecrire('reglages', { cle: 'demoInit', valeur: VERSION_DEMO });
    }

    panneauListe().innerHTML = Acq.panneauListe();
    brancherEvenements();
    rendre();

    // Fonctionnement hors connexion (seulement sur l'adresse en ligne, pas dans la démonstration).
    if ('serviceWorker' in navigator && !window.DEMO_AUTO && /^(https:|http:\/\/localhost)/.test(location.href)) {
      navigator.serviceWorker.register('service-worker.js').catch((e) => console.warn('Hors connexion indisponible', e));
    }
  }

  return { demarrer, rendre, retour: () => retourHash };
})();

App.demarrer();
