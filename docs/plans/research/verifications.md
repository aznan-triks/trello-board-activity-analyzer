# Vérifications réellement effectuées et reproductions

**Date : 2026-10-20 · Commit de référence : c1f4ed39c0fae2f2a97e3f85224eafeb0446780a.**

Ce document distingue résultats de tests, lecture statique et limites d'environnement. Aucun correctif n'a été implémenté pour obtenir ces résultats. Aucun appel API Trello live, token réel ou fichier utilisateur n'a été utilisé.

## 1. Inventaire et contexte de commande

Commandes exécutées depuis la racine du dépôt :

- `pwd; git status --short; ls -la; find …` : racine attendue, arbre propre au départ, application statique et 14 fichiers suivis (`git ls-files`).
- `git log -10 --oneline; git rev-parse --is-shallow-repository` : seul c1f4ed3 disponible, shallow=true. Pas de fetch/switch/commit/push.
- Lecture du README, tests, scripts, configurations, workflow et licence vendor par blocs `sed`/`nl` ; suivi approfondi des flux JS et de leurs appelants, examen du markup/CSS et des générateurs PDF/XLSX. Pas de revue exhaustive de chaque règle CSS ni de chaque détail binaire. Bundle Chart identifié par entrée/banner et sa licence, pas un audit complet du minifié.
- `grep -n 'Limiter.wait\|fetchJSON(\|Store\.\|validPayload\|expandActionKeepId' index.html` : aucun appel à Limiter.wait ; appelants répertoriés dans les plans.
- `node --version` = v22.22.3 ; `python3 --version` = 3.11.2.

Interrogations GitHub effectivement réalisées par `gh` :

- `gh issue list --state all --limit 40` : sortie vide.
- `gh pr list --state all --limit 15` : PR #1…#10 fusionnées ; `gh pr view 9/10 --json body` lus. Les chiffres de performance de #10 sont des affirmations historiques, non réévaluées.
- `gh run list --limit 6 --json conclusion,displayTitle,headSha,url` : validation et Pages du commit de base success. Run de validation observé : https://github.com/aznan-triks/trello-board-activity-analyzer/actions/runs/37000773048 .
- `gh api repos/aznan-triks/trello-board-activity-analyzer/pages` : `build_type:legacy`, source `main:/`, status `built`. Il ne s'agit pas d'un nouveau test HTTP du site public.
- Métadonnées repo : `license:null`, aucune issue ouverte ; aucune licence projet dans fichiers suivis.
- Recherche/code/contents/tags/releases pour les sources R1…R8 du [registre](../02-recherche-et-options.md). Une tentative `pycontribs/py-trello` et un dépôt supposé Atlassian ont répondu 404 ; remplacées par le dépôt réel `sarumont/py-trello`, sans déduire que la capacité Trello serait absente.

## 2. Dépendances et suite existante

`npm ci --ignore-scripts --no-audit --no-fund` : 41 packages installés, manifestes et lock inchangés. `npm audit --json` : vulnerabilities.total=0 (0 high/critical). Cette interrogation ne teste pas la sécurité du code applicatif.

Le navigateur n'était pas préinstallé. Les hôtes de téléchargement Playwright ne sont pas dans l'allowlist. Pour **l'audit uniquement**, installation de `@sparticuz/chromium@153.0.0` par npm **hors dépôt**, dans `/home/user/.cache/tba-audit/runtime`, extraction de son bundle navigateur et de `al2023.tar.br`. Rien de cela n'est une dépendance recommandée du projet ; ne pas modifier la config pour le reproduire en CI.

Premier essai `CHROMIUM_PATH=/tmp/chromium npm test` : 19 échecs de lancement, **libnspr4.so manquante**, aucun scénario applicatif exécuté. Puis extraction des bibliothèques embarquées et :

```sh
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test
```

