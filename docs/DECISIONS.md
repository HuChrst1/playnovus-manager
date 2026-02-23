# Journal des décisions

Date de mise à jour initiale: 2026-02-12
Derniere mise a jour: 2026-02-23

## Décisions prises

### D-001 - Next.js App Router + TypeScript strict

- Statut: validée
- Constat:
  - projet structuré autour de `src/app/*`
  - TS strict activé dans `tsconfig.json`
- Impact:
  - base solide pour composants serveur/client et typage des flux

### D-002 - Supabase comme backend unique

- Statut: validée
- Constat:
  - clients Supabase dédiés (`supabase.ts`, `supabase-server.ts`)
  - typage DB généré dans `src/types/supabase.ts`
- Impact:
  - modèle de données centralisé sur Postgres/Supabase

### D-003 - Stock piloté par ledger de mouvements

- Statut: validée
- Constat:
  - `stock_movements` comme source de vérité
  - vues dérivées pour agrégats (`stock_per_piece`, `stock_journal`, `piece_movements`)
- Impact:
  - traçabilité et recalcul du stock indépendants des écrans

### D-004 - FIFO pour le coût des ventes

- Statut: validée
- Constat:
  - allocation FIFO implémentée dans `src/lib/stock.ts`
  - consommation appliquée lors des créations/éditions de vente
- Impact:
  - coût/marge réels calculés sur ordre chronologique des entrées

### D-005 - Support set partiel via overrides

- Statut: validée
- Constat:
  - mapping `overrides` (`piece_ref -> qty finale`) stocké sur `sale_items`
  - snapshot détaillé dans `sale_item_pieces`
- Impact:
  - vente de set incomplet possible sans casser le moteur FIFO

### D-006 - Vente mono-type (pas de mix SET/PIECE)

- Statut: validée
- Constat:
  - une commande doit avoir un type unique
  - `sale_type` est la vérité de classification
- Impact:
  - les lignes d'une vente doivent toutes correspondre au type de la commande
  - les cas `MIXED` sont hors scope

### D-007 - Pas de liste globale "pièces vendues", audit via détail commande

- Statut: validée
- Constat:
  - l'écran principal de ventes reste la vue `Commandes` (1 ligne = 1 vente)
  - le besoin audit est couvert dans le détail commande
- Impact:
  - aucune page liste globale dédiée "pièces vendues"
  - drilldown autorisé en modal/section pour afficher les pièces réellement sorties

### D-008 - KPIs Ventes standardisés (fenêtre + delta)

- Statut: validée
- Constat:
  - période par défaut: 30 jours glissants
  - périodes rapides: `Total`, `90`, `30`, `7`
  - comparaison avec période précédente équivalente
- Impact:
  - exclusion des ventes `CANCELLED` des KPIs business
  - lecture des performances homogène d'un écran à l'autre

### D-009 - Confirmation lot interdite tant que le lot est vide

- Statut: validée
- Constat:
  - un lot avec 0 pièce ne doit pas être confirmable
  - le coût unitaire reste vide tant que le lot n'a pas de quantité
- Impact:
  - réduction des incohérences de stock/couts sur les lots incomplets
  - garde-fou produit explicite avant intégration stock

### D-010 - Suppression contrôlée des lots confirmés

- Statut: validée
- Constat:
  - un lot confirmé peut être supprimé pour corriger un approvisionnement erroné
  - la suppression doit retirer les mouvements d'achat du stock/historique
  - la suppression est interdite si le lot a déjà été utilisé en ventes
- Impact:
  - suppression autorisée pour `draft` et `confirmed` si aucune consommation ventes
  - blocage explicite + guidage utilisateur si ventes liées détectées
  - aucune suppression en cascade des ventes

### D-011 - Synchronisation stock sur transition de statut lot

- Statut: validée
- Constat:
  - passer `confirmed -> draft` doit retirer les entrées `PURCHASE` du lot
  - passer `draft -> confirmed` doit recréer les entrées `PURCHASE` du lot
  - le downgrade `confirmed -> draft` est bloqué si le lot est déjà utilisé en ventes
- Impact:
  - cohérence stock/historique sur les changements de statut
  - prévention des doublons de mouvements lors des aller-retours de statut
  - conservation des invariants FIFO/ventes existants

### D-012 - Baseline migrations SQL issue de la DB reelle + seed desactive en F1.1

- Statut: validée
- Constat:
  - baseline SQL versionnee generee depuis la DB Supabase reelle (`public`)
  - `supabase/migrations/` initialise avec migration timestampée
  - `seed.sql` n'existe pas encore (scope F1.2)
- Impact:
  - le schema est versionne et rejouable localement depuis le repo
  - la valeur de verite schema devient la baseline migration
  - `db.seed.enabled` est desactive temporairement pour eviter les resets casses en F1.1

### D-013 - Mouvements IN/OUT obligatoirement relies a un lot (F1.3)

