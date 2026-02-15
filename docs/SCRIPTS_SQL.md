Liste des script SQL dans SUPABASE dans l’ordre chronologique 

Ce document constitue la trace historique de l’ensemble des scripts SQL exécutés (via copier-coller) dans Supabase, ayant permis la création des tables actuellement en place, et ce jusqu’à la date de reprise du projet.

1 ALTER TABLE sets_catalog ADD COLUMN IF NOT EXISTS theme text;

2 

-- ATTENTION : supprime complètement la table lots (et ses contraintes) si elle existe déjà
drop table if exists public.lots cascade;


-- TABLE lots : en-tête des lots d'approvisionnement
create table public.lots (
 id            bigserial primary key,      -- identifiant technique
 lot_code      text unique,                -- ex : 'LOT_0', 'LOT_1' (optionnel mais pratique pour l'UI)
 label         text,                       -- libellé humain : 'Stock initial', 'Lot brocante 12/2024', etc.
 purchase_date date not null,              -- date d'achat / réception
 supplier      text,                       -- nom du fournisseur (optionnel)
 total_pieces  integer not null check (total_pieces >= 0),
 total_cost    numeric(12,2) not null check (total_cost >= 0),
 status        text not null default 'draft' check (status in ('draft','confirmed')),
 notes         text,
 created_at    timestamptz not null default now()
);


-- Index pour trier / filtrer facilement
create index lots_purchase_date_idx on public.lots (purchase_date desc);
create index lots_status_idx        on public.lots (status);



3 

-- 1) Supprimer l'ancienne colonne lot_id texte (si elle existe encore)
alter table public.inventory
drop column if exists lot_id;


-- 2) Ajouter un vrai lot_id numérique, relié à public.lots(id)
alter table public.inventory
add column lot_id bigint not null references public.lots(id);


-- 3) Index utile pour les futures requêtes FIFO / rapports
create index if not exists inventory_piece_lot_idx
 on public.inventory (piece_ref, lot_id);


create index if not exists inventory_created_at_idx
 on public.inventory (created_at);



4

ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS unit_cost numeric;


-- Recalcule un coût unitaire par lot,
-- puis l'applique à toutes les lignes inventory de ce lot.
UPDATE public.inventory AS i
SET unit_cost = lot_stats.unit_cost
FROM (
 SELECT
   inv.lot_id,
   CASE
     WHEN SUM(inv.quantity) > 0 AND l.total_cost IS NOT NULL
       THEN l.total_cost / SUM(inv.quantity)::numeric
     ELSE NULL
   END AS unit_cost
 FROM public.inventory AS inv
 JOIN public.lots AS l
   ON l.id = inv.lot_id
 GROUP BY inv.lot_id, l.total_cost
) AS lot_stats
WHERE i.lot_id = lot_stats.lot_id;

5

CREATE OR REPLACE VIEW public.stock_per_piece AS
SELECT
 i.piece_ref,
 -- quantité totale en stock (entrées - sorties, plus tard)
 SUM(i.quantity) AS total_quantity,


 -- quantité pour laquelle on connaît un coût
 SUM(
   CASE
     WHEN i.unit_cost IS NOT NULL THEN i.quantity
     ELSE 0
   END
 ) AS quantity_with_cost,


 -- valeur totale connue (uniquement les lignes avec unit_cost non NULL)
 SUM(
   CASE
     WHEN i.unit_cost IS NOT NULL THEN i.quantity * i.unit_cost
     ELSE 0
   END
 ) AS total_value,


 -- PUMP moyen = total_value / quantity_with_cost
 CASE
   WHEN SUM(
     CASE
       WHEN i.unit_cost IS NOT NULL THEN i.quantity
       ELSE 0
     END
   ) > 0
   THEN
     SUM(
       CASE
         WHEN i.unit_cost IS NOT NULL THEN i.quantity * i.unit_cost
         ELSE 0
       END
     )
     /
     SUM(
       CASE
         WHEN i.unit_cost IS NOT NULL THEN i.quantity
         ELSE 0
       END
     )
   ELSE NULL
 END AS avg_unit_cost
FROM public.inventory AS i
GROUP BY i.piece_ref


-- On ne garde que les références dont le stock est strictement positif
HAVING SUM(i.quantity) > 0;

6

CREATE OR REPLACE VIEW public.set_completion AS
SELECT
 b.set_id,
 SUM(b.quantity) AS total_parts_needed,
 SUM(
   LEAST(
     COALESCE(sp.total_quantity, 0),
     b.quantity
   )
 ) AS total_parts_owned,
 CASE
   WHEN SUM(b.quantity) > 0 THEN
     (SUM(
       LEAST(
         COALESCE(sp.total_quantity, 0),
         b.quantity
       )
     )::numeric * 100.0)
     / SUM(b.quantity)::numeric
   ELSE 0
 END AS completion_percent
FROM public.sets_bom AS b
LEFT JOIN public.stock_per_piece AS sp
 ON sp.piece_ref = b.piece_ref
WHERE b.piece_ref IS NOT NULL
GROUP BY b.set_id;

7

SELECT *
FROM public.set_completion
ORDER BY completion_percent DESC
LIMIT 20;

8

DROP VIEW IF EXISTS public.set_with_completion;


CREATE OR REPLACE VIEW public.set_with_completion AS
SELECT
 sc.id,
 sc.display_ref,
 sc.name,
 sc.version,
 sc.year_start,
 sc.year_end,
 sc.theme,
 sc.image_url,
 COALESCE(c.total_parts_needed, 0) AS total_parts_needed,
 COALESCE(c.total_parts_owned, 0) AS total_parts_owned,
 c.completion_percent
FROM public.sets_catalog AS sc
LEFT JOIN public.set_completion AS c
 ON c.set_id = sc.id;

9

SELECT
 id,
 display_ref,
 completion_percent,
 total_parts_needed,
 total_parts_owned
FROM public.set_with_completion
ORDER BY completion_percent DESC NULLS LAST
LIMIT 20;

10

CREATE OR REPLACE VIEW public.set_completion AS
WITH bom_with_stock AS (
 SELECT
   b.set_id,
   b.piece_ref,
   b.quantity AS required_qty,
   COALESCE(s.total_quantity, 0) AS stock_qty
 FROM public.sets_bom AS b
 LEFT JOIN public.stock_per_piece AS s
   ON s.piece_ref = b.piece_ref
),
per_part AS (
 SELECT
   set_id,
   required_qty,
   stock_qty,
   LEAST(stock_qty, required_qty) AS used_for_completion,
   CASE
     WHEN required_qty > 0 THEN FLOOR(stock_qty / required_qty)
     ELSE 0
   END AS max_sets_for_part
 FROM bom_with_stock
)
SELECT
 set_id,
 SUM(required_qty) AS total_parts_needed,
 SUM(used_for_completion) AS total_parts_owned,
 CASE
   WHEN SUM(required_qty) > 0 THEN
     (SUM(used_for_completion)::numeric / SUM(required_qty)::numeric) * 100
   ELSE NULL
 END AS completion_percent,
 MIN(max_sets_for_part) AS max_complete_sets
