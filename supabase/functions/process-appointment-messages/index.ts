import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface AppointmentPayload {
  type: 'INSERT' | 'UPDATE';
  old_record?: any;
  record: any;
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const payload: AppointmentPayload = await req.json();
    
    console.log('Processing appointment event:', payload);

    const appointment = payload.record;
    const oldAppointment = payload.old_record;
    
    // Визначаємо тип події
    let triggerCondition: string | null = null;
    
    if (payload.type === 'INSERT' && appointment.status === 'pending') {
      // Новий запис створено
      triggerCondition = 'booking_confirmation';
    } else if (payload.type === 'UPDATE' && oldAppointment) {
      // Перевіряємо зміни статусу
      if (oldAppointment.status !== 'cancelled' && appointment.status === 'cancelled') {
        // Запис скасовано
        triggerCondition = 'booking_cancelled';
      } else if (oldAppointment.status !== 'completed' && appointment.status === 'completed') {
        // Візит завершено
        triggerCondition = 'post_visit_thanks';
      }
    }

    if (!triggerCondition) {
      console.log('No trigger condition matched, skipping');
      return new Response(JSON.stringify({ success: true, message: 'No action needed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Trigger condition:', triggerCondition);

    // Завантажуємо дані для повідомлення
    const { data: appointmentData, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(*),
        employee:employees(display_name),
        service:services(name)
      `)
      .eq('id', appointment.id)
      .single();

    if (appointmentError || !appointmentData) {
      console.error('Error loading appointment data:', appointmentError);
      throw new Error('Failed to load appointment data');
    }

    // Знаходимо активний темплейт для цієї події
    const { data: templates, error: templateError } = await supabase
      .from('message_templates')
      .select('*')
      .eq('trigger_condition', triggerCondition)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (templateError) {
      console.error('Error loading templates:', templateError);
      throw new Error('Failed to load templates');
    }

    if (!templates || templates.length === 0) {
      console.log('No active templates found for trigger:', triggerCondition);
      return new Response(JSON.stringify({ success: true, message: 'No templates found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Форматуємо дату та час
    const scheduledAt = new Date(appointmentData.scheduled_at);
    const date = scheduledAt.toLocaleDateString('uk-UA', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const time = scheduledAt.toLocaleTimeString('uk-UA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Змінні для заміни в темплейті
    const variables = {
      '{client_name}': appointmentData.client?.full_name || 'Клієнт',
      '{employee}': appointmentData.employee?.display_name || 'Майстер',
      '{service}': appointmentData.service?.name || 'Послуга',
      '{date}': date,
      '{time}': time,
      '{price}': `${appointmentData.price} ₴`,
    };

    // Відправляємо повідомлення для кожного каналу
    for (const template of templates) {
      let messageBody = template.body;
      let messageSubject = template.subject || '';

      // Заміняємо змінні
      Object.entries(variables).forEach(([key, value]) => {
        messageBody = messageBody.replace(new RegExp(key, 'g'), value);
        messageSubject = messageSubject.replace(new RegExp(key, 'g'), value);
      });

      console.log(`Sending ${template.channel} message using template: ${template.name}`);

      // Викликаємо функцію відправки
      try {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
          'send-notification',
          {
            body: {
              client_id: appointmentData.client_id,
              appointment_id: appointmentData.id,
              message_type: 'custom',
              custom_message: messageBody,
              force_channel: template.channel,
            },
          }
        );

        if (sendError) {
          console.error(`Error sending ${template.channel} message:`, sendError);
        } else {
          console.log(`${template.channel} message sent successfully:`, sendResult);
        }
      } catch (error: any) {
        console.error(`Exception sending ${template.channel} message:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, trigger: triggerCondition }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in process-appointment-messages:', error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});