- Statut: validee
- Constat:
  - le garde-fou anti-stock negatif est porte par `stock_balance` alimente depuis `stock_movements`
  - des mouvements `IN/OUT` avec `lot_id` nul pouvaient contourner ce garde-fou
  - la logique FIFO et les couts unitaires reussissent uniquement avec un rattachement lot explicite
- Impact:
  - contrainte DB `ck_stock_movements_lot_required_inout` pour imposer `lot_id` sur `IN/OUT`
  - tout rejet de stock negatif remonte un message SQL explicite
  - compatibilite conservee avec le modele ledger (`stock_movements` source de verite, `stock_balance` derive)

### D-014 - Anti-doublon strict metier sur stock_movements + fail-fast (F1.4)

- Statut: validee
- Constat:
  - `stock_movements` etait protege par PK `id` uniquement, sans unicite metier anti-double insertion
  - les flux coeur (`PURCHASE`, `SALE`, `SALE_CANCEL`) peuvent etre reinvoques accidentellement (retry/double-submit)
  - deux indexes strictement redondants existaient deja sur `(source_type, source_id)`
- Impact:
  - contrainte DB `ck_stock_movements_source_id_required_core` pour exiger `source_id` non vide sur flux coeur
  - index unique partiel `ux_stock_movements_no_duplicate_core` sur `(source_type, source_id, piece_ref, lot_id, direction)` pour `PURCHASE|SALE|SALE_CANCEL`
  - strategie migration `fail-fast` en presence de donnees invalides/doublons preexistants (pas de dedup auto)
  - remplacement de lookup source par `idx_stock_movements_source_id_direction`
  - suppression des indexes source redondants pour limiter le cout d'ecriture inutile

### D-015 - Healthcheck metier SQL canonique via vue versionnee (F1.5)

- Statut: validee
- Constat:
  - besoin d'un audit pre-release des anomalies metier sans bloquer les ecritures
  - les anomalies cibles couvrent: ventes `CONFIRMED`, mouvements orphelins flux coeur, incoherences inventory, stock negatif
- Impact:
  - creation de `public.healthcheck_business_anomalies_v1` comme contrat canonique de healthcheck SQL
  - sortie normalisee stable (`v1`) avec colonnes techniques/metier exploitables en lecture humaine et automatisation
  - `anomaly_code`/`anomaly_family` imposes comme cles machine de tri et suivi
  - strategie `fail-open` explicite: aucun trigger/contrainte bloquante supplementaire introduit en F1.5
  - compatibilite preservee avec le modele ledger existant (`stock_movements` source de verite, `stock_balance` derive)

### D-016 - LotID auto attribue cote serveur a la creation

- Statut: validee
- Constat:
  - la creation de lot demandait une saisie manuelle de `lot_code` cote UI
  - ce champ est une convention interne qui doit rester sequentielle et simple (`LOT_N`)
  - la contrainte DB `lots_lot_code_key` impose deja l'unicite
- Impact:
  - `lot_code` est genere cote serveur a la creation, au format `LOT_<N>`
  - regle de progression retenue: `max+1` global sur les codes conformes `LOT_N`
  - `LOT_0` reste reserve au lot initial (la generation standard commence a `LOT_1`)
  - en cas de collision concurrente, retry serveur avant retour d'erreur explicite
  - edition manuelle ulterieure de `lot_code` conservee dans la modale d'edition

### D-017 - Renumerotation automatique des LOT_n apres suppression + protection de LOT_0

- Statut: validee
- Constat:
  - apres suppression d'un lot intermediaire, la numerotation visuelle pouvait laisser des trous (`LOT_1`, `LOT_3`, ...)
  - `LOT_0` represente le lot initial de reference et ne doit pas etre supprimable
  - des codes personnalises peuvent exister et ne doivent pas etre reecrits automatiquement
- Impact:
  - suppression de `LOT_0` interdite cote serveur avec message explicite
  - apres suppression d'un `LOT_n`, tous les codes standards `LOT_k` avec `k > n` sont renumerotes en `LOT_{k-1}`
  - la renumerotation cible uniquement les codes conformes `^LOT_(\\d+)$`
  - les codes personnalises restent inchanges
  - les regles metier existantes (blocage ventes liees, garde-fous stock) restent prioritaires

### D-018 - Confirmation lot atomique fonctionnelle par compensation verifiee

- Statut: validee
- Constat:
  - la confirmation `draft -> confirmed` etait executee en plusieurs etapes sans transaction DB unique
  - un echec intermediaire pouvait laisser un risque d'etat partiel (mouvements prepares puis echec statut)
  - un lot devait rester non confirmable s'il n'avait pas de lignes inventory valides au moment de confirmer
