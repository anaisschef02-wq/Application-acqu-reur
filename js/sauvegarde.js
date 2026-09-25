// Sauvegarde et restauration : un fichier (JSON) contenant toutes les données,
// pour passer du téléphone à l'ordinateur et ne rien perdre si le téléphone est perdu.
const Sauvegarde = (() => {
  const { esc } = UI;
  const APP = 'mes-acquereurs';
  const FORMAT = 1;
  const RAPPEL_JOURS = 7;
  // Réglages propres à cet appareil, jamais copiés d'un appareil à l'autre.
  const REGLAGES_LOCAUX = ['demoInit', 'derniereSauvegarde'];

  let derniere = null; // date ISO de la dernière sauvegarde

  async function charger() {
    const r = await DB.lire('reglages', 'derniereSauvegarde');
    derniere = (r && r.valeur) || null;
  }

  const joursDepuis = () => (derniere ? Math.floor((Date.now() - new Date(derniere)) / 86400000) : null);
  const aRappeler = () => Acq.liste().length > 0 && (derniere === null || joursDepuis() >= RAPPEL_JOURS);

  async function noter() {
    derniere = new Date().toISOString();
    await DB.ecrire('reglages', { cle: 'derniereSauvegarde', valeur: derniere });
  }

  // ---------- Création du fichier ----------

  async function contenu() {
    const reglages = ((await DB.tout('reglages')) || []).filter((r) => !REGLAGES_LOCAUX.includes(r.cle));
    return {
      app: APP,
      format: FORMAT,
      creeLe: new Date().toISOString(),
      acquereurs: await DB.tout('acquereurs'),
      biens: await DB.tout('biens'),
      reglages,
    };
  }

  const nomFichier = () => `mes-acquereurs-sauvegarde-${Relances.isoJour(new Date())}.json`;

  async function fichier() {
    const texte = JSON.stringify(await contenu());
    return new File([texte], nomFichier(), { type: 'application/json' });
  }

  async function telecharger() {
    const f = await fichier();
    const url = URL.createObjectURL(f);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = f.name;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    await noter();
    UI.toast('Sauvegarde enregistrée dans vos téléchargements');
  }

  // Sur téléphone : envoyer le fichier par e-mail, OneDrive… via le menu de partage.
  const partagePossible = () => {
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] }));
    } catch (e) {
      return false;
    }
  };

  async function partager() {
    const f = await fichier();
    try {
      await navigator.share({ files: [f], title: 'Sauvegarde Mes acquéreurs' });
      await noter();
      UI.toast('Sauvegarde envoyée');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      UI.toast('Le partage n\'a pas fonctionné : utilisez « Sauvegarder mes données ».');
    }
  }

  // ---------- Restauration ----------

  function lireFichier(f) {
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => ko(r.error);
      r.readAsText(f);
    });
  }

  // Petite fenêtre à trois choix : fusionner, remplacer, annuler.
  function choisir(sauvegarde) {
    const el = document.getElementById('modale');
    const nbA = sauvegarde.acquereurs.length;
    const nbB = (sauvegarde.biens || []).length;
    el.innerHTML = `
      <div class="modale-fond" data-choix=""></div>
      <div class="modale-boite" role="dialog" aria-modal="true" aria-labelledby="modale-titre">
        <h3 id="modale-titre">Restaurer la sauvegarde du ${esc(UI.date(sauvegarde.creeLe))} ?</h3>
        <p>Elle contient ${nbA} acquéreur${nbA > 1 ? 's' : ''} et ${nbB} bien${nbB > 1 ? 's' : ''}. Cet appareil en contient ${Acq.liste().length} et ${Biens.liste().length}.</p>
        <div class="choix-restauration">
          <button type="button" class="btn" data-choix="fusion">Fusionner</button>
          <small>Ajoute ce qui manque et garde la version la plus récente de chaque fiche. Rien n'est effacé.</small>
          <button type="button" class="btn btn-danger" data-choix="remplacer">Tout remplacer</button>
          <small>Efface les données de cet appareil et les remplace par celles de la sauvegarde.</small>
          <button type="button" class="btn btn-secondaire" data-choix="">Annuler</button>
        </div>
      </div>`;
    el.hidden = false;
    el.querySelector('[data-choix="fusion"]').focus();
    return new Promise((resoudre) => {
      const clic = (e) => {
        const b = e.target.closest('[data-choix]');
        if (!b) return;
        el.removeEventListener('click', clic);
        el.hidden = true;
        el.innerHTML = '';
        resoudre(b.dataset.choix || null);
      };
      el.addEventListener('click', clic);
    });
  }

  async function fusionner(magasin, elements) {
    const actuels = new Map(((await DB.tout(magasin)) || []).map((x) => [x.id, x]));
    let n = 0;
    for (const x of elements) {
      const y = actuels.get(x.id);
      if (!y || (x.modifieLe || '') > (y.modifieLe || '')) { await DB.ecrire(magasin, x); n++; }
    }
    return n;
  }

  async function restaurer(input) {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return false;
    let s;
    try {
      s = JSON.parse(await lireFichier(f));
    } catch (e) {
      UI.toast('Ce fichier n\'est pas une sauvegarde lisible.');
      return false;
    }
    if (!s || s.app !== APP || !Array.isArray(s.acquereurs)) {
      UI.toast('Ce fichier n\'est pas une sauvegarde de « Mes acquéreurs ».');
      return false;
    }
    const choix = await choisir(s);
    if (!choix) return false;
    const reglages = (s.reglages || []).filter((r) => r && r.cle && !REGLAGES_LOCAUX.includes(r.cle));

    if (choix === 'remplacer') {
      await DB.vider('acquereurs');
      await DB.vider('biens');
      for (const a of s.acquereurs) await DB.ecrire('acquereurs', a);
      for (const b of s.biens || []) await DB.ecrire('biens', b);
      for (const r of reglages) await DB.ecrire('reglages', r);
      UI.toast('Données restaurées');
    } else {
      const n = (await fusionner('acquereurs', s.acquereurs)) + (await fusionner('biens', s.biens || []));
      // Réglages : on garde ceux de cet appareil, sauf les communes, qu'on réunit.
      const communes = reglages.find((r) => r.cle === 'communes');
      if (communes) {
        const ici = await DB.lire('reglages', 'communes');
        const union = [...new Set([...((ici && ici.valeur) || []), ...(communes.valeur || [])])];
        await DB.ecrire('reglages', { cle: 'communes', valeur: union });
      }
      UI.toast(n ? `${n} fiche${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} ou mise${n > 1 ? 's' : ''} à jour` : 'Tout était déjà à jour');
    }
    return true;
  }

  // ---------- Affichage ----------

  function etat() {
    if (!derniere) return 'Aucune sauvegarde pour l\'instant.';
    const j = joursDepuis();
    const quand = j === 0 ? 'aujourd\'hui' : j === 1 ? 'hier' : `il y a ${j} jours`;
    return `Dernière sauvegarde : ${quand} (${UI.date(derniere)}).`;
  }

  function vueReglages() {
    return `
      <section class="bloc bloc-sauvegarde" id="sauvegarde">
        <h3>Sauvegarde</h3>
        <p class="${aRappeler() ? 'alerte-sauvegarde' : 'discret'}">${esc(etat())}</p>
        <p class="discret">Vos données ne sont que sur cet appareil. Sauvegardez-les régulièrement : le fichier sert aussi à les copier sur l'ordinateur (ou l'inverse).</p>
        <div class="agenda-boutons">
          <button type="button" class="btn" data-action="sauvegarder">Sauvegarder mes données</button>
          ${partagePossible() ? '<button type="button" class="btn btn-secondaire" data-action="partager-sauvegarde">Envoyer la sauvegarde…</button>' : ''}
          <label class="btn btn-secondaire btn-fichier">
            <input id="fichier-restauration" type="file" accept=".json,application/json">
            Restaurer / importer une sauvegarde
          </label>
        </div>
      </section>`;
  }

  // Rappel discret sur « Ma journée ».
  function rappel() {
    if (!aRappeler()) return '';
    const texte = derniere ? `Pas de sauvegarde depuis ${joursDepuis()} jours.` : 'Vos données n\'ont encore jamais été sauvegardées.';
    return `
      <div class="rappel-sauvegarde" role="note">
        <span>${esc(texte)} Si le téléphone est perdu, elles seraient perdues aussi.</span>
        <button type="button" class="btn btn-secondaire" data-action="${partagePossible() ? 'partager-sauvegarde' : 'sauvegarder'}">Sauvegarder</button>
      </div>`;
  }

  return { charger, telecharger, partager, restaurer, vueReglages, rappel };
})();
