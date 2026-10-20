# Roadmap et règles d'intégration

Date : 2026-10-20. **PLAN-001 validé localement** ; autres lots non implémentés. [Plans/statuts](README.md), [contrats cibles](03-vision-cible.md), [preuves](01-etat-des-lieux.md).

## Ordre motivé

```text
001 delta/complétude (P0)
 ├── 002 stockage réel (P1)
 │    ├── 003 portée des exports (P1) ── 004 CSV (P1)
 │    └── 006 frontières/restauration (P1)
 └── 005 réseau (P2)
003 + 006 ── 007 calendrier (P2) ── 008 indicateurs (P2) ── 009 données accessibles (P2)
```

**Ordre de livraison conseillé : 001 → 002 → 003 → 004 → 006 → 005 → 007 → 008 → 009.** Les numéros sont stables, pas un ordre total. 006 peut être traité avant 003 si l'intégrateur préfère sécuriser les entrées d'abord. 005 est logiquement indépendant de 002…004/006 après 001, mais ne doit pas retarder leur jalon P1.

### J0 — Reproduire sans modifier le produit

- Lire le dossier, vérifier SHA, branche et propreté ; relire les symboles touchés.
- `npm ci`, navigateur Playwright dans l'environnement cible, `npm test` : enregistrer baseline réelle, pas supposer 19 verts sur toute plateforme.
- Ajouter les régressions **dans le lot correspondant**, pas une phase de refonte de tests. Reproductions de référence dans `research/verifications.md`.
- Absence de Trello live n'empêche aucun lot prêt : contrats testés par routes fidèles et invariants. Si test live ultérieur, uniquement tableau de test et credentials hors chat/journal.

### J1 — Aucune perte locale silencieuse : PLAN-001 + PLAN-002

Pourquoi d'abord : on ne peut pas améliorer les analyses si le rafraîchissement efface leur source. Une sauvegarde prétendument durable masque ensuite la perte à la fermeture.

**Sortie mesurable :** delta vide conserve IDs et snapshot ; pages invalides/annulation ne modifient pas la sauvegarde ; échec de stockage/effacement/consentement n'est jamais annoncé comme succès. Consultation/démo restent fonctionnelles sans stockage. Baseline existante et régressions passent.

### J2 — Partage sûr et entrées contrôlées : PLAN-003 + PLAN-004 + PLAN-006

Pourquoi avant nouvelles métriques : éviter diffusion d'actions exclues, CSV actif et chargement partiellement corrompu. 003 stabilise le nouveau contenu HTML que 006 validera ; si ordre inverse, 003 doit prolonger son validateur pour les métadonnées de provenance.

**Sortie :** une vue contenant N IDs produit exactement ces IDs dans JSON/HTML/ZIP/CSV/XLSX, même après reset des filtres dans le rapport ; payload hostile/refusé laisse l'état précédent intact ; cellules CSV de test ne démarrent pas par une formule exploitable au contrat documenté. Message de rupture HTML et limites CSV publiés dans README. Aucun secret dans les artefacts décompressés. **Ce jalon constitue la première version recommandée.**

### J3 — Réseau maîtrisé : PLAN-005

**Sortie :** chaque tentative/retry passe par le limiter, délais de Retry-After testés à horloge simulée, annulation pendant attente <500 ms dans le test (hors tolérance de charge documentée), conservation des données. Pas de requête PUT/POST ajoutée. Vérification des quotas officiels actuelle souhaitable mais ne bloque pas la réactivation prudente du régulateur 90/10s existant.

### J4 — Chiffres interprétables : PLAN-007 + PLAN-008

Ordre impératif : fixer la définition du jour/semaine avant d'en déduire des tendances. Tests par fuseaux exécutés indépendamment, pas via des fixtures dépendantes de la date du jour.

**Sortie :** jour/heatmap/série/weekend cohérents UTC, Europe/Paris et America/New_York aux changements d'heure ; clés calendaire exactes ; briefing pas de score ni prévision validée suggérée ; comparaison de deux semaines closes/consécutives ou indisponible explicite. Les limites d'identités restent visibles.

### J5 — Accès aux valeurs : PLAN-009

Après stabilisation des séries et du discours, éviter de dupliquer un mauvais modèle dans des alternatives textuelles.

**Sortie :** chaque graphique informatif et heatmap a des valeurs accessibles au clavier et lecteur d'écran ; synchronisation après filtres et dans HTML autonome ; axe reste sans violation, test clavier réel des détails. Ne pas revendiquer conformité WCAG complète à partir d'axe seul.

