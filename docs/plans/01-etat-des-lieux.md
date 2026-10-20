# État des lieux vérifié

Date et référence : voir [index du dossier](README.md). Recherche associée : [options](02-recherche-et-options.md). Exécution : [roadmap](04-roadmap.md).

## 1. Ce qu'est le projet

**O.** Application française de consultation de l'activité d'un tableau Trello, API REST v1, dans le navigateur. Pas de backend applicatif, base distante, authentification de service ni compilation nécessaire à l'utilisation. Le code, le style et le markup sont réunis dans `index.html` (5 199 lignes environ ; le repérage par symbole prime). `package.json` fournit les outils de développement, non un runtime serveur.

**Flux effectivement suivis :**

```text
formulaire → analyzeBoard → fetchJSON(board) → fetchAllActions
  → loadMemberMap + pages /actions → normalizeActions → state.actions
  → persistData(slimAction) → Store → localStorage / window.storage / mémoire
  → renderDashboard → getVisible → computeStats → 8 graphiques + heatmap + Nexus
reprise → readPayload → validPayload → expandActionKeepId → normalizeActions
actualisation → refreshData(delta/complet) → fetchAllActions → remplacement/fusion
exports → buildReportModel/getVisible ou état complet → PDF/ZIP/XLSX/CSV/JSON/HTML…
HTML autonome → SELF_SRC/SELF_STYLE/SELF_MARKUP + EMBEDDED → bootEmbedded
```

Preuves : `index.html:995–1019`, `1385–1439`, `1584–1654`, `1660–1769`, `2182–2406`, `2859–2893`, `3281–3500`, `4336–4393`, `4672–4723`, `5164–5193` ; carte des sections `README.md:227–255`.

## 2. Avancement et forces à préserver

| Système/parcours | État réel et preuve |
|---|---|
| Accueil, champs, démo | Fonctionnels dans les scénarios existants ; démo déterministe 1 284 actions, sans écraser la session (`2408–2443`, test `76–104`) |
| Acquisition | Pagination, déduplication, timeout et retries présents. Complétude et débit non garantis : F01/F05 |
| Session hors réseau | Lecture slim ancienne et actuelle ; fallback mémoire permet la consultation. Durabilité trompeuse : F02/F06 |
| Analyse | 8 graphiques, filtres membres/dates/recherche, granularité, heatmap, détail triable. Défauts de sémantique : F07/F08/F10 |
| Nexus | Briefing, comparateur, objectif, fenêtres, commandes implémentés ; pas une mesure de productivité validée (`2471–2855`) |
| Exports | Neuf formats du scénario E2E, plus briefing texte (`exp-brief`, `2747`, `5049`) ; contrôles de structure souvent superficiels, F03/F04/F12 |
| Accessibilité | Clavier, focus, `inert`, reduced-motion, thèmes testés. Le factory ajoute rôle et nom des canvas (`1974–2001`) ; pas de valeurs tabulaires complètes équivalentes, F09 |
| Livraison | Pages confirmé par API : mode `legacy`, `main:/`, état `built`. Workflow local + vérification production existants, pas de workflow de build applicatif |
| API publique | `window.tba` et alias globaux documentés et maintenus (`5164–5193`). Ce sont des appelants à préserver, pas seulement des détails internes |

**V.** Installation de développement `npm ci --ignore-scripts --no-audit --no-fund` réussie sans modification des manifestes. `npm audit --json` : **0 vulnérabilité déclarée**, ce qui ne prouve pas l'absence de défauts applicatifs. **19 tests Playwright passent en 34,0 s** avec Chromium 153 alternatif ; ce n'est pas une nouvelle mesure sur le Chromium épinglé par Playwright. Détails et premier échec environnemental dans [le protocole](research/verifications.md).

## 3. Constats hiérarchisés et causes

### F01 — P0 : le delta peut détruire la copie locale de l'historique (V/O)

`refreshData` (`2351–2390`) n'effectue la fusion que si `knownIds && res.stoppedAtKnown`. Pourtant `since` demande seulement les actions récentes. Une page vide ou exclusivement nouvelle ne rencontre aucun ID connu : branche `state.actions = fresh`, puis sauvegarde. Reproduction : **2 actions → delta `[]` → 0 actions, 0 sauvegardées**. Ce n'est pas une suppression dans Trello, mais une perte de la copie locale et une analyse erronée.