- Impact:
  - confirmation basee sur un snapshot inventory valide (quantites strictement positives)
  - refus explicite de confirmation si snapshot vide/invalide (`LOT_CONFIRMATION_INCONSISTENT`)
  - transition de statut protegee par garde de conflit (`status` attendu `draft`)
  - rollback de confirmation avec verification explicite de restauration (`LOT_CONFIRMATION_ROLLBACK_FAILED` si non verifiable)
  - message utilisateur actionnable en cas de conflit (`LOT_CONFIRMATION_CONFLICT` => recharger et reessayer)

### D-019 - Hardening Supabase compatible sans auth applicative

- Statut: validee
- Constat:
  - le linter Supabase signalait:
    - vues en posture definer (`security_definer_view`)
    - RLS desactive sur des tables exposees (`rls_disabled_in_public`)
  - l'application n'a pas encore de flux auth utilisateur generalise
  - une correction stricte orientee auth aurait risque une regression immediate
- Impact:
  - activation de RLS sur les tables publiques cibles avec policies de compatibilite (`anon/authenticated`) pour conserver le comportement actuel
  - bascule des vues ciblees en `security_invoker=true` pour appliquer les permissions de l'appelant
  - reduction des grants:
    - vues ciblees: `SELECT` uniquement pour `anon/authenticated`
    - tables ciblees: CRUD explicite pour `anon/authenticated`
  - aucun changement des droits `service_role` dans cette iteration
  - trajectoire retenue:
    - phase actuelle: linter clean sans regression
    - phase ulterieure: durcissement auth strict (policies par utilisateur/role metier)

### D-020 - Sortie a 0 vulnerabilite npm par migration ESLint vers Biome

- Statut: validee
- Constat:
  - `npm audit` remontait 10 vulnerabilites moderees via la chaine lint (`eslint` -> `@eslint/eslintrc` -> `ajv@6`)
  - la correction proposee par npm (`npm audit fix --force`) entrainait un downgrade cassant
  - l'objectif produit etait `0 vulnerabilite` globale (prod + dev)
- Impact:
  - retrait de `eslint` et `eslint-config-next` du projet
  - adoption de `@biomejs/biome` comme moteur lint bloqueur
  - ajout d'un garde-fou specifique `<img>` pour maintenir le minimum de protection Next sans plugin ESLint
  - maintien des gates qualite (`lint`, `typecheck`, `build`, `test:f2.0`) sans modification de logique metier
- verrouillage d'une trajectoire simple de maintenance supply-chain (moins de dependances lint transitive critiques)

### D-021 - Dashboard V2 en mode hub analytique + drilldowns existants (Recharts)

- Statut: validee
- Constat:
  - le dashboard `/` F4.2 couvrait les 4 KPI essentiels mais restait trop minimal pour un pilotage quotidien
  - le besoin metier prioritaire est un cockpit unique oriente profit/cash avec lecture decisionnelle rapide
  - la creation de nouvelles routes analytiques dediees augmenterait le cout UX et la maintenance hors phase initiale
- Impact:
  - adoption d'une architecture `Hub + drilldowns`:
    - `/` devient le cockpit analytique principal
    - actions detaillees redirigees vers pages operationnelles existantes (`/ventes`, `/approvisionnement`, `/stock`, `/historique-stock`, `/catalogue`)
  - contrat URL dashboard etendu a `preset/from/to` avec canonicalisation SSR stricte
  - baseline comparaison standardisee: periode precedente equivalente
  - visualisations standardisees via `Recharts` (phase A sans migration SQL)
  - conservation explicite de la compatibilite `dashboard.v1` et ajout d'un contrat `dashboard.v2` pour l'enrichissement

### D-022 - Dashboard V3 strict: modales etendues + composition fixe en 5 blocs

- Statut: validee
- Constat:
  - la lecture V2 restait encore en ecart avec la vision produit attendue pour le pilotage quotidien
  - le besoin prioritaire est un tableau de bord dense mais strictement actionnable, avec detail contextuel immediat sans changer de page
  - l'effet de detail attendu est une modale etendue avec animation courte (overlay + pop), et non un simple drilldown de navigation
- Impact:
  - la composition `/` devient contractuelle en 5 blocs:
    - bloc 1: 11 KPI financiers/operations
    - bloc 2: tendances temporelles (CA + marge) + cycles sets/pieces
    - bloc 3: comparaison sets vs pieces (grouped + tableau + pie)
    - bloc 4: pilotage achats/stock (mensuel + tendance)
    - bloc 5: opportunites catalogue
  - contrat URL unifie:
    - `preset=7|30|90|12m|custom`, avec compat legacy `total -> 30`
    - canonicalisation SSR stricte (`from/to` invalides ignores, permutation auto, custom borne unique => plage 1 jour)
  - definitions metier verrouillees:
    - `12 mois = 365 jours glissants`
    - rotation stock = `CA periode / stock moyen (ouverture+cloture)/2`
    - taux immobilisation = `stock actuel / CA cumule 12 mois`
  - interaction detail:
    - toutes cartes KPI et tous blocs ouvrent une modale etendue
    - animation dashboard-only: overlay `opacity 0->0.5`, modale `opacity 0->1` + `scale 0.95->1` en `150ms ease-out` (sortie inverse)
  - sections V2 retirees de `/`:
    - `alertes actionnables`
    - `drilldowns rapides`

