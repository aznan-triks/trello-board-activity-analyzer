# PLAN-003 — Un périmètre de données identique dans tous les exports

**Statut : validé localement (2026-10-21) · Priorité : P1 — Majeur.** Risque de diffusion de données exclues par les filtres et JSON contradictoire, démontrés. Rupture de comportement HTML décidée et à annoncer.

## 1. Problème / preuves

[F03](../01-etat-des-lieux.md) : JSON stats 420 mais 1 284 actions, HTML 1 284 pour vue filtrée 420. `buildAnalysisJson:3327–3343`, `embeddedPayload:4347–4364`, `buildHtmlExport:4375–4393`, `exportZip:4600–4654`. README `94–103` documente l'HTML complet : ne pas prétendre qu'il était déjà restreint.

## 2. Objectif

Un export et ses re-exports ne contiennent que les IDs visibles au lancement. Stats, données, filtres déclarés, graphiques et archive doivent décrire ce même ensemble, sans secrets.

## 3. Cible

Contrat [C3](../03-vision-cible.md). Les constructeurs publics sans argument conservent leur signature. Réutiliser `getVisible`, `buildReportModel`, `flushRerender`, `slimAction` ; figer localement liste/métadonnées au début d'une opération asynchrone, sans nouveau « service export ». Toute capture durant l'opération utilise la même vue. Le plus simple : neutraliser temporairement les contrôles de filtres/granularité et attendre la fin du rendu avant capture, restaurés dans finally ; pas de verrou global permanent. Maintenir les états disabled préexistants.

HTML : embarquer seulement la liste visible, filtres actifs initiaux **vides**, texte de provenance des filtres source et mention « sous-ensemble exporté ». Pas de query source conservée comme filtre actif, sinon le rapport pourrait paraître vide après changements de libellés ou reset. Métadonnées de provenance inertes, validables par 006.

## 4. Décision / alternative

Coût M, pas de dépendance. Écarter popup de choix ou option « tout inclure » : un contrat unique minimise l'erreur de partage. Pour inclure tout, utilisateur efface les filtres puis exporte. Si un besoin explicite de rapport complet malgré vue filtrée apparaît, un futur plan pourra ajouter confirmation distincte ; ne pas l'anticiper. Ne pas refondre tous les générateurs.

## 5. Points d'impact complets

`getVisible`, filtres temporisés, `buildAnalysisJson`, `embeddedPayload`, `buildHtmlExport`, `bootEmbedded`, `buildReportModel`, `withExport`, `exportCsv/Json/Png` (hors garde actuel), `exportHtml/Pdf/Markdown/Xlsx/Sheet/Zip`, `exportBriefing/briefingPlain`. Appelants : boutons `exp-*`, raccourcis `wireShortcuts`, `commandCatalog`, API `tba.*` et alias ; ZIP appelle constructeurs directement. SELF_MARKUP/SELF_SRC et repli statique à préserver.

Tests : downloads existants, nouvelle fixture 3 IDs dont un nom secret exclu ; décoder JSON, payload HTML, CSV, XLSX et archive ZIP. ZIP STORE existant : test peut lire les entrées avec `node:zlib`/Buffer et signature ZIP, pas de nouvelle dépendance pour ce seul cas. README table exports, manifeste ZIP, bannière HTML, texte UI menu. Pas de modification du vendor/CI ; formats binaires restent identiques hors données attendues.

## 6. Étapes ordonnées