FROM per_part
GROUP BY set_id;

11

SELECT
 set_id,
 total_parts_needed,
 total_parts_owned,
 completion_percent,
 max_complete_sets
FROM public.set_completion
ORDER BY completion_percent DESC NULLS LAST
LIMIT 20;

12

CREATE OR REPLACE VIEW public.set_with_completion AS
SELECT
 sc.id,
 sc.display_ref,
 sc.name,
 sc.version,
 sc.year_start,
 sc.year_end,
 sc.theme,
 sc.image_url,
 COALESCE(c.total_parts_needed, 0) AS total_parts_needed,
 COALESCE(c.total_parts_owned, 0) AS total_parts_owned,
 c.completion_percent,
 COALESCE(c.max_complete_sets, 0) AS max_complete_sets
FROM public.sets_catalog AS sc
LEFT JOIN public.set_completion AS c
 ON c.set_id = sc.id;

13

SELECT
 id,
 display_ref,
 completion_percent,
 max_complete_sets
FROM public.set_with_completion
ORDER BY completion_percent DESC NULLS LAST
LIMIT 20;

14

-- 2.2.1.1 – Table d’historique des mouvements de stock
CREATE TABLE public.stock_movements (
 id          bigserial PRIMARY KEY,
  -- Référence de pièce
 piece_ref   text NOT NULL,
  -- Optionnel : lien vers un lot d'approvisionnement
 lot_id      bigint NULL,
  -- Sens du mouvement : entrée, sortie, correction
 direction   text NOT NULL CHECK (direction IN ('IN', 'OUT', 'ADJUST')),
  -- Quantité absolue (toujours > 0, le sens est dans "direction")
 quantity    integer NOT NULL CHECK (quantity > 0),
  -- Coût unitaire réel associé à ce mouvement (peut être NULL au début)
 unit_cost   numeric(12,4) NULL,
  -- Métadonnées sur l’origine du mouvement
 source_type text NOT NULL,  -- ex : 'PURCHASE', 'SALE', 'ADJUSTMENT', ...
 source_id   text NULL,      -- ex : id logique du lot, de la vente, etc.
  -- Audit
 created_at  timestamptz NOT NULL DEFAULT now(),
 comment     text NULL
);


-- (Optionnel mais recommandé)
-- Si tu veux lier lot_id à public.lots.id :
-- ALTER TABLE public.stock_movements
--   ADD CONSTRAINT stock_movements_lot_fk
--   FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;

15

-- 2.2.1.2 – Index pour accélérer les requêtes sur stock_movements


-- 1) Requêtes par pièce (historique d’une réf)
CREATE INDEX stock_movements_piece_ref_idx
 ON public.stock_movements (piece_ref);


-- 2) Requêtes par date (journal global, dernières opérations…)
CREATE INDEX stock_movements_created_at_idx
 ON public.stock_movements (created_at DESC);


-- 3) Requêtes par type de source (achats, ventes, ajustements…)
CREATE INDEX stock_movements_source_type_idx
 ON public.stock_movements (source_type);


-- (Optionnel mais très utile plus tard : historique d’une pièce ordonné par date)
-- CREATE INDEX stock_movements_piece_date_idx
--   ON public.stock_movements (piece_ref, created_at DESC);

16

CREATE OR REPLACE VIEW public.stock_per_piece AS
WITH movements_signed AS (
 SELECT
   piece_ref,
   CASE
     WHEN direction = 'IN' THEN quantity
     WHEN direction = 'OUT' THEN -quantity
     WHEN direction = 'ADJUST' THEN quantity
     ELSE 0
   END AS signed_quantity,
   CASE
     WHEN direction = 'IN' THEN quantity * COALESCE(unit_cost, 0)
     WHEN direction = 'OUT' THEN -quantity * COALESCE(unit_cost, 0)
     WHEN direction = 'ADJUST' THEN quantity * COALESCE(unit_cost, 0)
     ELSE 0
   END AS signed_value
 FROM public.stock_movements
)
SELECT
 piece_ref,
 SUM(signed_quantity) AS total_quantity,
 CASE
   WHEN SUM(signed_quantity) > 0
     THEN SUM(signed_value) / SUM(signed_quantity)
   ELSE NULL
 END AS avg_unit_cost,
 SUM(signed_value) AS total_value
FROM movements_signed
GROUP BY piece_ref
HAVING SUM(signed_quantity) > 0;

17

BEGIN;


-- 1) On supprime l'ancienne vue
DROP VIEW IF EXISTS public.stock_per_piece CASCADE;


-- 2) On recrée la vue basée sur stock_movements
CREATE VIEW public.stock_per_piece AS
WITH movements_signed AS (
 SELECT
   piece_ref,
   CASE
     WHEN direction = 'IN' THEN quantity
     WHEN direction = 'OUT' THEN -quantity
     WHEN direction = 'ADJUST' THEN quantity
     ELSE 0
   END AS signed_quantity,
   CASE
     WHEN direction = 'IN' THEN quantity * COALESCE(unit_cost, 0)
     WHEN direction = 'OUT' THEN -quantity * COALESCE(unit_cost, 0)
     WHEN direction = 'ADJUST' THEN quantity * COALESCE(unit_cost, 0)
     ELSE 0
   END AS signed_value
 FROM public.stock_movements
)
SELECT
 piece_ref,
 SUM(signed_quantity) AS total_quantity,
 CASE
   WHEN SUM(signed_quantity) > 0
     THEN SUM(signed_value) / SUM(signed_quantity)
   ELSE NULL
 END AS avg_unit_cost,
 SUM(signed_value) AS total_value
FROM movements_signed
GROUP BY piece_ref
HAVING SUM(signed_quantity) > 0;


COMMIT;

18

-- 2.2.3.2 – Vue piece_movements (historique par pièce)


BEGIN;


DROP VIEW IF EXISTS public.piece_movements;


