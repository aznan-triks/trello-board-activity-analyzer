# PLAN-009 — Lire toutes les données sans canvas ni survol

**Statut : validé localement (2026-10-21) · Priorité : P2 — Important.** Les noms accessibles actuels ne donnent pas toutes les valeurs ; accès essentiel, mais ne doit pas dupliquer des séries encore erronées.

## 1. Problème / preuves

F09 : `chart:1974–2001` attribue rôle img et aria-label (à préserver) ; canvas markup `806–862`, heatmap `2993–3026` en div avec tooltip. Tableau membres `3158–3190` ne fournit pas séries timeline/types/heures/cartes/heatmap. R5 explique la responsabilité d'alternative canvas ; axe existant sans violation ne suffit pas à prouver l'accès aux valeurs.

## 2. Objectif

L'utilisateur non voyant ou sans dispositif de survol peut obtenir les mêmes nombres et périodes que les graphiques, via du HTML natif utilisable au clavier et sans réseau dans les rapports.

## 3. Cible minimale

Conserver graphiques. Ajouter un `<details><summary>Voir les données de …</summary><table>…` dans chaque carte informative ; caption explicite, th scope, texte échappé. Même données/domaine que le dataset construit : pas de seconde agrégation analytique. Pour membres, le tableau détaillé existant constitue l'équivalent : lien explicite vers sa section plutôt que doublon si ses lignes couvrent toutes celles du graphe.

Équivalents requis : timeline, types, tendances top membres (colonnes séries et périodes), top cartes, heures, types par période, semaine/weekend ; heatmap table 7×24 avec nombres et part de l'heure selon métrique. Les canvas restent nommés ; ajouter `aria-describedby` vers la solution textuelle quand approprié. Pas de 168 focus individuels ni rôle grid interactif.

Le factory `chart` connaît déjà labels/datasets et sert 8 usages stables : un rendu tabulaire simple depuis ces données est acceptable si plus petit que sept chemins copiés, mais sans couche d'adapters ou options futures. Prévoir libellés complets pour les noms tronqués (members/topcards) ; pour heatmap réutiliser `heatMatrix(st)` et son dénominateur heure, pas les couleurs CSS.

## 4. Décisions / alternative

HTML natif plutôt que nouvelle bibliothèque accessibilité ou SVG pilotable. R5 ne garantit pas que nom+role donne toutes les données : c'est le besoin local de valeurs exactes qui justifie tables. Prose seule insuffisante pour série ; remplacement complet Chart.js disproportionné et casse export images.

## 5. Périmètre et points d'impact

- Markup cartes et sections `806–862`, tableau membres et ancres ; chart factory, `renderHeatmap/heatMatrix`, rendu des titres de datasets non renseignés (ex. timeline), `memberFullLabels` et top cartes full names.
- Rendus complets/filtres `renderDashboard/applyFilterRerender`, granularité `setGran`, métrique `setHeatMetric`, thème/resize ; pas de valeurs alternatives obsolètes après re-render.
- Export autonome SELF_MARKUP capturé avant rendu, puis SELF_SRC remplit ; inclure les conteneurs dans markup initial. HTML statique `buildHtmlStatic/heatHtml` doit offrir mêmes données textuelles ; PDF/PNG ont leurs limites de documents visuels, ne pas annoncer équivalence accessible de ces formats dans ce lot. ZIP doit inclure rapport HTML utilisable.
- Tests app existants axe/responsive/clavier/exports ; fixture labels hostiles/longs/vides. README accès aux données. Pas de config/dépendance ; signatures publiques chart/model inchangées.
- Risques : poids DOM sur séries longues, débordement mobile, état ouvert des details perdu lors du rendu, répétition d'annonces. Recréer contenu table plutôt que details entier pour préserver état/focus.

## 6. Étapes

1. Tests ciblés des équivalents : valeurs timeline, chaque série tendance, cellule heatmap et part ; lien graphique membres vers tableau complet ; aucun chiffre seulement dans tooltip.
2. Ajouter details/table natifs dans les conteneurs de markup, colonnes/headers adaptés et scroll horizontal local sur petit écran sans débordement page. Pas de redesign.
3. Alimenter avec les mêmes arrays stables que charts ; texte via textContent ou `esc`. Les tables restent utilisables si Chart échoue mais le modèle est disponible ; ne pas dépendre d'une instance Chart réussie pour exposer les nombres.
4. Synchroniser filtrage, granularité, métrique et vide ; conserver focus et ouverture d'un details pendant rendu. Réutiliser table membres quand équivalente, sans extraction générale des vues.
5. Ajouter équivalents au HTML statique ; tester HTML autonome sans réseau et réexport. Conserver les alternatives lors de l'impression HTML si l'utilisateur les ouvre ; éviter huit tables ouvertes par défaut dans PDF visuel.
6. Vérifier clavier, axe clair/sombre, largeurs existantes ; si lecteur d'écran disponible, audit de lecture caption/colonnes et consigner outil/version ; sinon consigner limite.

## 7. Dépendances

Après 008/007 pour ne pas exposer une logique de calendrier/score obsolète ; 003 pour rapport de portée sûre. Comparer d'abord données actuelles, pas ajouter métrique pour remplir une table.

## 8. Contraintes / non-objectifs

