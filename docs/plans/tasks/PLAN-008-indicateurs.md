# PLAN-008 — Un briefing descriptif, pas une note de productivité

**Statut : en cours (2026-10-21) · Priorité : P2 — Important.** Interprétation potentiellement trompeuse du volume ; pas de demande validée d'un modèle prédictif.

## 1. Problème et preuves

F08 : coefficients score arbitraires, semaines actives non consécutives, projection `dayAvg*7`, anomalies sans jours nuls (`2471–2537`). Formule expliquée sommairement (`769–770`) mais non validée par un résultat métier. F10 : membres/cartes regroupés par nom, pas identité. R4 montre prérequis différents des métriques Kanban.

## 2. Objectif

Chaque phrase du briefing doit être vérifiable à partir du sous-ensemble visible et de la période déclarée. Garder les outils utiles de Nexus, retirer ce qui exige une interprétation non démontrée.

## 3. Cible

- Supprimer score composite et anneau de l'UI, footer et textes marketing ; ne pas remplacer par autre note. `buildInsights` public garde son nom/signature ; son champ existant `score` vaut **null**, documenté comme non calculé, sans wrapper de compatibilité ou nouveau mode. Le selfTest ne doit plus exiger un score zéro et le test Nexus ne doit plus exiger une note numérique. Changement de valeur publique annoncé.
- Moyenne/jour = actions / nombre de **jours civils inclusifs** dans la période retenue : bornes filtres explicitement choisies si présentes, sinon jours de première/dernière action ; borner à l'intervalle de données observé pour ne pas prétendre observer avant/après. Un côté de borne manquant utilise la donnée observée correspondante. Au moins 1 jour si non vide. Label exact « sur N jours civils observés » ; vide : pas de ratio/équivalent prévu.
- Équivalent hebdomadaire = moyenne observée *7, libellé « équivalent hebdomadaire du rythme observé — pas une prévision ». Garder champ `forecast` public pour compatibilité de forme, mais documenter sa signification descriptive ; aucun modèle statistique ajouté.
- Comparer les **deux semaines closes consécutives** précédant la semaine de la dernière action visible, uniquement si leurs 14 jours sont entièrement dans la période observée/filtrée. Semaines commençant dimanche selon 007 ; semaine sans événement compte zéro. Sinon « comparaison indisponible : période insuffisante ». Afficher dates des deux semaines. Si précédent zéro : pas d'infini ni pourcentage, donner comptes absolus.
- Remplacer « jours atypiques / aucun pic statistique » par « jours les plus actifs » (top 3 counts datés, aucun test d'anomalie), et classifications « charge week-end / activité surtout opérationnelle » par parts descriptives sans inférence de charge ou nature du travail. Supprimer jour « calme » normalisé sans exposition.
- Signaler « Les actions ne mesurent ni effort, ni qualité, ni livraison ; membres et cartes regroupés par libellé dans cette version. » Le comparateur conserve les chiffres, pas une recommandation de gestion des personnes.

## 4. Décisions / alternative

KISS : soustraire les inférences fragiles plutôt qu'ajouter modèle, ML, calibrage ou options. Ne pas supprimer Nexus entier : recherche, commandes et comparaison servent des parcours existants. R4 démontre que cycle/lead time exigent transitions et listes métier, pas ces poids. « Ne rien changer + disclaimer » ne corrige pas comparaison non consécutive ; option rejetée comme cible.

## 5. Fichiers et impacts

`buildInsights`, `renderNexus`, `briefingPlain/copyBriefing/exportBriefing`, footer de renderDashboard, markup `nx-ring/nx-score/details` et styles **exclusivement utilisés** par score ; `renderStats/renderExtStats/buildReportModel` pour les moyennes ; `buildMarkdownReport`, **`buildXlsxWorkbook` qui appelle lui-même buildInsights/computeStats (`4110` environ)**, et autres exports via modèle ; légendes et manifeste si texte modifié. Ne pas supposer que buildReportModel est l'unique appelant des calculs de briefing.

Séries manquantes : `periodSeries`, `byPeriod`, `renderTimeline/renderTrends/renderTypeTimeline`, JSON weekly/monthly, `sparkBuckets/sparkHtml` à aligner sur même domaine civil. `byMemberPeriod` public reste objet sparse ; renderTrends doit choisir domaine calendaire complet depuis la liste visible, pas union uniquement active. Les compteurs source Maps restent sparse, pas des actions zéro synthétiques.

Tests Nexus et selfTest, fixtures semaines zéro/partielles, README formule/suppression score et limites identités. Appelants publics `buildInsights`, `computeStats`, constructeurs rapports, alias, mode HTML (SELF_SRC) concernés ; aucune dépendance/config.

## 6. Étapes

1. Fixtures fixes couvrant plusieurs semaines avec trou, semaine actuelle partielle, comparaison à zéro, dataset vide/1 action et filtre étroit ; vérifier texte/comptes exacts.
2. Réutiliser les clés civiles 007 ; compléter séries de périodes entre bornes min/max existantes avec zéro, en semaine et mois. Mettre la définition du domaine dans les helpers de périodes existants (pas un moteur de séries générique). Mettre à jour leurs appelants internes ; les fonctions publiques gardent leurs signatures.
3. Appliquer dénominateur civil inclusif de façon partagée aux valeurs affichées et modèles exportés, pas une formule distincte par format. Les durées horodatées source restent disponibles ; ne pas modifier les dates/actions pour corriger un ratio.
4. Calculer deux semaines closes couvertes et résultats explicites, retirer score/heuristiques non retenues et textes associés, conserver le reste de Nexus.
5. Aligner Markdown/briefing/plain/JSON si métriques présentes, mettre à jour tests et documentation de changements publics `score/forecast` et des valeurs hebdomadaires.
6. Vérifier rendu thémé, vide, snapshots 003 et suite ; pas de nouvelle fonctionnalité à la place de l'espace score retiré.

## 7. Dépendances

007 définit jours/semaines ; 003 impose même population aux exports. 009 attend séries/textes stabilisés. Pas d'entretien bloquant : décision conservatrice de ne pas interpréter le volume, pas tentative de deviner la productivité.

## 8. Contraintes / non-objectifs

Préserver filtres, comparateur, recherche, raccourcis, objectif local (libellé « actions de la vue cette semaine » à clarifier), thèmes et exports. **Ne pas** migrer identités, ajouter seuil personnalisable, score alternatif, prédiction, Kanban, télémétrie ou classement humain.

## 9. Cas limites

Deux semaines séparées par trou → trou zéro, pas saut ; moins de 14 jours couverts, filtre au milieu d'une semaine, précédente=0, noms identiques et membres inconnus explicitement limités. Ancien rapport exporté autonome reste avec ancienne logique : pas de mise à jour rétroactive.

## 10. Tests

Sommes séries complétées inchangées, semaines/mois manquants zéro et consécutifs, comparaisons uniquement sur couverture complète. UI/Markdown/briefing reflètent mêmes chiffres et aucune note composite. Test auto-test sous query issu de 006. Aucun wording « prédiction » ou jugement de performance dans sorties. `npm test` et téléchargement neuf formats + briefing.

## 11. Critères d'acceptation

Zéro score numérique affiché, score public null documenté ; 1 action sur 1 jour → 1/j, équivalent 7 actions/semaine descriptif ; vide → aucun équivalent chiffré ; comparaison à zéro absolue et jamais Infinity/NaN ; dates des périodes explicites ; pas de semaines omises dans timeline. Noms et limites métier visibles.

## 12. Terminé

Formules et libellés alignés sur contrat unique, fixtures vérifiables, retrait limité aux éléments inutiles du score, suite verte et changements annoncés. Aucun gain de productivité prétendument mesuré.

## 13. Sources

F07/F08/F10, [R4 et comparaison briefing](../02-recherche-et-options.md), vision C4, roadmap J4, PLAN-007/009.

## Exécution — 2026-10-21 · en cours

Prérequis 007 validé. Inventaire des séries, moyennes UI/modèle, briefing Markdown et XLSX et textes score effectué. Contrat : score null, observation civile bornée, semaines closes consécutives avec zéros ; aucune migration d’identités.

### Métadonnée d’observation nécessaire à la parité des rapports

003 réinitialise volontairement les filtres actifs du HTML. Une vue contenant
une seule action dans six jours explicitement observés passerait sinon de 1/6
à 1/j à l’ouverture. Ajout borné `observation:{fromMs,toMs}` au kind existant,
validé avant boot par les contrôles de 006 ; aucun événement exclu embarqué.
Les bornes sont des timestamps et les jours restent recalculés dans le fuseau
lecteur annoncé en 007. Le modèle fige son briefing pour que Markdown/XLSX ne
recalculent pas à partir d’une autre période après sa création.
