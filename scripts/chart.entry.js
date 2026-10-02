/**
 * Point d'entrée du bundle Chart.js « sur mesure » livré dans vendor/chart.umd.js.
 *
 * Le site ne construit que trois types de graphiques (ligne, barres, anneau)
 * sur deux échelles (catégorie, linéaire). La distribution officielle
 * (dist/chart.umd.js) embarque l'intégralité des contrôleurs, échelles et
 * greffons : ~200 Ko chargés et analysés pour une fraction réellement utilisée.
 * On ne conserve que ce que `index.html` construit, ce qui allège la page ET
 * les rapports HTML autonomes (le bundle y est inliné en clair).
 *
 * Régénérer après un changement de types de graphiques ou de version :
 *   npm run build:vendor
 *
 * @see scripts/build-vendor.mjs
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';

Chart.register(
  // contrôleurs : ligne (timeline, tendances, types par période),
  // barres (membres, top cartes, heures), anneau (types, semaine/week-end)
  LineController,
  BarController,
  DoughnutController,
  // éléments dessinés par ces contrôleurs
  LineElement,
  PointElement,
  BarElement,
  ArcElement,
  // échelles : x = libellés de période (catégorie), y = compteurs (linéaire)
  CategoryScale,
  LinearScale,
  // greffons : aires remplies (`fill: true`), légende de l'anneau, infobulles
  Filler,
  Legend,
  Tooltip
);

// Le bundle est auto-suffisant (IIFE) : on expose le même global `Chart` que
// la distribution UMD officielle, y compris dans un rapport HTML inliné.
globalThis.Chart = Chart;