## Parallélisme et propriété des fichiers

Tous les plans modifient probablement `index.html`, `tests/app.spec.js` et README : **pas d'implémentation simultanée sur ces fichiers**. Un seul lot intégré et validé à la fois ; dépendance documentaire ≠ permission d'écraser un autre diff.

Travaux en parallèle possibles **sans conflit d'édition** : concevoir les fixtures delta (001), préparer jeux CSV (004), matrice fuseaux (007) et grille de lecture accessible (009) dans des documents propres à chaque agent. Interfaces à respecter : liste normalisée `Rec`, slim `{t,d,m,c,i?}`, invariants C1…C5. Ces préparations ne remplacent pas les tests d'intégration de l'agent propriétaire du lot. Pas de nouvelle API inter-agents ni de framework commun imposé.

## Risques bloquants et décisions déjà levées

- **Non bloquant :** inclusivité exacte `since` inconnue ; recouvrement + IDs prévu. Le delta n'est pas une réconciliation des suppressions.
- **Non bloquant :** IndexedDB non décidé ; PLAN-002 règle la vérité du statut sans migration.
- **Non bloquant :** HTML change de portée ; décision prise ici et critère d'annonce, pas un choix renvoyé à l'exécutant.
- **Bloquant pour annoncer validation tableur complète :** Excel/LibreOffice non disponibles dans ce sandbox. PLAN-004 inclut preuve au niveau octets et vérification manuelle contrôlée ; à défaut consigner la limite et ne pas annoncer « compatible tous tableurs ».
- **Bloquant pour licence :** titulaire non confirmé ; sujet différé, aucun plan de licence.
- **Environnement :** suite réellement épinglée Playwright attendue en CI. Chromium alternatif utilisé ici permet de vérifier, pas de modifier la config pour le sandbox.

## Validation et fin de lot

Chaque lot : régression montrée avant correction → plus petit changement de cause commune → nouveaux tests + suite complète → mise à jour de sa documentation → diff borné. Version/release à gérer au jalon par l'intégrateur avec les emplacements existants (`package.json`, lock, `APP_VERSION`, HTML/README) si une release est effectivement préparée, pas à chaque plan par automatisme. Aucun changement vendor/dépendance sans justification propre.

Une exécution n'est terminée qu'avec critères du plan et preuves ; mettre alors son statut à jour avec date/commit et résultats réels. Ce dossier initial ne coche aucun travail implémenté. Validation de publication : `npm run verify:pages` **après** publication effective du commit sur main uniquement ; ne pas demander à Pages de servir une branche de travail. Suivre les jobs existants plutôt que considérer un hash local comme preuve de déploiement.

### Reprise d’exécution — 2026-10-20

J0 vérifié sur `b164f95`, branche active autorisée et arbre propre ; baseline 19/19 avec Chromium alternatif. PLAN-001 exécuté seul : 36/36 tests passent (19 existants + 17 régressions), sur Chromium alternatif 153. Son prérequis est levé pour PLAN-002, prochain lot prêt ; J1 reste incomplet tant que 002 n’est pas validé. J2 et les autres jalons restent planifiés. Aucun déploiement/release vérifié.

- 2026-10-21 · PLAN-002 : en cours. Prérequis PLAN-001 validé, branche autorisée active, arbre propre. Relecture Store et de tous ses consommateurs ; aucune migration requise. Tests de panne et consentement à ajouter avant correction.

- 2026-10-21 · PLAN-002 : validé localement. Implémentation 6298d9d. Avant correction : 10/10 tests ciblés échouaient ; après : 10/10 passent (6,5 s), puis test de sérialisation ajouté. Suite complète : 47/47 passent (48,3 s), commande LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test. Tous consommateurs Store relus (cache, thème, objectif, session), sans changement de leur signature publique ; suppression du faux plafond UTF-16. SecurityError, quota, rechargement ancien snapshot, date, retrait depuis démo, hôte succès/rejet et changements rapides vérifiés. Aucun test live ni navigateur épinglé ; Chromium alternatif 153. PLAN-003 et PLAN-006 ont leur prérequis satisfait ; prochain lot 003.

- 2026-10-21 · PLAN-003 : en cours. Prérequis 002 satisfait (47 tests verts). Relecture de tous les constructeurs, capture, ZIP, briefing et bootEmbedded ; changement de portée HTML intentionnel, pas de nouveau format.

