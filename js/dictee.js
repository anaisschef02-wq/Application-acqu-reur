// Dictée vocale : reconnaissance vocale du navigateur, en français.
// Si elle n'est pas disponible (certains iPhone), on indique d'utiliser
// le micro du clavier, qui fonctionne dans toutes les zones de texte.
const Dictee = (() => {
  const { esc } = UI;
  const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
  const disponible = !!Reconnaissance;
  let enCours = null; // { reco, bouton, zone }

  // Zone de texte avec son bouton micro.
  function champ(label, id, valeur = '', { lignes = 4, name = id } = {}) {
    return `
      <div class="champ champ-dictee">
        <div class="champ-dictee-tete">
          <label for="${id}">${esc(label)}</label>
          <button type="button" class="btn-micro" data-dictee="${id}" aria-pressed="false">
            ${UI.icone('micro', 18)}<span>Dicter</span>
          </button>
        </div>
        <textarea id="${id}" name="${name}" rows="${lignes}">${esc(valeur)}</textarea>
        ${disponible ? '' : '<small>Astuce : touchez la zone de texte puis le micro de votre clavier pour dicter.</small>'}
      </div>`;
  }

  function ajouter(base, texte) {
    texte = texte.trim();
    if (!texte) return base;
    const debutPhrase = !base.trim() || /[.!?]\s*$/.test(base);
    if (debutPhrase) texte = texte.charAt(0).toUpperCase() + texte.slice(1);
    const separateur = !base || /\s$/.test(base) ? '' : ' ';
    return base + separateur + texte;
  }

  // Assemble les morceaux reconnus. Sur Android, un morceau reprend parfois
  // le précédent en entier : on ne garde alors que le plus long.
  function assembler(resultats) {
    const morceaux = [];
    for (const r of resultats) {
      const t = r[0].transcript.trim();
      if (!t) continue;
      const prec = morceaux[morceaux.length - 1];
      if (prec && t.toLowerCase().startsWith(prec.toLowerCase())) morceaux[morceaux.length - 1] = t;
      else morceaux.push(t);
    }
    return morceaux.join(' ');
  }

  function indisponible(message) {
    return UI.modale({
      titre: 'Dictée indisponible ici',
      texte: message || 'Ce navigateur ne propose pas la dictée intégrée. Touchez la zone de texte, puis le micro de votre clavier : cela fonctionne aussi.',
      ok: 'Compris',
      annuler: false,
    });
  }

  function marquer(bouton, actif) {
    bouton.classList.toggle('ecoute', actif);
    bouton.setAttribute('aria-pressed', String(actif));
    bouton.querySelector('span').textContent = actif ? 'J\'écoute… Arrêter' : 'Dicter';
  }

  function arreter() {
    if (!enCours) return;
    const { reco, bouton } = enCours;
    enCours = null;
    marquer(bouton, false);
    try { reco.stop(); } catch (e) { /* déjà arrêtée */ }
  }

  function basculer(bouton) {
    if (enCours && enCours.bouton === bouton) { arreter(); return; }
    arreter();
    if (!disponible) { indisponible(); return; }

    const zone = document.getElementById(bouton.dataset.dictee);
    const base = zone.value;
    const reco = new Reconnaissance();
    reco.lang = 'fr-FR';
    reco.continuous = true;
    reco.interimResults = true;

    reco.onresult = (e) => {
      zone.value = ajouter(base, assembler(e.results));
      zone.dispatchEvent(new Event('input', { bubbles: true }));
    };
    reco.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        indisponible('Le micro n\'est pas autorisé pour cette page. Autorisez le micro dans les réglages du navigateur, ou utilisez le micro de votre clavier.');
      } else if (e.error === 'no-speech') {
        UI.toast('Je n\'ai rien entendu. Touchez « Dicter » pour réessayer.');
      } else if (e.error === 'network') {
        UI.toast('La dictée a besoin d\'Internet. Utilisez le micro du clavier.');
      }
      if (enCours && enCours.reco === reco) arreter();
    };
    reco.onend = () => { if (enCours && enCours.reco === reco) arreter(); };

    try {
      reco.start();
    } catch (e) {
      indisponible();
      return;
    }
    enCours = { reco, bouton, zone };
    marquer(bouton, true);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dictee]');
    if (b) basculer(b);
  });

  return { champ, arreter, disponible };
})();