### D-023 - Dashboard V3.1: preset total canonique + filtre en drawer + cards compactes cliquables

- Statut: validee
- Constat:
  - la vision produit cible une densite forte sur `/` avec des cards compactes et detail uniquement en modale
  - les chips de filtre permanentes nuisaient a la lisibilite et occupaient trop d'espace utile
  - le preset `total` devait devenir officiel (et non un alias legacy) pour piloter la totalite de l'historique business
  - le bloc 3 necessitait une lecture modale plus focalisee pour eviter la surcharge visuelle
- Impact:
  - `DashboardPreset` devient `total|7|30|90|12m|custom`
  - canonicalisation SSR de `/`:
    - fallback par defaut `/?preset=total`
    - `preset` invalide -> `total`
    - `custom` avec `from/to` strictement normalises (invalides ignores, permutation auto, borne unique -> plage 1 jour)
  - implementation du preset `total` sur plage reelle:
    - borne de debut = plus ancienne date exploitable entre ventes confirmees et lots confirmes
    - borne de fin = aujourd'hui
  - UX dashboard:
    - suppression des boutons `Agrandir`
    - ouverture modale au clic sur toute la card
    - filtres de temps deplaces dans un drawer lateral droit avec timeline discrete (`Total`, `12m`, `90j`, `30j`, `7j`) + mode custom
    - modale KPI recentree sur la valeur (formule masquee)
    - modale bloc 3 refondue en vues focalisees `Graphique/Tableau/Camembert`

### D-024 - Dashboard V3.2: filtre inline non intrusif + KPI unitaires + bento trend-dominant

- Statut: validee
- Constat:
  - le filtre en drawer lateral restait trop intrusif visuellement pour un usage rapide
  - la section KPI englobante reduisait la lisibilite attendue (objectif `1 KPI = 1 card`)
  - la disposition des blocs n'etait pas encore percue comme un vrai bento a densite variee
- Impact:
  - filtre dashboard migre de `Sheet` vers `Popover` dans le header:
    - sans overlay pleine page
    - presets en application instantanee (`Total`, `12m`, `90j`, `30j`, `7j`)
    - mode custom conserve (`from/to` + `Appliquer`)
  - suppression du wrapper "Sante financiere":
    - rendu direct des 11 KPI en cards unitaires
    - densite desktop 5 colonnes
    - style cards KPI adouci (pastel + ring leger, sans contour dur)
  - layout bento verrouille en mode trend-dominant:
    - carte tendances en bloc majeur (`col-span-8`, `row-span-2` sur XL)
    - autres blocs repartis en tailles variees
    - previews graphiques compactes en dashboard, detail reserve aux modales

### D-025 - Dashboard V3.2.1: KPI aligns sur cards standard + popover filtre horizontal a gauche

- Statut: validee
- Constat:
  - les KPI restaient visuellement en ecart (effet transparent/pastel juge non coherent)
  - le popover filtre apparaissait en dessous du bouton avec une lecture trop verticale
- Impact:
  - KPI harmonises avec les cards standards du dashboard:
    - fond blanc
    - bordure legere
    - ombre douce
    - plus de gradient pastel specifique KPI
  - popover filtre deplace a gauche du bouton `Filtrer`:
    - `side=left`
    - contenu horizontalise (presets + actions/custom)
  - comportement fonctionnel conserve:
    - presets instantanes
    - mode custom applique via bouton `Appliquer`
    - reset vers `/?preset=total`

### D-026 - Dashboard V3.2.2: filtre inline horizontal desktop (no-overlap) + drawer mobile

- Statut: validee
- Constat:
  - un panneau filtre flottant pouvait encore recouvrir la zone KPI selon la taille d'ecran
  - l'objectif UX exige un filtre desktop tres horizontal, sans empilement principal vertical
- Impact:
  - desktop/tablette:
    - remplacement du panneau flottant par un bandeau inline dans le header
    - panneau en flux normal, garantissant zero overlap avec les KPI
    - controles alignes horizontalement (`flex-nowrap`) avec scroll horizontal si necessaire
  - mobile:
    - fallback via drawer dedie (`Sheet`) pour conserver un usage lisible sur petit viewport
  - comportement fonctionnel inchange:
    - presets instantanes
    - mode custom via `from/to` + `Appliquer`
    - reset `/?preset=total`
  - aucun impact sur la couche data:
    - contrat `dashboard.v3` inchangé
    - query params `preset/from/to` inchangés

### D-027 - Dashboard V3.2.4: header filtre verrouille (zone centrale) + garde viewport