Le test `tests/app.spec.js:33–44,197–212` ignore `since/before` et renvoie toujours les 12 anciennes actions ; il exerce précisément le cas qui fonctionne. Autres risques liés à la même frontière : curseur absent et garde-fou MAX_PAGES conduisent à un succès tronqué (`1648–1653`) ; absence de détection de curseur répété. **PLAN-001** : acquisition candidate et fusion gouvernée par le mode demandé, pas par un détail de pagination.

### F02 — P1 : « Sauvegardé » ne signifie pas durable (V/O)

`Store.set` retourne `true` après son fallback mémoire (`1417–1429`). `persistData` en déduit une sauvegarde réussie et affecte `savedAtIso` (`2182–2200`). Reproduction avec getter localStorage levant SecurityError : `ok:true`, label **Sauvegardé**, timestamp présent. Après fermeture, cette mémoire disparaît. Le seuil `payload.length` est un nombre d'unités UTF-16, pas des octets ni le quota disponible d'origine ; bundle Chart.js/thème/objectif utilisent aussi cette origine. `Store.del` ignore l'échec mais `clearSaved` annonce l'effacement (`2250–2256`).

Le changement de consentement (`5030`) n'écrit rien jusqu'à la prochaine persistance : décocher peut laisser un ancien token sur disque. **PLAN-002** : résultats durables explicites, anciennes données conservées en cas d'échec, révocation traitée immédiatement.

### F03 — P1 : contrats de portée des exports incompatibles (V/O)

`README.md:94–99` annonce la vue courante, sauf HTML explicitement complet. `buildAnalysisJson` (`3327–3343`) utilise les statistiques filtrées en cache mais **toutes** les actions, sans query ni véritables bornes demandées. `embeddedPayload` (`4347–4364`) embarque tout. Reproduction sur la démo filtrée Camille : **420 visibles, stats JSON 420, JSON 1 284 et HTML 1 284 actions**. L'HTML complet est intentionnel, pas un bug caché ; le risque de partage au-delà du filtre est réel. ZIP mélange les deux périmètres (`4600–4654`).

La temporisation du filtre (`3215–3226`) laisse aussi une fenêtre pendant laquelle données courantes et `lastStats` peuvent différer. **PLAN-003** retient une règle plus sûre pour tous les exports ; changement de comportement à annoncer, pas correction silencieuse.

### F04 — P1 : échappement CSV ≠ protection contre une formule (V/O/E)

`csvCell('=1+1')` renvoie exactement `=1+1`. `csvCell` (`3281–3285`) ne fait que l'échappement RFC 4180. Les noms de carte/membre sont des entrées non fiables. `buildActionsCsv` est appelé par exportCsv et exportZip, et exposé publiquement (`3320–3325`, `3345–3351`, `4635`, `5173`). L'exécution dans Excel n'a **pas** été testée ; le risque est établi par R2. Le XLSX utilise déjà des cellules partagées typées chaîne (`4064–4090`), pas des formules. **PLAN-004** corrige à la frontière CSV, sans mutiler la donnée source.

### F05 — P2 : fiabilité réseau partielle et code régulateur inactif (O/E)

`Limiter.wait` est défini (`1450–1479`) mais n'est appelé nulle part (recherche globale). `fetchJSON` n'appelle que `noteWrite` pour un mode non GET inutilisé dans les parcours internes (`1510–1573`). Le compteur d'écriture n'est pas un timestamp alors qu'il est comparé à Date.now ; **ne pas développer cette fonctionnalité hypothétique**. `sleep` n'écoute pas le signal : backoff, pause de page et attente de débit ne sont pas interrompus immédiatement. `retryDelay` parse uniquement un nombre, plafonne à 30 s et ne respecte donc pas les dates HTTP ni les délais supérieurs (R6). Les limites officielles Trello actuelles n'ont pas pu être confirmées sur un hôte officiel autorisé : ne pas les inventer. **PLAN-005** réutilise les constantes prudentes existantes et retire la fausse promesse d'écriture.

### F06 — P1 : « validation stricte » n'est qu'un contrôle d'enveloppe (V/O)

`validPayload` (`1734–1737`) accepte `{boardData:{name:'X'}, actions:[null]}`. `expandAction` lit immédiatement `s.t` (`1722–1729`), donc la restauration peut échouer hors du message « corrompu ». `bootEmbedded` applique ses champs avant validation globale (`4672–4701`). `normalizeAction` ne garantit pas une chaîne pour `_memberName`, utilisée ensuite par `firstWord`/comparaisons. Des dates invalides sont silencieusement éliminées à la normalisation ; le nombre annoncé au bandeau n'est pas nécessairement restaurable.

