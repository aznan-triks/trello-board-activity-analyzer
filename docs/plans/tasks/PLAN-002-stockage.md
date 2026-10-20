# PLAN-002 — Dire la vérité sur la sauvegarde et retirer les secrets sur refus

**Statut : prêt à exécuter — PLAN-001 validé localement le 2026-10-20 ; non démarré · Priorité : P1 — Majeur.** Risque de perte à la fermeture et consentement non effectif, indépendant d'une éventuelle migration de stockage.

## 1. Problème et preuves

[F02](../01-etat-des-lieux.md), `Store:1385–1439`, `persistData:2182–2200`, `clearSaved:2250–2256`, listener `keep-creds:5030`. Vérifié : localStorage bloqué → `persistData()` renvoie true, « Sauvegardé ». Effacement ignore aussi les échecs ; décocher ne retire pas immédiatement le token déjà sur disque.

## 2. Objectif précis

L'utilisateur sait si sa session survivra à la fermeture. Une révocation tente immédiatement de supprimer les secrets persistés sans écraser une autre sauvegarde ; tout échec est visible et n'est jamais annoncé comme succès.

## 3. Comportement / architecture cible

[C2](../03-vision-cible.md). Dans l'adaptateur Store existant, distinguer écriture persistante réussie, mémoire seule et échec ; résultat interne explicite (par exemple `{durable, ok}` et provenance à la lecture). Adapter tous les consommateurs. La méthode **publique** `persistData` garde un boolean : true seulement si persistance réussie. Thème/objectif/cache peuvent rester disponibles en mémoire sans afficher de statut de session durable.

Une erreur de quota laisse le précédent snapshot durable intact, la dernière analyse consultable en mémoire. La date du dernier succès ne change pas sur volatile/échec. « Effacé » seulement après suppression confirmée par le backend courant ; sinon erreur. La suppression n'exige pas le probe d'écriture localStorage (qui peut échouer à quota plein alors qu'un removeItem fonctionnerait).

## 4. Décisions / alternative

Réutiliser Store, clé SK, état slim ; aucune dépendance. R1 distingue stockage durable/volatile et quota par origine. Retirer l'assimilation `payload.length = octets disponibles` : pas de pré-refus fondé sur un quota fictif ; tenter l'écriture et gérer son résultat, conserver une taille informative explicitement en unités/estimation. Pas de charge gigantesque dans un test quota : provoquer QuotaExceededError au backend. Alternative IndexedDB R7, préférable seulement après mesures de refus au volume attendu (vision), pas pour ce lot.

## 5. Fichiers, appelants et impacts

- Store get/set/del ; `persistData`, `readPayload`, `checkSaved`, `loadSaved`, `clearSaved`, `setSaveStatus`, `savedAtIso` ; handlers consentement dans init.
- Consommateurs Store exhaustifs relevés : fallback/cache Chart (`2040,2090,2107`), session (`2197,2205,2251`), objectif (`2667,2672`), thème (`4872,4879`). Les revoir même si seulement session exploite `durable`.
- Appelants publics `persistData/checkSaved/loadSaved/clearSaved`, analyse/refresh, reset ; démo et bootEmbedded **ne doivent pas** persister une session.
- Tests app + fixture snapshot contenant faux secrets ; README stockage/consentement/cache. Aucune config ni dépendance à modifier.
- Risque : donnée plus récente en mémoire vs ancienne sur disque. Retour lecture marque provenance ; bandeau « session sauvegardée » ne doit pas présenter la mémoire comme disque. À la vraie recharge, reprendre l'ancienne copie durable si le remplacement a échoué.

## 6. Étapes d'implémentation

1. Tests échec d'écriture, stockage interdit, quota plein avec ancien snapshot, suppression refusée et suppression possible à quota plein ; vérifier message, date et contenu.
2. Corriger les résultats et les erreurs de Store dans sa section ; ne pas multiplier les adapters. Un rejet de window.storage reste un échec connu ; simuler son contrat get/set/delete existant en test, ne pas supposer une API externe supplémentaire.
3. Mettre à jour tous les consommateurs cités et le statut de session. `loadSaved` doit restaurer `savedAtIso` d'une sauvegarde valide, pas inventer une date de succès.
4. Lors du décochage, lire la copie sauvegardée courante, retirer key/token et réécrire **cette copie**, pas `state.actions` qui peut représenter une démo/autre board. Garder boardId et autres champs valides ; si corrompue, ne pas la détruire, avertir. Ne pas supprimer les secrets en mémoire nécessaires au refresh courant.
5. Si révocation échoue, message explicite invitant à effacer les données du site ; ne pas recocher silencieusement ni prétendre retrait effectué. Charger un consentement explicite existant reste compatible.
6. Documenter durée de vie mémoire et limites de l'origine ; tester suite entière et réouverture.

## 7. Dépendances et prérequis

Après 001 pour distinguer atomicité réseau et échec de stockage. Avant 003/006. Pas de migration persistante, pas de secret réel dans tests/logs.

## 8. Contraintes et non-objectifs

Préserver consultation sans stockage, thème/objectif/cache best-effort, clé et schéma historiques, démo. **Ne pas** ajouter IndexedDB, chiffrement trompeur, sauvegardes multiples, télémétrie, options de backend ou promesse de persistance éternelle.

## 9. Cas limites et risques

Stockage privé/inaccessible, set rejeté mais get/remove possibles, window.storage levée/succès, ancien snapshot d'un autre tableau, aucune session, révocation depuis setup, chaîne corrompue, plusieurs changements de consentement rapides. Sérialiser les opérations de consentement pour que l'état final décoché ne soit pas annulé par une écriture précédente ; pas de framework de transactions.

## 10. Tests et vérifications

Mocks Storage/host ciblés ; recharger une page avec ancien snapshot durable et échouer la nouvelle écriture ; pas seulement vérifier le DOM avant fermeture. Tester que cache Chart n'écrase pas la session. Test de faux secrets absents après décochage et toujours absents des exports. `npm test`.

## 11. Critères mesurables

SecurityError/QuotaExceededError → persistData false, pas de nouveau `savedAtIso`, indication non durable ; état consultable. Snapshot ancien identique après échec. Échec delete → pas de toast « effacée ». Décocher sur snapshot valide → clés/token vides persistés, actions/board strictement conservés ; décocher en démo n'écrit jamais la démo.

## 12. Définition de terminé

Tous consommateurs Store revus, tests normaux/dégradés verts et résultats enregistrés, README aligné. Aucune réussite durable revendiquée sans écriture effective.

## 13. Sources

F02/F11, R1/R7 et comparaison persistance dans [recherche](../02-recherche-et-options.md), vision C2, roadmap J1, PLAN-001/006.