- Statut: validee
- Constat:
  - le bouton `Filtrer` devait rester strictement positionne a droite du header en desktop/tablette
  - le panneau filtre devait s'ouvrir uniquement dans la zone centrale du header, sans depasser ni recouvrir les KPI
  - des bascules de viewport pouvaient laisser le `Sheet` mobile ouvert en contexte desktop, provoquant fond sombre + ouverture en bas
- Impact:
  - header desktop/tablette verrouille en grille 3 zones (`gauche/centre/droite`)
  - bouton `Filtrer` fixe en colonne droite (`justify-self-end`, alignement haut)
  - panneau filtre desktop rendu uniquement dans la colonne centrale:
    - en flux normal (pas de panel flottant)
    - largeur bornee au slot central
    - layout horizontal strict (`flex-nowrap`, `whitespace-nowrap`, `overflow-x-auto`)
  - garde viewport ajoutee (`matchMedia`) pour fermer automatiquement:
    - le `Sheet` mobile en passage desktop/tablette
    - le panneau desktop en retour mobile
  - logique metier conservee:
    - presets instantanes
    - custom via `from/to` + `Appliquer`
    - reset `/?preset=total`
  - aucun impact sur la couche data:
    - contrat `dashboard.v3` inchangé
    - query params `preset/from/to` inchangés

### D-028 - Dashboard V3.2.5: suppression Sheet dashboard et filtre inline unique

- Statut: validee
- Constat:
  - la coexistence `panneau inline + Sheet mobile` sur le dashboard pouvait encore produire un comportement perçu comme incoherent en desktop (fond sombre + panneau bas)
  - l'objectif produit prioritaire est un comportement desktop-first unique et previsible
- Impact:
  - suppression du `Sheet` pour le filtre de la page `/`
  - un seul declencheur `Filtrer` conserve dans le header
  - un seul mode d'affichage du filtre:
    - panneau inline dans la zone centrale du header
    - aucun overlay plein ecran
    - aucune ouverture en bas
  - controle horizontal strict maintenu:
    - `Total`, `12m`, `90j`, `30j`, `7j`, `Personnalise`, `Du`, `Au`, `Appliquer`, `Reinitialiser`
  - logique metier conservee:
    - presets instantanes
    - custom via `from/to` + `Appliquer`
    - reset `/?preset=total`
  - aucun impact sur la couche data:
    - contrat `dashboard.v3` inchangé
    - query params `preset/from/to` inchangés

### D-029 - Dashboard V3.2.6: header compact mono-ligne sans metadonnees secondaires

- Statut: validee
- Constat:
  - le header restait trop haut pour la densite souhaitee
  - l'objectif UX prioritaire etait de maximiser l'espace utile pour les KPI/charts
- Impact:
  - le header de `/` est reduit a une ligne structurelle:
    - gauche: `DASHBOARD`
    - centre: panneau filtre inline (si ouvert)
    - droite: bouton `Filtrer`
  - suppression des elements secondaires du header:
    - label version
    - badges periode/preset/granularite
  - panneau filtre conserve en mode horizontal strict et compact (`h-10`)
  - logique metier filtre conservee (presets instantanes, custom apply, reset total)
  - aucun impact sur la couche data:
    - contrat `dashboard.v3` inchangé
    - query params `preset/from/to` inchangés

### D-030 - F4.4 phase B: axes analytiques verrouilles (projection cash/profit, cohorte canal, appro par canal, rotation theme)

- Statut: validee
- Constat:
  - la priorite metier est la decision achat rapide via projection cash/profit, pas une lecture uniquement descriptive
  - l'axe "fournisseur" devait rester exploitable sans taxonomie rigide, en reutilisant les libelles operationnels existants
  - la rotation fine devait etre alignee sur la famille produit la plus lisible cote business (`theme` set)
  - les blocs masques en cas de donnees faibles reduisent la confiance et degradent la lisibilite decisionnelle
- Impact:
  - projections F4.4 standardisees:
    - horizons 30j et 90j
    - signal global achat `ACCELERER|STABLE|FREINER`
  - cohortes avancees alignees sur `sales.sales_channel` (classement contribution marge puis CA)
  - lead-time d'approvisionnement calcule par canal `lots.supplier` (normalisation trim/casse sans taxonomie imposee)
  - rotation fine par famille alignee sur `sets_catalog.theme`
  - politique explicite d'insuffisance de donnees:
    - sections conservees visibles
    - message explicite `manque de donnees pour formuler une analyse fiable`
    - valeurs non fiables en `—`
  - contraintes de compatibilite conservees:
    - contrat `dashboard.v3` additif uniquement
    - query params `preset/from/to` inchanges
    - aucune migration SQL imposee par F4.4

### D-031 - F5.0.1 import CSV lot: traitement partiel + aggregation doublons + rapport detaille

- Statut: validee
- Constat:
  - l'import CSV de detail lot doit accelerer la saisie sans perdre la robustesse metier existante
  - les exports terrain (Excel/Sheets) peuvent contenir des lignes invalides et des doublons de references
  - bloquer tout le fichier pour quelques lignes incorrectes degrade fortement l'UX operationnelle
