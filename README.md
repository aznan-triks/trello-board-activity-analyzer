# Trello Board Activity Analyzer

Analyse complète de l'historique d'un tableau Trello (API REST v1) — 100 % côté
client, dans un seul fichier `index.html` autonome (aucun build, aucun serveur).

> **v4.0.0** — refactor complet de l'artefact d'origine (v1) : même interface,
> mêmes écrans, mêmes graphiques, mêmes formats de sauvegarde (`trello-v3`),
> mêmes messages utilisateur — architecture, robustesse et fonctionnalités
> entièrement repensées. Testé par une suite E2E (jsdom) de 100 assertions qui
> compare chaque sortie à une implémentation de référence du code v1.

---

## Utilisation

1. Ouvrez `index.html` (ou servez-le : `python3 -m http.server`).
2. Renseignez **API Key** ([trello.com/app-key](https://trello.com/app-key)),
   **Token** et **Board ID ou URL** complète (`https://trello.com/b/xxxx/...`).
3. « Analyser tout le tableau » télécharge tout l'historique (pagination
   `before` de 1 000 actions), le persiste au format « slim » et affiche le
   dashboard. Une session sauvegardée est proposée au rechargement de la page.

## Fonctionnalités d'origine (intégralement préservées)

| Zone | Comportement conservé |
|---|---|
| Setup | 3 champs, extraction d'ID par regex `trello.com/b/<id>`, bannière de reprise (date FR, nb d'actions), Recharger / Effacer, pré-remplissage des identifiants, erreurs exactes (`Veuillez remplir tous les champs.`, `Erreur API (n) — vérifiez vos identifiants.`, `Données corrompues.`, `Aucune donnée trouvée.`) |
| Chargement | Écran spinner + barre de progression avec les mêmes paliers (5 → 15 → +4/page plafonné à 85 → 90 → 100) et les mêmes libellés |
| Sauvegarde | Clé `trello-v3`, payload `{boardData, actions, creds, savedAt}`, schéma slim `{t,d,m,c}`, garde-fou 4,8 Mo (`Trop volumineux (x.xx MB)`), pastille d'état (Sauvegarde…/Sauvegardé/erreur) |
| Stats | Total actions + « sur N jours », membres actifs + top, jour le + actif + compte, moyenne/semaine — formules et cas particuliers (ties, `+ ' actions'`) à l'identique |
| Graphiques | Timeline semaine/mois (bucket dimanche local → clé ISO), barres membres (troncature 18/16, hauteur `max(120, n·32+40)`), donut types groupés (`ACTION_GROUPS`), heatmap Lun→Dim × 0-23h (alpha `√(v/mx)`, tooltips `Dim 0h: N action(s)`), tendances top-5 membres, top-10 cartes (22/20), activité horaire (`.25+.75·v/mx`) — Chart.js 4.4.1, palettes, polices monospace, axes : tout conservé |
| Flux | `refreshData` complet, `resetApp` (destruction des charts, re-`checkSaved`), granularité qui mémorise les membres de tendances (`renderTrends(null)`) |

## Extensions (ajouts complets, aucune régression)

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
- **Exports** : CSV d'actions (RFC 4180, BOM UTF-8, séparé des téléchargements
  via `buildActionsCsv`/`buildAnalysisJson` testables), JSON d'analyse complet,
  PNG de la timeline.
- **Sécurité** : échappement HTML systématique des noms API (légendes, tooltips
  heatmap, chips, tableau), validation de l'ID de board avant d'urller l'URL,
  token en champ `password`, case « Conserver les identifiants » (décochée =
  non persistés), journal technique avec masquage automatique des secrets,
  `rel="noopener"` sur les liens externes.
- **Robustesse** : `window.onerror`/`unhandledrejection` → toast + journal ;
  parsing JSON défensif partout ; actions de date invalide ignorées et tracées ;
  garde anti-`NaN` sur les couleurs horaires (plantage potentiel v1 sur board
  vide corrigé) ; adaptateur de stockage `window.storage` → `localStorage` →
  mémoire (l'app reste utilisable hors hôte artifacts) ; repli CDN
  jsDelivr/unpkg si cdnjs est injoignable.
- **Accessibilité / confort** : `lang="fr"`, labels `for/id`, `role`/`aria-live`,
  focus visibles, `Escape` ferme journal/menu, Entrée soumet le formulaire,
  CSS `@media print`, tooltips avec noms complets tronqués.

## Architecture du fichier

```
1  CONFIG        constantes, seuils, palettes, ACTION_GROUPS (+ index O(1))
2  UTILS         $, esc, fmt, periodKey (sémantique v1 documentée)
3  LOGGER        anneau 400 entrées, redaction des secrets, never-throw
4  STORAGE       adapter window.storage / localStorage / mémoire
5  TRELLO CLIENT fetchJSON (timeout, retries, limiter), pagination, since/before
6  DATA STORE    normalisation, dédoublonnage, slim/expand (contrat v1)
7  STATE         état unique + styles d'affichage d'origine
8  STATS ENGINE  computeStats mono-passage + byPeriod/byMemberPeriod (v1)
9  CHART KIT     factory destroy+rebuild (parité v1), fallback CDN
10 VIEWS          setup / loading / dashboard, sous-rendus isolés
14-16            filtres, heatmap share, granularité
17 WIRING        init unique, events, error boundary
18 API PUBLIQUE  window.tba + alias globaux non conflictuels (rétrocompat)
```

La construction des statistiques est passée de ~6 boucles + tri complet (v1) à
une **simple passe** réutilisée par tous les graphiques ; les sous-rendus
(filtres, granularité) ne reconstruisent que les blocs concernés.

## Vérification

`tests` (hors dépôt) : suite E2E jsdom — analyse complète, chemins d'erreur
401/validation, reprise de session v1 et v3, delta avec fusion/dédup, toggles,
filtres, export, annulation, board vide, XSS d'échappement — chaque sortie DOM
et chaque config de graphique est comparée à une **copie de la logique v1**.

## Notes & limites

- Les identifiants sont transmis uniquement à `api.trello.com` (HTTPS), en query
  — comme la v1, contrainte de l'API Trello. Le stockage local (artefact ou
  `localStorage`) peut les contenir si vous laissez l'option cochée.
- L'API Trello limite l'historique accessible ; `filter=all` récupère tout ce
  qui est exposé.
- L'export PNG dépend de `canvas.toBlob`/`toBase64Image` (navigateurs modernes).