- 2026-10-21 · PLAN-003 : validé localement. Implémentation 76b1857. Avant correction : 4/4 régressions échouaient. Après : 6 tests ciblés, répétés trois fois (18/18, 17,4 s), et suite complète 53/53 (59,8 s). Commande standard de session : LD_LIBRARY_PATH=/tmp/lib:/tmp CHROMIUM_PATH=/tmp/chromium npm test. Contrôles JSON/CSV/XLSX/ZIP STORE décodés, HTML offline puis reset/réexport, vue vide, debounce, verrouillage/restitution disabled, snapshot pendant attente et repli statique forcé. Tests d’attente stabilisés en neutralisant le préchauffage idle uniquement dans leurs pages de test ; une assertion de texte de carte dans le rapport statique (cartes rendues en images) remplacée par total/membre réellement présents. API publiques conservées. Aucun live/Pages/navigateur épinglé. Prochain lot 004.

- 2026-10-21 · PLAN-004 : en cours. Prérequis 003 validé (53 tests). Sérialiseur unique csvCell, deux appelants et SELF_SRC relus ; neutralisation tableur uniquement, JSON/XLSX exacts.

- 2026-10-21 · PLAN-004 : validé localement, tableur non vérifié. Implémentation 56c2418. 2 régressions rouges avant correction puis 2/2 ciblées (2,3 s) ; suite complète 55/55 (55,2 s). Même commande npm test et Chromium alternatif. Parseur de test RFC multiline, 15 préfixes hostiles et cas français, octets CSV direct/ZIP/offline, JSON/XLSX exacts sans formule vérifiés. Pas de tableur installé (command -v libreoffice/soffice vide) : vérification manuelle et universalité explicitement non revendiquées. Aucun mode raw ajouté. Prochain lot 006.

- 2026-10-21 · PLAN-006 : en cours. Prérequis 002 et provenance 003 intégrés ; lecture des validations, expansion, normalisation, tendances et selfTest. Objectif : rejet entier avant mutation, compatibilité v1/v3 et ancien rapport préservée.

- 2026-10-21 · PLAN-006 : validé localement. Implémentation a124b1d. 7 tests ciblés échouaient avant puis passent (7,0 s), 2 contrôles complémentaires ajoutés. Suite complète finale : 64/64 (1,1 min), npm test avec Chromium alternatif 153. Sessions invalides sans mutation/suppression, legacy sans ID/nom/creds/date, noms spéciaux/prototypes, raw objets, selfTest avec query et références restaurées, 10 rapports invalides et ancien rapport, membres non array, révocation sur snapshot corrompu vérifiés. Bornes finies hors plage Date refusées car non réexportables. Mesure axe stabilisée sur toutes les surfaces animées et après deux frames ; seconde série 6/6 audits répétés (32,2 s), sans règle désactivée. Pas de lecteur d’écran manuel ni publication. Jalon prioritaire implémenté, limite tableur 004 inchangée. Prochain lot 005.

- 2026-10-21 · PLAN-005 : en cours. Après le jalon P1, prérequis 001 satisfait. fetchJSON privé, tous appels internes GET ; réserve écritures inactive, suppression prévue. Tests à horloge virtuelle, sans attente longue réelle.

- 2026-10-21 · PLAN-005 : validé localement. Implémentation 1ca6d64. 8 tests rouges avant correction puis 8 verts, 2 contrôles ajoutés ; 30/30 ciblés à répétition (18,3 s), suite complète 74/74 (1,2 min). Commande npm test sous Chromium alternatif. Harness réseau privé injecté uniquement dans la réponse HTML locale et ignoré sur BASE_URL ; horloge virtuelle pour 90/10s retries inclus (header zéro et attente explicitement observée avant avancement pour supprimer une course du test), 120s/date HTTP, auth sans retry, JSON invalide, 4 tentatives réseau/timeout, délais au-delà de setTimeout, pré-aborted sans timer/fetch. Annulations isolées <500ms réelles, parcours UI <1000ms avec tolérance justifiée (519,5ms observé sous charge), ancien snapshot intact. Export sleep sans signal toujours couvert. Aucune réserve écriture restante, aucune requête non GET, politique locale non garantie officielle. Prochain lot 007.

- 2026-10-21 · PLAN-007 : en cours. Prérequis 003/006 validés ; inventaire des usages Date, clés, ordinaux, bornes et fenêtres effectué. Durée écoulée des moyennes conservée pour 008 ; calendrier local/dimanche déclaré, pas de sélecteur de fuseau.