CREATE VIEW public.piece_movements AS
SELECT
 m.id,
 m.piece_ref,
 m.created_at,
 m.direction,
 m.quantity,                                    -- quantité "brute"
 CASE                                          
   WHEN m.direction = 'IN' THEN m.quantity
   WHEN m.direction = 'OUT' THEN -m.quantity
   WHEN m.direction = 'ADJUST' THEN m.quantity
   ELSE 0
 END AS signed_quantity,                        -- +IN, -OUT, +ADJUST


 m.unit_cost,
 CASE
   WHEN m.unit_cost IS NULL THEN NULL
   ELSE
     CASE
       WHEN m.direction = 'IN' THEN m.quantity * m.unit_cost
       WHEN m.direction = 'OUT' THEN -m.quantity * m.unit_cost
       WHEN m.direction = 'ADJUST' THEN m.quantity * m.unit_cost
       ELSE 0
     END
 END AS signed_value,                           -- valeur du mouvement (signée)


 m.lot_id,
 m.source_type,
 m.source_id,
 m.comment
FROM public.stock_movements AS m;


COMMIT;

19

SELECT *
FROM public.piece_movements
WHERE piece_ref = '30000000'
ORDER BY created_at DESC, id DESC;


SELECT
 piece_ref,
 SUM(signed_quantity) AS current_quantity,
 SUM(signed_value)    AS current_value
FROM public.piece_movements
WHERE piece_ref = '30000000'
GROUP BY piece_ref;

20

-- 2.2.3.3 – Vue stock_journal (journal global des mouvements)


BEGIN;


DROP VIEW IF EXISTS public.stock_journal;


CREATE VIEW public.stock_journal AS
SELECT
 pm.id,
 pm.created_at,
 pm.piece_ref,
 pm.direction,
 pm.quantity,
 pm.signed_quantity,
 pm.unit_cost,
 pm.signed_value,


 pm.lot_id,
 l.lot_code,
 l.label          AS lot_label,
 l.purchase_date  AS lot_purchase_date,
 l.supplier       AS lot_supplier,


 pm.source_type,
 pm.source_id,
 pm.comment
FROM public.piece_movements AS pm
LEFT JOIN public.lots AS l
 ON pm.lot_id = l.id;


COMMIT;

21

create or replace view public.piece_movements as
select
 sm.id as movement_id,                -- ✅ alias ici
 sm.piece_ref,
 sm.created_at,
 sm.direction,
 sm.quantity,
 sm.unit_cost,
 (sm.quantity * coalesce(sm.unit_cost, 0))::numeric(12,4) as total_value,
 sm.source_type,
 sm.source_id,
 sm.lot_id,
 l.lot_code,
 l.purchase_date as lot_purchase_date,
 l.label        as lot_label,
 l.status       as lot_status,
 sm.comment
from public.stock_movements sm
left join public.lots l on l.id = sm.lot_id;

22

ALTER VIEW public.piece_movements
RENAME COLUMN id TO movement_id;

23

-- 1. On supprime d'abord le journal global qui dépend de piece_movements
DROP VIEW IF EXISTS public.stock_journal;


-- 2. Puis on recrée proprement piece_movements
DROP VIEW IF EXISTS public.piece_movements;


CREATE VIEW public.piece_movements AS
SELECT
 sm.id AS id,                        -- ⚠️ important : 'id' (et pas movement_id)
 sm.piece_ref,
 sm.created_at,
 sm.direction,
 sm.quantity,
 sm.unit_cost,
 CASE
   WHEN sm.direction = 'IN'
     THEN sm.quantity * COALESCE(sm.unit_cost, 0)
   WHEN sm.direction = 'OUT'
     THEN - sm.quantity * COALESCE(sm.unit_cost, 0)
   ELSE
     sm.quantity * COALESCE(sm.unit_cost, 0)
 END AS total_value,
 sm.source_type,
 sm.source_id,
 sm.lot_id,
 l.lot_code,
 l.purchase_date AS lot_purchase_date,
 l.label AS lot_label,
 l.status AS lot_status,
 sm.comment
FROM public.stock_movements sm
LEFT JOIN public.lots l ON l.id = sm.lot_id;


-- 3. On recrée le journal global en se basant sur piece_movements
CREATE VIEW public.stock_journal AS
SELECT
 pm.id,
 pm.piece_ref,
 pm.created_at,
 pm.direction,
 pm.quantity,
 pm.unit_cost,
 pm.total_value,
 pm.source_type,
 pm.source_id,
 pm.lot_id,
 pm.lot_code,
 pm.lot_purchase_date,
 pm.lot_label,
 pm.lot_status,
 pm.comment
FROM public.piece_movements pm
ORDER BY pm.created_at DESC;

24

SELECT * FROM public.piece_movements LIMIT 5;

25

-- 3.1.1.2 - Création de la table des ventes : sales


CREATE TABLE public.sales (
 -- Identité
 id                  bigserial PRIMARY KEY,
 sale_number         text UNIQUE,


 -- Typage & canal
 sale_type           text NOT NULL CHECK (sale_type IN ('SET', 'PIECE')),
 sales_channel       text NOT NULL CHECK (sales_channel IN ('VINTED', 'EBAY', 'LEBONCOIN', 'DIRECT', 'OTHER')),
 status              text NOT NULL CHECK (status IN ('CONFIRMED', 'CANCELLED')),


 -- Montants (niveau vente)
 net_seller_amount   numeric(12,2) NOT NULL,  -- montant net que tu reçois
 currency            text NOT NULL DEFAULT 'EUR',


 -- Préparation futur (TVA / site e-commerce)
 buyer_paid_total    numeric(12,2),          -- total payé par l'acheteur (optionnel)
 vat_rate            numeric(4,3),           -- ex: 0.200 pour 20% (optionnel)


 -- Coût & marge historisés au niveau de la vente
 total_cost_amount   numeric(12,4),          -- somme des coûts des lignes (sale_items)
 total_margin_amount numeric(12,4),          -- net_seller_amount - total_cost_amount
 margin_rate         numeric(4,3),           -- total_margin_amount / net_seller_amount


 -- Dates
 paid_at             timestamptz NOT NULL,   -- date de paiement (référence stats)
 created_at          timestamptz NOT NULL DEFAULT now(),


 -- Commentaire libre
 comment             text
);


-- Index utiles pour filtres & stats
CREATE INDEX sales_paid_at_idx
 ON public.sales (paid_at);


CREATE INDEX sales_sale_type_idx
 ON public.sales (sale_type);


CREATE INDEX sales_sales_channel_idx
 ON public.sales (sales_channel);


CREATE INDEX sales_status_idx
 ON public.sales (status);

26

-- 3.1.1.3 - Index & perfs additionnels sur la table sales


