# PLAN-004 — Neutraliser les cellules dangereuses du CSV tableur

**Statut : en cours (2026-10-21) · Priorité : P1 — Majeur.** Une carte ou un membre peut fournir du texte interprété par un tableur ; correction locale partagée et sans dépendance.

## 1. Problème et preuves

F04 : `index.html:3281–3285`, `csvCell('=1+1') === '=1+1'` vérifié. L'échappement de guillemets ne neutralise pas les formules. Source R2 documente risque et absence de mitigation universelle.

## 2. Objectif

Le CSV annoncé Excel est sûr pour **l'ouverture initiale dans les tableurs vérifiés** : texte non fiable ne devient pas une formule. Ne pas modifier les données normalisées, JSON ni XLSX typé chaîne.

## 3. Cible

Corriger une seule fois dans `csvCell` partagé. Avant le quoting RFC : détecter débuts dangereux `= + - @`, variantes pleine largeur et contrôles tab/CR/LF ; considérer une séquence initiale d'espaces/contrôles pouvant précéder ces caractères (tableurs susceptibles de les ignorer). Pour cellule dangereuse, préfixer **une tabulation à l'intérieur du champ obligatoirement cité**, puis doubler les quotes. Conserver le texte d'origine après ce préfixe, pas de trim destructif. Pour non dangereux : comportement existant.

Définir détection conservatrice sans expression regex opaque : tests explicites des préfixes, caractères Unicode nommés dans commentaire. Appliquer aussi aux IDs/type/date parce que l'API publique accepte du texte arbitraire ; pas seulement aux noms.

## 4. Décisions / alternative

R2 précise tabulation Excel et compromis ; CSV n'est pas un format exact pour machine après neutralisation. JSON reste exact ; XLSX déjà typé chaîne, ne pas changer. Apostrophe seule non retenue : limites rapportées après sauvegarde/réouverture ; aucun préfixe ne garantit tout tableur. Alternative si contrainte aval interdit ce préfixe : retirer CSV/diriger vers XLSX plutôt que livrer un mode dangereux optionnel. Pas de bibliothèque pour quelques lignes.

## 5. Fichiers, appelants, risques utilisateurs

`csvCell`, `buildActionsCsv`, `selfTest`, `exportCsv`, entrée `actions.csv` dans exportZip. API publique `csvCell/buildActionsCsv`, alias globaux ; `exp-csv` et raccourci CSV si présent dans wireShortcuts restent branchés. Réexport depuis HTML utilise SELF_SRC, donc même sérialiseur. Tests app : jeu de caractères hostile et archive ; README CSV/JSON, manifeste ZIP si avertissement nécessaire.

Config/fixtures : fixtures synthétiques dans tests, pas de vrais liens d'exfiltration. Exports XLSX/JSON à vérifier inchangés au niveau texte. **Risque de compatibilité** : préfixe tabulation pour consommateurs machine ; annoncer expressément le changement et orienter vers JSON. Pas de donnée source détruite.

## 6. Étapes d'implémentation

1. Tests de `csvCell/buildActionsCsv` sur `=1+1`, `+1`, `-1`, `@x`, tab/CR/LF, espace+formule, variantes Unicode, quotes/virgules et lignes multiples ; non-danger français ordinaire inchangé.
2. Implémenter détection/préfixe/quoting dans csvCell, sans ajouter mode raw ou configuration. Les entêtes constants restent inchangés, BOM UTF-8 et CRLF conservés.
3. Vérifier ZIP et rapport HTML réexporté passent par ce sérialiseur. Étendre selfTest sur une cellule simple sans casser ses invariants.
4. Ajouter texte de documentation : usage tableur, caractères conservés avec préfixe technique, JSON exact, limitations après resauvegarde tierce.
5. Si Excel/LibreOffice disponibles, ouvrir fixture bénigne isolée sans liens : cellule doit être texte, pas résultat numérique calculé. Consigner version/outils et résultat ; ne pas annoncer cette vérification si non disponible.

## 7. Dépendances / prérequis

Après 003 pour ne pas entrer en conflit sur exports/fixtures. Aucun accès live Trello. Disponibilité d'un tableur non supposée ; pas de téléchargement hors allowlist pour le sandbox.

## 8. Contraintes / non-objectifs

Conserver RFC 4180, BOM/CRLF et sorties normales ; ne pas supprimer CSV ni ajouter désactivation de sécurité. Pas d'échappement global dans `normalizeAction`, pas d'apostrophe dans JSON/XLSX, pas d'audit de vulnérabilités Excel historique.

## 9. Cas limites

Chaîne vide, nombre négatif transmis en texte (protection conservatrice volontaire), formules précédées de contrôles, locale Unicode, multiline, quotes, signature UTF-8. Altérations ultérieures par logiciel tiers hors contrôle : aucune garantie universelle.

## 10. Tests / vérifications

Lire octets téléchargés, parser les champs de fixture (mini parse de test supportant quotes/multiline, pas `split(',')`), vérifier préfixe à l'intérieur des quotes et absence de nouvelle cellule. Vérifier chaînes JSON/XLSX inchangées. Réexport HTML et archive ZIP. `npm test` complet.

## 11. Critères d'acceptation

Chaque entrée dangereuse testée produit un champ cité dont la valeur commence par tabulation et conserve le texte original ensuite ; champs ordinaires byte-identiques ; aucune cellule formule construite par séparateur/quote. Les deux appelants de buildActionsCsv et la visionneuse ont le comportement. README ne promet pas sécurité de tout tableur/réouverture.

## 12. Définition de terminé

Cause corrigée une seule fois, fixtures/auto-test et suite verts ; compatibilité/limitations documentées. Vérification manuelle seulement si réellement faite, sinon limite consignée sans inventer un succès.

## 13. Sources

F04/F12, [R2 et comparaison CSV](../02-recherche-et-options.md), vision C3, roadmap J2, PLAN-003.

## Exécution — 2026-10-21 · en cours

Prérequis 003 validé (53 tests). Sérialiseur unique csvCell, deux appelants et SELF_SRC relus ; neutralisation tableur uniquement, JSON/XLSX exacts.
