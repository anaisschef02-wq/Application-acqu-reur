// Rappels dans l'agenda (Outlook, Google Agenda ou fichier .ics) et récap du jour par e-mail.
// C'est l'agenda du téléphone ou de l'ordinateur qui envoie ensuite la notification.
const Agenda = (() => {
  const { esc } = UI;

  const AGENDAS = [
    { id: 'outlook-pro', label: 'Outlook professionnel (Microsoft 365)' },
    { id: 'outlook-perso', label: 'Outlook personnel (outlook.fr, hotmail…)' },
    { id: 'google', label: 'Google Agenda' },
    { id: 'ics', label: 'Autre agenda (fichier .ics)' },
  ];
  const DUREE = 15; // minutes
  const z = (n) => String(n).padStart(2, '0');

  let reglages = { agenda: 'outlook-pro', email: '', heure: '09:00' };

  async function charger() {
    const r = await DB.lire('reglages', 'agenda');
    if (r && r.valeur) reglages = { ...reglages, ...r.valeur };
  }

  async function regler(cle, valeur) {
    reglages[cle] = valeur;
    await DB.ecrire('reglages', { cle: 'agenda', valeur: reglages });
  }

  // ---------- Contenu d'un rappel ----------

  // Heure choisie dans les réglages ; une relance en retard (ou dont l'heure est passée)
  // est placée aujourd'hui, au prochain quart d'heure.
  function debut(date) {
    const [h, m] = (reglages.heure || '09:00').split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    const maintenant = new Date();
    if (d < maintenant) {
      d.setTime(maintenant.getTime());
      d.setSeconds(0, 0);
      d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15);
    }
    return d;
  }
  const heureLisible = (d) => `${d.getHours()} h ${z(d.getMinutes())}`;
  const fin = (d) => new Date(d.getTime() + DUREE * 60000);

  function evenement(a, p) {
    const tel = a.personnes.map((x) => x.telephone).filter(Boolean);
    const mails = a.personnes.map((x) => x.email).filter(Boolean);
    const recurrent = !p.fixee;
    const lignes = [
      `Relance acquéreur : ${Acq.nomAffiche(a)}`,
      Acq.resumeRecherche(a),
      tel.length ? `Tél. : ${tel.join(' / ')}` : '',
      mails.length ? `E-mail : ${mails.join(' / ')}` : '',
      Relances.texteDernier(a),
      recurrent ? `Rappel tous les ${Relances.frequence(a)} jours. Pensez à noter l'échange dans « Mes acquéreurs ».` : 'Pensez à noter l\'échange dans « Mes acquéreurs ».',
    ].filter(Boolean);
    const d = debut(p.date);
    return {
      uid: `relance-${a.id}@mes-acquereurs`,
      titre: `Relancer ${Acq.nomAffiche(a)}`,
      description: lignes.join('\n'),
      debut: d,
      fin: fin(d),
      intervalle: recurrent ? Relances.frequence(a) : 0,
    };
  }

  // ---------- Fichier .ics ----------

  const icsLocal = (d) => `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}T${z(d.getHours())}${z(d.getMinutes())}00`;
  const icsUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsTexte = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // Lignes de 75 caractères au plus, comme le veut le format.
  const plier = (ligne) => ligne.match(/.{1,60}/gu).join('\r\n ');

  function ics(evenements) {
    const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mes acquereurs//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    evenements.forEach((e) => {
      lignes.push(
        'BEGIN:VEVENT',
        `UID:${e.uid}`,
        `DTSTAMP:${icsUtc(new Date())}`,
        `DTSTART:${icsLocal(e.debut)}`,
        `DTEND:${icsLocal(e.fin)}`,
      );
      if (e.intervalle) lignes.push(`RRULE:FREQ=DAILY;INTERVAL=${e.intervalle}`);
      lignes.push(
        `SUMMARY:${icsTexte(e.titre)}`,
        `DESCRIPTION:${icsTexte(e.description)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsTexte(e.titre)}`, 'TRIGGER:-PT0M', 'END:VALARM',
        'END:VEVENT',
      );
    });
    lignes.push('END:VCALENDAR');
    return lignes.map(plier).join('\r\n') + '\r\n';
  }

  const nomFichier = (t) => UI.sansAccents(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'relance';

  function telecharger(contenu, nom) {
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/calendar;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `${nom}.ics`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- Liens directs Outlook / Google ----------

  // Date avec le décalage horaire, ex. 2026-09-29T09:00:00+02:00
  function isoAvecDecalage(d) {
    const dec = -d.getTimezoneOffset();
    const signe = dec >= 0 ? '+' : '-';
    const abs = Math.abs(dec);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:00${signe}${z(Math.floor(abs / 60))}:${z(abs % 60)}`;
  }

  function lienOutlook(e, domaine) {
    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: e.titre,
      body: e.description,
      startdt: isoAvecDecalage(e.debut),
      enddt: isoAvecDecalage(e.fin),
    });
    return `https://${domaine}/calendar/0/deeplink/compose?${params.toString()}`;
  }

  function lienGoogle(e) {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: e.titre,
      details: e.description,
      dates: `${icsLocal(e.debut)}/${icsLocal(e.fin)}`,
    });
    if (e.intervalle) params.set('recur', `RRULE:FREQ=DAILY;INTERVAL=${e.intervalle}`);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // ---------- Sur la fiche ----------

  function boutonsFiche(a, p) {
    const e = evenement(a, p);
    const quand = `${Relances.dateLongue(e.debut)} à ${heureLisible(e.debut)}`;
    const recur = e.intervalle ? `, puis tous les ${e.intervalle} jours` : '';
    let principal;
    if (reglages.agenda === 'outlook-pro' || reglages.agenda === 'outlook-perso') {
      const domaine = reglages.agenda === 'outlook-pro' ? 'outlook.office.com' : 'outlook.live.com';
      principal = `<a class="btn" href="${esc(lienOutlook(e, domaine))}" target="_blank" rel="noopener">${UI.icone('rdv', 20)}Ajouter à Outlook</a>`;
    } else if (reglages.agenda === 'google') {
      principal = `<a class="btn" href="${esc(lienGoogle(e))}" target="_blank" rel="noopener">${UI.icone('rdv', 20)}Ajouter à Google Agenda</a>`;
    } else {
      principal = `<button type="button" class="btn" data-action="agenda-ics" data-id="${a.id}">${UI.icone('rdv', 20)}Ajouter à mon agenda</button>`;
    }
    const secondaire = reglages.agenda === 'ics' ? '' : `<button type="button" class="lien" data-action="agenda-ics" data-id="${a.id}">ou télécharger le fichier agenda (.ics${e.intervalle ? ', répété' : ''})</button>`;
    return `
      <div class="agenda-fiche">
        <p class="discret">Rappel dans votre agenda le ${esc(quand)}${esc(recur && reglages.agenda !== 'outlook-pro' && reglages.agenda !== 'outlook-perso' ? recur : '')}.</p>
        <div class="agenda-boutons">${principal}${secondaire}</div>
      </div>`;
  }

  function icsAcquereur(id) {
    const a = Acq.trouver(id);
    const p = Relances.prochaine(a);
    if (!p) return;
    telecharger(ics([evenement(a, p)]), `relance-${nomFichier(Acq.nomAffiche(a))}`);
    UI.toast('Fichier agenda créé : ouvrez-le pour l\'ajouter');
  }

  function icsSemaine() {
    const { retard, auj, semaine } = Relances.groupes();
    // Les relances en retard sont placées aujourd'hui, sans répétition.
    const evts = [...retard, ...auj, ...semaine].map(({ a, p }) => {
      const e = evenement(a, { ...p, date: p.date < Relances.aujourdhui() ? Relances.aujourdhui() : p.date, fixee: true });
      return { ...e, uid: `relance-${a.id}-${icsLocal(e.debut)}@mes-acquereurs` };
    });
    if (!evts.length) { UI.toast('Aucune relance cette semaine'); return; }
    telecharger(ics(evts), `relances-${Relances.isoJour(new Date())}`);
    UI.toast(`${evts.length} relance${evts.length > 1 ? 's' : ''} dans le fichier agenda`);
  }

  // ---------- Récap du jour par e-mail ----------

  function recap() {
    const { retard, auj, semaine } = Relances.groupes();
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const bloc = (titre, items, avecDate = false) => {
      if (!items.length) return '';
      return `${titre.toUpperCase()} (${items.length})\n${items.map(({ a, p }) => {
        const tel = a.personnes.map((x) => x.telephone).find(Boolean);
        return [
          `• ${avecDate ? `${Relances.quand(p)} — ` : ''}${Acq.nomAffiche(a)}${tel ? ` — ${tel}` : ''}`,
          `  ${Acq.resumeRecherche(a)}`,
          `  ${Relances.texteDernier(a)}`,
        ].join('\n');
      }).join('\n')}\n`;
    };
    const corps = [
      `Mes relances du ${date}`,
      '',
      bloc('En retard', retard),
      bloc('Aujourd\'hui', auj),
      bloc('Cette semaine', semaine, true),
      !retard.length && !auj.length ? 'Aucune relance pour aujourd\'hui.\n' : '',
      '— Envoyé depuis « Mes acquéreurs »',
    ].filter((l) => l !== '').join('\n');
    return { sujet: `Mes relances du ${date}`, corps };
  }

  function lienRecap() {
    const { sujet, corps } = recap();
    return `mailto:${encodeURIComponent(reglages.email || '')}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  }

  function actionsJournee(nb) {
    return `
      <section class="bloc outils-journee">
        <h3>Rappels</h3>
        <div class="agenda-boutons">
          <a class="btn btn-secondaire" href="${esc(lienRecap())}">${UI.icone('email', 20)}M'envoyer le récap du jour</a>
          ${nb ? `<button type="button" class="btn btn-secondaire" data-action="agenda-semaine">${UI.icone('rdv', 20)}Relances de la semaine dans l'agenda</button>` : ''}
        </div>
        ${reglages.email ? `<p class="discret">Le récap part vers ${esc(reglages.email)}.</p>` : '<p class="discret">Indiquez votre adresse e-mail dans Réglages pour que le récap vous soit adressé directement.</p>'}
      </section>`;
  }

  // ---------- Réglages ----------

  function vueReglages() {
    const heures = [];
    for (let h = 7; h <= 19; h++) ['00', '30'].forEach((m) => heures.push(`${z(h)}:${m}`));
    return `
      <section class="bloc">
        <h3>Agenda et récap du jour</h3>
        <p class="discret">Les rappels de relance sont ajoutés à votre agenda, qui vous envoie la notification sur le téléphone.</p>
        ${UI.champ('Mon agenda', `<select id="reglage-agenda" class="champ-select">${AGENDAS.map((x) => `<option value="${x.id}" ${x.id === reglages.agenda ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`)}
        ${UI.champ('Heure des rappels', `<select id="reglage-heure" class="champ-select">${heures.map((h) => `<option value="${h}" ${h === reglages.heure ? 'selected' : ''}>${Number(h.slice(0, 2))} h ${h.slice(3)}</option>`).join('')}</select>`)}
        ${UI.champ('Mon adresse e-mail (pour le récap)', `<input id="reglage-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" value="${esc(reglages.email)}" placeholder="prenom.nom@…">`)}
      </section>`;
  }

  document.addEventListener('change', async (e) => {
    const cles = { 'reglage-agenda': 'agenda', 'reglage-heure': 'heure', 'reglage-email': 'email' };
    if (!cles[e.target.id]) return;
    await regler(cles[e.target.id], e.target.value.trim());
    UI.toast('Réglage enregistré');
  });

  return { charger, boutonsFiche, icsAcquereur, icsSemaine, actionsJournee, vueReglages, recap, ics, evenement };
})();