**Résultat : 19 passed (34.0s)**, 4 workers, Chromium 153.0.8010.0, Playwright du projet 1.55.1. Pas de changement du serveur/config/dependencies pour obtenir ce résultat. Les rapports ignorés restent des artefacts locaux, non inclus dans la documentation. En environnement normal, suivre README : `npm ci`, `npx playwright install --with-deps chromium`, `npm test` pour le navigateur épinglé.

Les tests nominalement verts n'invalident pas les défauts ci-dessous : le mock renvoie l'historique identique même en delta, les exports testés ne sont pas filtrés et la disponibilité dégradée teste la démo, pas une sauvegarde durable.

## 3. Sonde ciblée de données

Un serveur Python temporaire a servi le dépôt sur 0.0.0.0:8080 ; arrêté à la fin de l'audit. Sonde Node/Playwright dans un contexte éphémère **Europe/Paris** avec API entièrement interceptée. Le code suivant permet de reproduire la sonde originale depuis la racine (serveur déjà lancé), sans modifier le dépôt. Exécuter dans un contexte jetable, pas dans une session utilisateur de production. Le script change uniquement l'état/stockage du contexte navigateur qu'il ferme.

```js
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({timezoneId:'Europe/Paris'});
 const page=await ctx.newPage();
 const out={};
 const open=async()=>{await page.goto('http://127.0.0.1:8080/');await page.waitForFunction(()=>window.tba&&typeof Chart!=='undefined')};
 const mk=(i,date='2026-09-22T10:00:00.000Z')=>({id:'a'+i,type:'commentCard',date,idMemberCreator:'m1',data:{card:{id:'c'+i,name:'Carte '+i}}});
 await page.route('https://api.trello.com/**',route=>{let u=new URL(route.request().url());let body=u.pathname.endsWith('/actions')?(u.searchParams.has('since')?[]:[mk(1),mk(2,'2026-09-21T10:00:00.000Z')]):u.pathname.endsWith('/members')?[{id:'m1',fullName:'Alice'}]:{id:'1234567890abcdef12345678',name:'Audit'};return route.fulfill({json:body})});
 await open(); await page.locator('#api-key').fill('fake-key');await page.locator('#api-token').fill('fake-token');await page.locator('#board-id').fill('Ab12Cd34');await page.locator('#btn-analyze').click();await page.waitForFunction(()=>tba.state.actions.length===2);
 out.deltaBefore=await page.evaluate(()=>tba.state.actions.length);await page.evaluate(()=>tba.refreshData(true));out.deltaAfter=await page.evaluate(()=>({actions:tba.state.actions.length,saved:JSON.parse(localStorage.getItem('trello-v3')).actions.length}));
 await page.evaluate(()=>tba.resetApp());await page.locator('#btn-demo').click();await page.waitForFunction(()=>tba.state.demo&&tba.state.actions.length===1284);
 out.exports=await page.evaluate(()=>{tba.state.filter.members=new Set(['Camille Martin']);tba.state.filter.query='';tba.renderDashboard(tba.state.board.name);const j=JSON.parse(tba.buildAnalysisJson());return {visible:tba.getVisible().length,jsonActions:j.actions.length,jsonStats:j.stats.total,htmlActions:JSON.parse(tba.buildHtmlExport('/* audit */').match(/window.__TBA_EMBEDDED__ = (.*);<\/script>/)[1]).actions.length}});
 out.selfTestFiltered=await page.evaluate(()=>{tba.state.filter.query='NO_MATCH_AUDIT';const r=tba.selfTest();return {failed:r.failed,failures:r.results.filter(x=>!x.ok)}});
 out.data=await page.evaluate(()=>{const norm=x=>tba.normalizeAction(x);const raw=[{id:'x1',type:'commentCard',date:'2026-09-22T10:00:00Z',_memberName:'Same',idMemberCreator:'m1',data:{card:{id:'c1',name:'Same card'}}},{id:'x2',type:'commentCard',date:'2026-09-22T10:30:00Z',_memberName:'Same',idMemberCreator:'m2',data:{card:{id:'c2',name:'Same card'}}}];const r=raw.map(norm),st=tba.computeStats(r); const tz=tba.computeStats([{...r[0],dateMs:Date.parse('2026-09-21T22:30:00Z')}]);return {rawCount:r.length,members:st.memberCounts.size,cards:st.cardCounts.size,firstRec:r[0],utcDays:[...tz.dayCounts.keys()],localHour:tz.peakHour,csv:tba.csvCell('=1+1'),nullPayloadAccepted:tba.validPayload({boardData:{name:'X'},actions:[null]})}});
 const ctx2=await browser.newContext();await ctx2.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})});const p2=await ctx2.newPage();await p2.goto('http://127.0.0.1:8080');await p2.waitForFunction(()=>window.tba);out.storage=await p2.evaluate(async()=>{tba.state.board={name:'audit'};tba.state.actions=[tba.normalizeAction({id:'a',type:'createCard',date:'2026-09-22T10:00:00Z',_memberName:'A'})];return {ok:await tba.persistData(),label:document.getElementById('save-label').textContent,savedAt:tba.state.savedAtIso}});
 console.log(JSON.stringify(out,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

```

