# PLAN-009 — Lire toutes les données sans canvas ni survol

**Statut : dépendant d'un autre plan — PLAN-008 · Priorité : P2 — Important.** Les noms accessibles actuels ne donnent pas toutes les valeurs ; accès essentiel, mais ne doit pas dupliquer des séries encore erronées.

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
