# Trello Board Activity Analyzer

Analyse complète de l'historique d'un tableau Trello (API REST v1) — 100 % côté
client, sans build ni serveur applicatif. Le code applicatif reste dans
`index.html` ; Chart.js 4.4.1 est livré dans `vendor/` (licence MIT incluse).
Les rapports HTML exportés restent des fichiers uniques autonomes.

> **v7.0.0** — habillage technologique : thème **sombre néon par défaut**
> (clair et auto conservés, choix persisté), panneaux de verre à rail
> supérieur dégradé et liseré lumineux, fond quadrillé technique fixé au
> défilement avec ligne de balayage, titre du héros en dégradé de texte et
> accroche pulsante, chiffres / KPI / commandes en chasse fixe capitales
> espacées, **graphiques et heatmap pilotés par jetons CSS** (`--chart-*`,
> `--hm-*`, `--neon-*`) qui suivent le thème au lieu de couleurs figées,
> planche PNG **sombre néon** (panneaux sombres sous les graphiques) tandis
> que le PDF et le rapport HTML restent **clairs** (captures prises sous le
> thème adapté puis thème utilisateur restauré), animations décoratives
> (pulse, balayage) supprimées sous `prefers-reduced-motion`.
>
> **v6.0.0** — nouvelle interface sans esthétique terminal : typographie sans
> empattement, accents violet/menthe/corail, cartes aérées, accueil guidé,
> thèmes clair/sombre et micro-interactions respectant les préférences de mouvement.
> Démonstration de 1 284 actions fictives sans identifiants ni sauvegarde,
> navigation clavier améliorée, validation des URL courtes Trello corrigée,
> graphique des types par période corrigé. Identifiants mémorisés uniquement
> sur consentement explicite. Tests navigateur et accessibilité automatisés.
>
> **v5.1.0** — refonte visuelle : palette claire/sombre fraîche (bleu
> Atlassian + neutres froids), surfaces avec ombres légères, coins arrondis
> modernisés, série principale des graphiques et heatmap assorties au bleu,
> rapport PDF et export PNG harmonisés.
> **v5.0.0** — exports enrichis et confort d'usage : **rapport HTML interactif
> hors-ligne** (fichier autonome), **rapport PDF A4** (générateur PDF intégré,
> zéro dépendance), **Markdown**, **Classeur Excel .xlsx**, **archive ZIP
> complète**, **planche PNG** — en plus des exports v4 (CSV, JSON, PNG).
> Palette autonome + thème clair/sombre, raccourcis clavier, self-test intégré,
> reprise hors-ligne de la librairie graphique.
> **v4.0.0** — refactor complet de l'artefact d'origine (v1) : même interface,
> mêmes écrans, mêmes graphiques, mêmes formats de sauvegarde (`trello-v3`),
> mêmes messages utilisateur. Testé par une suite E2E (jsdom) de 100 assertions
> qui compare chaque sortie à une implémentation de référence du code v1.

---

## Utilisation

