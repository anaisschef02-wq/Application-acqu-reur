// Listes de choix utilisées dans toute l'application.
const STATUTS = [
  { id: 'nouveau', label: 'Nouveau' },
  { id: 'active', label: 'Recherche active' },
  { id: 'visites', label: 'Visites en cours' },
  { id: 'offre', label: 'Offre faite' },
  { id: 'compromis', label: 'Compromis signé' },
  { id: 'achete', label: 'Acheté' },
  { id: 'pause', label: 'En pause' },
  { id: 'abandonne', label: 'Abandonné' },
];
// Statuts « terminés » : masqués par défaut dans la liste.
const STATUTS_CLOS = ['achete', 'abandonne'];

const TYPES_BIEN = [
  { id: 'maison', label: 'Maison' },
  { id: 'appartement', label: 'Appartement' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'immeuble', label: 'Immeuble de rapport' },
  { id: 'autre', label: 'Autre' },
];

const OPTIONS_BIEN = [
  { id: 'garage', label: 'Garage' },
  { id: 'plainpied', label: 'Plain-pied' },
  { id: 'jardin', label: 'Jardin' },
  { id: 'balcon', label: 'Balcon / terrasse' },
  { id: 'dependance', label: 'Dépendance' },
];

const TRAVAUX = [
  { id: 'aucun', label: 'Aucun' },
  { id: 'rafraichissement', label: 'Rafraîchissement accepté' },
  { id: 'gros', label: 'Gros travaux acceptés' },
];

const DELAIS = [
  { id: 'urgent', label: 'Urgent' },
  { id: '6mois', label: 'Dans les 6 mois' },
  { id: 'paspresse', label: 'Pas pressé' },
];

const DEMARCHES = [
  { id: 'rien', label: 'Pas encore fait' },
  { id: 'rdv', label: 'Rendez-vous prévu' },
  { id: 'accord', label: 'Accord de principe obtenu' },
  { id: 'courtier', label: 'Passe par un courtier' },
  { id: 'comptant', label: 'Achat comptant' },
];

const STATUTS_BIEN = [
  { id: 'disponible', label: 'Disponible' },
  { id: 'offre', label: 'Sous offre' },
  { id: 'vendu', label: 'Vendu' },
];

const TYPES_ECHANGE = [
  { id: 'appel', label: 'Appel' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'E-mail' },
  { id: 'visite', label: 'Visite' },
  { id: 'rdv', label: 'Rendez-vous' },
  { id: 'note', label: 'Note' },
];

const AVIS_VISITE = [
  { id: 'aime', label: 'A aimé' },
  { id: 'mitige', label: 'Mitigé' },
  { id: 'pasaime', label: 'N\'a pas aimé' },
];

const COMMUNES_SECTEUR = [
  'Waldighofen', 'Illtal', 'Ruederbach', 'Hirtzbach',
  'Aspach', 'Roppentzwiller', 'Durmenach', 'Bettendorf',
];

const libelle = (liste, id) => (liste.find((x) => x.id === id) || {}).label || '';