-- Index composite conseillé pour les listes de ventes par période + statut
CREATE INDEX IF NOT EXISTS sales_paid_at_status_idx
 ON public.sales (paid_at, status);

27

-- 1. Vente SET Vinted, confirmée
INSERT INTO public.sales (
 sale_number,
 sale_type,
 sales_channel,
 status,
 net_seller_amount,
 currency,
 buyer_paid_total,
 vat_rate,
 total_cost_amount,
 total_margin_amount,
 margin_rate,
 paid_at,
 comment
) VALUES (
 'S-TEST-0001',      -- sale_number
 'SET',              -- sale_type
 'VINTED',           -- sales_channel
 'CONFIRMED',        -- status
 32.50,              -- net_seller_amount (ce que tu reçois)
 'EUR',              -- currency
 NULL,               -- buyer_paid_total (inconnu sur Vinted pour le moment)
 NULL,               -- vat_rate (0 ou NULL tant qu'on ne gère pas la TVA)
 NULL,               -- total_cost_amount (on remplira plus tard via FIFO)
 NULL,               -- total_margin_amount
 NULL,               -- margin_rate
 now() - interval '2 days',  -- paid_at
 'Vente test set complet Vinted'
);


-- 2. Vente PIECE Leboncoin, confirmée
INSERT INTO public.sales (
 sale_number,
 sale_type,
 sales_channel,
 status,
 net_seller_amount,
 currency,
 buyer_paid_total,
 vat_rate,
 total_cost_amount,
 total_margin_amount,
 margin_rate,
 paid_at,
 comment
) VALUES (
 'S-TEST-0002',
 'PIECE',
 'LEBONCOIN',
 'CONFIRMED',
 12.00,
 'EUR',
 NULL,
 NULL,
 NULL,
 NULL,
 NULL,
 now() - interval '1 days',
 'Vente test pièces au détail Leboncoin'
);


-- 3. Vente SET Vinted, annulée
INSERT INTO public.sales (
 sale_number,
 sale_type,
 sales_channel,
 status,
 net_seller_amount,
 currency,
 buyer_paid_total,
 vat_rate,
 total_cost_amount,
 total_margin_amount,
 margin_rate,
 paid_at,
 comment
) VALUES (
 'S-TEST-0003',
 'SET',
 'VINTED',
 'CANCELLED',
 25.00,
 'EUR',
 NULL,
 NULL,
 NULL,
 NULL,
 NULL,
 now() - interval '5 days',
 'Vente test annulée (pour futurs tests de retour stock)'
);

28

SELECT
 id,
 sale_number,
 sale_type,
 sales_channel,
 status,
 net_seller_amount,
 paid_at,
 total_cost_amount,
 total_margin_amount,
 margin_rate
FROM public.sales
ORDER BY paid_at DESC;

29

-- 3.1.2.2 - Création de la table des lignes de vente : sale_items


CREATE TABLE public.sale_items (
 -- Identité
 id            bigserial PRIMARY KEY,


 -- Lien vers la vente
 sale_id       bigint NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,


 -- Ordre d'affichage des lignes dans la vente
 line_index    integer NOT NULL,


 -- Nature de la ligne : set ou pièce au détail
 item_kind     text NOT NULL CHECK (item_kind IN ('SET', 'PIECE')),


 -- Référence du set (si item_kind = 'SET')
 set_id        bigint REFERENCES public.sets_catalog(id),


 -- Référence de la pièce (si item_kind = 'PIECE')
 piece_ref     text,


 -- Quantité : nb de sets ou nb de pièces
 quantity      integer NOT NULL CHECK (quantity > 0),


 -- Indique si le set est vendu incomplet / presque complet
 is_partial_set boolean NOT NULL DEFAULT false,


 -- Montant net attribué à cette ligne (optionnel)
 net_amount    numeric(12,2),


 -- Coût total des pièces consommées pour cette ligne (FIFO)
 cost_amount   numeric(12,4),


 -- Marge absolue pour cette ligne : net_amount - cost_amount
 margin_amount numeric(12,4),


 -- Commentaire spécifique à la ligne
 comment       text
);


-- Index pour les requêtes fréquentes
CREATE INDEX sale_items_sale_id_idx
 ON public.sale_items (sale_id);


CREATE INDEX sale_items_set_id_idx
 ON public.sale_items (set_id);


CREATE INDEX sale_items_piece_ref_idx
 ON public.sale_items (piece_ref);

30

DROP TABLE IF EXISTS public.sale_items CASCADE;

31

-- 3.1.2.2 - Création de la table des lignes de vente : sale_items (version corrigée)


CREATE TABLE public.sale_items (
 -- Identité
 id             bigserial PRIMARY KEY,


 -- Lien vers la vente
 sale_id        bigint NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,


 -- Ordre d'affichage des lignes dans la vente
 line_index     integer NOT NULL,


 -- Nature de la ligne : set ou pièce au détail
 item_kind      text NOT NULL CHECK (item_kind IN ('SET', 'PIECE')),


 -- Référence du set (si item_kind = 'SET')
 -- ⚠️ id de sets_catalog est de type text, donc on aligne set_id sur text
 set_id         text REFERENCES public.sets_catalog(id),


 -- Référence de la pièce (si item_kind = 'PIECE')
 piece_ref      text,


 -- Quantité : nb de sets ou nb de pièces
 quantity       integer NOT NULL CHECK (quantity > 0),


 -- Indique si le set est vendu incomplet / presque complet
 is_partial_set boolean NOT NULL DEFAULT false,


 -- Montant net attribué à cette ligne (optionnel)
 net_amount     numeric(12,2),


 -- Coût total des pièces consommées pour cette ligne (FIFO)
 cost_amount    numeric(12,4),


 -- Marge absolue pour cette ligne : net_amount - cost_amount
 margin_amount  numeric(12,4),


 -- Commentaire spécifique à la ligne
 comment        text
);


-- Index pour les requêtes fréquentes
CREATE INDEX sale_items_sale_id_idx
 ON public.sale_items (sale_id);


CREATE INDEX sale_items_set_id_idx
 ON public.sale_items (set_id);


CREATE INDEX sale_items_piece_ref_idx
 ON public.sale_items (piece_ref);

32

SELECT
 column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sale_items'
ORDER BY ordinal_position;

33

-- 3.1.2.3 - Index & perfs supplémentaires sur sale_items


-- Au cas où ils n'existent pas encore (idempotent)
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx
 ON public.sale_items (sale_id);


CREATE INDEX IF NOT EXISTS sale_items_set_id_idx
 ON public.sale_items (set_id);


CREATE INDEX IF NOT EXISTS sale_items_piece_ref_idx
 ON public.sale_items (piece_ref);


-- Index composite : pratique pour récupérer les lignes d'une vente triées
CREATE INDEX IF NOT EXISTS sale_items_sale_id_line_index_idx
 ON public.sale_items (sale_id, line_index);

34

-- 3.1.2.4 - Contrainte de cohérence interne sur sale_items


ALTER TABLE public.sale_items
ADD CONSTRAINT sale_items_set_or_piece_consistency CHECK (
 (
   item_kind = 'SET'
   AND set_id IS NOT NULL
   AND piece_ref IS NULL
 )
 OR
 (
   item_kind = 'PIECE'
   AND piece_ref IS NOT NULL
   AND set_id IS NULL
 )
);

35

-- Liste des colonnes de stock_movements
SELECT
 column_name,
 data_type,
 is_nullable,
 column_default
FROM information_schema.columns
WHERE table_schema = 'public'
 AND table_name = 'stock_movements'
ORDER BY ordinal_position;

36

-- Check constraints sur stock_movements
SELECT
 tc.constraint_name,
 cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
 ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
 AND tc.table_name = 'stock_movements'
 AND tc.constraint_type = 'CHECK';

37

-- Index existants sur stock_movements
SELECT
 indexname,
 indexdef
FROM pg_indexes
WHERE schemaname = 'public'
 AND tablename = 'stock_movements';

38

SELECT DISTINCT source_type
FROM public.stock_movements
ORDER BY source_type;

39

-- 3.1.3.2 - Contrainte CHECK sur source_type pour inclure les ventes


ALTER TABLE public.stock_movements
ADD CONSTRAINT stock_movements_source_type_check
CHECK (
 source_type IN (
   'PURCHASE',      -- approvisionnements / lots
   'ADJUSTMENT',    -- ajustements manuels (présent ou futur)
   'SALE',          -- sorties de stock lors d'une vente
   'SALE_CANCEL'    -- retours en stock lors de l'annulation d'une vente
 )
);

40

-- 3.1.3.3 - Index pour retrouver rapidement les mouvements par source


CREATE INDEX IF NOT EXISTS stock_movements_source_type_id_idx
 ON public.stock_movements (source_type, source_id);

41

-- 3.1.3.4 - Vue de contrôle des mouvements par ligne de vente


-- On la recrée proprement si elle existe déjà
DROP VIEW IF EXISTS public.sale_item_movements;


CREATE VIEW public.sale_item_movements AS
SELECT
 si.id        AS sale_item_id,
 si.sale_id,
 sm.id        AS movement_id,
 sm.piece_ref,
 sm.direction,
 sm.quantity,
 sm.unit_cost,
 sm.created_at
FROM public.sale_items      AS si
JOIN public.stock_movements AS sm
 ON sm.source_type IN ('SALE', 'SALE_CANCEL')
AND sm.source_id = si.id::text;

42

SELECT *
FROM public.sale_item_movements
WHERE sale_id = 42
ORDER BY movement_id;

43

CREATE OR REPLACE VIEW public.set_completion AS
WITH piece_stats AS (
 SELECT
   b.set_id,
   b.piece_ref,
   b.quantity AS bom_quantity,
   COALESCE(sp.total_quantity, 0) AS stock_quantity,
   LEAST(COALESCE(sp.total_quantity, 0), b.quantity) AS owned_for_one_copy,
   CASE
     WHEN b.quantity > 0 THEN
       FLOOR(COALESCE(sp.total_quantity, 0)::numeric / b.quantity::numeric)
     ELSE NULL
   END AS max_sets_for_piece
 FROM public.sets_bom AS b
 LEFT JOIN public.stock_per_piece AS sp
   ON sp.piece_ref = b.piece_ref
 WHERE b.piece_ref IS NOT NULL
),
agg AS (
 SELECT
   set_id,
   SUM(bom_quantity) AS total_parts_needed,
   SUM(owned_for_one_copy) AS total_parts_owned,
   MIN(max_sets_for_piece) AS max_complete_sets
 FROM piece_stats
 GROUP BY set_id
)
SELECT
 set_id,
 total_parts_needed,
 total_parts_owned,
 CASE
   WHEN total_parts_needed > 0 THEN
     (total_parts_owned::numeric * 100.0) / total_parts_needed::numeric
   ELSE NULL
 END AS completion_percent,
 max_complete_sets
FROM agg;

44

SELECT *
FROM public.set_completion
ORDER BY completion_percent DESC NULLS LAST
LIMIT 10;

45

CREATE OR REPLACE VIEW public.set_with_completion AS
SELECT
 sc.id,
 sc.display_ref,
 sc.name,
 sc.version,
 sc.year_start,
 sc.year_end,
 sc.theme,
 sc.image_url,
 COALESCE(c.total_parts_needed, 0) AS total_parts_needed,
 COALESCE(c.total_parts_owned, 0) AS total_parts_owned,
 c.completion_percent,
 c.max_complete_sets
FROM public.sets_catalog AS sc
LEFT JOIN public.set_completion AS c
 ON c.set_id = sc.id;

46

SELECT
 id,
 display_ref,
 completion_percent,
 total_parts_needed,
 total_parts_owned,
 max_complete_sets
FROM public.set_with_completion
ORDER BY completion_percent DESC NULLS LAST
LIMIT 10;

47

create table if not exists public.sale_item_pieces (
 id bigserial primary key,
 sale_id bigint not null references public.sales(id) on delete cascade,
 sale_item_id bigint not null references public.sale_items(id) on delete cascade,
 piece_ref text not null,
 quantity integer not null check (quantity >= 0),


 -- optionnels (pour plus tard, quand FIFO sera branché)
 unit_cost numeric null,
 lot_id bigint null,


 created_at timestamptz not null default now()
);


create index if not exists sale_item_pieces_sale_id_idx
 on public.sale_item_pieces(sale_id);


create index if not exists sale_item_pieces_sale_item_id_idx
 on public.sale_item_pieces(sale_item_id);


create index if not exists sale_item_pieces_piece_ref_idx
 on public.sale_item_pieces(piece_ref);

48

--3.6.0 - create view sold_pieces_journal
begin;


create or replace view public.sold_pieces_journal as
select
 sip.piece_ref,
 si.item_kind as source,
 sip.sale_id,
 sip.sale_item_id,
 s.paid_at,
 s.sales_channel,
 s.sale_type,
 s.status,
 sip.quantity,
 sip.unit_cost,
 (sip.quantity * sip.unit_cost) as total_cost,
 sip.lot_id::text as lot_id
from public.sale_item_pieces sip
join public.sales s on s.id = sip.sale_id
join public.sale_items si on si.id = sip.sale_item_id
where s.status = 'CONFIRMED';


commit;

49



 begin;


-- 1) Supprime le snapshot des pièces consommées (lié aux ventes)
delete from public.sale_item_pieces
where sale_id in (select id from public.sales);