Conserver rôles/noms canvas existants, inert/focus des dialogues, animations réduites, skins, 8 charts et exports. Pas de navigation ARIA grille, chart SVG, sonification, refonte des dialogues, traduction ni déclaration de conformité WCAG complète.

## 9. Cas limites

Vide avec message et headers, une série, 0 dans semaine complétée, centaines de périodes, noms longs/homonymes limite déclarée, faux HTML/script, heure sans action en mode part, chart absent, resize mobile, filtre pendant details focalisé. Pas de division par zéro ou « undefined » dans caption.

## 10. Tests / vérifications

Tests DOM de chaque équivalent comparé aux données source ; Tab vers summary/Enter/Space/lecture table, valeur des headers et lien de retour ; compte d'actions inchangé. Axe clair/sombre et responsive 360/390/768/1440 existants. HTML exporté rouvert sans réseau, filtres/granularité modifient également tables ; forcer repli statique et vérifier tableaux. `npm test` complet.

## 11. Critères d'acceptation

Huit graphiques ont table dédiée ou lien vers table complète pertinente, heatmap 168 cellules numériques lisibles plus headers ; valeurs exactement égales aux séries/cellules et recalculées après filtre ; pas de nouveau débordement page, focus perdu ou violation axe. Rapport HTML offre ces valeurs hors ligne ; limites PDF/PNG et tests manuels non faits restent explicites.

## 12. Terminé

Accès clavier démontré, tests valeurs/rapports et baseline verts, aucune double logique statistique ; résultats réels documentés. Ne pas assimiler « axe passe » à une certification.

## 13. Sources

F09/F12, [R5 et comparaison accessibilité](../02-recherche-et-options.md), vision C5, roadmap J5, PLAN-003/007/008.

## Exécution — 2026-10-21 · en cours

Prérequis 008 validé. Factory chart, tableaux membres, heatmap, captures SELF_MARKUP et HTML statique relus. Tables natives depuis datasets et helpers existants, pas de bibliothèque ni grille interactive.

### Preuve complémentaire de portée

Avant correction, les cinq tests du lot échouent. Celui des tendances prouve un
nom exclu conservé dans `charts.trends.data.datasets` après filtrage ; le suivi
PLAN-003 est corrigé avant poursuite. La sélection top-membres sera recalculée
avec les compteurs de la vue, et partagée avec le modèle du rapport statique.

## Exécution — 2026-10-21 · validé localement

Implémentation 638ff9e, poussée. Cinq régressions rouges avant correction ; 12/12 ciblés finaux (18,7 s), suites complètes 103/103 (1,6 min puis 1,7 min), Chromium alternatif 153. Commande LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test. Vérifiés : sept tables égales aux datasets avant constructeur Chart, noms complets échappés, lien membres complet/retour avec focus, 168 cellules et parts horaires sans division par zéro, Enter/Space/Tab et scroll clavier local, ouverture/focus préservés, filtres/granularité/vide/thème/resize, périodes zéro et séries multiples. HTML autonome offline avec filtres/granularité, réexport et ZIP ; repli statique sans images, parité live/statique et mode part. Axe tables ouvertes clair/sombre sans règle désactivée, tailles 360/390/768/1440 sans débordement de page. La sélection des tendances est recalculée depuis la vue : complément PLAN-003 consigné. Ni dépendance/config/vendor modifié, ni nouvelle API publique, ni stockage ajouté. Aucun lecteur d’écran disponible/vérifié, aucune certification ; PDF/PNG restent visuels. Aucun prochain plan 001–009 : les neuf lots sont implémentés. PLAN-004 conserve sa réserve de vérification manuelle tableur ; pas de publication ni CI revendiquée.

### Détails de réalisation et limites

- Conteneurs présents dès le markup initial (capture `SELF_MARKUP`), summary et
  wrapper de défilement jamais remplacés : seules les tables sont régénérées.
  Rôle/nom canvas conservés ; description vers le résumé ou lien pertinent.
- Le factory consomme le nom complet des cartes avant de transmettre le config à
  Chart.js. Les autres noms de séries sont déjà complets ; le tableau membres
  existant couvre toutes les lignes du graphique et dispose d’une caption.
- Le modèle ajoute `heatMetric`, `trends` et `typeTimeline`, construits avec les
  mêmes helpers de périodes et compteurs que les graphiques. Le repli statique
  ne capture pas un cache mutable de Chart et conserve ses tables sans image.
  Aucune formule d’agrégation parallèle ni couche générique d’adapters.
- Mise au point des tests : les deux premières dates choisies tombaient toutes
  deux un mardi (une cellule de volume 2) ; la fixture finale répartit les deux
  actions mardi/mercredi à la même heure pour prouver 50 % chacune. Appels de
  test corrigés vers l’API réelle `exportZip` et le bouton de métrique (fonction
  `setHeatMetric` privée), sans ajouter d’API pour faciliter les tests.
- Tests locaux uniquement ; pas de mesure de performance représentative sur
  très longues séries, de Firefox/Safari, de lecteur d’écran ou de validation
  manuelle des impressions. Les details fermés par défaut n’alourdissent pas
  visuellement le rapport ; leur contenu reste dans le DOM. Aucun format
  PDF/PNG balisé accessible n’est promis.
