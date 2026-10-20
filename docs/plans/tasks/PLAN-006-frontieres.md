# PLAN-006 — Valider avant de restaurer et isoler les noms non fiables

**Statut : en cours (2026-10-21) · Priorité : P1 — Majeur.** Restauration de snapshots et rapports fragiles ; validation aux frontières sans ajouter d'infrastructure.

## 1. Problème et preuves

F06 : `validPayload:1734–1737` accepte actions `[null]`, puis expand lit s.t (`1722`). `bootEmbedded:4672` affecte board/actions avant validation globale. `_memberName` n'est pas garanti string. `byMemberPeriod:1898` écrit sur objet ordinaire ; vérifié dans navigateur : nom `__proto__` écrit `Object.prototype['2026-09']=1`. F12 : selfTest avec query active échoue `model kpis` ; état de test pas entièrement isolé (`4930–4984`).

## 2. Objectif

Une sauvegarde/rapport invalide est rejeté avec message explicite **avant** mutation d'état ; aucune réparation destructive automatique. Un nom, même `__proto__`, reste une donnée, pas une propriété héritée. Auto-test indépendant des filtres courants.

## 3. Cible

Deux enveloppes distinctes (session historique et rapport `kind:'trello-activity-export-v1'`) réutilisent un contrôle d'action slim : objet non null non array, `t/d/m/c` chaînes, date valide, `i` absent ou chaîne. Absence de `i` reste valide. Champs historiques effectivement optionnels (`creds`, `savedAt`, `board.id`) restent optionnels ; s'ils existent, type cohérent, et timestamp présent valide. `boardData/board` objet avec nom chaîne (vide accepté), nom absent d'un ancien objet : repli explicite « Tableau » si nécessaire pour compatibilité, pas d'objet injecté en texte.

Rapport : kind connu, actions valides, filtre optionnel membres tableau de chaînes, bornes null ou nombres finis, query chaîne, enums gran/heatMetric autorisés avec defaults existants. Métadonnées de provenance ajoutées en 003 : liste autorisée de champs inertes, inconnus ignorés, jamais exécutés. Borne inversée refusée explicitement. Après validation seulement, expansion/normalisation vers un candidat ; pas de suppression silencieuse d'une ligne d'un snapshot corrompu.

## 4. Décisions / alternative

Quelques contrôles JS explicites aux fonctions existantes, pas Zod/Ajv, TypeScript/build ni schéma généré depuis R8. Réutiliser normalizeAction pour son contrôle date, en garantissant sorties `Rec` chaînes ; ne pas laisser un objet membre circuler. Pour `byMemberPeriod`, objets sans prototype à tous les niveaux préservent le shape public objet et évitent migration Map de l'API. Alternative Map interne + conversion sûre si un consommateur impose prototype normal ; inutile actuellement. Ne pas interdire des noms parfaitement valides `constructor`.

## 5. Périmètre / appelants / impacts

- `validPayload` (API publique), `readPayload → checkSaved/loadSaved`, `expandAction/expandActionKeepId`, `normalizeAction/normalizeActions`, `loadMemberMap` types nom ; `embeddedPayload` écrit et `bootEmbedded` lit, avec nouvelle provenance de 003.
- `byMemberPeriod` public, consommateur interne unique `renderTrends` et usages `Object.keys/map[m]`; `selfTest` l'exerce aussi. `sparkBuckets` utilise déjà Map, ne pas le refaire.
- Auto-test remplace temporairement board/actions/creds/filter : sauver **toutes** ses propriétés modifiées, notamment query ; utiliser filtre factice propre puis restaurer dans finally.
- Tests : fixtures slim anciennes `{t,d,m,c}` et actuelles avec i, champs mal typés/null, rapport embarqué hostile ; tests sans secrets réels. README validité/compatibilité/erreur ; pas de config ni nouvelle dépendance.
- Risque : refuser une sauvegarde auparavant partiellement lisible ; conserver octets originaux, afficher explication, ne pas migrer ni supprimer automatiquement.

## 6. Étapes

