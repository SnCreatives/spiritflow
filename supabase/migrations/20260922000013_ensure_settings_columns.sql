-- Ensure settings table compatibility for address/business_address and language/selected_language
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'address') THEN
        ALTER TABLE settings ADD COLUMN address TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'business_address') THEN
        ALTER TABLE settings ADD COLUMN business_address TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'selected_language') THEN
        ALTER TABLE settings ADD COLUMN selected_language VARCHAR(10) DEFAULT 'mr';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'language') THEN
        ALTER TABLE settings ADD COLUMN language VARCHAR(10) DEFAULT 'mr';
    END IF;
END $$;
