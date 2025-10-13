-- Виправлення даних працівників

-- 1. Оновлення профілів (заповнення full_name)
UPDATE public.profiles 
SET full_name = 'Олена Коваленко'
WHERE id = '101ede99-3814-4c97-8d4d-83843d260512';

UPDATE public.profiles 
SET full_name = 'Марія Шевченко'
WHERE id = '4bcfbf6e-24e7-4115-a650-33d2fdab2b0d';

-- 2. Додавання ролей employee
INSERT INTO public.user_roles (user_id, role) VALUES
('101ede99-3814-4c97-8d4d-83843d260512', 'employee'),
('4bcfbf6e-24e7-4115-a650-33d2fdab2b0d', 'employee')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Створення записів працівників
INSERT INTO public.employees (id, user_id, bio, is_active) VALUES
('101ede99-3814-4c97-8d4d-83843d260512', '101ede99-3814-4c97-8d4d-83843d260512', 'Майстер з манікюру з 5-річним досвідом. Спеціалізуюсь на класичному та апаратному манікюрі.', true),
('4bcfbf6e-24e7-4115-a650-33d2fdab2b0d', '4bcfbf6e-24e7-4115-a650-33d2fdab2b0d', 'Професійний стиліст-перукар. Працюю з усіма типами волосся, фарбування, стрижки, укладки.', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Прив'язка послуг до працівників
DO $$
DECLARE
  service_mani_classic uuid;
  service_mani_hardware uuid;
  service_pedi_classic uuid;
  service_cut_woman uuid;
  service_cut_man uuid;
  service_color uuid;
  service_style uuid;
BEGIN
  -- Знаходимо ID послуг
  SELECT id INTO service_mani_classic FROM services WHERE name = 'Класичний манікюр';
  SELECT id INTO service_mani_hardware FROM services WHERE name = 'Апаратний манікюр';
  SELECT id INTO service_pedi_classic FROM services WHERE name = 'Педикюр класичний';
  SELECT id INTO service_cut_woman FROM services WHERE name = 'Жіноча стрижка';
  SELECT id INTO service_cut_man FROM services WHERE name = 'Чоловіча стрижка';
  SELECT id INTO service_color FROM services WHERE name = 'Фарбування волосся';
  SELECT id INTO service_style FROM services WHERE name = 'Укладка волосся';

  -- Олена Коваленко (манікюр/педикюр)
  IF service_mani_classic IS NOT NULL THEN
    INSERT INTO employee_services (employee_id, service_id, price, duration_minutes, is_active) VALUES
    ('101ede99-3814-4c97-8d4d-83843d260512', service_mani_classic, 350, 60, true),
    ('101ede99-3814-4c97-8d4d-83843d260512', service_mani_hardware, 450, 90, true),
    ('101ede99-3814-4c97-8d4d-83843d260512', service_pedi_classic, 400, 75, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Марія Шевченко (перукар)
  IF service_cut_woman IS NOT NULL THEN
    INSERT INTO employee_services (employee_id, service_id, price, duration_minutes, is_active) VALUES
    ('4bcfbf6e-24e7-4115-a650-33d2fdab2b0d', service_cut_woman, 500, 60, true),
    ('4bcfbf6e-24e7-4115-a650-33d2fdab2b0d', service_cut_man, 300, 45, true),
    ('4bcfbf6e-24e7-4115-a650-33d2fdab2b0d', service_color, 800, 120, true),
    ('4bcfbf6e-24e7-4115-a650-33d2fdab2b0d', service_style, 400, 60, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;