Autre frontière de noms : `byMemberPeriod` utilise un objet ordinaire indexé par un nom externe (`1898–1910`) ; `__proto__`/`constructor` peuvent accéder à des propriétés héritées. Vérification spécifique dans le protocole. `renderTrends` et API publique sont ses consommateurs ; `sparkBuckets` utilise déjà Map. Enfin selfTest conserve la query en cours pendant son état factice : reproduction **1 échec `model kpis`** avec query sans résultat (`4930–4984`). **PLAN-006** centralise la validation aux entrées et isole l'auto-test.

### F07 — P2 : le calendrier mélange UTC et heure locale (V/O)

`dayKeyMs`, jours actifs et série utilisent UTC (`1285–1297`, `1857–1862`) ; heatmap, heure de pointe, weekend et mois utilisent Date locale (`1832–1850`) ; semaine locale dimanche ensuite convertie en date UTC (`1239–1247`). En Europe/Paris, `2026-09-21T22:30Z` est mardi à 00h30 mais compte dans la clé de jour lundi `2026-09-21`. Cela rend jours, calendrier et briefing incohérents. **PLAN-007** choisit une seule convention locale et la déclare ; pas d'ajout d'un sélecteur multi-fuseaux.

### F08 — P2 : descriptions statistiques trop affirmatives (O, D)

`buildInsights` (`2471–2537`) combine des coefficients arbitraires (34/28/22/16, seuil 6 actions/jour) ; sa formule est néanmoins partiellement expliquée dans le HTML (`769–770`) : ne pas prétendre qu'elle est cachée. Aucune qualité, délai de livraison ni résultat métier n'entre dans cette formule. Les semaines sans actions sont omises (`periodSeries`, `1912–1916`), de sorte que les deux « dernières » semaines peuvent ne pas être consécutives ; semaine courante partielle vs complète. Projection `dayAvg*7`, jours atypiques calculés seulement sur jours actifs, jours calmes comparés sans exposition : pas de validation prédictive. **PLAN-008** rend le discours descriptif et retire le score composite plutôt que lui ajouter un modèle.

### F09 — P2 : nom accessible ≠ accès aux données (O/E)

Les canvas ont des rôles et noms grâce à `chart`, pas de défaut automatique de nom. Mais les séries, top cartes détaillées et 168 cellules de heatmap (`2993–3026`) ne disposent pas d'une alternative tabulaire complète navigable ; le tableau membres couvre seulement une partie (`3158–3190`). Aucun test de lecteur d'écran manuel effectué. **PLAN-009** ajoute des détails textuels natifs réutilisant les données déjà calculées, conserve les graphiques et vérifie le focus. Éviter une nouvelle bibliothèque ARIA.

### F10 — P2 différé : identités confondues et informations historiques perdues (V/O)

`normalizeAction` ne conserve ni `idMemberCreator`, ni `data.card.id` ; `computeStats` et `memberProfile` regroupent par nom (`1675–1688`, `1827–1861`, `2603–2620`). Reproduction : deux IDs de membres et cartes distincts avec mêmes noms donnent **1 membre, 1 carte**. Le lookup ne connaît que les membres actuels du board : anciens membres deviennent « Inconnu » même si la réponse contient memberCreator, ignoré (`1584–1597`, `1640`). Renommage de carte : cas inverse, plusieurs noms d'une même carte comptés séparément.

**Décision :** ne pas intégrer à la première série de corrections. Le passage aux IDs modifie filtres, séries, légendes, comparateur, slim, exports et API publique ; les anciennes sauvegardes n'ont pas l'information récupérable. Une migration opportuniste dans un lot de fiabilité serait dangereuse. Expliquer cette limite dans PLAN-008. Étude de suite bornée et conditions de réouverture dans la vision ; ce risque n'est pas présenté comme résolu.

### F11 — P3 : documentation et maintenance décalées (O/V)

README décrit un limiter actif et un modèle partagé par tous les exports (`236`, `243`), alors que JSON/HTML ont leurs chemins et le limiter n'est pas appelé. Mention d'une passe d'agrégation unique réutilisée partout à nuancer (`258–262`) : plusieurs rendus réagrègent. Assertions jsdom/pypdf/openpyxl et performance dans le README ou PR #10 sont historiques, hors dépôt et non reproduites ici. PR #10 dit temporisation 250 ms ; code actuel : 90 ms (`3215`). Licence Chart.js incluse, mais aucune licence du projet détectée (`git ls-files`, API GitHub license:null) : ne pas en attribuer une sans titulaire.

