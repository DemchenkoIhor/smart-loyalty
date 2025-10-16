-- Backfill missing 'employee' roles for existing employees
INSERT INTO public.user_roles (user_id, role)
SELECT e.user_id, 'employee'::app_role
FROM public.employees e
LEFT JOIN public.user_roles ur ON ur.user_id = e.user_id
WHERE ur.user_id IS NULL;