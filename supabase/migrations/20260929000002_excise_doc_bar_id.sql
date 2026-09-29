-- Add bar_id to excise_document_references for complete isolation
-- Date: 2026-09-29

ALTER TABLE excise_document_references ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES bar_outlets(id) ON DELETE CASCADE;

-- Assign existing records to the first bar
DO $$
DECLARE
    v_main_bar_id UUID;
BEGIN
    SELECT id INTO v_main_bar_id FROM bar_outlets ORDER BY created_at ASC LIMIT 1;
    IF v_main_bar_id IS NOT NULL THEN
        UPDATE excise_document_references SET bar_id = v_main_bar_id WHERE bar_id IS NULL;
    END IF;
END $$;

-- Make bar_id NOT NULL for future records
-- ALTER TABLE excise_document_references ALTER COLUMN bar_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_excise_doc_ref_bar ON excise_document_references(bar_id);