- Impact:
  - import partiel retenu:
    - lignes valides appliquees
    - lignes invalides rejetees avec motif explicite
  - doublons internes CSV agreges par `piece_ref` (addition des quantites) avant ecriture
  - application alignee strictement sur la saisie manuelle existante (`addPieceToLot`):
    - fusion `(lot_id, piece_ref)`
    - recalcul `lots.total_pieces`
    - recalcul `inventory.unit_cost`
  - verrou metier confirme:
    - lot `draft` autorise
    - lot `confirmed` refuse cote UI et cote serveur
  - pieces absentes du catalogue acceptees sans blocage
  - aucun changement SQL/migration requis pour F5.0.1

### D-032 - F5.0.2 piece jointe facture lot: cardinalite unique + remplacement auto + confirmed autorise

- Statut: validee
- Constat:
  - le detail lot devait integrer une preuve documentaire facture sans impacter les flux stock/ledger existants
  - le besoin operationnel retenu est une gestion simple "1 lot = 1 piece jointe facture", avec remplacement automatique
  - la consultation doit rester immediate depuis l'UI lot via lien securise, sans ouvrir un sous-parcours additionnel
- Impact:
  - cardinalite retenue:
    - une seule piece jointe facture par lot
    - si une piece existe deja, le nouvel upload la remplace automatiquement
  - regle statut lot:
    - upload autorise sur lot `draft` et `confirmed`
    - suppression autorisee sur lot `draft` et `confirmed`
  - validation fichier stricte:
    - formats autorises: `PDF`, `JPG/JPEG`, `PNG`, `WEBP`, `HEIC`
    - taille maximale: `15 Mo`
    - rejet bloquant avec message actionnable si non conforme
  - architecture retenue:
    - stockage via bucket Supabase prive dedie
    - ouverture via URL signee
    - pas de table metadata `public` additionnelle
  - invariants:
    - aucun impact sur `stock_movements`, `stock_balance`, `PURCHASE/SALE/SALE_CANCEL`
    - aucun changement SQL/migration requis pour F5.0.2

### D-033 - F5.5 refonte UI globale: topbar flottante + design system Soft UI/Bento

- Statut: validee
- Constat:
  - le paradigme sidebar n'etait plus aligne avec la direction visuelle cible (Soft UI/Bento, topbar flottante)
  - des styles ad hoc persistaient entre routes et composants shared, avec une lisibilite tableau heterogene
  - la refonte devait rester strictement non intrusive sur les flux metier (query params, tri, pagination, actions, navigation)
- Impact:
  - navigation globale migree vers une topbar flottante 3 zones:
    - gauche: marque/logo
    - centre: navigation principale
    - droite: actions globales/profil (incluant `Report`)
  - design system transverse unifie dans `globals.css`:
    - rayons XXL et surfaces pill-systematiques
    - ombres diffuses / glass leger
    - separateurs pointilles discrets
    - progression avec piste hachuree diagonale
  - composants shared alignes (button/badge/card/progress/data-table/page-header) sans changer leur logique
  - assouplissement responsive sur pages detail critiques (suppression de rigidites `min-w-[1024px]`)
  - invariants proteges:
    - aucun changement API/DB
    - aucune migration SQL
    - aucune ecriture distante

### D-034 - F6.2 auth explicite obligatoire a l'entree de l'application

- Statut: validee
- Constat:
  - `H-002` laissait ouverte la politique `sans auth` vs `auth explicite`
  - la roadmap F6.2 demande un ecran d'entree unique et des redirections d'acces
  - l'application ne possedait ni route login ni garde d'acces en amont
- Impact:
  - route publique dediee `/login` (email + mot de passe)
  - gate d'entree applique sur les routes metier cibles:
    - non connecte -> redirection `/login`
    - connecte sur `/login` -> redirection `/`
  - implementation F6.2 volontairement minimale:
    - cookie `httpOnly` de session applicative
    - validation du token Supabase dans le proxy Next.js (`src/proxy.ts`)
  - limites explicites maintenues pour F6.3/F6.4:
    - pas de gestion complete multi-session admin
    - pas d'UI logout/compte parametres dans ce lot
    - aucun changement schema DB
    - aucune ecriture distante

### D-035 - Session memorisee 30j/7j + flux mot de passe oublie

- Statut: validee
- Constat:
  - la session minimale F6.2 imposait une reconnexion frequente et ne couvrait pas le besoin "rester connecte"
  - Next.js 16 deprecie la convention `middleware` au profit de `proxy`
  - l'absence de parcours `Mot de passe oublie` bloquait l'autonomie utilisateur en cas de perte du mot de passe
