// Petits outils d'affichage partagés.
const UI = (() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const nombre = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('fr-FR'));
  const euros = (n) => (n == null || n === '' ? '' : nombre(n) + ' €');
  const kEuros = (n) => {
    if (n == null || n === '') return '';
    return n >= 1000 ? nombre(Math.round(n / 1000)) + ' k€' : nombre(n) + ' €';
  };
  const lireNombre = (v) => {
    const chiffres = String(v ?? '').replace(/[^\d]/g, '');
    return chiffres ? parseInt(chiffres, 10) : null;
  };
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.minuteur);
    toast.minuteur = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // Fenêtre de confirmation intégrée à la page (pas de confirm() du navigateur).
  function modale({ titre, texte = '', ok = 'Valider', danger = false, champ = null }) {
    const el = document.getElementById('modale');
    el.innerHTML = `
      <div class="modale-fond" data-modale="annuler"></div>
      <div class="modale-boite" role="dialog" aria-modal="true" aria-labelledby="modale-titre">
        <h3 id="modale-titre">${esc(titre)}</h3>
        ${texte ? `<p>${esc(texte)}</p>` : ''}
        ${champ ? `<label class="champ"><span>${esc(champ)}</span><textarea id="modale-champ" rows="3"></textarea></label>` : ''}
        <div class="modale-actions">
          <button type="button" class="btn btn-secondaire" data-modale="annuler">Annuler</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : ''}" data-modale="ok">${esc(ok)}</button>
        </div>
      </div>`;
    el.hidden = false;
    const zone = el.querySelector('#modale-champ');
    (zone || el.querySelector('[data-modale="ok"]')).focus();
    return new Promise((resoudre) => {
      const fermer = (valeur) => {
        el.hidden = true;
        el.innerHTML = '';
        el.removeEventListener('click', clic);
        document.removeEventListener('keydown', touche);
        resoudre(valeur);
      };
      const clic = (e) => {
        const a = e.target.closest('[data-modale]');
        if (!a) return;
        if (a.dataset.modale === 'ok') fermer(zone ? zone.value.trim() : true);
        else fermer(zone ? null : false);
      };
      const touche = (e) => { if (e.key === 'Escape') fermer(zone ? null : false); };
      el.addEventListener('click', clic);
      document.addEventListener('keydown', touche);
    });
  }

  // Champs de formulaire.
  const champ = (label, controle, aide = '') => `
    <label class="champ"><span>${esc(label)}</span>${controle}${aide ? `<small>${esc(aide)}</small>` : ''}</label>`;

  // Groupe de pastilles cliquables (cases à cocher ou choix unique).
  function pastilles(nom, liste, valeurs, { unique = false, legende = '', id = '' } = {}) {
    const choisis = Array.isArray(valeurs) ? valeurs : [valeurs];
    const type = unique ? 'radio' : 'checkbox';
    return `
      <fieldset class="groupe">
        ${legende ? `<legend>${esc(legende)}</legend>` : ''}
        <div class="pastilles" ${id ? `id="${id}"` : ''}>
          ${liste.map((o) => pastille(nom, o.id, o.label, choisis.includes(o.id), type)).join('')}
        </div>
      </fieldset>`;
  }
  const pastille = (nom, valeur, label, coche, type = 'checkbox') => `
    <label class="chip"><input type="${type}" name="${nom}" value="${esc(valeur)}" ${coche ? 'checked' : ''}><span>${esc(label)}</span></label>`;

  const badgeStatut = (statut) => `<span class="statut" data-statut="${esc(statut)}"><i aria-hidden="true"></i>${esc(libelle(STATUTS, statut))}</span>`;

  return { esc, sansAccents, nombre, euros, kEuros, lireNombre, date, toast, modale, champ, pastilles, pastille, badgeStatut };
})();
