# PLAN-001 — Actualisation sans perte et collecte complète atomique

**Statut : validé localement (2026-10-20 ; limites ci-dessous) · Priorité : P0 — Critique.** Un usage fondamental peut effacer la copie locale de l'historique ; coût borné, preuve reproductible. Session cible : client/pagination/flux et tests associés, sans refonte.

## 1. Problème et preuves

[F01](../01-etat-des-lieux.md) : `index.html:2351–2390`, fusion conditionnée à `stoppedAtKnown`, puis sauvegarde. Reproduction **2 → 0** après delta vide. Le mock `tests/app.spec.js:33–44` ignore les paramètres. Pagination sort en succès au garde-fou/curseur absent (`1610–1654`).

## 2. Objectif précis

Tout delta réussi conserve les anciens IDs ; une collecte incomplète ou annulée ne remplace ni l'état consultable ni le snapshot persistant. Ne pas effacer des données pour afficher une erreur.

## 3. Comportement cible

Contrat [C1](../03-vision-cible.md). Si `incremental && haveIds`, fusionner toujours nouvelles actions et anciennes avec déduplication par ID, même si `stoppedAtKnown=false` ou liste vide. Le mode complet reste remplaçant. Le repli ancien slim sans IDs reste **complet**, pas un mélange ambigu.

Préparer les listes/board candidats dans les variables du flux, ne les affecter à `state` qu'après collecte valide. Pas de copie historique supplémentaire durable. Une page pleine sans curseur, curseur répété ou MAX_PAGES atteint alors qu'une page supplémentaire serait nécessaire = erreur explicite « historique incomplet », pas succès tronqué.

## 4. Décisions techniques et alternative

Réutiliser `normalizeActions`, Set, `fetchAllActions`, `slimAction`, `persistData` ; pas de SDK. Recouvrement `since = maxMs - 1000` pour les actions de même instant et IDs dédupliqués. Commentaire requis : `shortcut: delta append-only avec recouvrement d'une seconde, utiliser le rechargement complet pour réconcilier les modifications ou suppressions anciennes`. R3 confirme fenêtre since/before sans certifier son inclusivité. Alternative de secours : désactiver Delta et garder complet si une API réelle invalide ce contrat ; pas de backend événementiel.

## 5. Périmètre et points d'impact

- `index.html` : `analyzeBoard`, `refreshData`, `fetchAllActions`, appels `loadMemberMap/fetchJSON`, messages/progression ; `state.board/actions`, `persistData`, rendu sur erreur.
- Appelants : boutons `btn-refresh`/`btn-refresh-inc` câblés dans `init`, `tba.refreshData` et alias globaux ; `startAnalysis → analyzeBoard`. Ne pas changer leurs signatures.
- Tests : `tests/app.spec.js`, mock sensible à `since/before`, fixtures synthétiques locales au test. Ne pas utiliser de vrais noms/tokens.
- Documentation : README actualisation/complétude. Formats d'export et config CI inchangés ; les exports doivent continuer à voir l'ancien état après échec.
- Risque utilisateur : permutation d'ordre ou doublons ; préserver l'ordre récent d'abord et l'ordre stable des égalités existantes plutôt que tri opportuniste global.

## 6. Étapes ordonnées

1. Ajouter régressions qui échouent sur code actuel : delta vide, nouvelles uniquement, mélange nouvelles/connues et sauvegarde, même milliseconde ; simuler deux pages pleines/chevauchantes.
2. Faire répondre le mock par route/paramètres au lieu de toujours renvoyer l'historique. Garder le scénario nominal existant avec ses 12 actions.
3. Calculer mode effectif une seule fois ; préparer since/knownIds puis candidat union ou remplacement selon ce mode, pas selon `stoppedAtKnown`.
4. Détecter absence/stagnation de curseur sur page pleine. Au garde-fou, lever erreur et ne pas appeler persistData. Une page courte ou vide constitue la fin normale.
5. Conserver board/actions précédents tant que board et collecte candidats ne sont pas valides ; publier ensuite, puis persister. Une erreur de persistance ne doit pas supprimer l'état candidat consultable (002 traitera le statut).
6. Vérifier retour visuel/annulation, mise à jour complète d'un tableau vide et repli v1 ; adapter README et commentaire de limite.

