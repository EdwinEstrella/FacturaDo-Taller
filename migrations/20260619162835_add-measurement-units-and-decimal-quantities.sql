ALTER TABLE public."Product"
  ADD COLUMN IF NOT EXISTS "measurementUnit" text;

UPDATE public."Product"
SET "measurementUnit" = 'FEET'
WHERE "unitType" = 'MEASURE'
  AND ("measurementUnit" IS NULL OR "measurementUnit" = '');

ALTER TABLE public."Product" DROP CONSTRAINT IF EXISTS product_unittype_check;
ALTER TABLE public."Product" DROP CONSTRAINT IF EXISTS product_measurementunit_check;

ALTER TABLE public."Product"
  ADD CONSTRAINT product_unittype_check
  CHECK ("unitType" IN ('UNIT', 'MEASURE')),
  ADD CONSTRAINT product_measurementunit_check
  CHECK (
    ("unitType" = 'UNIT' AND "measurementUnit" IS NULL)
    OR (
      "unitType" = 'MEASURE'
      AND "measurementUnit" IN ('FEET', 'CENTIMETERS', 'INCHES')
    )
  );

ALTER TABLE public."Product"
  ALTER COLUMN stock TYPE numeric USING stock::numeric;

ALTER TABLE public."ProductVariant"
  ALTER COLUMN stock TYPE numeric USING coalesce(stock, 0)::numeric;

ALTER TABLE public."InvoiceItem"
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

ALTER TABLE public."QuoteItem"
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

ALTER TABLE public."PurchaseItem"
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

ALTER TABLE public.installations
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

DROP FUNCTION IF EXISTS public.sync_product_stock_from_variants(text);

CREATE FUNCTION public.sync_product_stock_from_variants(p_product_id text)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock numeric;
BEGIN
  SELECT coalesce(sum(coalesce(stock, 0)), 0)
  INTO v_stock
  FROM public."ProductVariant"
  WHERE "productId" = p_product_id;

  UPDATE public."Product"
  SET stock = v_stock,
      "updatedAt" = now()
  WHERE id = p_product_id::uuid;

  RETURN v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_purchase_atomic(
  p_supplier_name text,
  p_total numeric,
  p_notes text,
  p_date timestamptz,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_purchase_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_product record;
  v_variant record;
  v_product_name text;
  v_variant_name text;
  v_quantity numeric;
  v_unit_cost numeric;
  v_new_cost numeric;
  v_new_price numeric;
  v_variant_total_stock numeric;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Purchase must include at least one item';
  END IF;

  INSERT INTO public."Purchase" ("supplierName", total, notes)
  VALUES (coalesce(nullif(p_supplier_name, ''), 'Proveedor'), p_total::text, p_notes)
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'productId')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_cost := (v_item ->> 'unitCost')::numeric;
    v_new_cost := nullif(v_item ->> 'newCost', '')::numeric;
    v_new_price := nullif(v_item ->> 'newPrice', '')::numeric;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid purchase quantity for product %', v_product_id;
    END IF;

    IF v_unit_cost IS NULL OR v_unit_cost < 0 THEN
      RAISE EXCEPTION 'Invalid purchase unit cost for product %', v_product_id;
    END IF;

    SELECT * INTO v_product
    FROM public."Product"
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    v_product_name := v_product.name;
    v_variant_name := nullif(v_item ->> 'variantName', '');

    IF v_variant_id IS NOT NULL THEN
      SELECT * INTO v_variant
      FROM public."ProductVariant"
      WHERE id = v_variant_id
        AND "productId" = v_product_id::text
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant % not found for product %', v_variant_id, v_product_id;
      END IF;

      v_variant_name := coalesce(v_variant_name, v_variant.name);

      UPDATE public."ProductVariant"
      SET stock = coalesce(stock, 0) + v_quantity,
          cost = coalesce(v_new_cost, v_unit_cost)::text,
          price = coalesce(v_new_price, nullif(price, '')::numeric, 0)::text
      WHERE id = v_variant_id;

      SELECT coalesce(sum(coalesce(stock, 0)), 0) INTO v_variant_total_stock
      FROM public."ProductVariant"
      WHERE "productId" = v_product_id::text;

      UPDATE public."Product"
      SET stock = v_variant_total_stock,
          cost = coalesce(v_new_cost, v_unit_cost)::text,
          price = coalesce(v_new_price, nullif(price, '')::numeric, 0)::text,
          "hasVariants" = true,
          "updatedAt" = now()
      WHERE id = v_product_id;
    ELSE
      UPDATE public."Product"
      SET stock = coalesce(stock, 0) + v_quantity,
          cost = coalesce(v_new_cost, v_unit_cost)::text,
          price = coalesce(v_new_price, nullif(price, '')::numeric, 0)::text,
          "updatedAt" = now()
      WHERE id = v_product_id;
    END IF;

    INSERT INTO public."PurchaseItem" (
      "purchaseId",
      "productId",
      "productName",
      quantity,
      price,
      "variantId",
      "variantName",
      "quantityType",
      "newCost",
      "newPrice"
    ) VALUES (
      v_purchase_id::text,
      v_product_id::text,
      CASE WHEN v_variant_name IS NULL THEN v_product_name ELSE v_product_name || ' - ' || v_variant_name END,
      v_quantity,
      v_unit_cost::text,
      v_variant_id::text,
      v_variant_name,
      coalesce(nullif(v_item ->> 'quantityType', ''), 'UNIT'),
      coalesce(v_new_cost, v_unit_cost)::text,
      v_new_price::text
    );
  END LOOP;

  INSERT INTO public."Transaction" (type, category, amount, description, date, reference_id)
  VALUES (
    'EXPENSE',
    'PURCHASE',
    p_total,
    'Compra de Mercancía - ' || coalesce(nullif(p_supplier_name, ''), 'Proveedor'),
    p_date,
    v_purchase_id
  );

  RETURN jsonb_build_object('success', true, 'purchaseId', v_purchase_id);
END;
$$;
