-- 1) Employees: public display name to avoid profiles RLS on public pages
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS display_name text;

-- Backfill from profiles where possible
UPDATE public.employees e
SET display_name = p.full_name
FROM public.profiles p
WHERE e.user_id = p.id
  AND (e.display_name IS NULL OR e.display_name = '');

-- Sync trigger from profiles -> employees.display_name
CREATE OR REPLACE FUNCTION public.sync_employee_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employees
  SET display_name = NEW.full_name
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_display_name ON public.profiles;
CREATE TRIGGER trg_sync_employee_display_name
AFTER UPDATE OF full_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_display_name();

-- 2) Admins can manage profiles (so admin can edit employee names if needed)
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) RPC to expose busy slots for a given employee and date (no PII)
CREATE OR REPLACE FUNCTION public.get_employee_busy_slots(emp_id uuid, day date)
RETURNS TABLE(start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.scheduled_at AS start_at,
         a.scheduled_at + make_interval(mins => a.duration_minutes) AS end_at
  FROM public.appointments a
  WHERE a.employee_id = emp_id
    AND a.status <> 'cancelled'
    AND a.scheduled_at::date = day
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_busy_slots(uuid, date) TO anon, authenticated;

-- 4) Server-side protection: prevent overlapping appointments per employee
CREATE OR REPLACE FUNCTION public.prevent_overlapping_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_start timestamptz := NEW.scheduled_at;
  new_end   timestamptz := NEW.scheduled_at + make_interval(mins => NEW.duration_minutes);
  conflict_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.employee_id = NEW.employee_id
      AND a.status <> 'cancelled'
      AND (NEW.id IS NULL OR a.id <> NEW.id)
      AND NOT (
        new_end <= a.scheduled_at OR
        new_start >= a.scheduled_at + make_interval(mins => a.duration_minutes)
      )
  ) INTO conflict_exists;

  IF conflict_exists THEN
    RAISE EXCEPTION 'APPOINTMENT_TIME_CONFLICT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_overlapping_appointments ON public.appointments;
CREATE TRIGGER trg_prevent_overlapping_appointments
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_overlapping_appointments();