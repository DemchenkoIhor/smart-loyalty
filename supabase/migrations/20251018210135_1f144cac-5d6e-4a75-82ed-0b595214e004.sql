-- Drop the unnecessary trigger since admin doesn't update employee names via management module
DROP TRIGGER IF EXISTS sync_employee_display_name_trigger ON public.profiles;