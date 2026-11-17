-- 1. Clients with invoices or quotes cannot be hard-deleted (fiscal history), so "delete"
--    archives them: they disappear from lists and selectors but keep their history.
ALTER TABLE public."Client" ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz;

-- 2. Free-text category used to organize the Point of Sale catalog.
--    Independent from "category" (ARTICULO/MATERIAL/SERVICIO), which drives tax and inventory rules.
ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS "posCategory" text;

-- Initial classification by product name. Order matters: the first matching rule wins.
UPDATE public."Product"
SET "posCategory" = CASE
  WHEN name ILIKE ANY (ARRAY['%reparaci%', '%reemplazo%', '%reeplazo%', '%remplazo%', '%mantenimiento%', '%graduaci%', 'r. %']) THEN 'Reparaciones'
  WHEN name ILIKE '%sin instal%' THEN 'Puertas'
  WHEN name ILIKE ANY (ARRAY['%instalaci%', '%mano de obra%', '%transporte%', '%trabajo de herreria%', '%recorte%']) THEN 'Instalación y mano de obra'
  WHEN name ILIKE ANY (ARRAY['%enrrollable%', '%enrollable%', '%shutter%', '%motor%', '%sistema el%', '%cubre rollo%', '%sinta%', '%cinta%']) THEN 'Puertas enrollables y motores'
  WHEN name ILIKE ANY (ARRAY['%cerradura%', 'kit de puertas%', '%rodaja%', 'perfil para%', 'llavin%', '%puño%', 'tirador%', 'poleas%', 'guías%', 'guias%', 'cierre de%', 'rueda%', 'moldura%', 'masilla%', 'grasa%', 'angular%', 'tubo%', 'lamina%']) THEN 'Herrajes y accesorios'
  WHEN name ILIKE ANY (ARRAY['%closet%', '%diviciones%', '%divisiones%']) THEN 'Closets'
  WHEN name ILIKE ANY (ARRAY['%meseta%', '%gabinete%', '%gabiete%', '%despensa%', '%fregadero%', '%estufa%', '%microhondas%', '%vitrina%', '%estante%']) THEN 'Gabinetes y muebles'
  WHEN name ILIKE ANY (ARRAY['ventana%', '%ventanal%', 'paño fijo%', 'protectores de hierro%', 'marcos para ventana%']) THEN 'Ventanas'
  WHEN name ILIKE ANY (ARRAY['%vidrio%', '%cristal%', '%espejo%', '%fachada%', '%muro cortina%', '%baranda%']) THEN 'Vidrios y cristales'
  WHEN name ILIKE ANY (ARRAY['%puerta%', '%mampara%']) THEN 'Puertas'
  ELSE 'Herrajes y accesorios'
END
WHERE "posCategory" IS NULL;
