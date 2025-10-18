-- Create trigger to sync employee display_name when profile full_name is updated
CREATE TRIGGER sync_employee_display_name_trigger
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_display_name();

-- Also sync display_name for existing employees that might have NULL display_name
UPDATE public.employees e
SET display_name = p.full_name
FROM public.profiles p
WHERE e.user_id = p.id
  AND (e.display_name IS NULL OR e.display_name = '');