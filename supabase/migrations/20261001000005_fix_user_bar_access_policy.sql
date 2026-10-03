
-- Fix policy for user_bar_access to allow inserts
DROP POLICY IF EXISTS "Service role full access on user_bar_access" ON public.user_bar_access;
CREATE POLICY "Service role full access on user_bar_access" ON public.user_bar_access 
FOR ALL 
USING (true) 
WITH CHECK (true);
