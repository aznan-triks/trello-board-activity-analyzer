# Recherche utile aux décisions, pas catalogue de technologies

**Consultation effective : 2026-10-20.** Sources obtenues par `gh api`, npm et code local. Accès Internet restreint à GitHub/npm/PyPI ; documentation Atlassian sur developer.atlassian.com et site publié non consultés directement. Aucune limite Trello actuelle ni exhaustivité de son historique n'est donc certifiée ici. Les URL ci-dessous sont des sources lues, pas des tests exécutés chez leurs auteurs.

## 1. Registre des sources et contribution

### R1 — MDN, quotas et éviction (source de documentation maintenue)

[Contenu consulté à la révision a64fca5](https://github.com/mdn/content/blob/a64fca52b72fd03b0efd7661207d5afdd220aac3/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md).

**Apport :** quotas par origine et non sous-chemin, Web Storage limité, QuotaExceededError à gérer, mémoire et best-effort ≠ persistance garantie. Renforce F02 et le contrat durable/volatile de PLAN-002. Le quota réel n'est pas calculable par `payload.length`; tenter et traiter l'échec est nécessaire.

**Limite :** les chiffres généraux MDN ne remplacent pas un test de quota du navigateur cible ; IndexedDB peut aussi être refusé ou évincé. **Décision :** ne pas promettre que changer d'API supprime le risque de perte.

### R2 — OWASP, CSV Injection (source sécurité, nuances de mitigation comprises)

[Texte consulté, révision 818b8d6](https://github.com/OWASP/www-community/blob/818b8d6c014ab7233aff3081260e8dfe47f986c0/pages/attacks/CSV_Injection.md).

**Apport :** RFC 4180 seul ne neutralise pas une formule ; caractères =,+,-,@, contrôles et variantes Unicode ; solutions apostrophe ou tabulation ont des compromis et ne sont pas universelles. Le document préconise notamment tabulation *dans le champ cité* pour Excel. Justifie PLAN-004 et l'orientation « consultation tableur » du CSV déjà annoncé comme Excel.

**Décision :** tabulation préfixée dans les cellules dangereuses, champ toujours cité dans ce cas ; JSON pour les chaînes exactes, XLSX typé texte pour consultation. **Limite explicite :** sauvegarder/recharger dans un outil tiers peut transformer la protection ; aucun export CSV universellement sûr n'est promis. Ne pas copier une formule d'exfiltration pour tester : `=1+1` suffit.

### R3 — py-trello, implémentation comparable d'un client

[board.py à f89a72a](https://github.com/sarumont/py-trello/blob/f89a72a218295c572921103a08d4ce3ec225c353/trello/board.py#L560-L586). Métadonnées consultées : non archivé ; dernier tag retourné `v0.20.1` à cette révision, pas de GitHub release latest disponible.

**Apport :** `fetch_actions` passe `since` et `before` à `/boards/{id}/actions`, reçoit une liste de la fenêtre demandée. Ce n'est pas une réconciliation complète de l'historique. Conforte la nécessité de fusionner le delta dans PLAN-001.

**Limites :** code Python et client tiers, pas contrat officiel d'inclusivité de `since`, de rétention ni d'ordre Trello. Notre correction ne dépend pas de deviner cette inclusivité : petite fenêtre de recouvrement et déduplication par ID. **Rejet :** ajouter un SDK JS/Python serait du coût sans résoudre le bug métier de fusion.

### R4 — TKAT, vrai outil de métriques Kanban et contre-exemple de maintenance

[README](https://github.com/nicoespeon/trello-kanban-analysis-tool/blob/0e88622265f90ca081fcba2912326c8c4e555f8b/README.md), [calculs de temps](https://github.com/nicoespeon/trello-kanban-analysis-tool/blob/0e88622265f90ca081fcba2912326c8c4e555f8b/app/components/Metrics/times.js), [issue #52 ouverte](https://github.com/nicoespeon/trello-kanban-analysis-tool/issues/52).

**Apport :** calcule lead/cycle time à partir des IDs de carte et de transitions de listes configurées, pas du volume d'événements. L'issue rapporte une valeur changeant selon la liste « Work Begins » ; c'est un retour utilisateur, pas un bug reproduit ici. Le README annonce explicitement que l'auteur ne maintient plus le projet (bien que GitHub ne le marque pas archivé). Ramda/RxJS/Cycle.js/Brunch servent aussi son objectif d'apprentissage.

**Décision :** ne pas importer ce modèle ni son stack. Les métriques de flux pourraient constituer un autre produit, mais notre slim ne conserve pas les transitions et aucune définition de « terminé » n'existe. L'ambition retenue est la confiance dans l'observation, pas un dashboard de productivité. Aucun benchmark comparatif n'a été effectué. Cette source suffit à identifier les prérequis d'une alternative de flux ; multiplier les clones n'ajouterait pas de décision.

### R5 — Chart.js, version et accessibilité

[Documentation d'accessibilité v4.4.1](https://github.com/chartjs/Chart.js/blob/v4.4.1/docs/general/accessibility.md), [release v4.5.1](https://github.com/chartjs/Chart.js/releases/tag/v4.5.1) annoncée le 2025-10-13, latest renvoyée par l'API le jour de consultation.

**Apport :** le canvas ne restitue pas ses données au lecteur d'écran ; ARIA/texte alternatif à charge de l'application. Le code actuel fournit déjà rôle et nom, ce qui doit être préservé. Ajouter une table réelle des valeurs apporte davantage que renommer les canvas. PLAN-009.

**Décision :** garder 4.4.1 pour ces lots, dépendance locale épinglée et bundle tree-shaken existants. Une version plus récente n'est pas une preuve d'un besoin d'upgrade. **Coût d'upgrade différé :** reconstruire vendor, adapter cache/version/fallbacks, comparer 8 graphiques et tous les rapports autonomes. `npm audit` n'a signalé aucune vulnérabilité, sans garantie absolue de sécurité.

### R6 — MDN, syntaxe de Retry-After

[Texte consulté à a64fca5](https://github.com/mdn/content/blob/a64fca52b72fd03b0efd7661207d5afdd220aac3/files/en-us/web/http/reference/headers/retry-after/index.md).

**Apport :** date HTTP ou entier de secondes ; délai minimum avant nouvelle requête. Rend la limitation actuelle à parseFloat/30s incorrecte pour ce contrat. PLAN-005 doit respecter la date et permettre annulation plutôt qu'écourter silencieusement l'attente. Si CORS cache l'en-tête, backoff existant conservé. Pas une source de quotas Trello.

### R7 — MDN, transactions IndexedDB

[IDBDatabase.transaction](https://github.com/mdn/content/blob/a64fca52b72fd03b0efd7661207d5afdd220aac3/files/en-us/web/api/idbdatabase/transaction/index.md).

**Apport :** transactions readonly/readwrite natives, durabilité avec compromis performance ; possible piste pour sessions dépassant Web Storage. **Non retenu maintenant :** une nouvelle base et migration ne sont pas nécessaires pour afficher la vérité d'un échec, et les quotas actuels n'ont pas été mesurés sur des utilisateurs. À rouvrir seulement après observation répétée de refus de sauvegarde pour des tableaux de taille attendue ; alors une seule entrée snapshot, pas une base analytique indexée ni Dexie pour quelques opérations. Limites `file://`, mode privé, coexistence `window.storage` et repli à tester.

### R8 — Spécification miroir Trello : source insuffisante, non normative

[Fichier inspecté](https://github.com/api-evangelist/trello/blob/main/openapi/_original/trello-rest-api-openapi.yml), [provenance inspectée](https://github.com/api-evangelist/trello/blob/main/provenance.yml).

**Apport négatif :** le endpoint `/boards/{id}/actions` n'y décrit que `filter` et `limit` (max 1000), omet `since/before/fields` pourtant utilisés dans des clients réels. Le mot `_original` ne suffit pas à établir une copie officielle exhaustive ; provenance comporte des artefacts d'origine inconnue/générée. **Décision :** ne pas générer un SDK/validateur à partir de ce miroir, ne pas invoquer son silence comme absence d'une capacité API. La vérification officielle future est une limite documentée, pas un prérequis pour l'union sûre du delta.

## 2. Comparaison avant recommandation

Échelles relatives à ce petit projet : coût/maintenance **F** faible (section existante), **M** moyen (plusieurs parcours), **E** élevé (migration/runtime nouveau). Pas d'estimation en jours sans connaissance de l'équipe. Impact et risques viennent des constats F01…F13, pas de popularité.

| Décision | Existant | Incrément retenu | Refonte comparée | Alternative sérieuse | Ne rien changer |
|---|---|---|---|---|---|
| Acquisition (001) | Fusion conditionnée à ID connu ; perte démontrée | Union par ID pour tout delta, candidat complet validé avant remplacement ; coût M, risque borné par fixtures | Journal d'événements/versionnement distant : E, infra et rétention nouvelles | Désactiver Delta et forcer complet : F, sûr mais coûteux réseau, recours si contraintes API empêchent le delta | Rejet : P0, perte locale reproductible |
| Persistance (002) | Fallback mémoire déclaré succès | Distinguer durable/volatile/échec dans Store et UI ; coût M, même schéma | IndexedDB + migration : E, plus de capacité, davantage de modes de panne | Aucune sauvegarde automatique, uniquement export : F mais régression de reprise ; option si environnement interdit toute persistance | Rejet : promesse de durabilité fausse |
| Portée (003) | JSON incohérent ; HTML complet intentionnel | Tous les exports = vue courante ; avertissement durable, filtres initiaux du rapport réinitialisés ; coût M | Module snapshot universel/refonte export : E et couplage auto-capture | Confirmation « toutes les données » : F/M mais clic supplémentaire et formats divergents ; préférable si besoin de partage complet **prouvé** | Rejet : risque de diffuser les données exclues |
| CSV (004) | RFC seulement | Neutraliser cellules dangereuses au sérialiseur ; F | Remplacer tous les générateurs par bibliothèques : E et poids du rapport | Retirer CSV au profit de XLSX typé : F, préférable si aucune compatibilité aval n'accepte l'altération textuelle | Rejet : données contrôlées par d'autres membres |
| Réseau (005) | Retries présents, limiter inactif | Une régulation par tentative GET et attentes annulables ; M | File centralisée multi-clients/service backend : E, aucune concurrence interne démontrée | Retries seuls : F mais pas la promesse actuelle ; possible si quotas officiellement vérifiés et volume minime | Possible court terme, pas cible après P0/P1 |
| Entrées (006) | Contrôle d'enveloppe | Validation des schémas historiques et embarqués aux frontières, dictionnaire sans prototype ; M | Schéma partagé généré/Zod/TypeScript build : E, nouveau runtime non justifié | Normalisation permissive avec bilan : M mais risque de perte partielle cachée ; seulement pour import volontaire futur | Rejet : restauration peut échouer après mutation |
| Calendrier (007) | Mélange UTC/local | Jour/mois/semaine locaux, dimanche préservé, fuseau affiché ; M | Temporal/polyfill ou Luxon multi-fuseaux : E, poids et option inutile ici | Tout UTC : F/M et reproductible entre postes, préférable pour reporting transverse explicite ; surprise pour heatmap locale actuelle | Rejet différé : résultats contradictoires aux frontières de jour |
| Briefing (008) | Score et extrapolation ; semaines non consécutives | Retirer score, garder faits descriptifs, comparer deux semaines closes consécutives ; M | Prévision statistique/modèle ML : E, non validé et besoin absent | Supprimer Nexus entier : F mais retirerait recherche/commandes utiles sans raison | Tolérable si disclaimer immédiat, pas cible des métriques |
| Données accessibles (009) | Canvas nommés, pas tous les chiffres accessibles | Détails/tableaux HTML natifs des données déjà calculées ; M, zéro nouvelle dépendance | Graphiques SVG interactifs complets : E, régressions export | Simple prose/KPI : F, insuffisant pour lire les valeurs exactes ; acceptable seulement pour illustration non informative | Rejet pour objectif d'accès aux mêmes informations |
| Identités (suite différée) | Regroupement par noms | Ajouter IDs au slim puis migration des agrégations : M/E, juste métier mais tous les consommateurs à adapter | Modèle événementiel brut complet : E, quotas/confidentialité augmentés | Mention explicite de comptage par libellé ; F, retenue pour cette série ; support IDs à étudier ensuite | Acceptable temporairement avec limite visible, pas prétendue exactitude d'identité |

## 3. Ce qui n'est pas recommandé et pourquoi

- **React/Vue/Vite ou découpage en modules chargés à l'exécution :** ne répare aucun constat ; casse l'auto-capture `SELF_SRC` et la distribution sans build. Extraire pour tester n'est pas requis : Playwright peut déjà appeler `tba.*`. Architecture existante plus simple pour la taille actuelle.
- **Backend OAuth, webhooks ou synchronisation multi-tableaux :** hébergement/secrets/consentement, sécurité et exploitation changent entièrement ; aucun besoin observé. Le produit n'écrit pas dans Trello, ne pas activer des réserves d'écriture théoriques.
- **Import JSON Trello sans compte :** alternative intéressante mais non retenue ; sémantique/rétention des exports réels non vérifiées, aucun exemple fourni. Pas de plan d'import imaginaire.
- **Kanban cycle time, SLA, classement de productivité :** raw transitions/IDs perdus et définition des étapes absente (R4). Ce n'est pas une extension de quelques compteurs ; score d'actions ≠ livraison.
- **IndexedDB systématique, Worker, ZIP compressé, PDF universel :** améliorations possibles mais besoins et budgets réels non mesurés. Éviter d'empiler migrations à la réparation urgente.
- **Upgrade de toutes les dépendances :** audit nul ; aucune incompatibilité démontrée. Ne pas substituer la nouveauté à un critère d'acceptation.

Arrêt de recherche : les sources convergent vers une correction locale des contrats. La question officielle `since` ne change pas l'obligation d'union ni les fixtures de bord ; le manque de données d'usage empêche de justifier une nouvelle plateforme. D'autres dépôts ne lèveraient pas cette incertitude utilisateur.
