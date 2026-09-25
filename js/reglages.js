// Page Réglages : communes du secteur et acquéreurs fictifs.
const Reglages = (() => {
  const { esc } = UI;

  // ---------- Installation sur l'écran d'accueil ----------
  let invitation = null; // proposition d'installation d'Android / Chrome / Edge
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invitation = e;
  });
  window.addEventListener('appinstalled', () => { invitation = null; });

  const installee = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const estIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);

  async function installer() {
    if (!invitation) return;
    invitation.prompt();
    const { outcome } = await invitation.userChoice;
    invitation = null;
    if (outcome === 'accepted') UI.toast('Application installée');
  }

  function vueInstallation() {
    if (window.DEMO_AUTO) return '';
    if (installee()) {
      return `
        <section class="bloc">
          <h3>Application</h3>
          <p class="discret">L'application est installée sur cet appareil et fonctionne sans connexion.</p>
        </section>`;
    }
    let etapes;
    if (invitation) {
      etapes = '<button type="button" class="btn" data-action="installer">Installer l\'application</button>';
    } else if (estIphone()) {
      etapes = `<ol class="etapes">
        <li>Ouvrez cette page dans <strong>Safari</strong>.</li>
        <li>Touchez le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).</li>
        <li>Choisissez <strong>« Sur l'écran d'accueil »</strong>, puis <strong>Ajouter</strong>.</li>
      </ol>`;
    } else {
      etapes = `<ol class="etapes">
        <li>Ouvrez cette page dans <strong>Chrome</strong> (téléphone Android) ou <strong>Edge / Chrome</strong> (ordinateur).</li>
        <li>Ouvrez le menu <strong>⋮</strong> (ou <strong>…</strong>).</li>
        <li>Choisissez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.</li>
      </ol>`;
    }
    return `
      <section class="bloc bloc-installation">
        <h3>Installer l'application</h3>
        <p class="discret">Installée, l'application s'ouvre depuis une icône, comme les autres, et fonctionne même sans réseau.</p>
        ${etapes}
        <p class="alerte-sauvegarde">Important : l'application installée et la page du navigateur ne partagent pas leurs fiches. Installez-la avant de saisir vos vrais acquéreurs.</p>
      </section>`;
  }

  function vue() {
    const nbExemples = Acq.liste().filter((a) => a.demo).length + Biens.liste().filter((b) => b.demo).length;
    const autres = Acq.communesSupplementaires();
    return `
      <article class="fiche">
        <a class="btn-retour" href="${App.retour()}">‹ Retour</a>
        <h2>Réglages</h2>

        ${vueInstallation()}

        ${Sauvegarde.vueReglages()}

        <section class="bloc">
          <h3>Communes proposées</h3>
          <p class="discret">Les communes du secteur sont toujours proposées. Ajoutez-en d'autres ici ou directement depuis une fiche.</p>
          <div class="pastilles fixes">
            ${COMMUNES_SECTEUR.map((c) => `<span class="chip-fixe">${esc(c)}</span>`).join('')}
            ${autres.map((c) => `<span class="chip-fixe">${esc(c)}<button type="button" class="retirer" data-action="retirer-commune" data-commune="${esc(c)}" aria-label="Retirer ${esc(c)}">×</button></span>`).join('')}
          </div>
          <div class="ajout-commune">
            <input id="reglages-commune" placeholder="Nouvelle commune…" autocomplete="off" autocapitalize="words" aria-label="Nouvelle commune">
            <button type="button" class="btn btn-secondaire" data-action="reglages-ajouter-commune">Ajouter</button>
          </div>
        </section>

        ${Messages.vueReglages()}

        ${Agenda.vueReglages()}

        ${Biens.vueReglages()}

        <section class="bloc">
          <h3>Acquéreurs fictifs</h3>
          <p class="discret">Des acquéreurs et des biens fictifs pour découvrir l'application sans toucher à vos vrais clients. Ils sont marqués « Exemple ».</p>
          <div class="vide-actions">
            <button type="button" class="btn btn-secondaire" data-action="charger-exemples">Ajouter des exemples</button>
            ${nbExemples ? `<button type="button" class="btn btn-danger" data-action="supprimer-exemples">Supprimer les ${nbExemples} exemples</button>` : ''}
          </div>
        </section>

        <section class="bloc">
          <h3>Vos données</h3>
          <p class="discret" id="etat-stockage">Toutes les fiches sont enregistrées uniquement sur cet appareil. Rien n'est envoyé sur Internet.</p>
        </section>
      </article>`;
  }

  return { vue, installer };
})();