-- 2) Supprime les mouvements de stock créés par les ventes (OUT) et annulations (IN miroir)
with sale_item_ids as (
 select id::text as id_txt
 from public.sale_items
 where sale_id in (select id from public.sales)
)
delete from public.stock_movements sm
where sm.source_type in ('SALE','SALE_CANCEL')
 and sm.source_id in (select id_txt from sale_item_ids);


-- 3) Supprime les lignes de vente
delete from public.sale_items
where sale_id in (select id from public.sales);


-- 4) Supprime les ventes
delete from public.sales;


commit;

50

create or replace function public.reset_sales_id_sequence()
returns void
language plpgsql
security definer
as $$
declare
 max_id bigint;
begin
 select coalesce(max(id), 0) into max_id from public.sales;


 perform setval(
   pg_get_serial_sequence('public.sales', 'id'),
   max_id,
   true
 );
end;
$$;


grant execute on function public.reset_sales_id_sequence() to anon, authenticated, service_role;

51

select
 conname,
 pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class t on t.oid = c.conrelid
where t.relname = 'stock_movements'
 and conname = 'stock_movements_source_type_check';

52

alter table public.stock_movements
drop constraint if exists stock_movements_source_type_check;


alter table public.stock_movements
add constraint stock_movements_source_type_check
check (
 source_type in ('PURCHASE', 'SALE', 'SALE_CANCEL', 'SALE_EDIT')
);

