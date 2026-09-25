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
5. ✅ Biens et rapprochement automatique
6. ✅ Rappels via l'agenda (Outlook, Google, .ics) + récap du jour par e-mail
7. ✅ Sauvegarde / restauration des données
8. Exports Excel / PDF et statistiques
9. Application installable (hors connexion) ✅ — mise en ligne : en attente

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
- `js/biens.js` : les biens et le rapprochement avec les acquéreurs
- `js/agenda.js` : les rappels dans l'agenda et le récap du jour
- `js/sauvegarde.js` : la sauvegarde et la restauration des données
- `js/reglages.js` : la page Réglages
- `js/app.js` : la navigation entre les écrans
- `manifest.webmanifest`, `icones/` : ce qui rend l'application installable
- `service-worker.js` : le fonctionnement hors connexion (à chaque mise à jour, changer `VERSION` dans ce fichier)
- `outils/construire-demo.mjs` : fabrique une version de démonstration en un seul fichier

## Adresse de l'application

https://anaisschef02-wq.github.io/Application-acqu-reur/

L'adresse ne contient que le code de l'application : les fiches restent sur chaque appareil.

## Installer sur le téléphone

- **iPhone** : ouvrir l'adresse dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
- **Android** : ouvrir l'adresse dans **Chrome** → menu **⋮** → **Installer l'application**.
- **Ordinateur** : ouvrir l'adresse dans **Edge** ou **Chrome** → icône d'installation dans la barre d'adresse (ou menu → **Installer**).

Attention : l'application installée et la page ouverte dans le navigateur ne partagent pas leurs fiches. Installez d'abord, puis saisissez vos acquéreurs dans l'application installée.

Pour passer les fiches du téléphone à l'ordinateur : Réglages → **Sauvegarder mes données** (ou **Envoyer la sauvegarde…**) sur le téléphone, puis Réglages → **Restaurer / importer une sauvegarde** sur l'ordinateur.
