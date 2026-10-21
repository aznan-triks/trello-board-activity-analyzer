# Dossier de décision — un analyseur local digne de confiance

**Date : 20 octobre 2026 · Référence : `c1f4ed39c0fae2f2a97e3f85224eafeb0446780a` · Application : 8.1.0**

Ce dossier conserve les constats initiaux et suit désormais leur exécution. Les statuts courants distinguent les travaux en cours des corrections validées. Les lignes citées concernent le commit de référence ; rechercher les symboles après modification.

## Lire puis exécuter

1. [État des lieux et preuves](01-etat-des-lieux.md).
2. [Recherche, alternatives et décisions](02-recherche-et-options.md).
3. [Vision cible et contrats](03-vision-cible.md).
4. [Roadmap, dépendances et jalons](04-roadmap.md).
5. Le plan individuel du lot choisi dans [tasks/](tasks/).
6. [Protocole de vérification et reproductions](research/verifications.md).

| Plan | Priorité | Statut courant | Résultat attendu |
|---|---|---|---|
| [PLAN-001](tasks/PLAN-001-delta.md) | P0 | validé localement le 2026-10-20 (`298da40`, 36/36, Chromium alternatif) | Delta sans perte d'historique ; pagination incomplète en échec explicite |
| [PLAN-002](tasks/PLAN-002-stockage.md) | P1 | validé localement (2026-10-21) | Statut de persistance honnête et retrait effectif des secrets mémorisés |
| [PLAN-003](tasks/PLAN-003-portee-exports.md) | P1 | validé localement (2026-10-21) | Exports limités à la vue courante, cohérents et réexportables |
| [PLAN-004](tasks/PLAN-004-csv.md) | P1 | validé localement, tableur non vérifié (2026-10-21) | CSV destiné au tableur : cellules textuelles hostiles neutralisées |
| [PLAN-005](tasks/PLAN-005-reseau.md) | P2 | validé localement (2026-10-21) | Débit réellement régulé ; attentes annulables ; Retry-After respecté |
| [PLAN-006](tasks/PLAN-006-frontieres.md) | P1 | validé localement (2026-10-21) | Sessions et rapports invalides refusés sans mutation ni effacement |
| [PLAN-007](tasks/PLAN-007-calendrier.md) | P2 | validé localement (2026-10-21) | Jours, semaines et heures cohérents dans le fuseau local déclaré |
| [PLAN-008](tasks/PLAN-008-indicateurs.md) | P2 | en cours (2026-10-21) | Comparaisons et briefing descriptifs, sans surinterprétation du volume |
| [PLAN-009](tasks/PLAN-009-accessibilite.md) | P2 | dépendant d'un autre plan : 008 | Données des graphiques disponibles sans vision ni survol |

**Arbitrage principal :** conserver le fichier applicatif autonome, Chart.js local, les formats slim historiques, les API globales et l'hébergement statique. Réparer les frontières et les contrats dans ces sections existantes ; pas de framework, backend, stockage réécrit ou nouveau format d'export.

Les neuf lots ont des périmètres de session bornés. Ils ne sont pas tous requis avant la première livraison : **001, 002, 003, 004 et 006** forment le jalon de confiance. Les autres améliorent ensuite l'interprétation et l'accès. Tous touchent `index.html` : intégration séquentielle obligatoire, même quand les dépendances logiques autorisent des investigations parallèles.

## Convention de preuve

- **O** : observé dans les fichiers ; **V** : vérifié par commande ou reproduction ; **E** : confirmé par source externe consultée ; **H** : hypothèse ; **D** : décision recommandée, pas exigence historique.
- Les constats **F01…F13** de l'état des lieux sont réutilisés dans les plans.
- Les références **R1…R8** du document de recherche donnent URL, date, apport et limites.
- Les besoins utilisateur restent des hypothèses déduites des parcours : aucun entretien ni métrique d'usage n'a été obtenu.

Aucun plan antérieur n'a été trouvé parmi les fichiers suivis. Le README existant est préservé : ses assertions historiques ne valent pas preuve des contrats actuels. Les contradictions importantes sont recensées plutôt qu'effacées.
