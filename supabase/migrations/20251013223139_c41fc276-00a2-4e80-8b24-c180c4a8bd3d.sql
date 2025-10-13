-- Ensure display_name stays in sync with profiles.full_name
DROP TRIGGER IF EXISTS trg_sync_employee_display_name ON public.profiles;
CREATE TRIGGER trg_sync_employee_display_name
AFTER UPDATE OF full_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_display_name();

-- Backfill display_name where missing
UPDATE public.employees e
SET display_name = p.full_name
FROM public.profiles p
WHERE e.user_id = p.id
  AND (e.display_name IS NULL OR e.display_name = '');

-- Prevent overlapping appointments per employee
DROP TRIGGER IF EXISTS trg_prevent_overlapping_appointments ON public.appointments;
CREATE TRIGGER trg_prevent_overlapping_appointments
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_overlapping_appointments();

-- Make sure RPC is callable by public booking page
GRANT EXECUTE ON FUNCTION public.get_employee_busy_slots(uuid, date) TO anon, authenticated;