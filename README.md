# SVG Cleaner & Editor

Une application web moderne, puissante et intuitive pour le nettoyage, l'édition et la manipulation de fichiers SVG (Scalable Vector Graphics). Conçue pour offrir une expérience fluide, l'éditeur propose de nombreux outils d'édition visuelle pour modifier vos tracés complexes et assainir la structure de vos fichiers vectoriels.

## 🚀 Fonctionnalités principales

*   **Édition de Nœuds et Tracés (Paths) :** Manipulez les points de contrôle de vos courbes, ajoutez de nouveaux axes en double-cliquant sur les tracés et ajustez précisément les figures.
*   **Outils de Transformation Avancés :** Déplacez, mettez à l'échelle, appliquez des rotations et manipulez des symétries (horizontales/verticales) de manière interactive sur un ou plusieurs éléments simultanément. Les calculs se basent sur des projections absolues pour une précision maximale.
*   **Nettoyage Intelligent :** Importez des fichiers SVG pollués (notamment ceux issus de logiciels de design comme Illustrator ou Inkscape) pour retirer automatiquement les balises vides et les métadonnées inutiles.
*   **Alignement & Groupement :** Alignez parfaitement vos éléments (gauche, centre, droite, haut, milieu, bas). Créez des groupes (`<g>`) ou dégroupez facilement vos calques à la volée.
*   **Bibliothèque & Sauvegarde Locale :** Sauvegardez vos SVG dans la bibliothèque intégrée de votre navigateur. Retrouvez-les même après la fermeture de l'onglet, et profitez d'une interface de suppression sécurisée sans pop-ups système bloquants.
*   **Historique d'Édition (Undo/Redo) :** Un système d'historique robuste enregistre chaque modification dans l'arbre DOM interne, vous permettant d'annuler ou de rétablir vos actions de dessin sans crainte.
*   **Interface Responsive (Mobile-Friendly) :** Une organisation des outils optimisée pour toutes les tailles d'écrans. En mode mobile, l'espace se concentre sur le canevas ; les barres latérales deviennent des menus escamotables et la barre d'outils est dotée d'un défilement intelligent par flèches.
*   **Arbre des Calques :** Visualisez la hiérarchie complète de votre fichier sous forme d'arborescence à travers la barre latérale gauche.
*   **Glisser-Déposer & Mode Hors-Ligne :** Faites simplement glisser vos fichiers sur l'interface pour commencer et travaillez sans interruption.

## 🛠 Dépendances & Technologies

Ce projet est basé sur des technologies performantes garantissant une interface fluide :
*   **React 18** avec **TypeScript** pour la robustesse et les composants d'interface.
*   **Vite** environnement de build ultra-rapide.
*   **Tailwind CSS** (couplé à `clsx` & `tailwind-merge`) pour le stylisme direct, adapté au mode sombre et aux utilitaires d'interface.
*   **Lucide React** pour l'intégralité du pack d'icônes nettes et épurées.
*   **Système Custom de manipulation DOM :** Analyse et transformation du XML SVG en temps réel directement en mémoire afin d'offrir une fluidité parfaite à 60 FPS.

## 📦 Installation et Lancement Rapide

Vous aurez besoin de [Node.js](https://nodejs.org/) et de `yarn` (ou `npm`).

1. **Se positionner dans le dossier du projet**:
    ```bash
    cd svg-cleaner
    ```

2. **Installer les dépendances**:
    ```bash
    yarn install
    # ou
    npm install
    ```

3. **Démarrer le serveur de développement**:
    ```bash
    yarn dev
    # ou
    npm run dev
    ```

4. **Accéder à l'application**:
    Le site sera alors disponible sur `http://localhost:5173`. L'interface réagira instantanément à vos modifications de code grâce au HMR.

## ⚙️ Compilation pour la production

Pour préparer l'application à être déployée sur serveur (Netlify, Vercel, Nginx, etc.) :
```bash
yarn build
# ou
npm run build
```
Les fichiers statiques optimisés et minifiés se trouveront alors dans le dossier `./dist/` à la racine de votre projet.

---

*(Développé avec ❤️ pour simplifier le travail vectoriel des développeurs et designers)*
