-- ====================================================================
-- DayStart India — MIGRATION VERIFICATION
-- Run this in Supabase Dashboard -> SQL Editor to verify the migration
-- ====================================================================

-- 1. VERIFY TABLES CREATED
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: 26 tables
-- profiles, phone_otp_requests, user_roles, customer_profiles, service_coverage_locations,
-- services, sub_services, worker_profiles, worker_kyc_documents, worker_registrations,
-- bookings, booking_items, booking_events, worker_assignments, booking_evidence,
-- payment_transactions, worker_earnings, payout_requests, project_quotes, reviews,
-- booking_disputes, notifications, admin_audit_logs, pricing_config, contact_messages

-- 2. VERIFY STORAGE BUCKETS
SELECT id, name, public FROM storage.buckets;

-- Expected: 3 buckets
-- aadhaar-documents (private), worker-kyc (private), work-evidence (private)

-- 3. VERIFY RLS POLICIES
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected: Multiple policies per table for security

-- 4. VERIFY INDEXES
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Expected: Indexes on foreign keys and frequently queried columns

-- 5. VERIFY FUNCTIONS
SELECT 
  routine_name,
  routine_type,
  data_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Expected: set_updated_at, has_role, is_admin, is_worker

-- 6. VERIFY SERVICE DATA
SELECT COUNT(*) as service_count FROM public.services;
SELECT COUNT(*) as sub_service_count FROM public.sub_services;

-- Expected: 4 services, 32 sub-services

-- 7. VERIFY TRIGGERS
SELECT 
  trigger_name,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Expected: Triggers for updated_at on all tables
