-- Add acceptance_deadline column to worker_assignments
-- Add assignment_reason column to worker_assignments
-- Add pending_acceptance status to worker_assignments check constraint

-- Add new columns
ALTER TABLE public.worker_assignments
ADD COLUMN IF NOT EXISTS acceptance_deadline timestamptz,
ADD COLUMN IF NOT EXISTS assignment_reason text;

-- Update the status check constraint to include pending_acceptance
ALTER TABLE public.worker_assignments
DROP CONSTRAINT IF EXISTS worker_assignments_status_check;

ALTER TABLE public.worker_assignments
ADD CONSTRAINT worker_assignments_status_check
CHECK (status IN ('pending', 'pending_acceptance', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'declined'));
