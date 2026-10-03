
-- Fix policy for bar_outlets to allow inserts
DROP POLICY IF EXISTS "Service role full access on bar_outlets" ON public.bar_outlets;
CREATE POLICY "Service role full access on bar_outlets" ON public.bar_outlets FOR ALL USING (true) WITH CHECK (true);
