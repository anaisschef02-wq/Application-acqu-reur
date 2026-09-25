// Page Réglages : communes du secteur et acquéreurs fictifs.
const Reglages = (() => {
  const { esc } = UI;

  function vue() {
    const nbExemples = Acq.liste().filter((a) => a.demo).length;
    const autres = Acq.communesSupplementaires();
    return `
      <article class="fiche">
        <a class="btn-retour" href="${App.retour()}">‹ Retour</a>
        <h2>Réglages</h2>

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

        <section class="bloc">
          <h3>Acquéreurs fictifs</h3>
          <p class="discret">Pour découvrir l'application sans toucher à vos vrais clients. Ils sont marqués « Exemple » dans la liste.</p>
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

  return { vue };
})();
