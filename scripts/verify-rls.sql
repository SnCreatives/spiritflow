
-- RLS_POLICY_VERIFICATION.sql
-- Run this in SQL Editor to verify RLS configuration

-- 1. Check RLS Status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('bar_outlets', 'bar_user_authorizations', 'purchases', 'inventory', 'stock_ledger') 
ORDER BY tablename;

-- 2. Check Policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