Sortie effectivement obtenue (timestamp du stockage omis sauf sa présence) :

```json
{
  "deltaBefore": 2,
  "deltaAfter": {"actions": 0, "saved": 0},
  "exports": {"visible": 420, "jsonActions": 1284, "jsonStats": 420, "htmlActions": 1284},
  "selfTestFiltered": {"failed": 1, "failures": [{"name": "model kpis", "ok": false, "detail": ""}]},
  "data": {
    "rawCount": 2, "members": 1, "cards": 1,
    "firstRec": {"type": "commentCard", "date": "2026-09-22T10:00:00Z", "dateMs": 1790071200000, "id": "x1", "memberName": "Same", "cardName": "Same card"},
    "utcDays": ["2026-09-21"], "localHour": 0,
    "csv": "=1+1", "nullPayloadAccepted": true
  },
  "storage": {"ok": true, "label": "Sauvegardé", "savedAt": "2026-10-20T02:59:14.346Z"}
}
```

Interprétation bornée : delta vide démontre perte de la copie locale ; scope HTML complet est intentionnel selon README mais risqué au partage ; formule CSV **non exécutée** dans Excel ici ; collision de noms démontre modèle, pas prévalence chez utilisateurs ; exemple UTC/local démontre incohérence de convention et non un bug de Date.

### Vérification supplémentaire du dictionnaire de noms

Dans une **nouvelle page jetable**, après chargement :

```js
const date = '2026-09-22T10:00:00Z';
tba.byMemberPeriod([{date, _memberName:'__proto__'}], 'month');
({prototypeKey: Object.prototype['2026-09'],
  payloadAccepted: tba.validPayload({boardData:{name:'x'}, actions:[null]})});
```

Résultat observé : `{prototypeKey:1,payloadAccepted:true}`. Le contexte a ensuite été fermé. Ce constat ne prétend pas une exécution de code arbitraire ; il prouve l'écriture via prototype et suffit pour préférer un dictionnaire sans prototype en PLAN-006.

## 4. Vérifications volontairement non exécutées

- `npm run build:vendor` : écrirait un artefact source versionné, non nécessaire à l'audit. Entrée et script lus, pas de reconstruction prétendument identique.
- `npm run verify:pages` : hôte github.io non autorisé ; le script attend aussi un commit effectivement publié. L'état API Pages n'est pas une preuve d'octets identiques du site.
- Pas de test Trello authentifié, de rétention/exhaustivité réelle ni d'inclusivité officielle since. Union/recouvrement permet de ne pas bloquer le correctif P0 sur cette connaissance.
- Pas de Chrome épinglé Playwright/Firefox/Safari, de lecteur d'écran manuel, Excel/LibreOffice, pypdf/openpyxl ou benchmark 50k sur cette passe. Les récits historiques du README/PR ne sont pas convertis en résultats actuels.
- Pas de scanner exhaustif CSP/CDN, fuzzing ou audit PDF/ZIP64/unicode complet ; limites et portes de réouverture dans audit/vision.

