DO $$
DECLARE
    r RECORD;
    v_target_id uuid;
    v_dup_id uuid;
    i integer;
BEGIN
    -- 1. Deduplicate by normalized client name (case-insensitive and trimmed)
    FOR r IN (
        SELECT 
            LOWER(TRIM(name)) AS norm_name,
            array_agg(id ORDER BY 
                -- Priority 1: Record with invoices
                (SELECT count(*) FROM public."Invoice" WHERE "clientId"::text = c.id::text) DESC,
                -- Priority 2: Record with quotes
                (SELECT count(*) FROM public."Quote" WHERE "clientId"::text = c.id::text) DESC,
                -- Priority 3: Has non-empty phone
                (CASE WHEN c.phone IS NOT NULL AND TRIM(c.phone) <> '' THEN 1 ELSE 0 END) DESC,
                -- Priority 4: Has non-empty RNC or Cedula
                (CASE WHEN (c.rnc IS NOT NULL AND TRIM(c.rnc) <> '') OR (c.cedula IS NOT NULL AND TRIM(c.cedula) <> '') THEN 1 ELSE 0 END) DESC,
                -- Priority 5: Oldest creation date
                c."createdAt" ASC
            ) AS sorted_ids
        FROM public."Client" c
        GROUP BY LOWER(TRIM(name))
        HAVING count(*) > 1
    ) LOOP
        -- The first ID is our canonical target client
        v_target_id := r.sorted_ids[1];
        
        -- Merge and delete each duplicate
        FOR i IN 2 .. array_length(r.sorted_ids, 1) LOOP
            v_dup_id := r.sorted_ids[i];
            
            -- Backfill missing contact info on target client from duplicate
            UPDATE public."Client" target
            SET 
                phone = COALESCE(NULLIF(TRIM(target.phone), ''), NULLIF(TRIM(dup.phone), '')),
                rnc = COALESCE(NULLIF(TRIM(target.rnc), ''), NULLIF(TRIM(dup.rnc), '')),
                cedula = COALESCE(NULLIF(TRIM(target.cedula), ''), NULLIF(TRIM(dup.cedula), '')),
                address = COALESCE(NULLIF(TRIM(target.address), ''), NULLIF(TRIM(dup.address), '')),
                email = COALESCE(NULLIF(TRIM(target.email), ''), NULLIF(TRIM(dup.email), ''))
            FROM public."Client" dup
            WHERE target.id = v_target_id AND dup.id = v_dup_id;

            -- Repoint Invoices
            UPDATE public."Invoice"
            SET "clientId" = v_target_id
            WHERE "clientId"::text = v_dup_id::text;

            -- Repoint Quotes
            UPDATE public."Quote"
            SET "clientId" = v_target_id::text
            WHERE "clientId"::text = v_dup_id::text;

            -- Repoint Client History
            UPDATE public."ClientHistory"
            SET "clientId" = v_target_id::text
            WHERE "clientId"::text = v_dup_id::text;

            -- Repoint Receivables if any
            UPDATE public."Receivable"
            SET "clientId" = v_target_id::text
            WHERE "clientId"::text = v_dup_id::text;

            -- Repoint WindowBreakdown if any
            UPDATE public."WindowBreakdown"
            SET "clientId" = v_target_id::text
            WHERE "clientId"::text = v_dup_id::text;

            -- Safely delete duplicate client
            DELETE FROM public."Client" WHERE id = v_dup_id;
        END LOOP;
    END LOOP;
END $$;