## 7. Dépendances / prérequis

Aucune implémentation préalable ; baseline Playwright [protocole](../research/verifications.md). Ne pas attendre l'accès live officiel pour corriger l'union démontrée. PLAN-002 dépend de ce flux stabilisé.

## 8. Contraintes à préserver / non-objectifs

Lecture slim sans IDs, API globale, démo non persistée, pagination 1000, pas d'écriture Trello. **Ne pas** ajouter snapshots multiples, IndexedDB, nouvelle interface de synchronisation, statistiques ou suppression de doublons par noms/date.

## 9. Cas limites et risques

Vide initial, full vide volontaire, delta vide, tous IDs connus, nouvelle action au même timestamp, doublons interpages, erreur page 2, page pleine répétée, annulation en collecte, IDs legacy absents. Les suppressions upstream ne sont pas reflétées par delta : l'annoncer. MAX_PAGES reste un garde-fou, pas une garantie d'exhaustivité Trello.

## 10. Tests et vérifications

Routes inspectent `since/before`, vérifient max 1000/page, ordre et IDs. Test de stagnation échoue en deux réponses plutôt qu'un million d'actions. Pour MAX_PAGES, inspection de la branche de contrôle et petit harness d'exécution à constante abaissée **en mémoire seulement** si un test est nécessaire, sans option produit de test. Vérifier snapshot avant/après au niveau JSON. `npm test` complet.

## 11. Critères d'acceptation mesurables

- Seed `{a,b}` + delta vide → `{a,b}` en état et sauvegarde ; delta `{c}` → `{c,a,b}` sans doublon ; chevauchement `b` ne double rien.
- Échec/annulation en page 2 et curseur stagnant : anciens IDs/snapshot inchangés, erreur visible, chargement fermé.
- Full complet vide → zéro action accepté ; legacy sans IDs appelle le mode complet.
- 19 scénarios de base + régressions passent, aucune requête d'écriture ni donnée confidentielle ajoutée.

## 12. Définition du travail terminé

Changement limité aux sections citées, tests démontrant la cause avant/après, README exact, diff relu, résultats consignés. Ne déclarer terminé qu'après ces preuves ; le dossier initial ne contenait aucune correction.

## 13. Sources et références

Audit F01/F12 ; recherche [R3/R8 et comparaison acquisition](../02-recherche-et-options.md) ; vision C1 ; roadmap J1 ; PLAN-002 pour distinguer échec de stockage et échec d'acquisition.

## Journal d’exécution — 2026-10-20

- Branche autorisée active `arena/e47875e6-trello-board-activity-analyzer`, base `b164f95`, arbre initial propre ; aucun correctif antérieur constaté. Aucun prérequis d’implémentation.
- Lecture du dossier et vérification des appelants : les défauts F01 sont toujours présents.
- `npm ci --ignore-scripts --no-audit --no-fund` réussi ; baseline : **19 tests passent (33,4 s)** avec Chromium alternatif 153, sans modification de configuration/dépendances. Commande et limites dans le protocole.
- Régressions et implémentation à venir ; aucun critère déclaré validé à ce stade.

### Preuve complémentaire avant correction

Les 14 régressions de `tests/delta.spec.js` exécutées sur le code initial donnent **10 échecs, 4 réussites (58,5 s)**. Le delta vide perd les IDs, le `since` manque le recouvrement, les curseurs invalides/le garde-fou publient des données tronquées, et une analyse échouée publie son board candidat.

