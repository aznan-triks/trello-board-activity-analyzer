# PLAN-007 — Un calendrier local cohérent pour tous les compteurs

**Statut : dépendant d'un autre plan — PLAN-003 et PLAN-006 · Priorité : P2 — Important.** Mélange UTC/local démontré, mais sans perte de la source ; correction après le jalon de confiance.

## 1. Problème / preuves

F07 : jour UTC dans dayKeyMs et ordinaux (`1285–1297`, `1857–1862`), heures/weekend locaux, semaine dimanche locale sérialisée UTC (`1239–1247`). Europe/Paris, `2026-09-21T22:30Z` → clé lundi alors qu'heure mardi 00h30. `memberProfile` utilise aussi ordinaux UTC (`2603–2620`).

## 2. Objectif

Une action appartient au même jour civil dans jours actifs, streak, briefing, heures, weekend et filtres. Déclarer le fuseau et la convention de semaine, pas ajouter un sélecteur.

## 3. Cible

C4 : fuseau local appareil, dimanche début de semaine conservé. Clé jour `AAAA-MM-JJ` par getFullYear/getMonth/getDate ; clé semaine = dimanche local **formaté localement**, pas toISOString().slice. Mois local inchangé. Ordinal civil = `Date.UTC(année,mois,jour)/864e5` à partir des composantes **locales** : permet différence de jours malgré DST ; pas `Math.floor(ms/864e5)`.

Les clés date seule ne doivent plus être relues par `new Date('AAAA-MM-JJ')` (interprétation UTC) pour affichage local : construire date locale par composantes. Timestamps des actions restent ISO UTC. Moyennes fondées sur durée écoulée gardées comme telles jusqu'à 008 ; ne pas faire passer un ordinal civil pour des heures écoulées.

## 4. Décisions / alternative

JS Date/Intl standard suffisent ; réutiliser periodKey/periodKeyMs/dayKeyMs et caches. Les helpers calendaires communs sont justifiés par stats, comparateur et briefing. Pas de Luxon/Temporal polyfill ni config timezone. Alternative tout UTC plus reproductible entre postes, mais changerait sens de la heatmap et des inputs locaux : non retenu. Déclarer limite de recalcul interpostes selon C4 ; ne pas implémenter un fuseau source partiel/incorrect.

## 5. Points d'impact et appelants exhaustifs

- Utils : periodKey/periodKeyMs, week/month/day caches, dayKeyMs, fmtDate et affichage des clés ; `computeStats`, `longestStreak`, `byPeriod`, `byMemberPeriod`, `groupPeriodCounts`.
- Consommateurs dates : `buildInsights/renderNexus`, `renderHeader/renderStats`, `renderTimeline/renderTrends/renderTypeTimeline`, `renderExtStats`, `memberProfile/renderCompare`, `sparkBuckets`, `currentWeekCount/renderGoal`, `setTimeWindow`, `parseFilterDate/msToLocalInput`.
- Modèle/export : buildReportModel (peakDay/range), buildAnalysisJson timeline, embeddedPayload/provenance + bootEmbedded, buildMarkdownReport, PDF/PNG/HTML statique via modèle, ZIP manifeste et briefingPlain. Rechercher tous les `new Date(...day/key...)` et `864e5` et qualifier leur rôle, pas remplacement aveugle.
- API publique : byPeriod/byMemberPeriod/computeStats/heatMatrix/setTimeWindow, mêmes signatures ; **valeurs de clés de semaine changent intentionnellement hors UTC**, documenter pour consommateurs JSON.
- Tests app : contextes timezoneId séparés et dates fixes ; pas de fixtures changées selon la machine. README convention, métadonnée timezone d'export autorisée par 006. Vendor/CI pas touchés.

## 6. Étapes

1. Ajouter fixtures minuit local, dimanche, fin de mois/année, DST printemps/automne dans Europe/Paris et America/New_York, témoin UTC.
2. Corriger les clés jour/semaine et ordinal civil à la source commune ; adapter caches aux mêmes clés/conventions sans croissance unitaire par action. Préserver calcul mois.
3. Remplacer agrégations UTC de jours actifs/streak/comparateur par ordinal civil local. Adapter affichage des clés pour éviter deuxième décalage.
4. Vérifier bornes `datetime-local` et fenêtres : bornes saisies explicites, minutes inclusives ; définir 7/30/90 comme jours civils glissants terminant à l'action la plus récente, par setDate local et heure conservée, pas soustraction fixe en ms au passage DST. Documenter ancrage sur dernière action, pas sur aujourd'hui. Borne inversée : erreur, ne pas ouvrir implicitement tout le tableau.
5. Ajouter libellé fuseau/week-start dans UI et exports. Le rapport mémorise fuseau source comme provenance mais calcule dans le fuseau lecteur ; afficher les deux s'ils diffèrent et annoter le raccourci de C4.
6. Adapter selfTest/README selon conventions nouvelles ; vérifier tous formats concernés et suite.

## 7. Dépendances

003 fixe portée/provenance et 006 types des bornes ; implémenter avant 008. Pas de besoin d'un serveur, token ou nouvelle lib calendrier.

## 8. Contraintes / non-objectifs

Pas de lundi arbitraire comme début de semaine ; ne pas « corriger » les timestamps sources, renommer les anciens fichiers ou migrer le slim. Pas de multi-fuseau configurable ni estimation de fuseau des membres. Source export recalculée différemment sur autre poste est une **limite déclarée**, pas supprimée dans ce lot.

## 9. Cas limites

Dates négatives acceptées par Date, année bissextile, heure répétée/absente DST, action exactement aux bornes, jour civil de 23/25h, dataset vide, seul événement, deux événements même jour local mais jours UTC distincts, ancienne source timezone absente. Pas de faux jour supplémentaire par arrondi DST.

## 10. Tests / vérifications

Pour chacun des 3 fuseaux, vérifier clés attendues explicites, nombre jours actifs/streak, heure/weekend, labels de semaine et date de pic ; sommes des graphiques = nombre d'actions. Fenêtre civile sur transition DST. Ouvrir rapport dans fuseau différent : provenance et avertissement présents, aucune promesse de chiffres invariants ; re-export utilise vue lecteur et son fuseau déclaré. `npm test`.

## 11. Critères d’acceptation mesurables

Exemple F07 compte le mardi local partout ; deux jours civils consécutifs restent une série de 2 malgré DST ; semaine commence dimanche réellement affiché ; zéro décalage des libellés UTC/Paris/New_York ; entrées ISO inchangées ; limites interpostes et changement JSON annoncés.

## 12. Terminé

Inventaire des usages temps clos, tests de frontières stables et suite verts, labels/modèles cohérents et documentation exacte. Pas d'affirmation de reproductibilité multi-fuseaux non obtenue.

## 13. Sources

F07/F08, [comparaison calendrier](../02-recherche-et-options.md), vision C4, roadmap J4, PLAN-003/006/008.
