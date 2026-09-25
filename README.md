# Mes acquéreurs

Application de suivi des acquéreurs pour Anaïs Scheffel (Maya Immo, Waldighofen).

- Fonctionne dans le navigateur, sur téléphone et sur ordinateur.
- **Les données restent sur l'appareil** (stockage du navigateur). Rien n'est envoyé sur Internet.
- Aucun compte, aucun mot de passe, aucun serveur.

## Avancement

1. ✅ Fiche acquéreur : création, modification, liste, recherche par nom, stockage local
2. ✅ Historique des échanges + dictée vocale + note rapide
3. ✅ Relances et écran « Ma journée »
4. ✅ Modèles de messages
5. Biens et rapprochement automatique
6. Rappels via l'agenda + récap du jour par e-mail
7. Sauvegarde / restauration des données
8. Exports Excel / PDF et statistiques
9. Application installable (hors connexion) et mise en ligne

## Organisation des fichiers

- `index.html` : la page de l'application
- `css/style.css` : l'apparence (couleurs, mode sombre, téléphone / ordinateur)
- `js/db.js` : l'enregistrement des données sur l'appareil
- `js/donnees.js` : les listes de choix (statuts, types de bien, communes…) et les acquéreurs fictifs
- `js/acquereurs.js` : la liste, la fiche et le formulaire
- `js/echanges.js` : l'historique des échanges et la note rapide
- `js/dictee.js` : la dictée vocale
- `js/relances.js` : le calcul des relances et l'écran « Ma journée »
- `js/messages.js` : les modèles de messages (SMS / e-mail)
- `js/reglages.js` : la page Réglages
- `js/app.js` : la navigation entre les écrans
- `outils/construire-demo.mjs` : fabrique une version de démonstration en un seul fichier