1. Visitez [l’application sur GitHub Pages](https://aznan-triks.github.io/trello-board-activity-analyzer/)
   ou servez le dépôt : `python3 -m http.server 8080`.
   Le bouton **Explorer la démonstration** permet de tout essayer sans compte.
2. Renseignez **API Key** ([trello.com/app-key](https://trello.com/app-key)),
   **Token** et **Board ID ou URL** complète (`https://trello.com/b/xxxx/...`).
3. « Analyser mon tableau » télécharge tout l'historique (pagination
   `before` de 1 000 actions), le persiste au format « slim » et affiche le
   dashboard. Une session sauvegardée est proposée au rechargement de la page.

Le dépôt peut aussi s’ouvrir en `file://` en conservant `vendor/` à côté
 d’`index.html`. Un serveur statique est recommandé : certains navigateurs
bloquent la récupération du bundle pour les exports interactifs en `file://`
(un export statique reste proposé en repli). Sur HTTP(S), Chart.js est chargé
localement et mis en cache ; les CDN ne servent que de secours si le bundle
local est manquant. Aucune police ni ressource graphique distante n’est requise.

Les identifiants ne sont **pas mémorisés par défaut**. La case dédiée permet
de les conserver sur un appareil de confiance. Les données du tableau restent
sauvegardées localement indépendamment de ce choix. La démonstration ne remplace
jamais une sauvegarde existante et ses exports portent « démo » dans le nom du tableau.

---

## Exports (v5) — menu « ⤓ Export »

Les exports respectent la **vue courante** (filtres membres/dates inclus) ; le
rapport HTML embarque en plus **toutes** les actions avec l'état des filtres —
on peut donc les desserrer dans le rapport. Aucun export n'inclut jamais vos
identifiants API.

| Format | Fichier | Contenu |
|---|---|---|
| **Rapport HTML interactif (hors-ligne)** | `*-rapport-*.html` | **Fichier autonome** : styles + Chart.js + l'application (mode rapport) + données embarquées. Une fois téléchargé, il s'ouvre dans n'importe quel navigateur **sans connexion** et reste **pleinement interactif** : filtres membres/dates, tri du tableau, granularité semaine/mois, heatmap volume/part %, tooltips — et il peut lui-même **re-exporter** (CSV, JSON, Markdown, PNG, PDF, HTML). Aucun identifiant embarqué ; noms de cartes échappés (`\u003c`) contre l'injection de script. |
| **Rapport PDF (A4)** | `*-rapport-*.pdf` | Document multi-pages : bandeau + 8 indicateurs, les 8 graphiques en images JPEG (DCTDecode), **heatmap vectorielle**, top cartes, **tableau détaillé par membre**, pieds de page « Page n / N ». Écrit par un **mini-générateur PDF intégré** (PDF 1.4, Helvetica/Courier WinAnsi — accents français OK), sans aucune dépendance. v7 : toujours **clair** — les instantanés de graphiques sont pris sous thème clair puis le thème utilisateur est restauré. |
| **Rapport Markdown** | `*-synthese-*.md` | Synthèse (KPI), tableaux membres / cartes / types — prêt pour un wiki ou un dépôt. |
| **Classeur Excel (.xlsx)** | `*-classeur-*.xlsx` | OOXML réel (3 feuilles : **Synthèse**, **Membres**, **Actions**), en-têtes figés, colonnes dimensionnées. Empaqueté par le mini-ZIP intégré (STORE + CRC-32). |
| **Archive ZIP complète** | `*-archive-*.zip` | Tout d'un coup : `rapport.html`, `rapport.pdf`, `analyse.json`, `actions.csv`, `synthese.md`, `membres.xlsx`, `graphiques/*.png` (8 graphiques + `planche.png`), `readme.txt` (manifeste). |
| Actions — CSV (Excel) *(v4)* | `*-actions-*.csv` | CSV RFC 4180, BOM UTF-8 — inchangé. |
| Analyse complète — JSON *(v4)* | `*-analyse-*.json` | Stats + actions brutes, sans identifiants — inchangé. |
| Timeline — PNG *(v4)* | `*-timeline-*.png` | Image de la timeline — inchangé. |
| **Planche — tous les graphiques (PNG)** | `*-planche-*.png` | Une seule image : en-tête, 8 indicateurs, les 8 graphiques et la heatmap. v7 : composition **sombre néon** (fond et panneaux sombres sous les graphiques, barre d'en-tête dégradée), quel que soit le thème actif. |

**Export PDF via navigateur** : le CSS `@media print` d'origine est conservé —
`Ctrl+P` sur le dashboard reste possible (et sur le rapport statique, avec son
bouton « Imprimer / PDF »).

**Rapport HTML statique (repli)** : si le bundle Chart.js ne peut pas être
récupéré à l'export (hors-ligne, sans cache), le rapport HTML est généré en
mode **statique** : mêmes indicateurs, graphiques en images, heatmap et tableau
triable — et un bouton impression.

---

## Raccourcis clavier

Dashboard actif, hors champs de saisie (bouton « ⌨ Raccourcis » ou `?`) :

| Touche | Action |
|---|---|
| `E` | Menu « Export » |
| `P` | Exporter le rapport PDF |
| `H` | Exporter le rapport HTML hors-ligne |
| `G` | Basculer granularité semaine / mois |
| `T` | Thème : auto → clair → sombre |
| `/` | Filtrer un membre |
| `?` | Aide clavier |
| `Esc` | Fermer fenêtres et menus |

---

## Fonctionnalités d'origine (intégralement préservées)

| Zone | Comportement conservé |
|---|---|
| Setup | 3 champs, extraction d'ID par regex `trello.com/b/<id>`, bannière de reprise (date FR, nb d'actions), Recharger / Effacer, pré-remplissage des identifiants, erreurs exactes (`Veuillez remplir tous les champs.`, `Erreur API (n) — vérifiez vos identifiants.`, `Données corrompues.`, `Aucune donnée trouvée.`) |
| Chargement | Écran spinner + barre de progression avec les mêmes paliers (5 → 15 → +8/page plafonné à 85 → 90 → 100) et les mêmes libellés |
| Sauvegarde | Clé `trello-v3`, payload `{boardData, actions, creds, savedAt}`, schéma slim `{t,d,m,c}`, garde-fou 4,8 Mo (`Trop volumineux (x.xx MB)`), pastille d'état (Sauvegarde…/Sauvegardé/erreur) |
| Stats | Total actions + « sur N jours », membres actifs + top, jour le + actif + compte, moyenne/semaine — formules et cas particuliers (ties, `+ ' actions'`) à l'identique |
| Graphiques | Timeline semaine/mois (bucket dimanche local → clé ISO), barres membres (troncature 18/16, hauteur `max(120, n·32+40)`), donut types groupés (`ACTION_GROUPS`), heatmap Lun→Dim × 0-23h (alpha `√(v/mx)`, tooltips `Dim 0h: N action(s)`), tendances top-5 membres, top-10 cartes (22/20), activité horaire (`.25+.75·v/mx`) — Chart.js 4.4.1, moteur conservé, typographie sans empattement et couleurs adaptées au thème en v6, puis **séries, légendes et heatmap pilotées par jetons CSS** (`--chart-*`, `--hm-*`) en v7 |
| Flux | `refreshData` complet, `resetApp` (destruction des charts, re-`checkSaved`), granularité qui mémorise les membres de tendances (`renderTrends(null)`) |
| Exports v4 | `buildActionsCsv` / `buildAnalysisJson` : sorties **octet à octet inchangées** (contrat des tests E2E) |

## Extensions

### v5 — exports, hors-ligne, confort

- **Rapport HTML interactif hors-ligne** : l'export est **l'application
  elle-même** en « mode rapport » (`window.__TBA_EMBEDDED__`) — le script se
  capture au démarrage (source + markup + CSS) et le bundle Chart.js est
  inliné. Zéro duplication de logique : le rapport a exactement les mêmes
  rendus, et l'interactivité (filtres, tris, toggles, re-exports) marche
  hors-ligne pour toujours.
- **Mini-PDF intégré** (`buildPdfReport`) : writer PDF 1.4 (catalogue, pages,
  polices WinAnsi, XObject images DCTDecode, xref classique). Heatmap et
  encarts KPI en vectoriel ; tableau membres paginé ; mesures de texte
  approchées pour les retours à la ligne.
- **Mini-ZIP + XLSX** : archives STORE avec CRC-32 (validé sur le vecteur
  `crc32("123456789") = 0xCBF43926`) ; classeur OOXML 3 feuilles (chaînes
  inline, volets figés) lisible par Excel, Numbers, LibreOffice.
- **Planche PNG** : composition canvas unique (en-tête, KPI, 8 graphiques,
  heatmap dessinée).
- **Exports robustes** : constructeurs purs séparés des téléchargements
  (`build*` testables), garde anti double-clic, chaque export en try/catch →
  toast + journal (jamais de crash), messages de taille.
- **Hors-ligne** : bundle Chart.js mis en cache local (`trello-v3:chartjs:…`)
  après le premier chargement — l'app et les exports HTML repartent sans CDN ;
  cache pré-chauffé en tâche de fond après analyse.
- **Palette autonome + thème** : jetons CSS locaux injectés seulement si
  l'hôte n'en fournit pas (ou si l'utilisateur force clair/sombre) ; suivi de
  `prefers-color-scheme` ; préférence persistée (`trello-v3:theme`). v7 :
  **sombre par défaut** sans préférence mémorisée ; cycle clair → sombre → auto.
- **Raccourcis clavier** + fenêtre d'aide (`?`), `aria-*` sur la fenêtre,
  `prefers-reduced-motion` respecté.
- **Self-test intégré** : `tba.selfTest()` (console) — 24 contrôles sur les
  helpers purs (CSV, slim/expand, validPayload, CRC/ZIP, PDF header/xref/flux,
  Markdown, XLSX, HTML inlining sûr, jetons de couleur v7).

### v4 — robustesse, analyses, sécurité (toutes conservées)

- **Fiabilité réseau** : timeout par requête (30 s), retries avec backoff
  exponentiel + jitter et respect de `Retry-After` (429/5xx/réseau), fenêtre
  glissante 90 req/10 s, réserve anti-rate-limit après écritures, garde-fou de
  pagination, dédoublonnage par id.
- **Annulation** : bouton « ✕ Annuler » pendant le chargement (`AbortController`
  câblé jusqu'au niveau requête) — message dédié, retour au setup propre.
- **Rafraîchissement Δ (« ⤒ Delta »)** : `since` = dernière action connue + arrêt
  anticipé dès qu'une page retombe sur des id sauvegardés ; repli automatique
  sur un rechargement complet pour les sauvegardes v1 sans ids (les payloads
  écrits depuis la v1 ne contenaient pas `i` — ils restent lisibles à 100 %).
- **Filtres** : par membres (recherche + chips) et plage de dates — tout le
  dashboard se recalcule sur le sous-ensemble ; la sauvegarde reste les données
  complètes ; état vide = comportement v1 exact.
- **Analyses additionnelles** : stats avancées (commentaires et leur part,
  moyenne/jour, heure de pointe, part week-end, série continue max, ratio
  jour/nuit), aire empilée « Types d'actions par période », donut Semaine vs
  Week-end, tableau détaillé par membre triable (actions, commentaires, cartes
  touchées, jours actifs, dernière activité), heatmap en mode « Répartition % ».
- **Sécurité** : échappement HTML systématique des noms API (légendes, tooltips
  heatmap, chips, tableau), validation de l'ID de board avant d'urller l'URL,
  token en champ `password`, case « Mémoriser mes identifiants » (décochée par défaut = non
  persistés), journal technique avec masquage automatique des secrets,
  `rel="noopener"` sur les liens externes. **Exports** : JSON embarqué protégé
  (`<` → `\u003c`), jamais d'identifiants, HTML inline sans fermeture de script
  accidentelle.
- **Robustesse** : `window.onerror`/`unhandledrejection` → toast + journal ;
  parsing JSON défensif partout ; actions de date invalide ignorées et tracées ;
  garde anti-`NaN` sur les couleurs horaires (plantage potentiel v1 sur board
  vide corrigé) ; adaptateur de stockage `window.storage` → `localStorage` →
  mémoire (l'app reste utilisable hors hôte artifacts) ; repli CDN
  jsDelivr/unpkg puis cache local si cdnjs est injoignable.
- **Accessibilité / confort** : `lang="fr"`, labels `for/id`, `role`/`aria-live`,
  focus visibles, `Escape` ferme journal/menu/aide, Entrée soumet le formulaire,
  CSS `@media print`, tooltips avec noms complets tronqués.

## Architecture du fichier

```
0  SELF-CAPTURE    source + markup + CSS captés au boot (exports autonomes)
1  CONFIG          constantes, seuils, palettes, ACTION_GROUPS, exports
2  UTILS           $, esc, fmt, periodKey (sémantique v1 documentée)
3  LOGGER          anneau 400 entrées, redaction des secrets, never-throw
4  STORAGE         adapter window.storage / localStorage / mémoire
5  TRELLO CLIENT   fetchJSON (timeout, retries, limiter), pagination, since/before
6  DATA STORE      normalisation, dédoublonnage, slim/expand (contrat v1)
7  STATE           état unique + styles d'affichage d'origine
8  STATS ENGINE    computeStats mono-passage + byPeriod/byMemberPeriod (v1)
9  CHART KIT       factory destroy+rebuild (parité v1), fallback CDN + cache
10 VIEWS           setup / loading / dashboard, sous-rendus isolés
14-16              filtres, heatmap share, granularité
15b EXPORT MODEL   buildReportModel / heatMatrix (partagé par tous les formats)
15c MARKDOWN       buildMarkdownReport
15d MINI PDF       encodage WinAnsi, layout A4, images DCTDecode, xref
15e MINI ZIP/XLSX  crc32, zipStore, OOXML 3 feuilles
15f IMAGES         captures JPEG/PNG, planche contact-sheet
15g HTML EXPORT    payload embarqué, rapport interactif + repli statique
15h EXPORT ACTIONS exportHtml/Pdf/Markdown/Xlsx/Sheet/Zip (+ v4 CSV/JSON/PNG)
15i MODE RAPPORT   visionneuse d'un export HTML (bootEmbedded)
16b RACCOURCIS     clavier + fenêtre d'aide
17b THÈME          palette autonome, sombre par défaut (v7), captures thémées
18 SELF-TEST       tba.selfTest()
19 WIRING          init unique, events, error boundary
API PUBLIQUE       window.tba + alias globaux non conflictuels (rétrocompat)
```

La construction des statistiques est passée de ~6 boucles + tri complet (v1) à
une **simple passe** réutilisée par tous les graphiques et tous les exports ;
les sous-rendus (filtres, granularité) ne reconstruisent que les blocs
concernés. Le rapport HTML hors-ligne n'importe **aucune duplication** : il
relance la même application avec `window.__TBA_EMBEDDED__`.

## Vérification

- `tba.selfTest()` (console) : 24 assertions sur les helpers purs des exports.
- Suite E2E jsdom (hors dépôt) : analyse complète, chemins d'erreur
  401/validation, reprise de session v1 et v3, delta avec fusion/dédup, toggles,
  filtres, export, annulation, board vide, XSS d'échappement — chaque sortie DOM
  et chaque config de graphique est comparée à une **copie de la logique v1**.
- Validations complémentaires v5 (hors dépôt) : le PDF lit avec `pypdf`
  (texte français + images DCTDecode), le XLSX avec `openpyxl` (3 feuilles),
  le ZIP par lecture de l'EOCD, et le rapport HTML exporté est **rouvert et
  utilisé** dans un second jsdom (filtres, tri, granularité, re-exports).


## Développement, tests et livraison (v6)

```sh
npm ci
npx playwright install --with-deps chromium
npm test
```

Le serveur statique démarre automatiquement pour les tests. Aucun `npm install`
n’est nécessaire pour utiliser ou publier l’application. Pour inspecter le
rapport de tests : `npx playwright show-report`.

La suite Playwright (18 scénarios) couvre : affichage à 360/390/768/1440 px,
débordements du menu mobile, parcours de démonstration, filtres et état vide,
granularité, cohérence des séries, tri au clavier, thème sombre par défaut et
persistance du choix, focus des modales, réduction des animations (décoratives
comprises : aucune animation sous `prefers-reduced-motion`), audits axe WCAG
A/AA en clair et sombre — étendus au menu d’export, à l’aide clavier et au
journal —, stockage bloqué, consentement de stockage des identifiants,
échappement HTML, absence de secrets dans les exports, impression et neuf
formats d’export.
Le rapport HTML est réouvert avec le réseau bloqué. Les parcours API sont
**simulés** (succès, delta, reprise, erreur 401, annulation), sans secret réel.
Le self-test historique des constructeurs est aussi exécuté dans Chromium.
Ces audits automatisés ne remplacent pas un audit manuel exhaustif avec des
technologies d’assistance, ni un essai avec un vrai tableau Trello autorisé.

### GitHub Pages

Le site public est publié depuis **`main` / racine** (`https://aznan-triks.github.io/trello-board-activity-analyzer/`),
en mode « Deploy from a branch » — donc **aucun traitement Jekyll** grâce à
`.nojekyll`, qui publie l'arborescence telle quelle. C'est pour cela que seules
les modifications arrivées sur `main` sont visibles en ligne : une branche de
travail (par exemple `arena/…`) n'est jamais publiée, elle doit être fusionnée
par pull request.

Conserver `index.html` et `vendor/` ensemble ; toutes les ressources utilisent
des chemins relatifs compatibles avec le sous-chemin du dépôt.

1. Ouvrir une pull request depuis la branche de travail (`arena/…`) vers `main`.
2. Attendre le workflow **Validation UI et fonctionnelle** (18 scénarios
   navigateur + audits WCAG), puis fusionner — le merge doit aller **sur `main`**.
3. Attendre la publication **pages build and deployment** du commit de fusion.
4. Le job **Vérification du site publié** (déclenché par le push sur `main`)
   contrôle automatiquement, sans secret ni intervention :
   - chaque fichier du dépôt demandé à Pages : **HTTP 200** et **SHA-256
     identique** au fichier local (arborescence complète, pas seulement
     `index.html`) ;
   - le **périmètre applicatif obligatoire** (`index.html`, `.nojekyll`,
     `vendor/**`) : un fichier manquant, tronqué ou divergent échoue le job ;
   - la **racine du site** (`/`) : même HTML que `index.html`, version de
     `package.json` et titre attendus ;
   - l'**état de publication Pages** pour le commit courant via l'API GitHub ;
   - puis rejoue les 18 scénarios contre l'URL publique.
   Le récapitulatif (empreinte SHA-256 de l'arborescence publiée, tableau
   fichier par fichier) est écrit dans le **résumé du job** et en **annotations
   de check** (visibles dans l'interface Actions et via l'API) ; les captures et
   traces restent dans les artefacts CI (7 jours), pas dans Git.

Pour revérifier le site sans nouveau commit : onglet **Actions** → workflow
**Validation UI et fonctionnelle** → **Run workflow** → renseigner `base_url`
(ex. `https://aznan-triks.github.io/trello-board-activity-analyzer/`). Le job
**Vérification du site publié** rejoue alors le contrôle complet et les
18 scénarios contre cette URL (`base_url` vide = simple exécution locale).

En cas de contenu divergent (propagation Pages parfois lente), le job réessaie
20 fois à 15 s d'intervalle avant d'échouer avec un diagnostic précis
(fichier, taille et empreinte publiées vs attendues).

Vérification manuelle, avant ou après fusion :

```sh
npm run serve                                      # terminal 1 : http://127.0.0.1:8080
BASE_URL=http://127.0.0.1:8080/ npm run verify:pages  # terminal 2
BASE_URL=http://127.0.0.1:8080/ npm test              # les 18 scénarios

# ou directement contre le site publié :
BASE_URL=https://aznan-triks.github.io/trello-board-activity-analyzer/ npm run verify:pages
BASE_URL=https://aznan-triks.github.io/trello-board-activity-analyzer/ npm test
```

`VERIFY_ATTEMPTS` et `VERIFY_DELAY_MS` ajustent la patience du contrôle
(utile pour tester le script rapidement en local).

En cas de régression, révoquer le changement par une pull request de revert
vers `main`, puis attendre la nouvelle publication Pages et sa vérification
automatique.