53

-- =========================
-- STEP 1 - STOCK_MOVEMENTS SAFETY
-- =========================


-- 1) Index utiles (FIFO + annulation + recherches)
create index if not exists idx_stock_movements_piece_created_id
 on public.stock_movements (piece_ref, created_at, id);


create index if not exists idx_stock_movements_source
 on public.stock_movements (source_type, source_id);


create index if not exists idx_stock_movements_piece_lot
 on public.stock_movements (piece_ref, lot_id);


-- 2) Contraintes de base (format/valeurs)
do $$
begin
 -- direction valide
 if not exists (
   select 1 from pg_constraint where conname = 'ck_stock_movements_direction'
 ) then
   alter table public.stock_movements
     add constraint ck_stock_movements_direction
     check (direction in ('IN','OUT','ADJUST')) not valid;
 end if;


 -- quantité positive
 if not exists (
   select 1 from pg_constraint where conname = 'ck_stock_movements_quantity_pos'
 ) then
   alter table public.stock_movements
     add constraint ck_stock_movements_quantity_pos
     check (quantity > 0) not valid;
 end if;


 -- unit_cost >= 0 si renseigné
 if not exists (
   select 1 from pg_constraint where conname = 'ck_stock_movements_unit_cost_nonneg'
 ) then
   alter table public.stock_movements
     add constraint ck_stock_movements_unit_cost_nonneg
     check (unit_cost is null or unit_cost >= 0) not valid;
 end if;


 -- piece_ref non vide
 if not exists (
   select 1 from pg_constraint where conname = 'ck_stock_movements_piece_ref_nonempty'
 ) then
   alter table public.stock_movements
     add constraint ck_stock_movements_piece_ref_nonempty
     check (length(trim(piece_ref)) > 0) not valid;
 end if;


 -- source_type non vide
 if not exists (
   select 1 from pg_constraint where conname = 'ck_stock_movements_source_type_nonempty'
 ) then
   alter table public.stock_movements
     add constraint ck_stock_movements_source_type_nonempty
     check (length(trim(source_type)) > 0) not valid;
 end if;


 -- 3) Cohérence source_type <-> direction
 -- PURCHASE => IN
 -- SALE => OUT
 -- SALE_CANCEL => IN
 -- SALE_EDIT => IN (rollback/édition)
 if not exists (
   select 1 from pg_constraint where conname = 'ck_stock_movements_source_direction'
 ) then
   alter table public.stock_movements
     add constraint ck_stock_movements_source_direction
     check (
       (source_type = 'PURCHASE' and direction = 'IN')
       or (source_type = 'SALE' and direction = 'OUT')
       or (source_type = 'SALE_CANCEL' and direction = 'IN')
       or (source_type = 'SALE_EDIT' and direction = 'IN')
       or (source_type not in ('PURCHASE','SALE','SALE_CANCEL','SALE_EDIT'))
     ) not valid;
 end if;
end $$;


-- 4) Validation des contraintes (si ça échoue, on te dira quoi corriger)
alter table public.stock_movements validate constraint ck_stock_movements_direction;
alter table public.stock_movements validate constraint ck_stock_movements_quantity_pos;
alter table public.stock_movements validate constraint ck_stock_movements_unit_cost_nonneg;
alter table public.stock_movements validate constraint ck_stock_movements_piece_ref_nonempty;
alter table public.stock_movements validate constraint ck_stock_movements_source_type_nonempty;
alter table public.stock_movements validate constraint ck_stock_movements_source_direction;

54

-- ==========================================
-- STEP 2 - OPTION B : STOCK BALANCE + TRIGGER
-- ==========================================


-- 0) (Optionnel mais recommandé) lot_id obligatoire pour IN/OUT
do $$
begin
 if not exists (
   select 1 from pg_constraint where conname = 'ck_stock_movements_lot_required_inout'
 ) then
   alter table public.stock_movements
     add constraint ck_stock_movements_lot_required_inout
     check (
       direction not in ('IN','OUT')
       or lot_id is not null
     ) not valid;
 end if;
end $$;


alter table public.stock_movements
 validate constraint ck_stock_movements_lot_required_inout;




-- 1) Table de stock "réel" (par pièce + lot)
create table if not exists public.stock_balance (
 piece_ref text not null,
 lot_id bigint not null,
 quantity integer not null,
 updated_at timestamptz not null default now(),
 constraint pk_stock_balance primary key (piece_ref, lot_id),
 constraint ck_stock_balance_qty_nonneg check (quantity >= 0)
);


create index if not exists idx_stock_balance_piece on public.stock_balance(piece_ref);
create index if not exists idx_stock_balance_lot on public.stock_balance(lot_id);




