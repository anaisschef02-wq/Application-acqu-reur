// Navigation entre les écrans et gestion des clics.
const App = (() => {
  const panneauListe = () => document.getElementById('panneau-liste');
  const panneauDetail = () => document.getElementById('panneau-detail');
  let route = { ecran: 'liste' };

  function lireRoute() {
    const morceaux = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (morceaux[0] === 'nouveau') return { ecran: 'nouveau' };
    if (morceaux[0] === 'reglages') return { ecran: 'reglages' };
    if (morceaux[0] === 'a' && morceaux[1]) return { ecran: morceaux[2] === 'modifier' ? 'modifier' : 'fiche', id: morceaux[1] };
    return { ecran: 'liste' };
  }

  const aller = (hash) => {
    if (location.hash === hash) rendre();
    else location.hash = hash;
  };

  function rendre() {
    route = lireRoute();
    const detail = panneauDetail();
    let a = null;
    if (route.id) {
      a = Acq.trouver(route.id);
      if (!a) route = { ecran: 'liste' };
    }

    document.body.className = route.ecran === 'liste' ? 'vue-liste' : 'vue-detail';

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
      default:
        detail.innerHTML = `<div class="accueil-bureau"><p>Choisissez un acquéreur dans la liste, ou créez une nouvelle fiche.</p></div>`;
    }
    Acq.rendreListe(route.id);
    if (route.ecran !== 'liste') window.scrollTo(0, 0);
  }

  async function action(nom, el) {
    const form = el.closest('form');
    switch (nom) {
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
        rendre();
        break;
      case 'supprimer-exemples': {
        const ok = await UI.modale({ titre: 'Supprimer les exemples ?', texte: 'Seuls les acquéreurs marqués « Exemple » seront supprimés. Vos vraies fiches ne sont pas touchées.', ok: 'Supprimer', danger: true });
        if (!ok) return;
        await Acq.supprimerExemples();
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
        aller('#/');
        break;
      }
    }
  }

  function brancherEvenements() {
    window.addEventListener('hashchange', rendre);

    document.addEventListener('click', (e) => {
      const f = e.target.closest('[data-filtre]');
      if (f) {
        Acq.filtre.statut = f.dataset.filtre;
        Acq.rendreListe(route.id);
        return;
      }
      const el = e.target.closest('[data-action]');
      if (el) action(el.dataset.action, el);
    });

    document.addEventListener('input', (e) => {
      if (e.target.id === 'recherche-nom') {
        Acq.filtre.texte = e.target.value;
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

    if (!(await DB.estPersistant())) {
      const b = document.getElementById('bandeau');
      b.textContent = 'Attention : ce navigateur n\'autorise pas l\'enregistrement. Les fiches seront perdues à la fermeture de la page.';
      b.hidden = false;
    }

    // Version de démonstration : on la remplit d'exemples au premier lancement.
    if (window.DEMO_AUTO && !Acq.liste().length) {
      const deja = await DB.lire('reglages', 'demoInit');
      if (!deja) {
        await Acq.chargerExemples();
        await DB.ecrire('reglages', { cle: 'demoInit', valeur: true });
      }
    }

    panneauListe().innerHTML = Acq.panneauListe();
    brancherEvenements();
    rendre();
  }

  return { demarrer };
})();

App.demarrer();