## 5. Passe de couverture et validation documentaire

Passe 1 : fichiers suivis et parcours acquisition/reprise/démo/exports → delta, statut mémoire, portée et CSV. Passe 2 : appelants transversaux calendrier/briefing/comparateur, dictionnaire de noms et auto-test sous query → ajouts F06…F10 et plans associés. Vérification des canvas dans le factory : ils ont bien un nom accessible ; le plan 009 porte donc sur les **valeurs**, pas un faux défaut de nom.

Dernière relecture des générateurs : le XLSX calcule aussi directement son briefing via buildInsights/computeStats, sans passer uniquement par buildReportModel ; PLAN-008 a été précisé pour couvrir cet appelant. Aucune nouvelle architecture n'en découle.

Contrôles documentaires exécutés : 15 documents dont 9 plans ; aucun lien Markdown local manquant. `git diff --name-only HEAD` vide pour les fichiers préexistants, nouveaux fichiers exclusivement sous `docs/plans/**` ; branche de session inchangée. `git diff --check` n'a remonté aucune erreur sur les fichiers suivis ; un contrôle séparé des espaces finaux dans les nouveaux Markdown est utilisé car ils ne sont pas encore suivis. Dépendances sans cycle, ordre d'édition commun défini dans roadmap. Aucune modification source, style, dépendance, workflow ou interface existante réalisée par cet audit.

## 6. Exécution PLAN-001 — 2026-10-20

