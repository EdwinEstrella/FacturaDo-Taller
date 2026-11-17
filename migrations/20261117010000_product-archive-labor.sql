-- Archived products disappear from catalogs, the POS and the invoice/quote forms, but stay in the
-- database so past invoices and quotes keep their lines.
ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz;

-- Labor and installation products replaced by the "Incluye instalación" option (user request 2026-11-17).
UPDATE public."Product"
SET "archivedAt" = now(), "updatedAt" = now()
WHERE id IN (
  '86c57af6-7c84-4813-90bd-ffd3e785997a', -- Instalación de Closet
  '65a9f6da-d38e-4daa-b746-0607f2fc69b9', -- Instalacion de espejos a retrovisores
  '323fe306-77ce-4e7b-b15c-b660dcac236c', -- Instalacion de puerta enrrollable electrica mano de obra
  '1b0fe73f-aa32-40f2-bba0-3b5f5b5be57c', -- Instalacion de puertas polim blancas
  'd3e17448-2bba-49a7-8f4a-08c4557ba039', -- Instalación de Vidrios
  '0d5e9e5d-925e-4bea-b574-08c1a525e44d', -- JGF Mano de obra
  '997f1f1b-495d-44a8-95e9-0563f697da42', -- MANO DE OBRA
  '942977e1-2409-43e2-809f-be9df438b89e', -- Mano de obra de colocacion de tubo 4x4
  '9260954c-52eb-4d5d-b08a-88997d904105', -- Mano de obra para desmontar Puertas y Ventanas
  '0c1521bb-d35d-4b73-916f-20875a271a72'  -- puerta solo instalación
)
AND "archivedAt" IS NULL;