**Correction du plan :** l’arrêt au premier ID connu n’est pas une preuve de fin : la fixture de deux pages pleines chevauchantes place un connu en page 1 et une nouvelle action au même instant en page 2. Le plan initial conservait à tort cette optimisation. Parcourir toute la fenêtre `since`, courte ou vide en terminaison, et ignorer les IDs connus dans le candidat. `stoppedAtKnown` reste une information de chevauchement interne, non une condition de succès ni de fusion. Aucun tri des égalités n’est supposé.

### Implémentation, validation ciblée

Union gouvernée par le mode effectif, recouvrement d’une seconde, pagination complète de la fenêtre, détection des curseurs absents/répétés/cycliques et garde-fou en erreur. `analyzeBoard` ne publie board/actions/credentials qu’après collecte valide. Signatures publiques inchangées ; ordre conservé ; message d’échec complet visible. Test nominal rendu sensible à `since/before/limit` ; fixtures séparées dans `tests/delta.spec.js` pour borner le lot.

Première passe après correction : **14/14 régressions passent (13,6 s)**. Ajout de contrôles de fin normale au garde-fou et d’analyse vide ; suite complète encore à exécuter. Aucun changement stockage, vendor, exports, dépendances ou configuration CI.

### Validation finale du lot

- Suite complète : **36/36 passent (45,1 s)**, soit 19 scénarios existants et 17 régressions PLAN-001. Commande : `LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test`.
- `{a,b}` + delta vide / `{c}` / doublons / connus : IDs attendus strictement identiques dans l’état et le JSON sauvegardé ; borne `since` vérifiée à -1 seconde.
- Deux pages de 1 000 actions avec chevauchement et égalité temporelle : `before` et `since` vérifiés, déduplication et ordre attendus exacts.
- Erreur page 2, annulation page 2 (delta/complet), curseur absent/répété/cyclique et garde-fou : board/actions/date de sauvegarde et chaîne persistée inchangés ; fermeture du chargement et message vérifiés. L’export JSON voit encore les anciens IDs après échec.
- Garde-fou testé à 2 pages par substitution HTML en mémoire ; fin normale courte/vide au seuil acceptée. Aucune constante de production abaissée.
- Analyse échouée : board candidat non publié ; analyse complète vide et refresh complet vide acceptés ; legacy sans IDs bascule bien en complet sans `since`.
- Appelants boutons, `startAnalysis`, API `tba.refreshData` et alias globaux relus, signatures inchangées. Tests normaux couvrent reprise, démo, exports et HTML autonome. `git diff --check` réussi.

**Limites :** validation sur Chromium alternatif 153, pas le Chromium épinglé ; aucune API Trello live, garantie de rétention, publication Pages, Firefox/Safari. Le statut de stockage durable reste le défaut connu de PLAN-002 ; ne pas confondre conservation de la copie persistée lors d’un échec réseau et garantie de durabilité générale. Aucun autre plan implémenté. Le prochain lot est PLAN-002, dont le prérequis est satisfait.

### Commits et point de reprise

- Implémentation et preuves : `298da4024ae182546de0fb94ad439f0e6cf9a527` (2026-10-20), poussé sur la branche autorisée. Aucun merge ni publication.
- Relecture du workflow : CI déclenchée sur PR/push main/manuellement, pas sur ce push de branche ; `gh run list --branch arena/e47875e6-trello-board-activity-analyzer` retourne `[]`. Aucune CI annoncée verte.
- Ajustement final des tests : les trois tests du harness MAX_PAGES local sont explicitement ignorés lorsque `BASE_URL` est fourni, pour ne jamais substituer un HTML local à un site publié. Les autres tests restent applicables. Revalidation locale finale : **36/36 passent (46,5 s)** ; `git diff --check` et syntaxe des tests valides.
- **Reprise : PLAN-002 uniquement**, prêt mais non démarré. Relire son plan et tous les consommateurs Store ; reproduire SecurityError/QuotaExceededError, suppression refusée et retrait des faux secrets, puis corriger le résultat durable/volatile sans migration de stockage. PLAN-005 attend toujours après le jalon P1 selon l’ordre recommandé. Pas de travail partiel caché dans ce lot.