1. Ajouter test 3 actions distinctes, filtres membre+date+query isolant une seule ; affirmer IDs et absence du nom exclu dans données décompressées, pas dans un simple test d'extension.
2. Rendre JSON indépendant de `lastStats` périmé : calculer stats depuis liste visible au lancement. Garder shape existante de filtres et ajouter query/bornes demandées clairement ; distinguer bornes observées si nécessaires, ne pas les substituer à la sélection.
3. Restreindre payload HTML à la liste visible, encoder par `embedJson`, provenance via champs autorisés ; boot affiche celle-ci et démarre sans filtre actif. Évaluer le plus petit ajout de champ compatible au kind existant ; pas d'invalidation des anciens rapports déjà produits.
4. Aligner toutes les fonctions d'export citées, y compris ZIP et briefing. Pour appels publics aux constructeurs purs, le comportement courant doit être cohérent sans dépendre d'un clic UI préalable.
5. Éliminer la fenêtre de rendu périmé via flush/snapshot avant capture ; avecExport n'empêche pas aujourd'hui le changement de filtre. Tester saisie + export immédiat et action pendant attente `getChartJsSource`.
6. Modifier README/menu/bannière/manifeste pour annoncer la nouvelle portée, les données nominales restantes et comment exporter tout. Relire hors réseau et réexporter.

## 7. Dépendances

Après 002 ; 004 modifie ensuite le CSV, 006 valide ensuite les champs de provenance. Si 006 a déjà été intégré, adapter son validateur dans ce lot. Ordre séquentiel des fichiers imposé par roadmap.

## 8. Contraintes / non-objectifs

Ne pas modifier `state.actions` ni la sauvegarde pour exporter. Aucun anonymiseur, mot de passe de rapport, nouveau format, option de portée, backend, refonte de modèle. Conserver chaînes, timestamps et actions autorisées exactement. Une vue vide peut produire un rapport vide explicite si tableau source non vide ; jamais revenir aux actions complètes.

## 9. Cas limites / risques

Zéro résultat, filtre seul dates ou query, noms hostiles, borne minute, export pendant debounce, changement thème, ZIP avec fallback statique, réexport HTML plusieurs fois, ancienne version de rapport embarqué complet. Ancien rapport conserve ses anciennes données : pas de capacité à les retirer rétroactivement, l'annoncer.

## 10. Tests

Comparer ensembles d'IDs et totaux sur chaque format de données ; ouvrir HTML hors réseau, clearFilters et réexport JSON ne retrouvent pas l'action exclue. Vérifier les images/KPI de la même vue avec le total attendu ; tester rapport statique forcé sans source récupérable. Rejouer neuf downloads + briefing, absence de faux secrets ; `npm test`.

## 11. Critères d'acceptation

Pour N visibles : `json.actions.length=json.stats.total=N`, payload HTML N, lignes CSV/XLSX N, tous les artefacts ZIP N pour les données. Action exclue absente même après réinitialisation de la visionneuse ; sauvegarde et state complets inchangés. Export immédiatement après saisie reflète la saisie, pas lastStats précédent. Annonce de rupture explicite.

## 12. Terminé

Tests précis des données et pas seulement magic bytes, suite complète verte, nouvelle portée documentée et API publique relue. Pas d'exfiltration démontrée nécessaire pour satisfaire le plan.

## 13. Sources

F03/F12, [comparaison portée](../02-recherche-et-options.md), vision C3, roadmap J2, PLAN-004/006.

## Exécution — 2026-10-21 · en cours

Prérequis 002 satisfait (47 tests verts). Relecture de tous les constructeurs, capture, ZIP, briefing et bootEmbedded ; changement de portée HTML intentionnel, pas de nouveau format.

## Exécution — 2026-10-21 · validé localement

Implémentation 76b1857. Avant correction : 4/4 régressions échouaient. Après : 6 tests ciblés, répétés trois fois (18/18, 17,4 s), et suite complète 53/53 (59,8 s). Commande standard de session : LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test. Contrôles JSON/CSV/XLSX/ZIP STORE décodés, HTML offline puis reset/réexport, vue vide, debounce, verrouillage/restitution disabled, snapshot pendant attente et repli statique forcé. Tests d’attente stabilisés en neutralisant le préchauffage idle uniquement dans leurs pages de test ; une assertion de texte de carte dans le rapport statique (cartes rendues en images) remplacée par total/membre réellement présents. API publiques conservées. Aucun live/Pages/navigateur épinglé. Prochain lot 004.
