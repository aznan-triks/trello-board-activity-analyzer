# PLAN-005 — Réguler les tentatives GET et annuler les attentes

**Statut : en cours (2026-10-21) · Priorité : P2 — Important.** Fiabilité importante sur gros historiques, mais aucune perte directe supérieure au P0/P1 déjà planifiés.

## 1. Problème et preuves

F05 : `Limiter.wait:1450–1479` sans appel ; `fetchJSON:1510–1573` n'utilise pas la régulation. `retryDelay:1495–1505` ne lit pas de date HTTP et réduit les délais longs à 30s. `sleep:1205` non annulable ; retries `1543/1563`, pagination `1651`. Tous les appels HTTP applicatifs internes sont GET (`1585,1625,2312`).

## 2. Objectif

Chaque tentative HTTP, retries inclus, passe par la même limite locale ; l'utilisateur peut annuler pendant une attente sans déclencher d'appel supplémentaire. Un Retry-After lisible n'est pas raccourci.

## 3. Cible

Réutiliser Limiter et sleep. Étendre sleep avec signal **optionnel**, inchangé pour captures/export. `Limiter.wait(signal)` utilise cette attente et contrôle l'abandon avant/après permission. Installer le timeout de requête seulement quand la permission est acquise, pas pendant le backoff/limiter. Annulation externe → CanceledError ; timeout réseau → retry borné existant.

`retryDelay` accepte entier secondes ou date HTTP future (R6), invalides/past → backoff existant. Une attente longue reste annulable et mentionnée dans la progression/journal sans secrets. Ne pas limiter un header valide à un délai plus court ; découper l'attente si nécessaire pour la limite de setTimeout JS, sans configuration produit.

## 4. Décisions et alternative

Garder 90 requêtes/10s existantes comme politique locale prudente, sans déclarer limites officielles confirmées. Une seule file locale, pas de dépendance. Enlever la réserve d'écriture et ses constantes mortes **uniquement si** aucun appelant interne n'en dépend (relevé actuel : aucun) ; ne pas faire évoluer un support PUT/POST hypothétique. `fetchJSON` n'est pas API publique. Alternative retries sans limiter peut suffire petit tableau mais contredit la promesse README et ne borne pas les rafales.

## 5. Fichiers et points d'impact

`index.html`: sleep, Limiter, constantes RATE/WRITE, retryDelay, fetchJSON, fetchAllActions ; appelants directs exhaustifs loadMemberMap, fetchAllActions, analyzeBoard. sleep a aussi appels `withThemeForCapture:4506`, `exportPdf:4560`, `exportZip:4604` : conserver usage sans signal. Les flux publics startAnalysis/refreshData dépendent des erreurs et de l'annulation ; bouton cancel, logger expurgé et progression à vérifier.

Tests app : routes 429/503/réseau, chronologie virtuelle ; README robustesse/quotas. Pas d'ajout de package, changement de config, vendor ou données persistées. Pas de parallélisme multi-client inventé.

## 6. Étapes

1. Ajouter routes séquentielles 429 puis succès ; signaler événements requêtes et annuler pendant backoff ; assertions sur ancien état/snapshot de 001.
2. Étendre sleep à l'abandon et retirer ses listeners/timers dans tous les chemins. Test pré-aborted : aucun timer/fetch.
3. Brancher wait au début de **chaque** tentative dans fetchJSON ; démarrer ctrl/timer après wait, nettoyer en finally. Utiliser erreur d'annulation existante.
4. Corriger Retry-After secondes/date, traiter absent/CORS non exposé par backoff. Garder RETRY_MAX et bornes du backoff sans header ; pas de retry 401/403/404.
5. Passer le signal aux pauses de pages et retries. Retirer réserve écriture non utilisée/commentaires trompeurs, pas de nouvelle régulation d'écriture.
6. Tester suite et aligner README : limite locale par onglet, non garantie officielle ou coordination inter-onglets.

## 7. Dépendances / prérequis

Après 001, intégration séquentielle. Réutiliser clock Playwright 1.55.1 déjà installée pour avancer le temps ; pas d'attente réelle de minutes en tests. Confirmation des limites officielles souhaitée mais pas requise pour conserver la constante existante prudente.

## 8. Contraintes / non-objectifs

Pas d'auth backend, SDK, headers nouveaux exposant les secrets, PUT/POST, file persistante ou politique multi-utilisateurs. Garder 30s timeout de requête, retries bornés et messages auth existants sauf précision sûre. Ne pas journaliser URL complète avec key/token.

## 9. Cas limites

Annulation avant départ/pendant délai/pendant fetch ; header date passé/invalide, header 120s, header invisible CORS, réseau TypeError, 500 puis 200, JSON malformé sur 200 (erreur explicite, pas retry infini), timer actif à cleanup. Aucun timestamp d'écriture comparé à Date.now.

## 10. Tests

Avec routes synthétiques et horloge : 91 tentatives dans fenêtre ne passent pas toutes avant 10s ; retries comptent dans la fenêtre. Aucun retry après 401 ; au plus 1+RETRY_MAX tentatives transitoires. Avancer temps 30s puis 120s et constater pas de départ prématuré. Annuler et mesurer fin de flux <500ms avec tolérance de charge explicitée. Rejouer exports qui utilisent sleep sans signal. `npm test`.

## 11. Critères d’acceptation mesurables

Limiter effectivement appelé sur toutes tentatives ; Retry-After entier/date respecté ; annulation ne laisse ni nouveau fetch ni état partiel ; anciennes données intactes ; logs sans faux secrets. Les scénarios de base restent verts.

## 12. Terminé

Appelants sleep/fetch revus, tests déterministes sans attente longue réelle, README décrit le périmètre réel. Pas de prétendue vérification live Trello.

## 13. Sources

F05, [R3/R6/R8 et comparaison réseau](../02-recherche-et-options.md), vision C1, roadmap J3, PLAN-001.

## Exécution — 2026-10-21 · en cours

Après le jalon P1, prérequis 001 satisfait. fetchJSON privé, tous appels internes GET ; réserve écritures inactive, suppression prévue. Tests à horloge virtuelle, sans attente longue réelle.

### Mesure d’annulation et tolérance explicite

Les trois tests d’attentes isolées (backoff, limiteur, pause page) gardent la
contrainte <500 ms réelle. Le parcours UI ajoute la reconstruction synchrone de
huit graphiques : une première suite à quatre workers a mesuré 519,5 ms, contre
<500 ms en ciblé. Tolérance de charge de 1 000 ms retenue **pour ce seul parcours
UI**, pas pour la résolution des attentes. Aucune attente réseau intentionnelle
n’est ajoutée après annulation. L’horloge virtuelle ne sert pas à mesurer cette
latence réelle (chronomètre Node).
