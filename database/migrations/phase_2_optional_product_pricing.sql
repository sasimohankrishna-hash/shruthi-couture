-- Data-preserving product pricing and variant-optional order support.
-- Apply this migration to the connected Supabase project after reviewing it.
-- Existing rows, RLS policies, function owners, and function grants are retained.

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS stock integer;

ALTER TABLE public.product_variants
  ALTER COLUMN sku DROP NOT NULL,
  ALTER COLUMN price DROP NOT NULL,
  ALTER COLUMN stock DROP NOT NULL;

-- Keep old nullable-variant order lines on their original confirmation path.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_stock_tracked boolean NOT NULL DEFAULT false;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_price_positive_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_positive_check
      CHECK (price IS NULL OR price > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_stock_nonnegative_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_nonnegative_check
      CHECK (stock IS NULL OR stock >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.product_variants'::regclass
      AND conname = 'product_variants_price_positive_check'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_price_positive_check
      CHECK (price IS NULL OR price > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.product_variants'::regclass
      AND conname = 'product_variants_stock_nonnegative_check'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_stock_nonnegative_check
      CHECK (stock IS NULL OR stock >= 0) NOT VALID;
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.create_order(
    p_customer_name text,
    p_customer_phone text,
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_item JSONB;
    v_variant_id UUID;
    v_product_id UUID;
    v_quantity INTEGER;
    v_quantity_text TEXT;
    v_price NUMERIC(12,2);
    v_stock INTEGER;
    v_size TEXT;
    v_color TEXT;
    v_product_name TEXT;
    v_total NUMERIC(12,2) := 0;
    v_order_id UUID;
BEGIN
    IF p_customer_name IS NULL
       OR LENGTH(TRIM(p_customer_name)) = 0 THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;

    IF p_customer_phone IS NULL
       OR LENGTH(TRIM(p_customer_phone)) = 0 THEN
        RAISE EXCEPTION 'Customer phone is required';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid order items';
    END IF;

    IF jsonb_array_length(p_items) = 0
       OR jsonb_array_length(p_items) > 50 THEN
        RAISE EXCEPTION 'Invalid order items';
    END IF;

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items) AS x(value)
    LOOP
        IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION
                'Each item must contain exactly one product or variant ID and a quantity';
        END IF;

        IF jsonb_object_length(v_item) <> 2
           OR (v_item ? 'variant_id') = (v_item ? 'product_id')
           OR NOT (v_item ? 'quantity') THEN
            RAISE EXCEPTION
                'Each item must contain exactly one product or variant ID and a quantity';
        END IF;

        v_quantity_text := v_item->>'quantity';
        IF v_quantity_text IS NULL
           OR v_quantity_text !~ '^[0-9]{1,4}$' THEN
            RAISE EXCEPTION 'Invalid product quantity';
        END IF;

        v_quantity := v_quantity_text::INTEGER;
        IF v_quantity <= 0 OR v_quantity > 1000 THEN
            RAISE EXCEPTION 'Invalid product quantity';
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) AS x(value)
        GROUP BY CASE
            WHEN x.value ? 'variant_id'
                THEN 'variant:' || (x.value->>'variant_id')
            ELSE 'product:' || (x.value->>'product_id')
        END
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate product or variant in order';
    END IF;

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items) AS x(value)
    LOOP
        v_quantity := (v_item->>'quantity')::INTEGER;

        IF v_item ? 'variant_id' THEN
            v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
            IF v_variant_id IS NULL THEN
                RAISE EXCEPTION 'Invalid variant ID or quantity';
            END IF;

            SELECT
                pv.price,
                pv.stock,
                pv.size,
                pv.color,
                p.name
            INTO
                v_price,
                v_stock,
                v_size,
                v_color,
                v_product_name
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            JOIN public.collections c ON c.id = p.collection_id
            WHERE pv.id = v_variant_id
              AND pv.is_active = TRUE
              AND p.is_active = TRUE
              AND c.is_active = TRUE
            FOR UPDATE OF pv;
        ELSE
            v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
            IF v_product_id IS NULL THEN
                RAISE EXCEPTION 'Invalid product ID or quantity';
            END IF;

            SELECT
                p.price,
                p.stock,
                NULL::TEXT,
                NULL::TEXT,
                p.name
            INTO
                v_price,
                v_stock,
                v_size,
                v_color,
                v_product_name
            FROM public.products p
            JOIN public.collections c ON c.id = p.collection_id
            WHERE p.id = v_product_id
              AND p.is_active = TRUE
              AND c.is_active = TRUE
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.product_variants pv
                  WHERE pv.product_id = p.id
                    AND pv.is_active = TRUE
              )
            FOR UPDATE OF p;
        END IF;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product or variant is unavailable';
        END IF;

        IF v_price IS NULL OR v_price <= 0 THEN
            RAISE EXCEPTION 'Product price must be greater than zero';
        END IF;

        IF v_stock IS NULL OR v_stock < v_quantity THEN
            RAISE EXCEPTION
                'Insufficient stock for product: %',
                v_product_name;
        END IF;

        v_total := v_total + (v_price * v_quantity);
    END LOOP;

    INSERT INTO public.orders (
        customer_name,
        customer_phone,
        total_amount
    )
    VALUES (
        TRIM(p_customer_name),
        TRIM(p_customer_phone),
        v_total
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items) AS x(value)
    LOOP
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_variant_id := NULL;
        v_product_id := NULL;

        IF v_item ? 'variant_id' THEN
            v_variant_id := (v_item->>'variant_id')::UUID;
            SELECT
                pv.price,
                pv.size,
                pv.color,
                p.name,
                p.id
            INTO
                v_price,
                v_size,
                v_color,
                v_product_name,
                v_product_id
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = v_variant_id;
        ELSE
            v_product_id := (v_item->>'product_id')::UUID;
            SELECT
                p.price,
                NULL::TEXT,
                NULL::TEXT,
                p.name,
                p.id
            INTO
                v_price,
                v_size,
                v_color,
                v_product_name,
                v_product_id
            FROM public.products p
            WHERE p.id = v_product_id;
        END IF;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            variant_id,
            product_name,
            selected_size,
            selected_color,
            quantity,
            product_price,
            line_total,
            product_stock_tracked
        )
        VALUES (
            v_order_id,
            v_product_id,
            v_variant_id,
            v_product_name,
            v_size,
            v_color,
            v_quantity,
            v_price,
            v_price * v_quantity,
            v_variant_id IS NULL
        );
    END LOOP;

    RETURN v_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_stock_deducted BOOLEAN;
    v_item RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    SELECT stock_deducted
    INTO v_stock_deducted
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_stock_deducted = TRUE THEN
        RETURN;
    END IF;

    FOR v_item IN
        SELECT product_id, variant_id, quantity, product_stock_tracked
        FROM public.order_items
        WHERE order_id = p_order_id
        ORDER BY product_id, variant_id
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock = stock - v_item.quantity
            WHERE id = v_item.variant_id
              AND stock >= v_item.quantity;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'Insufficient stock while confirming order';
            END IF;
        ELSIF v_item.product_stock_tracked
          AND v_item.product_id IS NOT NULL THEN
            UPDATE public.products
            SET stock = stock - v_item.quantity
            WHERE id = v_item.product_id
              AND stock >= v_item.quantity;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'Insufficient stock while confirming order';
            END IF;
        ELSE
            RAISE EXCEPTION
                'A product variant no longer exists. Stock was not deducted.';
        END IF;
    END LOOP;

    UPDATE public.orders
    SET stock_deducted = TRUE
    WHERE id = p_order_id;
END;
$function$;

COMMIT;