// Acquéreurs fictifs pour la démonstration (marqués « demo »).
function acquereursExemples() {
  const ilYa = (jours) => new Date(Date.now() - jours * 86400000).toISOString();
  // Date « locale » d'un échange (format des champs date + heure).
  const le = (jours, heure) => {
    const d = new Date(Date.now() - jours * 86400000);
    const [h, m] = heure.split(':');
    d.setHours(+h, +m, 0, 0);
    return dateLocale(d);
  };
  const ech = (jours, heure, type, texte, visite = {}) => ({ id: nouvelId(), date: le(jours, heure), type, texte, bien: visite.bien || '', avis: visite.avis || '' });
  const base = (o) => ({
    id: nouvelId(),
    demo: true,
    adresse: '',
    raisonAbandon: '',
    echanges: [],
    modifieLe: o.creeLe,
    ...o,
  });
  return [
    base({
      creeLe: ilYa(3),
      statut: 'nouveau',
      relanceFixee: dateLocale().slice(0, 10),
      personnes: [
        { prenom: 'Julie', nom: 'Exemple-Meyer', telephone: '06 00 00 00 01', email: 'julie.exemple@example.com' },
        { prenom: 'Thomas', nom: 'Exemple-Meyer', telephone: '06 00 00 00 02', email: '' },
      ],
      adresse: '12 rue des Tilleuls, 68130 Altkirch',
      recherche: {
        types: ['maison'], budgetMin: 220000, budgetMax: 280000, surfaceMin: 110, chambresMin: 3, terrainMin: 500,
        options: ['garage', 'jardin'], travaux: 'rafraichissement', communes: ['Waldighofen', 'Illtal'],
        delai: '6mois', important: 'Deux enfants en bas âge : proche de l\'école, jardin clos. Lui travaille à Bâle.',
      },
      echanges: [
        ech(3, '10:15', 'appel', 'Premier appel suite à l\'annonce de la maison de Waldighofen. Très motivés, accord bancaire déjà obtenu.'),
        ech(2, '18:40', 'email', 'Envoi de 3 biens correspondant à leur recherche.'),
      ],
      financement: { demarche: 'accord', banque: 'Crédit Mutuel Waldighofen', accordMontant: 260000, accordDate: '2026-09-10', apport: 30000, bienAVendre: 'non', venteEtat: '' },
    }),
    base({
      creeLe: ilYa(21),
      statut: 'visites',
      personnes: [{ prenom: 'Marc', nom: 'Exemple-Schmitt', telephone: '06 00 00 00 03', email: 'marc.exemple@example.com' }],
      recherche: {
        types: ['maison'], budgetMin: null, budgetMax: 200000, surfaceMin: 90, chambresMin: 2, terrainMin: null,
        options: ['plainpied', 'garage'], travaux: 'aucun', communes: ['Durmenach', 'Roppentzwiller', 'Bettendorf'],
        delai: 'urgent', important: 'Retraité, veut absolument du plain-pied. Pas d\'escalier.',
      },
      echanges: [
        ech(20, '09:30', 'rdv', 'Rendez-vous à l\'agence pour faire le point sur son projet.'),
        ech(12, '14:00', 'visite', 'Maison lumineuse mais trop d\'escaliers pour lui.', { bien: 'Maison de ville, Durmenach', avis: 'pasaime' }),
        ech(5, '11:00', 'visite', 'Plain-pied comme il le souhaite. Il veut revenir avec sa fille samedi.', { bien: 'Plain-pied 4 pièces, Roppentzwiller', avis: 'aime' }),
        ech(4, '17:20', 'sms', 'Contre-visite confirmée samedi 10 h.'),
      ],
      financement: { demarche: 'comptant', banque: '', accordMontant: null, accordDate: '', apport: 200000, bienAVendre: 'oui', venteEtat: 'Appartement à Mulhouse sous compromis, signature prévue fin octobre.' },
    }),
    base({
      creeLe: ilYa(45),
      statut: 'active',
      personnes: [{ prenom: 'Sophie', nom: 'Exemple-Weber', telephone: '06 00 00 00 04', email: 'sophie.exemple@example.com' }],
      recherche: {
        types: ['appartement'], budgetMin: 120000, budgetMax: 160000, surfaceMin: 65, chambresMin: 2, terrainMin: null,
        options: ['balcon', 'garage'], travaux: 'aucun', communes: ['Waldighofen'],
        delai: '6mois', important: 'Premier achat. Veut un balcon et une place de parking.',
      },
      echanges: [
        ech(44, '12:10', 'appel', 'Premier contact. Cherche un premier appartement.'),
        ech(30, '16:45', 'visite', 'Bien placé mais le balcon est trop petit.', { bien: 'Appartement T3, Waldighofen centre', avis: 'mitige' }),
        ech(16, '09:05', 'note', 'Rendez-vous chez le courtier prévu début octobre.'),
      ],
      financement: { demarche: 'courtier', banque: 'Courtier Sundgau Finance', accordMontant: null, accordDate: '', apport: 15000, bienAVendre: 'non', venteEtat: '' },
    }),
    base({
      creeLe: ilYa(60),
      statut: 'offre',
      frequenceRelance: 7,
      personnes: [
        { prenom: 'Karim', nom: 'Exemple-Haas', telephone: '06 00 00 00 05', email: 'karim.exemple@example.com' },
        { prenom: 'Léa', nom: 'Exemple-Fuchs', telephone: '06 00 00 00 06', email: 'lea.exemple@example.com' },
      ],
      recherche: {
        types: ['maison', 'terrain'], budgetMin: 250000, budgetMax: 350000, surfaceMin: 130, chambresMin: 4, terrainMin: 800,
        options: ['jardin', 'dependance'], travaux: 'gros', communes: ['Hirtzbach', 'Aspach', 'Illtal'],
        delai: 'paspresse', important: 'Aiment l\'ancien. Dépendance pour l\'atelier de Karim.',
      },
      echanges: [
        ech(58, '10:00', 'visite', 'Coup de cœur pour la grange.', { bien: 'Corps de ferme avec grange, Hirtzbach', avis: 'aime' }),
        ech(9, '15:30', 'rdv', 'Offre rédigée à 305 000 €, transmise au vendeur.'),
        ech(6, '11:45', 'appel', 'Le vendeur réfléchit, réponse attendue cette semaine.'),
      ],
      financement: { demarche: 'accord', banque: 'Banque Populaire', accordMontant: 320000, accordDate: '2026-08-02', apport: 50000, bienAVendre: 'non', venteEtat: '' },
    }),
    base({
      creeLe: ilYa(90),
      statut: 'pause',
      personnes: [{ prenom: 'Nathalie', nom: 'Exemple-Koenig', telephone: '06 00 00 00 07', email: '' }],
      recherche: {
        types: ['terrain'], budgetMin: null, budgetMax: 90000, surfaceMin: null, chambresMin: null, terrainMin: 600,
        options: [], travaux: '', communes: ['Ruederbach', 'Waldighofen'],
        delai: 'paspresse', important: 'Projet de construction. Reprend contact après sa mutation.',
      },
      echanges: [
        ech(85, '08:50', 'appel', 'Met sa recherche en pause en attendant sa mutation. Rappeler en janvier.'),
      ],
      financement: { demarche: 'rien', banque: '', accordMontant: null, accordDate: '', apport: null, bienAVendre: 'non', venteEtat: '' },
    }),
    base({
      creeLe: ilYa(140),
      statut: 'achete',
      personnes: [{ prenom: 'Paul', nom: 'Exemple-Muller', telephone: '06 00 00 00 08', email: 'paul.exemple@example.com' }],
      recherche: {
        types: ['immeuble'], budgetMin: 300000, budgetMax: 450000, surfaceMin: null, chambresMin: null, terrainMin: null,
        options: ['garage'], travaux: 'rafraichissement', communes: ['Waldighofen', 'Durmenach'],
        delai: '6mois', important: 'Investisseur, cherche un rendement d\'au moins 6 %.',
      },
      echanges: [
        ech(130, '10:30', 'visite', 'Rendement intéressant, 4 logements loués.', { bien: 'Immeuble 4 lots, Waldighofen', avis: 'aime' }),
        ech(100, '14:00', 'rdv', 'Signature du compromis.'),
        ech(10, '10:00', 'rdv', 'Signature de l\'acte chez le notaire.'),
      ],
      financement: { demarche: 'accord', banque: 'Caisse d\'Épargne', accordMontant: 400000, accordDate: '2026-05-15', apport: 80000, bienAVendre: 'non', venteEtat: '' },
    }),
  ];
}