- Impact:
  - migration de garde d'acces vers `src/proxy.ts` (convention Next.js 16)
  - politique session appliquee cote app:
    - duree maximale de memorisation: `30 jours`
    - expiration sur inactivite: `7 jours`
    - refresh token en proxy si access token expire
  - UX login enrichie:
    - case `Se souvenir de moi` (cochee par defaut)
    - lien `Mot de passe oublie`
  - ajout du flux reset password email:
    - page demande reset
    - page nouveau mot de passe
    - message neutre anti-enumeration compte
  - limites maintenues:
    - pas d'inscription UI
    - pas de gestion roles/comptes avancee
    - pas de changement schema DB
    - aucune ecriture distante

### D-036 - Strategie de tests critiques locale-first (F7.1)

- Statut: validee
- Constat:
  - la protection metier des flux FIFO/lot/annulation/KPI necessitait une suite executable localement en une commande
  - le projet ne disposait pas de `test` automatise couvrant ces regressions critiques
  - la politique de securite impose zero ecriture distante pour ce lot
- Impact:
  - scripts npm normalises:
    - `test:unit` pour la logique FIFO pure
    - `test:integration` pour les scenarios metier F7.1 sur Supabase local
    - `test` comme orchestration unique (`unit + integration`)
  - garde local-only obligatoire dans la suite integration (`supabase status -o env` + verification `localhost/127.0.0.1`)
  - couverture metier minimale verrouillee:
    - FIFO oldest-first
    - confirmation lot (nominal + refus incoherent)
    - annulation vente avec restauration stock
    - coherence KPI ventes/dashboard
  - non-regression F2.0 imposee dans la campagne integration (`npm run test:f2.0`)
  - aucun changement schema SQL requis pour la strategie de test

### D-037 - Gate healthcheck DB pre-release/post-release strict (F7.3)

- Statut: validee
- Constat:
  - le healthcheck SQL canonique F1.5 existait mais sans protocole release pre/post explicite
  - les validations healthcheck etaient presentes de maniere indirecte (F2.0) sans matrice release dediee
  - la validation finale Phase 7 exige une decision claire bloque/non-bloque en cas d'anomalie
- Impact:
  - ajout d'un script local dedie `scripts/f7_3_validate_local.mjs`:
    - checkpoint obligatoire `--checkpoint pre-release|post-release`
    - garde local-only obligatoire (`supabase status -o env` + host `localhost/127.0.0.1`)
    - rapport standardise:
      - pass/fail matrix
      - comptage global anomalies
      - comptage par `anomaly_family` / `anomaly_code`
      - details actionnables complets si anomalies > 0
  - politique de decision verrouillee:
    - `strict_blocking`
    - si `anomalies_total > 0` => `BLOCKED` (exit code `2`)
    - erreur technique/prerequis => exit code `1`
  - cadence de controle verrouillee:
    - checkpoint pre-release + post-release sur chaque release
  - scripts npm standardises:
    - `test:f7.3:pre`, `test:f7.3:post`, `test:f7.3`
  - aucun changement schema SQL
  - aucune ecriture distante autorisee

### D-038 - Gouvernance release F7.4: checklist unifiee + `GO/NO_GO` strict securite

- Statut: validee
- Constat:
  - les preuves de validation existaient, mais dispersees entre F7.1/F7.2/F7.3
  - la release Phase 7 necessitait un runbook unique avec regle de decision explicite
  - le besoin produit impose un blocage release en cas de non-conformite securite, meme non critique
- Impact:
  - ajout d'un runbook F7.4 unique:
    - `docs/F7_4_CHECKLIST_LIVRAISON_ROLLBACK.md`
  - ajout d'un script local de collecte F7.4:
    - `scripts/f7_4_validate_local.mjs`
    - sortie standardisee `PASS|FAIL|BLOCKED` par controle + evidence log horodate
    - decision finale `GO|NO_GO`
    - mode enforcement optionnel `--enforce-go`
  - scripts npm:
    - `test:f7.4`
  - politique de decision release verrouillee:
    - `block_always_on_security_non_compliance`
    - `GO` uniquement si controles critiques techniques et securite sont tous `PASS`
    - tout `FAIL`/`BLOCKED` securite implique `NO_GO`
  - protocole rollback local-first formalise:
    - objectif prioritaire: retour service rapide
    - verification immediate post-rollback des controles critiques
  - aucun changement SQL/migration
  - aucune ecriture DB distante

### D-039 - Gouvernance F7.5: gate securite strict `--enforce-go` + blocage sur secrets/env manquants

- Statut: validee
- Constat:
  - F7.4 a formalise le runbook et la matrice `GO/NO_GO`, mais la fermeture securite Phase 7 necessite un gate technique dedie
  - les ecarts restants critiques sont applicatifs (CAPTCHA/CORS/gardes session/rate-limit), pas un durcissement RLS SQL massif
  - les preuves de securite doivent etre reproductibles en local, sans ecriture distante
