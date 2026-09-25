// Stockage local (IndexedDB) : les données restent sur l'appareil.
// Si IndexedDB est indisponible (navigation privée…), on garde les données
// en mémoire le temps de la session et l'application le signale.
const DB = (() => {
  const NOM = 'suivi-acquereurs';
  const VERSION = 2;
  const MAGASINS = { acquereurs: 'id', biens: 'id', reglages: 'cle' };
  let ouverture = null;
  let memoire = null;

  function ouvrir() {
    if (!ouverture) {
      ouverture = new Promise((resoudre, rejeter) => {
        let req;
        try {
          req = indexedDB.open(NOM, VERSION);
        } catch (e) {
          rejeter(e);
          return;
        }
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const [nom, cle] of Object.entries(MAGASINS)) {
            if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, { keyPath: cle });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          // Une nouvelle version de l'application ouverte dans un autre onglet peut mettre la base à jour.
          db.onversionchange = () => db.close();
          resoudre(db);
        };
        req.onerror = () => rejeter(req.error);
        // Mise à jour en attente : un autre onglet garde l'ancienne version ouverte.
        req.onblocked = () => console.warn('Mise à jour de la base en attente : fermez les autres onglets de l\'application.');
      }).catch((e) => {
        console.warn('IndexedDB indisponible, stockage en mémoire', e);
        memoire = Object.fromEntries(Object.keys(MAGASINS).map((m) => [m, new Map()]));
        return null;
      });
    }
    return ouverture;
  }

  async function transaction(magasin, mode, action) {
    const db = await ouvrir();
    if (!db) return action(null);
    return new Promise((resoudre, rejeter) => {
      const t = db.transaction(magasin, mode);
      const resultat = action(t.objectStore(magasin));
      t.oncomplete = () => resoudre(resultat instanceof IDBRequest ? resultat.result : resultat);
      t.onerror = () => rejeter(t.error);
      t.onabort = () => rejeter(t.error);
    });
  }

  const cle = (magasin, objet) => objet[MAGASINS[magasin]];

  return {
    async tout(magasin) {
      const r = await transaction(magasin, 'readonly', (s) => (s ? s.getAll() : null));
      return memoire ? [...memoire[magasin].values()].map((o) => structuredClone(o)) : r;
    },
    async lire(magasin, id) {
      const r = await transaction(magasin, 'readonly', (s) => (s ? s.get(id) : null));
      return memoire ? structuredClone(memoire[magasin].get(id)) : r;
    },
    async ecrire(magasin, objet) {
      await transaction(magasin, 'readwrite', (s) => {
        if (s) s.put(objet);
        else memoire[magasin].set(cle(magasin, objet), structuredClone(objet));
      });
      return objet;
    },
    async supprimer(magasin, id) {
      await transaction(magasin, 'readwrite', (s) => {
        if (s) s.delete(id);
        else memoire[magasin].delete(id);
      });
    },
    async vider(magasin) {
      await transaction(magasin, 'readwrite', (s) => {
        if (s) s.clear();
        else memoire[magasin].clear();
      });
    },
    async estPersistant() {
      await ouvrir();
      return !memoire;
    },
  };
})();