-- 2) Backfill initial depuis l'historique stock_movements
-- (ne recrée rien si déjà rempli)
insert into public.stock_balance (piece_ref, lot_id, quantity)
select
 piece_ref,
 lot_id,
 sum(
   case direction
     when 'IN'  then quantity
     when 'OUT' then -quantity
     else 0
   end
 ) as qty
from public.stock_movements
where lot_id is not null
group by piece_ref, lot_id
having sum(
 case direction
   when 'IN'  then quantity
   when 'OUT' then -quantity
   else 0
 end
) <> 0
on conflict (piece_ref, lot_id) do nothing;




-- 3) Fonction helper : applique un delta sur stock_balance en empêchant le négatif
create or replace function public.apply_stock_balance_delta(
 p_piece_ref text,
 p_lot_id bigint,
 p_delta integer
) returns void
language plpgsql
as $$
declare
 new_qty integer;
begin
 if p_delta = 0 then
   return;
 end if;


 -- UPSERT atomique + garde-fou anti négatif
 insert into public.stock_balance(piece_ref, lot_id, quantity)
 values (p_piece_ref, p_lot_id, p_delta)
 on conflict (piece_ref, lot_id) do update
   set quantity = public.stock_balance.quantity + excluded.quantity,
       updated_at = now()
   where public.stock_balance.quantity + excluded.quantity >= 0
 returning quantity into new_qty;


 if new_qty is null then
   raise exception 'Stock insuffisant (piece_ref=% , lot_id=% , delta=%). Mouvement refusé.',
     p_piece_ref, p_lot_id, p_delta
     using errcode = '23514';
 end if;
end $$;




-- 4) Trigger statement-level (INSERT/UPDATE/DELETE) pour gérer les opérations en lot
create or replace function public.tg_stock_movements_balance_stmt()
returns trigger
language plpgsql
as $$
declare
 r record;
begin
 -- INSERT : appliquer effet(new_rows)
 if (tg_op = 'INSERT') then
   for r in
     select
       piece_ref,
       lot_id,
       sum(case direction when 'IN' then quantity when 'OUT' then -quantity else 0 end)::int as delta
     from new_rows
     where lot_id is not null
     group by piece_ref, lot_id
   loop
     perform public.apply_stock_balance_delta(r.piece_ref, r.lot_id, r.delta);
   end loop;


   return null;
 end if;


 -- DELETE : appliquer -effet(old_rows)
 if (tg_op = 'DELETE') then
   for r in
     select
       piece_ref,
       lot_id,
       (-sum(case direction when 'IN' then quantity when 'OUT' then -quantity else 0 end))::int as delta
     from old_rows
     where lot_id is not null
     group by piece_ref, lot_id
   loop
     perform public.apply_stock_balance_delta(r.piece_ref, r.lot_id, r.delta);
   end loop;


   return null;
 end if;


 -- UPDATE : appliquer -effet(old) + effet(new)
 if (tg_op = 'UPDATE') then
   for r in
     with deltas as (
       select
         piece_ref,
         lot_id,
         sum(case direction when 'IN' then quantity when 'OUT' then -quantity else 0 end)::int as delta
       from new_rows
       where lot_id is not null
       group by piece_ref, lot_id


       union all


       select
         piece_ref,
         lot_id,
         (-sum(case direction when 'IN' then quantity when 'OUT' then -quantity else 0 end))::int as delta
       from old_rows
       where lot_id is not null
       group by piece_ref, lot_id
     )
     select piece_ref, lot_id, sum(delta)::int as delta
     from deltas
     group by piece_ref, lot_id
   loop
     perform public.apply_stock_balance_delta(r.piece_ref, r.lot_id, r.delta);
   end loop;


   return null;
 end if;


 return null;
end $$;




-- 5) Attacher le trigger (statement-level + transition tables)
drop trigger if exists trg_stock_movements_balance_stmt on public.stock_movements;


create trigger trg_stock_movements_balance_stmt
after insert or update or delete on public.stock_movements
referencing new table as new_rows old table as old_rows
for each statement
execute function public.tg_stock_movements_balance_stmt();




-- 6) Vue simple pour vérifier le stock total par pièce depuis stock_balance
create or replace view public.stock_per_piece_balance as
select
 piece_ref,
 sum(quantity)::bigint as total_quantity
from public.stock_balance
group by piece_ref;

55

select count(*) as nb_bad_rows
from public.stock_movements
where direction in ('IN','OUT')
 and lot_id is null;

56

select t.tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
 and c.relname='stock_movements'
 and not t.tgisinternal;

57

-- 0) Nettoyage (safe)
drop trigger if exists trg_stock_balance_ins on public.stock_movements;
drop trigger if exists trg_stock_balance_upd on public.stock_movements;
drop trigger if exists trg_stock_balance_del on public.stock_movements;


drop function if exists public.apply_stock_balance_from_movements();


-- 1) Fonction trigger (met à jour stock_balance par delta)
create or replace function public.apply_stock_balance_from_movements()
returns trigger
language plpgsql
as $$
begin
 if tg_op = 'INSERT' then
   insert into public.stock_balance (piece_ref, lot_id, quantity)
   select
     piece_ref,
     lot_id,
     sum(case when direction = 'IN' then quantity else -quantity end) as delta
   from new_table
   where piece_ref is not null
     and lot_id is not null
     and direction in ('IN','OUT')
   group by piece_ref, lot_id
   on conflict (piece_ref, lot_id)
   do update set quantity = public.stock_balance.quantity + excluded.quantity;


   delete from public.stock_balance where quantity = 0;
   return null;


 elsif tg_op = 'DELETE' then
   insert into public.stock_balance (piece_ref, lot_id, quantity)
   select
     piece_ref,
     lot_id,
     -sum(case when direction = 'IN' then quantity else -quantity end) as delta
   from old_table
   where piece_ref is not null
     and lot_id is not null
     and direction in ('IN','OUT')
   group by piece_ref, lot_id
   on conflict (piece_ref, lot_id)
   do update set quantity = public.stock_balance.quantity + excluded.quantity;


   delete from public.stock_balance where quantity = 0;
   return null;


 elsif tg_op = 'UPDATE' then
   with old_agg as (
     select piece_ref, lot_id,
            sum(case when direction = 'IN' then quantity else -quantity end) as delta
     from old_table
     where piece_ref is not null
       and lot_id is not null
       and direction in ('IN','OUT')
     group by piece_ref, lot_id
   ),
   new_agg as (
     select piece_ref, lot_id,
            sum(case when direction = 'IN' then quantity else -quantity end) as delta
     from new_table
     where piece_ref is not null
       and lot_id is not null
       and direction in ('IN','OUT')
     group by piece_ref, lot_id
   ),
   diff as (
     select
       coalesce(n.piece_ref, o.piece_ref) as piece_ref,
       coalesce(n.lot_id, o.lot_id) as lot_id,
       coalesce(n.delta, 0) - coalesce(o.delta, 0) as delta
     from new_agg n
     full join old_agg o using (piece_ref, lot_id)
     where (coalesce(n.delta, 0) - coalesce(o.delta, 0)) <> 0
   )
   insert into public.stock_balance (piece_ref, lot_id, quantity)
   select piece_ref, lot_id, delta
   from diff
   on conflict (piece_ref, lot_id)
   do update set quantity = public.stock_balance.quantity + excluded.quantity;


   delete from public.stock_balance where quantity = 0;
   return null;
 end if;


 return null;