Chaque plan met à jour la section documentaire qu'il change ; pas de réécriture globale. Scripts, vendor et version sont inchangés pendant cet audit.

### F12 — P2/P3 : couverture « parcours heureux », pas contrats de données (O/V)

19 scénarios actuels, axe et quatre tailles d'écran : base utile. Les formats binaires sont surtout contrôlés par extension/magic bytes/taille (`tests/app.spec.js:233–263`) ; pas de lecture indépendante de toutes leurs structures dans cette suite. Delta sans nouvelle action, 1 000+ actions, retries, corruption profonde, quota, collision de noms, dates DST et exports filtrés absents. Pas de benchmark versionné ; pas de raison de prescrire Worker ou refonte de rendu. Les tests de non-régression **appartiennent au plan qui change le contrat**, pas à une infrastructure abstraite préalable.

### F13 — Risques secondaires sans lot de fonctionnalité (O/H)

- Cache Chart.js textuel exécuté, fallbacks CDN sans SRI (`2022–2118`) : surface de chaîne d'approvisionnement ; le parcours nominal reste local. Pas de faille exploitée observée ni de preuve que l'upgrade Chart.js soit nécessaire ; R5 et audit npm zéro ne justifient pas une migration.
- Stockage partagé par origine sur Pages, pas par sous-chemin (R1) ; mêmes limites de confidentialité entre applications du même propriétaire. Ne pas recommander « chiffrer localStorage » avec une clé livrée dans la même page.
- PDF WinAnsi limité hors alphabet pris en charge (`3571–3614`), XLSX/ZIP STORE sans compression/ZIP64 (`3947–4003`), canvas exports coûteux : limites réelles, pas de demande prouvée de les réécrire. Les chaînes non latines doivent être signalées lors d'une future évolution PDF.
- Export statique peut omettre un graphique en cas de capture impossible (`4540–4546`) ; l'impression est la solution actuelle de repli. Investigation contenu/PDF indépendant reste hors de cet audit.
- Objectif de semaine est local à l'appareil et s'applique à la liste filtrée (`2640–2678`) ; ne pas le présenter comme capacité d'équipe.

## 4. Historique, conventions et livraison

`git rev-parse --is-shallow-repository` : **true**, seul le commit de base apparaît localement. Historique complété par `gh pr list --state all` (PR #1…#10 fusionnées), corps PR #9/#10 et `gh run list` : validation et Pages du commit de base ont des conclusions `success`. **Ce sont des états GitHub observés, pas des tests de production refaits.** `gh issue list --state all` : aucune issue retournée ; absence d'issue ≠ absence de bug.

README reste le seul document antérieur d'architecture/développement. Déploiement vérifié par `scripts/verify-deployment.mjs` : arborescence locale, fichiers app obligatoires, SHA-256, racine, version, API Pages. Il n'effectue pas la publication ; celle-ci est assurée séparément par Pages main/racine. Il parcourt aussi les annexes servies ; ajouter `docs/` ne nécessite pas de changement de script. Tests et logs générés sont ignorés. Aucun pipeline backend, aucun service worker et aucun import de fichier utilisateur trouvés parmi les fichiers suivis et les parcours init/export.

## 5. Couverture et inconnues

L'inventaire couvre tous les fichiers suivis : README, application CSS/markup/JS, tests, scripts, configuration, workflow et licence. Lecture approfondie des flux JS et de leurs appelants ; examen structurel du markup, des styles par couches et des générateurs PDF/XLSX, sans revue exhaustive de chaque règle CSS ni validation indépendante de chaque objet binaire. Le vendor minifié a été identifié par sa provenance/entrée/version, pas audité instruction par instruction. Les flux majeurs et leurs appelants internes/globaux sont cartographiés. Pas d'entretien, de trafic réel, de token Trello, d'appel live Trello, d'audit manuel lecteur d'écran, ni de tests Firefox/Safari. L'API officielle Atlassian et le site Pages ne sont pas joignables dans la liste d'hôtes autorisés ; ne pas transformer les sources secondaires en garantie officielle. Recherche ciblée GitHub/npm disponible et effectuée.

Deux passes de couverture ont élargi l'analyse : (1) union delta → simulation biaisée, statut de persistance et portée du ZIP ; (2) calendrier → comparateur/objectif/briefing, dictionnaire de noms, auto-test sous query et nommage canvas dynamique. Les plans ont été révisés pour garder ces causes communes dans leurs frontières et éviter un faux constat d'absence d'ARIA.
