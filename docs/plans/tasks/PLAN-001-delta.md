# PLAN-001 — Actualisation sans perte et collecte complète atomique

**Statut : prêt à exécuter · Priorité : P0 — Critique.** Un usage fondamental peut effacer la copie locale de l'historique ; coût borné, preuve reproductible. Session cible : client/pagination/flux et tests associés, sans refonte.

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

Changement limité aux sections citées, tests démontrant la cause avant/après, README exact, diff relu, résultats consignés. Ne déclarer terminé qu'après ces preuves ; aucune correction réalisée dans le présent dossier.

## 13. Sources et références

Audit F01/F12 ; recherche [R3/R8 et comparaison acquisition](../02-recherche-et-options.md) ; vision C1 ; roadmap J1 ; PLAN-002 pour distinguer échec de stockage et échec d'acquisition.