// Biens fictifs pour la démonstration.
function biensExemples() {
  const ilYa = (jours) => new Date(Date.now() - jours * 86400000).toISOString();
  const base = (o) => ({ id: nouvelId(), demo: true, lien: '', photo: '', notes: '', modifieLe: o.creeLe, ...o });
  return [
    base({ creeLe: ilYa(1), reference: 'EX-2041', type: 'maison', commune: 'Illtal', prix: 245000, surface: 125, chambres: 4, terrain: 650, options: ['garage', 'jardin'], statut: 'disponible', lien: 'https://www.example.com/annonce-ex-2041' }),
    base({ creeLe: ilYa(4), reference: 'EX-2055', type: 'appartement', commune: 'Waldighofen', prix: 149000, surface: 72, chambres: 2, terrain: null, options: ['balcon', 'garage'], statut: 'disponible' }),
    base({ creeLe: ilYa(8), reference: 'EX-2060', type: 'maison', commune: 'Roppentzwiller', prix: 209000, surface: 95, chambres: 2, terrain: 400, options: ['plainpied', 'garage', 'jardin'], statut: 'disponible' }),
    base({ creeLe: ilYa(30), reference: 'EX-1987', type: 'terrain', commune: 'Ruederbach', prix: 78000, surface: null, chambres: null, terrain: 700, options: [], statut: 'offre' }),
  ];
}

// Date + heure locales au format des champs « datetime-local » (2026-09-25T14:30).
function dateLocale(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

function nouvelId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