1. Ajouter tests ciblés validPayload `[null]`, t/m objets, date invalide, actions non array, board nom objet ; restaurations v1/v3 valides de référence.
2. Mettre la validation action commune dans la section data store ; valider chaque enveloppe au point d'entrée, sans appeler expand avant contrôle.
3. Charger en variables candidates, traiter erreur en UI (checkSaved peut indiquer corrompu, loadSaved garde setup, bootEmbedded affiche rapport illisible) ; aucune écriture/clearSaved implicite.
4. Vérifier normalisation raw API : nom/type/cartes convertis/refusés selon types attendus sans exceptions ; member map ne doit pas injecter objet nom. Une réponse membres non array devient erreur explicite, pas carte vide silencieuse. Ne pas changer la politique existante de dates API invalides sans raison : journaliser les lignes ignorées ; snapshots, eux, sont refusés entiers.
5. Corriger dictionnaires byMemberPeriod et tester absence de changement des prototypes pour `__proto__`, `constructor`, `toString` ; contrôler rendu tendances et objet de retour.
6. Isoler auto-test de la query et restaurer état intégral en finally, y compris sur exception ; tests avant/après sous filtres actifs.
7. Aligner README et lancer suite.

## 7. Dépendances / prérequis

Après 002 pour messages et provenance de lecture durables. 003 recommandé avant ce lot, mais pas bloquant si provenance est ajoutée plus tard avec adaptation explicite du validateur. 007 s'appuiera sur bornes validées.

## 8. Contraintes / non-objectifs

Conserver ancienne lecture slim et kinds existants ; API validPayload renvoie bool, pas exception. Pas d'import nouveau, migration d'identités, limites de taille arbitraires, suppression des lignes invalides à la restauration, lib de validation, détection générale d'objets hostiles avec getters (JSON parsé ne porte pas de getter).

## 9. Cas limites

Vide valide, creds absents, IDs absents, champs supplémentaires inconnus, nom vide, date ISO DST/offset valide, from=0, query hostile, rapport ancien sans provenance, état existant chargé avant tentative invalide. Rapport non fiable est un fichier HTML exécutable par nature : valider son payload ne rend pas sûr un fichier arbitraire téléchargé d'un tiers.

## 10. Tests

Appeler validPayload et UI de reprise ; comparer state/snapshot avant/après refus. Exécuter byMemberPeriod en contexte navigateur neuf et vérifier prototypes non modifiés. Rapport hostile via constructeur puis payload altéré, messages et zéro écriture de session. Auto-test sous query sans résultat : zéro échec et mêmes filtres/board/actions après appel. `npm test`.

## 11. Critères d’acceptation mesurables

Toutes fixtures invalides refusées sans TypeError non gérée, mutation ni effacement ; v1/v3 et anciens rapports valides ouverts ; noms spéciaux rendus comme texte sans propriété sur Object.prototype ; auto-test identique filtres vides/actifs et état restauré.

## 12. Terminé

Contrats et fixtures documentés, appels d'expansion tous précédés d'un contrôle adapté sauf selfTest sur fixture sûre ; suite complète verte ; aucune dépendance nouvelle.

## 13. Sources

F06/F12, code local cité, [R8 et comparaison validation](../02-recherche-et-options.md), vision C2/C3, roadmap J2, PLAN-002/003.

## Exécution — 2026-10-21 · en cours

Prérequis 002 et provenance 003 intégrés ; lecture des validations, expansion, normalisation, tendances et selfTest. Objectif : rejet entier avant mutation, compatibilité v1/v3 et ancien rapport préservée.

### Découvertes pendant vérification

Les bornes embarquées doivent être non seulement finies, mais représentables par
Date : la fixture `fromMs=1e100` est un nombre fini qui provoquerait une erreur
à la réexportation ISO. Validation renforcée à cette frontière, sans seuil arbitraire.
Première suite : 63 verts, 1 échec axe (contraste du dialogue d’aide pendant sa
transition). Le test attend déjà les animations des autres surfaces mais pas
celle de l’aide : attente de fin ajoutée, sans désactiver de règle axe ni modifier
les couleurs. Cette stabilisation de mesure est vérifiée à répétition ci-dessous.
