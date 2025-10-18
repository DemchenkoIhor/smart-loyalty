-- Restore trigger to sync employee display_name when profile full_name is updated
CREATE TRIGGER sync_employee_display_name_trigger
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_display_name();