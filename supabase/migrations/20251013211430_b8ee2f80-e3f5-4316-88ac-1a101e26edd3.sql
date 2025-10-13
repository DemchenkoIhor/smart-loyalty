-- Додавання адміністратора та тестових працівників

-- 1. Створення профілю адміністратора
INSERT INTO public.profiles (id, full_name, email, phone) VALUES
('c09d022b-b00e-4b1a-a475-9d3869560b79', 'Адміністратор Системи', 'admin@admin.com', '+380501234567')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

-- 2. Призначення ролі admin
INSERT INTO public.user_roles (user_id, role) VALUES
('c09d022b-b00e-4b1a-a475-9d3869560b79', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ПРИМІТКА: Для створення працівників потрібно спочатку створити користувачів через Authentication
-- Інструкції:
-- 1. Створіть користувачів employee1@test.com та employee2@test.com
-- 2. Скопіюйте їх UUID
-- 3. Запустіть наступну міграцію з реальними UUID