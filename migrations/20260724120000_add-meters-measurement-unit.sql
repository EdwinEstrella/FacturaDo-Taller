ALTER TABLE public."Product" DROP CONSTRAINT IF EXISTS product_measurementunit_check;

ALTER TABLE public."Product"
  ADD CONSTRAINT product_measurementunit_check
  CHECK (
    ("unitType" = 'UNIT' AND "measurementUnit" IS NULL)
    OR (
      "unitType" = 'MEASURE'
      AND "measurementUnit" IN ('FEET', 'CENTIMETERS', 'INCHES', 'METERS')
    )
  );