Les sections 1 à 5 ci-dessus décrivent l’audit initial, conservé historiquement. Cette section décrit la première implémentation, sur `b164f95` (fusion PR #11), branche active `arena/e47875e6-trello-board-activity-analyzer`, arbre initial propre.

- Installation `npm ci --ignore-scripts --no-audit --no-fund` : réussie, 41 packages, manifestes inchangés.
- Chromium épinglé indisponible dans ce sandbox : `@sparticuz/chromium@153.0.0` installé **hors dépôt** dans `/home/user/.cache/tba-execution/runtime`. Exécutable extrait dans `/tmp/chromium`. Premier lancement échoué : `libnspr4.so` absente, aucun test applicatif exécuté. L’archive `al2023.tar.br` de cette version extrait ses bibliothèques dans **`/tmp/lib`**, et non `/tmp/al2023/lib` cité lors de l’audit ; chemin effectivement constaté et utilisé ci-dessous. Aucune adaptation du projet à cet environnement.
- Baseline : `LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test` → **19 passed (33,4 s)**.
- Avant correction : même environnement, `npx playwright test tests/delta.spec.js` → **10 failed, 4 passed (58,5 s)**. Échecs : delta vide/nouvelles, absence de recouvrement, arrêt au connu prématuré, curseurs/garde-fou, board candidat. Les quatre succès préexistants couvrent annulations page 2, erreur page 2 et repli/vide.
- Après correction : même commande ciblée → **14 passed (13,6 s)** ; trois tests supplémentaires vérifient les fins normales au garde-fou et l’analyse vide.
- Suite complète finale : `LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test` → **36 passed (45,1 s)** (19 existants + 17 PLAN-001). Aucun test volontairement rouge conservé.
- Les mocks inspectent GET, `limit=1000`, `since` et `before` ; données/tokens entièrement synthétiques. Le harness MAX_PAGES=2 remplace le texte servi **uniquement en mémoire**, pas dans le fichier produit. Les vérifications comparent les IDs et la chaîne du snapshot avant/après erreur/annulation ; l’export JSON reste basé sur l’ancien historique.
- `git diff --check` réussi ; pas de vendor, lock, dépendance, configuration, rapport généré ou vraie donnée Trello ajouté.

Écart motivé au plan initial : ne pas arrêter à un ID connu ; la fixture multi-page au même instant démontre que cela peut omettre des ajouts. Toute la fenêtre delta est désormais paginée ; l’ordre existant et celui des ajouts ne sont pas retriés. Voir journal PLAN-001.

Limites inchangées : aucun appel live, navigateur épinglé/Firefox/Safari non exécutés, aucune validation Pages/publication ; le stockage honnête et les autres contrats restent à implémenter. PLAN-002 est le prochain lot prêt, pas une correction comprise dans ces résultats.

Implémentation poussée : `298da4024ae182546de0fb94ad439f0e6cf9a527`. Après garde explicite excluant le harness local (3 tests) des exécutions `BASE_URL`, revalidation locale complète : **36 passed (46,5 s)**, même commande/environnement. Le chemin distant `BASE_URL` n’a pas été exécuté ici. `node --check tests/app.spec.js`, `node --check tests/delta.spec.js`, contrôle des liens Markdown locaux et `git diff --check` réussis. Pas de PR créée, aucun run CI pour la branche lors du contrôle `gh run list` ; le workflow attend une PR, main ou un déclenchement manuel.

### PLAN-002 — 2026-10-21 · en cours

Prérequis PLAN-001 validé, branche autorisée active, arbre propre. Relecture Store et de tous ses consommateurs ; aucune migration requise. Tests de panne et consentement à ajouter avant correction.

### PLAN-002 — 2026-10-21 · validé localement

Implémentation 6298d9d. Avant correction : 10/10 tests ciblés échouaient ; après : 10/10 passent (6,5 s), puis test de sérialisation ajouté. Suite complète : 47/47 passent (48,3 s), commande LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test. Tous consommateurs Store relus (cache, thème, objectif, session), sans changement de leur signature publique ; suppression du faux plafond UTF-16. SecurityError, quota, rechargement ancien snapshot, date, retrait depuis démo, hôte succès/rejet et changements rapides vérifiés. Aucun test live ni navigateur épinglé ; Chromium alternatif 153. PLAN-003 et PLAN-006 ont leur prérequis satisfait ; prochain lot 003.

### PLAN-003 — 2026-10-21 · en cours

Prérequis 002 satisfait (47 tests verts). Relecture de tous les constructeurs, capture, ZIP, briefing et bootEmbedded ; changement de portée HTML intentionnel, pas de nouveau format.

### PLAN-003 — 2026-10-21 · validé localement

Implémentation 76b1857. Avant correction : 4/4 régressions échouaient. Après : 6 tests ciblés, répétés trois fois (18/18, 17,4 s), et suite complète 53/53 (59,8 s). Commande standard de session : LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test. Contrôles JSON/CSV/XLSX/ZIP STORE décodés, HTML offline puis reset/réexport, vue vide, debounce, verrouillage/restitution disabled, snapshot pendant attente et repli statique forcé. Tests d’attente stabilisés en neutralisant le préchauffage idle uniquement dans leurs pages de test ; une assertion de texte de carte dans le rapport statique (cartes rendues en images) remplacée par total/membre réellement présents. API publiques conservées. Aucun live/Pages/navigateur épinglé. Prochain lot 004.

### PLAN-004 — 2026-10-21 · en cours

Prérequis 003 validé (53 tests). Sérialiseur unique csvCell, deux appelants et SELF_SRC relus ; neutralisation tableur uniquement, JSON/XLSX exacts.

### PLAN-004 — 2026-10-21 · validé localement, tableur non vérifié

Implémentation 56c2418. 2 régressions rouges avant correction puis 2/2 ciblées (2,3 s) ; suite complète 55/55 (55,2 s). Même commande npm test et Chromium alternatif. Parseur de test RFC multiline, 15 préfixes hostiles et cas français, octets CSV direct/ZIP/offline, JSON/XLSX exacts sans formule vérifiés. Pas de tableur installé (command -v libreoffice/soffice vide) : vérification manuelle et universalité explicitement non revendiquées. Aucun mode raw ajouté. Prochain lot 006.

### PLAN-006 — 2026-10-21 · en cours

Prérequis 002 et provenance 003 intégrés ; lecture des validations, expansion, normalisation, tendances et selfTest. Objectif : rejet entier avant mutation, compatibilité v1/v3 et ancien rapport préservée.
