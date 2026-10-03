
-- Fix policy for bar_user_authorizations to allow inserts
DROP POLICY IF EXISTS "Service role full access on bar_user_authorizations" ON public.bar_user_authorizations;
CREATE POLICY "Service role full access on bar_user_authorizations" ON public.bar_user_authorizations 
FOR ALL 
USING (true) 
WITH CHECK (true);