end;
$$;


-- 2) Triggers séparés (1 event chacun) => compatible transition tables
create trigger trg_stock_balance_ins
after insert on public.stock_movements
referencing new table as new_table
for each statement
execute function public.apply_stock_balance_from_movements();


create trigger trg_stock_balance_del
after delete on public.stock_movements
referencing old table as old_table
for each statement
execute function public.apply_stock_balance_from_movements();


create trigger trg_stock_balance_upd
after update on public.stock_movements
referencing old table as old_table new table as new_table
for each statement
execute function public.apply_stock_balance_from_movements();

58

select *
from public.stock_balance
order by piece_ref, lot_id
limit 50;

59

select
 sm.piece_ref,
 sm.lot_id,
 sum(case when sm.direction='IN' then sm.quantity else 0 end)
 - sum(case when sm.direction='OUT' then sm.quantity else 0 end) as qty_calculee
from public.stock_movements sm
where sm.lot_id is not null
 and sm.direction in ('IN','OUT')
group by sm.piece_ref, sm.lot_id
order by sm.piece_ref, sm.lot_id
limit 50;

60

-- 0) Nettoyage (safe)
drop trigger if exists trg_stock_balance_ins on public.stock_movements;
drop trigger if exists trg_stock_balance_upd on public.stock_movements;
drop trigger if exists trg_stock_balance_del on public.stock_movements;


drop function if exists public.apply_stock_balance_from_movements();


-- 1) Table de synthèse stock par (piece_ref, lot_id)
create table if not exists public.stock_balance (
 piece_ref text not null,
 lot_id bigint not null,
 quantity bigint not null default 0,
 primary key (piece_ref, lot_id)
);


-- 2) Remplissage initial à partir de stock_movements (source de vérité)
-- (on remplace la valeur si déjà présente)
insert into public.stock_balance (piece_ref, lot_id, quantity)
select
 piece_ref,
 lot_id,
 sum(case when direction = 'IN' then quantity else -quantity end)::bigint as quantity
from public.stock_movements
where piece_ref is not null
 and lot_id is not null
 and direction in ('IN','OUT')
group by piece_ref, lot_id
on conflict (piece_ref, lot_id)
do update set quantity = excluded.quantity;


delete from public.stock_balance where quantity = 0;


-- 3) Fonction trigger (mise à jour par delta)
create or replace function public.apply_stock_balance_from_movements()
returns trigger
language plpgsql
as $$
begin
 if tg_op = 'INSERT' then
   insert into public.stock_balance (piece_ref, lot_id, quantity)
   select
     piece_ref,
     lot_id,
     sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
   from new_table
   where piece_ref is not null
     and lot_id is not null
     and direction in ('IN','OUT')
   group by piece_ref, lot_id
   on conflict (piece_ref, lot_id)
   do update set quantity = public.stock_balance.quantity + excluded.quantity;


   delete from public.stock_balance where quantity = 0;
   return null;


 elsif tg_op = 'DELETE' then
   insert into public.stock_balance (piece_ref, lot_id, quantity)
   select
     piece_ref,
     lot_id,
     -sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
   from old_table
   where piece_ref is not null
     and lot_id is not null
     and direction in ('IN','OUT')
   group by piece_ref, lot_id
   on conflict (piece_ref, lot_id)
   do update set quantity = public.stock_balance.quantity + excluded.quantity;


   delete from public.stock_balance where quantity = 0;
   return null;


 elsif tg_op = 'UPDATE' then
   with old_agg as (
     select piece_ref, lot_id,
            sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
     from old_table
     where piece_ref is not null
       and lot_id is not null
       and direction in ('IN','OUT')
     group by piece_ref, lot_id
   ),
   new_agg as (
     select piece_ref, lot_id,
            sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
     from new_table
     where piece_ref is not null
       and lot_id is not null
       and direction in ('IN','OUT')
     group by piece_ref, lot_id
   ),
   diff as (
     select
       coalesce(n.piece_ref, o.piece_ref) as piece_ref,
       coalesce(n.lot_id, o.lot_id) as lot_id,
       coalesce(n.delta, 0) - coalesce(o.delta, 0) as delta
     from new_agg n
     full join old_agg o using (piece_ref, lot_id)
     where (coalesce(n.delta, 0) - coalesce(o.delta, 0)) <> 0
   )
   insert into public.stock_balance (piece_ref, lot_id, quantity)
   select piece_ref, lot_id, delta
   from diff
   on conflict (piece_ref, lot_id)
   do update set quantity = public.stock_balance.quantity + excluded.quantity;


   delete from public.stock_balance where quantity = 0;
   return null;
 end if;


 return null;
end;
$$;


-- 4) Triggers séparés (obligatoire pour utiliser new_table/old_table)
create trigger trg_stock_balance_ins
after insert on public.stock_movements
referencing new table as new_table
for each statement
execute function public.apply_stock_balance_from_movements();


create trigger trg_stock_balance_del
after delete on public.stock_movements
referencing old table as old_table
for each statement
execute function public.apply_stock_balance_from_movements();


create trigger trg_stock_balance_upd
after update on public.stock_movements
referencing old table as old_table new table as new_table
for each statement
execute function public.apply_stock_balance_from_movements();

61

select *
from public.stock_balance
order by piece_ref, lot_id
limit 50;

62

select
 sm.piece_ref,
 sm.lot_id,
 sum(case when sm.direction='IN' then sm.quantity else 0 end)
 - sum(case when sm.direction='OUT' then sm.quantity else 0 end) as qty_calculee
from public.stock_movements sm
where sm.lot_id is not null
 and sm.direction in ('IN','OUT')
group by sm.piece_ref, sm.lot_id
order by sm.piece_ref, sm.lot_id
limit 50;
