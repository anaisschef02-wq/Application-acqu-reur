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
  function modale({ titre, texte = '', ok = 'Valider', danger = false, champ = null, annuler = true }) {
    const el = document.getElementById('modale');
    el.innerHTML = `
      <div class="modale-fond" data-modale="annuler"></div>
      <div class="modale-boite" role="dialog" aria-modal="true" aria-labelledby="modale-titre">
        <h3 id="modale-titre">${esc(titre)}</h3>
        ${texte ? `<p>${esc(texte)}</p>` : ''}
        ${champ ? `<label class="champ"><span>${esc(champ)}</span><textarea id="modale-champ" rows="3"></textarea></label>` : ''}
        <div class="modale-actions">
          ${annuler ? '<button type="button" class="btn btn-secondaire" data-modale="annuler">Annuler</button>' : ''}
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

  // Petites icônes (traits simples, couleur du texte).
  const TRACES = {
    appel: 'M6.5 3.5h3l1.5 4.5-2.2 1.4a11 11 0 0 0 5.8 5.8l1.4-2.2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z',
    sms: 'M4 5h16v11H10l-5 4v-4H4z',
    email: 'M3.5 6h17v12h-17zM3.5 7l8.5 6 8.5-6',
    visite: 'M4 11l8-7 8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5',
    rdv: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
    note: 'M5 19.5h4l10-10-4-4-10 10zM13.5 7l3.5 3.5',
    micro: 'M12 3.5a3 3 0 0 1 3 3V12a3 3 0 0 1-6 0V6.5a3 3 0 0 1 3-3zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5',
    fermer: 'M6 6l12 12M18 6L6 18',
  };
  const icone = (nom, taille = 20) => `<svg class="icone" viewBox="0 0 24 24" width="${taille}" height="${taille}" aria-hidden="true"><path d="${TRACES[nom] || ''}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // Date d'un échange, lisible : « aujourd'hui · 14:30 », « hier · 09:10 », « lun. 22 sept. · 14:30 ».
  function dateEchange(locale) {
    if (!locale) return '';
    const d = new Date(locale);
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const jour = new Date(d); jour.setHours(0, 0, 0, 0);
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const ecart = Math.round((auj - jour) / 86400000);
    if (ecart === 0) return `aujourd'hui · ${heure}`;
    if (ecart === 1) return `hier · ${heure}`;
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    if (d.getFullYear() !== auj.getFullYear()) options.year = 'numeric';
    return `${d.toLocaleDateString('fr-FR', options)} · ${heure}`;
  }

  const badgeStatut = (statut) => `<span class="statut" data-statut="${esc(statut)}"><i aria-hidden="true"></i>${esc(libelle(STATUTS, statut))}</span>`;

  return { esc, icone, dateEchange, sansAccents, nombre, euros, kEuros, lireNombre, date, toast, modale, champ, pastilles, pastille, badgeStatut };
})();
