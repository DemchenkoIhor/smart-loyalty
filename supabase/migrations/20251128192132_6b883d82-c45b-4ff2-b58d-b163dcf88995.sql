-- Таблиця для вихідних днів працівників
CREATE TABLE public.employee_days_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date_off date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, date_off)
);

-- Увімкнути RLS
ALTER TABLE public.employee_days_off ENABLE ROW LEVEL SECURITY;

-- Політики
CREATE POLICY "Admins can manage days off"
ON public.employee_days_off
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view days off"
ON public.employee_days_off
FOR SELECT
USING (true);

-- Індекс для швидкого пошуку
CREATE INDEX idx_employee_days_off_employee_date ON public.employee_days_off(employee_id, date_off);