# Vision cible : observer et partager sans tromper

Statut : **cible en cours de réalisation** (2026-10-20 : partie acquisition C1 validée localement par PLAN-001 ; régulation/attentes C1 restent PLAN-005 ; autres contrats non implémentés), fondée sur [l'audit](01-etat-des-lieux.md) et [les comparaisons](02-recherche-et-options.md). Le détail des preuves et limites figure dans les plans individuels.

## Produit recommandé

Un outil local, autonome et lisible pour **consulter l'activité disponible d'un tableau Trello et partager une vue choisie**. Le cœur n'est pas une console de productivité, ni un entrepôt d'événements, ni une application SaaS.

**Hypothèses utilisateur H1/H2 :** la reprise locale et les nombreux exports suggèrent un usage d'analyse ponctuelle et de partage ; la démo suggère un besoin de découvrir sans compte. Pas de preuve d'une demande multi-tableaux, collaborative ou prédictive. La cible valorise les parcours déjà présents au lieu d'en inventer.

## Principes préservés

1. Données traitées dans le navigateur, pas de serveur de collecte ajouté.
2. `index.html` et Chart.js local restent déployables par simple serveur statique ; HTML exporté unique et utilisable sans réseau.
3. Compatibilité de lecture de `trello-v3` ancien `{t,d,m,c}` et actuel avec `i`. Aucun effacement/migration destructive automatique.
4. `window.tba` et alias historiques conservés ; signatures inchangées sauf ajout purement interne justifié. Version de l'application ne constitue pas un nouveau schéma implicite.
5. Thèmes, reduced-motion, focus, démo sans écrasement de session et formats existants restent couverts par les 19 tests et les tests ajoutés à chaque lot.
6. Validation aux frontières ; erreurs explicites. Ne pas transformer des données invalides ou tronquées en succès.

## Contrats cibles, communs aux plans

### C1 — Acquisition et actualisation (001, 005)

- Un delta réussi ne diminue jamais l'ensemble des IDs déjà connus. Un résultat vide ne modifie pas l'historique.
- La fusion est dédupliquée par ID, pas par date. Une courte fenêtre de recouvrement d'une seconde évite une dépendance à l'inclusivité exacte de `since` ; les IDs éliminent les doublons. **Limite :** delta append-only ne réconcilie pas suppressions/modifications anciennes ; la mise à jour complète est le mécanisme actuel pour cela.
- Une collecte complète remplace uniquement après fin de pagination valide. Curseur manquant sur page pleine, répété ou garde-fou atteint : échec explicite, ancien état/sauvegarde conservés. Pas de système de snapshots multiples ajouté.
- Erreur/annulation ne doivent ni publier ni sauvegarder une liste partielle. Débit régulé par tentative HTTP ; attente annulable.

### C2 — Persistance et consentement (002, 006)

- « Sauvegardé » signifie écriture réussie dans le backend persistant disponible ; cela ne promet pas l'immunité à l'éviction navigateur.
- La consultation mémoire reste possible, accompagnée de « session non sauvegardée, exporter avant de fermer ». Ne pas mettre à jour la date du dernier succès sur échec/volatile.
- Lecture corrompue : message explicite et aucune réécriture automatique. Échec d'effacement : ne pas prétendre avoir supprimé.
- Décocher la mémorisation tente immédiatement de retirer key/token de la copie existante, sans la remplacer par une démo ou un autre tableau ; échec visible. Les secrets restent utilisables en mémoire pour la connexion courante.
- Validation adaptée à chaque enveloppe historique/embarquée, réutilisant le contrôle des actions ; pas de schéma/API tout-en-un ou dépendance pour quelques champs.

### C3 — Partage (003, 004)

- **Tous les exports portent uniquement les actions visibles au moment du lancement.** Le JSON a les mêmes actions/stats/filtres, y compris query et bornes explicites. Les métadonnées sont une liste autorisée, pas un dump de `state`.
- Le HTML interactif ne peut desserrer les filtres qu'à l'intérieur de son sous-ensemble embarqué ; ses filtres initiaux sont vides, la provenance des filtres de la vue source est affichée comme texte. « Fichier complet de la vue exportée » ne veut plus dire « historique complet du tableau ».
- Les re-exports du rapport ne peuvent retrouver ni secrets ni actions exclues. ZIP et repli statique appliquent la même règle.
- Ce choix est une **rupture de comportement intentionnelle** par rapport à l'HTML complet documenté ; annoncer dans README et bannière, pas ajouter une option cachée de partage complet. Pour tout exporter : effacer les filtres avant export.
- CSV est une représentation pour tableur et peut neutraliser le texte dangereux. JSON et XLSX typé texte conservent les chaînes. Aucun secret API, aucun filtre ne doit être présenté comme anonymisation du nom de tableau ou de membre restant.

### C4 — Temps et signification (007, 008)

- Conserver l'heure locale de l'appareil et le dimanche comme début de semaine (moindre surprise vs calendrier actuel) ; changer la sérialisation des clés de semaine pour ne plus décaler le jour UTC. Jours actifs et séries deviennent locaux aussi.
- Afficher le fuseau IANA résolu (`Intl.DateTimeFormat().resolvedOptions().timeZone`, repli libellé « heure locale »). Les timestamps d'actions restent ISO UTC.
- Rapports affichent le fuseau source et précisent que le recalcul interactif suit le poste de lecture. **Raccourci assumé :** pas de calcul dans un fuseau étranger ; envisager un fuseau fixé uniquement si des comparaisons interpostes l'exigent. Le code exécutant devra annoter `shortcut: les agrégations suivent le fuseau local du lecteur, fixer un fuseau lorsque la comparaison interpostes devient une exigence`.
- Retirer le score composite, sa jauge et sa mention de footer. Le champ public existant `buildInsights(...).score` reste présent mais vaut null : changement de valeur à annoncer, sans enveloppe de compatibilité ni calcul fantôme. `forecast` garde sa forme mais devient explicitement un équivalent historique, non une prévision. Conserver les faits bruts et la recherche/commandes/comparateur. Présenter la projection comme équivalent hebdomadaire du rythme observé, pas prévision ; vide = pas de suggestion chiffrée.
- Comparaison entre deux semaines closes consécutives avec volume nul inclus, bornées dans l'intervalle observé/filtré ; si couverture insuffisante, dire « comparaison indisponible ». Pas de classement individuel de performance.
- Déclarer comptage par noms/libellés tant que les identités ne sont pas migrées. Une limite visible vaut mieux qu'une exactitude simulée.

### C5 — Accès (009)

Les chiffres et séries qui donnent une information doivent être disponibles en HTML natif, pas uniquement par couleur, canvas ou tooltip. Réutiliser les modèles/datasets réels ; ne pas maintenir des chiffres calculés parallèlement. Graphiques et heatmap restent visuels ; pas de 168 nouveaux tab stops.

## Évolutions différées, avec porte de réouverture

| Sujet | Pourquoi différé | Méthode concrète avant nouveau plan |
|---|---|---|
| Identités stables F10 | Correction utile mais migration transversale, données slim anciennes irrécupérables | Sur une fixture synthétique contenant `idMemberCreator`, `memberCreator`, `data.card.id`, tester homonymes, renommages, anciens membres et mix ancien/nouveau slim. Cartographier `memberNames`, `memberCounts/memberExtras/cardCounts`, `byMemberPeriod`, filtres, tendances, comparateur, exports et alias publics. Décider des clés `id:` vs `legacy-name:` sans prétendre réidentifier l'ancien. Découper ensuite acquisition/slim puis consommateurs, sans migration de session avant preuve de lecture rétrocompatible |
| IndexedDB | Pas de mesure de tableaux réels refusés et aucune demande de multi-session | Reproduire quota avec sessions synthétiques 10k/50k/100k, navigateur cible et origine contenant cache ; enregistrer taille/latence/erreur, sans données utilisateur. Si refus récurrent au volume attendu validé, planifier snapshot IndexedDB natif et migration par copie vérifiée avec ancienne clé conservée |
| Flux Kanban | Modèle métier et raw transitions absents | Avant tout plan, obtenir définition des listes début/fin et fixtures anonymisées de déplacement/retour/archivage. Comparer avec R4 ; arrêt si aucune question de délai de livraison n'est validée |
| Rendu Worker / update Chart.js | Performance historique seulement, pas seuil utilisateur mesuré ici | Refaire traces rendus 10k/50k/100k (médiane/p95, matériel décrit), comparer interaction <1 s ; seulement déplacer le calcul pur si blocage reproductible après correctifs |
| Durcissement CDN/CSP | Chemin nominal local, politique offline/non-réseau à préciser | Simuler bundle manquant et réseau refusé ; mesurer besoin réel du fallback. Suppression CDN préférable si absence d'usage ; sinon SRI/provenance sur bundle épinglé, sans eval de source distante non vérifiée. Pas de CSP improvisée incompatible avec les rapports inline |
| Licence du projet | Décision du titulaire, non déductible de la licence Chart.js | Avant redistribution par un tiers, faire confirmer au titulaire les droits et la licence souhaitée ; pas de fichier MIT inventé |

Ces lignes sont des **sujets non autorisés à implémenter implicitement dans les neuf lots**. Elles ne bloquent pas la réparation des pertes, du statut de stockage ou du partage.

## Architecture cible minimale

Même sections et même distribution. `fetchJSON` est la frontière HTTP ; les entrées restaurées passent par la validation ; `state.actions` reste la liste complète locale ; `getVisible` produit la vue ; `buildReportModel` reste la base des rapports. Pas de couche repository/service/adapter supplémentaire. Ne factoriser que la connaissance réellement commune : encodage slim, validation d'action, définition de jour civil et neutralisation CSV. Ne pas extraire tous les exports parce qu'ils se ressemblent.
