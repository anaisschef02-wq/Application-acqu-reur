// Historique des échanges (appel, SMS, e-mail, visite, rendez-vous, note)
// et « Note rapide » depuis l'écran d'accueil.
const Echanges = (() => {
  const { esc } = UI;
  const APERCU = 4; // nombre d'échanges affichés avant « Voir tout »
  const deplies = new Set();

  const tries = (a) => (a.echanges || []).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''));

  // ---------- Sur la fiche ----------

  function blocFiche(a) {
    const liste = tries(a);
    const tout = deplies.has(a.id);
    const visibles = tout ? liste : liste.slice(0, APERCU);
    return `
      <section class="bloc bloc-historique">
        <h3>Historique</h3>
        <div class="ajout-echange" role="group" aria-label="Ajouter un échange">
          ${TYPES_ECHANGE.map((t) => `
            <button type="button" class="btn-echange" data-action="nouvel-echange" data-id="${a.id}" data-type="${t.id}">
              ${UI.icone(t.id, 22)}<span>${esc(t.label)}</span>
            </button>`).join('')}
        </div>
        ${liste.length ? `
          <ol class="chronologie">${visibles.map((e) => ligne(a, e)).join('')}</ol>
          ${liste.length > APERCU ? `<button type="button" class="lien" data-action="deplier-historique" data-id="${a.id}">${tout ? 'Afficher moins' : `Voir les ${liste.length} échanges`}</button>` : ''}
        ` : '<p class="discret">Aucun échange pour l\'instant. Touchez un bouton ci-dessus pour noter un appel, une visite…</p>'}
      </section>`;
  }

  function ligne(a, e) {
    const avis = e.type === 'visite' && e.avis ? `<span class="avis" data-avis="${esc(e.avis)}">${esc(libelle(AVIS_VISITE, e.avis))}</span>` : '';
    return `
      <li>
        <button type="button" class="echange" data-action="modifier-echange" data-id="${a.id}" data-echange="${e.id}">
          <span class="echange-icone" data-type="${esc(e.type)}">${UI.icone(e.type, 18)}</span>
          <span class="echange-corps">
            <span class="echange-tete">
              <strong>${esc(libelle(TYPES_ECHANGE, e.type))}</strong>
              <time datetime="${esc(e.date)}">${esc(UI.dateEchange(e.date))}</time>
            </span>
            ${e.type === 'visite' && (e.bien || avis) ? `<span class="echange-bien">${esc(e.bien)} ${avis}</span>` : ''}
            ${e.texte ? `<span class="echange-texte">${esc(e.texte)}</span>` : ''}
          </span>
        </button>
      </li>`;
  }

  function basculerDepli(id) {
    if (deplies.has(id)) deplies.delete(id); else deplies.add(id);
  }

  // ---------- Fenêtre de saisie ----------

  function selectAcquereur(idChoisi) {
    const nom = (a) => Acq.nomAffiche(a);
    const tri = (x, y) => nom(x).localeCompare(nom(y), 'fr');
    const actifs = Acq.liste().filter((a) => !STATUTS_CLOS.includes(a.statut)).sort(tri);
    const clos = Acq.liste().filter((a) => STATUTS_CLOS.includes(a.statut)).sort(tri);
    const option = (a) => `<option value="${a.id}" ${a.id === idChoisi ? 'selected' : ''}>${esc(nom(a))}</option>`;
    return `
      <label class="champ">
        <span>Acquéreur</span>
        <select id="echange-acquereur" name="acquereur" class="champ-select" required>
          <option value="" ${idChoisi ? '' : 'selected'} disabled>Choisir l'acquéreur…</option>
          ${actifs.map(option).join('')}
          ${clos.length ? `<optgroup label="Achetés / abandonnés">${clos.map(option).join('')}</optgroup>` : ''}
        </select>
      </label>`;
  }

  // options : { id, type, idEchange, rapide }
  function ouvrir({ id = '', type = 'note', idEchange = null, rapide = false, focus = true } = {}) {
    const a = id ? Acq.trouver(id) : null;
    const existant = a && idEchange ? (a.echanges || []).find((e) => e.id === idEchange) : null;
    const e = existant || { type, date: dateLocale(), texte: '', bien: '', avis: '' };
    const titre = existant ? 'Modifier l\'échange' : rapide ? 'Note rapide' : `Nouvel échange · ${Acq.nomAffiche(a)}`;

    const el = document.getElementById('feuille');
    el.innerHTML = `
      <div class="feuille-fond" data-feuille="fermer"></div>
      <form class="feuille-boite" id="form-echange" data-id="${a ? a.id : ''}" data-echange="${existant ? existant.id : ''}" novalidate>
        <div class="feuille-tete">
          <h3>${esc(titre)}</h3>
          <button type="button" class="btn-icone" data-feuille="fermer" aria-label="Fermer">${UI.icone('fermer', 22)}</button>
        </div>
        ${rapide ? selectAcquereur(id) : ''}
        ${UI.pastilles('type', TYPES_ECHANGE, e.type, { unique: true, legende: 'Type d\'échange' })}
        <label class="champ">
          <span>Date et heure</span>
          <input id="echange-date" name="date" type="datetime-local" value="${esc(e.date)}">
        </label>
        <div class="visite-champs" data-si="type:visite">
          ${UI.champ('Bien visité', `<input id="echange-bien" name="bien" autocomplete="off" placeholder="Ex. : maison 5 pièces, Illtal" value="${esc(e.bien)}">`)}
          ${UI.pastilles('avis', AVIS_VISITE, e.avis, { unique: true, legende: 'Avis de l\'acquéreur' })}
        </div>
        ${Dictee.champ(e.type === 'visite' ? 'Compte rendu' : 'Notes', 'echange-texte', e.texte, { name: 'texte', lignes: 5 })}
        <div class="feuille-actions">
          ${existant ? '<button type="button" class="lien-danger" data-feuille="supprimer">Supprimer</button>' : ''}
          <button type="button" class="btn btn-secondaire" data-feuille="fermer">Annuler</button>
          <button type="submit" class="btn">Enregistrer</button>
        </div>
      </form>`;
    el.hidden = false;
    document.body.classList.add('feuille-ouverte');
    const form = el.querySelector('form');
    Acq.majConditions(form);
    if (focus && !rapide && !existant) form.querySelector('#echange-texte').focus();
  }

  function fermer() {
    Dictee.arreter();
    const el = document.getElementById('feuille');
    el.hidden = true;
    el.innerHTML = '';
    document.body.classList.remove('feuille-ouverte');
  }

  async function enregistrer(form) {
    const d = new FormData(form);
    const id = form.dataset.id || d.get('acquereur');
    const a = id && Acq.trouver(id);
    if (!a) {
      UI.toast('Choisissez d\'abord l\'acquéreur.');
      form.querySelector('#echange-acquereur').focus();
      return;
    }
    const type = d.get('type') || 'note';
    const echange = {
      id: form.dataset.echange || nouvelId(),
      type,
      date: d.get('date') || dateLocale(),
      texte: String(d.get('texte') || '').trim(),
      bien: type === 'visite' ? String(d.get('bien') || '').trim() : '',
      avis: type === 'visite' ? d.get('avis') || '' : '',
    };
    a.echanges = (a.echanges || []).filter((x) => x.id !== echange.id);
    a.echanges.push(echange);
    Relances.apresEchange(a);
    await Acq.enregistrer(a);
    fermer();
    UI.toast(form.dataset.id ? 'Échange enregistré' : `Note ajoutée à la fiche de ${Acq.nomAffiche(a)}`);
    App.rendre();
  }

  async function supprimer(form) {
    const ok = await UI.modale({ titre: 'Supprimer cet échange ?', texte: 'Il sera retiré de l\'historique.', ok: 'Supprimer', danger: true });
    if (!ok) return;
    const a = Acq.trouver(form.dataset.id);
    a.echanges = (a.echanges || []).filter((x) => x.id !== form.dataset.echange);
    await Acq.enregistrer(a);
    fermer();
    UI.toast('Échange supprimé');
    App.rendre();
  }

  // Écouteurs propres à la fenêtre de saisie.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-feuille]');
    if (!b) return;
    if (b.dataset.feuille === 'fermer') fermer();
    if (b.dataset.feuille === 'supprimer') supprimer(b.closest('form'));
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'form-echange') return;
    e.preventDefault();
    enregistrer(e.target);
  });
  document.addEventListener('input', (e) => {
    const form = e.target.closest('#form-echange');
    if (!form) return;
    Acq.majConditions(form);
    if (e.target.name === 'type') {
      form.querySelector('label[for="echange-texte"]').textContent = e.target.value === 'visite' ? 'Compte rendu' : 'Notes';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('feuille').hidden && document.getElementById('modale').hidden) fermer();
  });

  return { blocFiche, basculerDepli, ouvrir, fermer, tries };
})();
