-- Створюємо функцію для обробки змін у таблиці appointments та відправки повідомлень
-- Використовуємо прямий виклик edge function через pg_net.http_post

CREATE OR REPLACE FUNCTION public.process_appointment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger_condition text;
  v_templates record;
  v_appointment_data record;
  v_message_body text;
  v_message_subject text;
  v_scheduled_at timestamptz;
  v_date_formatted text;
  v_time_formatted text;
  v_client record;
  v_employee record;
  v_service record;
BEGIN
  -- Визначаємо тип події
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
    v_trigger_condition := 'booking_confirmation';
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.status <> 'cancelled' AND NEW.status = 'cancelled') THEN
      v_trigger_condition := 'booking_cancelled';
    ELSIF (OLD.status <> 'completed' AND NEW.status = 'completed') THEN
      v_trigger_condition := 'post_visit_thanks';
    END IF;
  END IF;

  -- Якщо немає умови, виходимо
  IF v_trigger_condition IS NULL THEN
    RETURN NEW;
  END IF;

  -- Завантажуємо дані клієнта
  SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Завантажуємо дані майстра
  SELECT * INTO v_employee FROM public.employees WHERE id = NEW.employee_id;
  
  -- Завантажуємо дані послуги
  SELECT * INTO v_service FROM public.services WHERE id = NEW.service_id;

  -- Форматуємо дату та час
  v_scheduled_at := NEW.scheduled_at;
  v_date_formatted := to_char(v_scheduled_at, 'DD Month YYYY');
  v_time_formatted := to_char(v_scheduled_at, 'HH24:MI');

  -- Обробляємо всі активні темплейти для цієї події
  FOR v_templates IN 
    SELECT * FROM public.message_templates 
    WHERE trigger_condition = v_trigger_condition 
    AND is_active = true
  LOOP
    -- Заміняємо змінні в темплейті
    v_message_body := v_templates.body;
    v_message_body := replace(v_message_body, '{client_name}', COALESCE(v_client.full_name, 'Клієнт'));
    v_message_body := replace(v_message_body, '{employee}', COALESCE(v_employee.display_name, 'Майстер'));
    v_message_body := replace(v_message_body, '{service}', COALESCE(v_service.name, 'Послуга'));
    v_message_body := replace(v_message_body, '{date}', v_date_formatted);
    v_message_body := replace(v_message_body, '{time}', v_time_formatted);
    v_message_body := replace(v_message_body, '{price}', NEW.price::text || ' ₴');

    -- Заміняємо змінні в subject (для email)
    IF v_templates.subject IS NOT NULL THEN
      v_message_subject := v_templates.subject;
      v_message_subject := replace(v_message_subject, '{client_name}', COALESCE(v_client.full_name, 'Клієнт'));
      v_message_subject := replace(v_message_subject, '{employee}', COALESCE(v_employee.display_name, 'Майстер'));
      v_message_subject := replace(v_message_subject, '{service}', COALESCE(v_service.name, 'Послуга'));
      v_message_subject := replace(v_message_subject, '{date}', v_date_formatted);
      v_message_subject := replace(v_message_subject, '{time}', v_time_formatted);
      v_message_subject := replace(v_message_subject, '{price}', NEW.price::text || ' ₴');
    END IF;

    -- Відправляємо повідомлення через edge function
    PERFORM net.http_post(
      url := 'https://nfwqjkbpvfmvpxvzkbnt.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5md3Fqa2JwdmZtdnB4dnprYm50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI4NDgzMiwiZXhwIjoyMDc1ODYwODMyfQ.r4d_kUmHdgX8sXjqf4xD6LqMCMN6YaRrVxQ8MHdqYsw'
      ),
      body := jsonb_build_object(
        'client_id', NEW.client_id,
        'appointment_id', NEW.id,
        'message_type', 'custom',
        'custom_message', v_message_body,
        'force_channel', v_templates.channel
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Видаляємо старий тригер якщо існує
DROP TRIGGER IF EXISTS on_appointment_change ON public.appointments;

-- Створюємо новий тригер
CREATE TRIGGER on_appointment_change
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.process_appointment_notification();