- Impact:
  - ajout d'un gate local dedie `scripts/f7_5_validate_local.mjs` + script npm `test:f7.5`
  - politique de cloture verrouillee:
    - F7.5 `FAIT` uniquement si `node scripts/f7_5_validate_local.mjs --checkpoint <pre|post>-release --enforce-go` passe
    - tout `FAIL`/`BLOCKED` sur `S1..S10` implique `NO_GO`
  - exigences env/secret explicites dans le gate:
    - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
    - `SUPABASE_AUTH_CAPTCHA_SECRET`
    - `APP_ALLOWED_ORIGINS`
  - couverture securite F7.5 standardisee:
    - rate limits auth + mutations + route API
    - RLS/policies/security_invoker verifies (mode compat conserve)
    - CAPTCHA Turnstile active et branchee auth
    - garde session + validation serveur sur mutations cibles
    - CORS allowlist avec test runtime (origin interdite `403`, sans session `401`)
    - audits dependances (`audit:prod`, `audit:deps`)
  - aucune migration SQL nouvelle imposee par F7.5
  - aucune ecriture DB distante autorisee

### D-040 - Gouvernance F8.1: preparation deploiement production local-first (Vercel) + preuves externes obligatoires

- Statut: validee
- Constat:
  - la Phase 8 necessite un cadre de preparation production explicite avant toute execution F8.2
  - l'application est Next.js App Router et la priorite business retenue est la reduction maximale du risque
  - la validation F8.1 doit conserver les garde-fous F7.4/F7.5 et rester sans ecriture DB distante
- Impact:
  - stack de deploiement retenue pour F8.1:
    - app: `Vercel`
    - backend/auth: `Supabase`
    - CAPTCHA: `Cloudflare Turnstile`
  - runbook F8.1 dedie ajoute:
    - `docs/F8_1_PREPARATION_DEPLOIEMENT_PRODUCTION.md`
  - gate local F8.1 ajoute:
    - `scripts/f8_1_validate_local.mjs`
    - script npm `test:f8.1`
  - regles de decision F8.1 verrouillees:
    - `GO` uniquement si tous les controles critiques sont `PASS`
    - preuves externes obligatoires:
      - E1: widget Turnstile prod valide sur domaine/hostnames de production
      - E2: variables securite prod verifiees dans l'environnement heberge
    - si E1/E2 ne sont pas `PASS`, F8.1 reste `BLOQUE`
  - passage preprod obligatoire avant passage effectif a F8.2
  - aucune migration SQL
  - aucune ecriture DB distante autorisee

## Hypothèses / décisions en attente

### H-002 - Politique d'authentification applicative

- Statut: cloturee (voir `D-034`)
- Observation:
  - le besoin d'acces applicatif authentifie est desormais tranche
- Decision prise:
  - auth utilisateur explicite obligatoire via entree `/login` pour les routes metier cibles

### H-003 - Découpage du module `sales.ts` (actions)

- Statut: ouverte
- Observation:
  - fichier volumineux, responsabilités multiples
- A décider:
  - refactor en modules métier dédiés (sans changer la logique fonctionnelle)

### H-004 - Couverture de tests

- Statut: cloturee (voir `D-036`)
- Observation:
  - la couverture minimale critique est desormais formalisee et executable localement
- Decision prise:
  - strategie locale-first unitaire + integration sur FIFO, confirmation lot, annulation vente et coherence KPI, avec non-regression `test:f2.0` obligatoire

### H-005 - Alignement implémentation avec décisions produit validées

- Statut: ouverte
- Observation:
  - certaines décisions validées ne sont pas encore appliquées partout dans le code
  - exemples observés: filtre par défaut ventes, standard KPI, garde-fou lot vide
- A décider:
  - ordre de priorité d'implémentation des décisions `D-008` et `D-009`
  - niveau de blocage attendu (UI seule vs contrôle serveur obligatoire)

### H-006 - Politique d'affichage par défaut des commandes annulées

- Statut: ouverte
- Observation:
  - la table `/ventes` inclut aujourd'hui `CONFIRMED` + `CANCELLED` par défaut
  - le besoin produit priorise une lecture business non polluée par les annulations
- A décider:
  - défaut strict `CONFIRMED` avec option d'inclure `CANCELLED`
  - ou maintien du défaut multi-statut avec simple badge

### H-007 - Parcours "Nouvelle vente" (modale unique vs page dédiée)

- Statut: ouverte
- Observation:
  - le flux est disponible en modale depuis `/ventes` et aussi via `/ventes/nouvelle`
- A décider:
  - conserver les 2 entrées
  - ou n'en garder qu'une (et laquelle) pour réduire la dette UX

### H-008 - Ajustements manuels de stock dans le périmètre court terme

- Statut: ouverte
- Observation:
  - les vues affichent les mouvements `ADJUSTMENT`
  - aucune UI claire de création d'ajustement n'a été identifiée dans le repo
- A décider:
  - implémenter la création d'ajustement maintenant
  - ou sortir explicitement ce besoin du périmètre immédiat
