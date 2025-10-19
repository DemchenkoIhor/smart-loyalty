import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'noreply@example.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const resend = new Resend(RESEND_API_KEY);

interface NotificationRequest {
  client_id: string;
  message_type: 'booking_confirmation' | 'booking_reminder' | 'post_visit_thanks' | 'custom';
  custom_message?: string;
  appointment_id?: string;
  force_channel?: 'email' | 'telegram';
  appointment_details?: {
    service: string;
    employee: string;
    date: string;
    time: string;
    price: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body: NotificationRequest = await req.json();
    
    console.log('Processing notification request:', body);

    // Завантажуємо дані клієнта
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', body.client_id)
      .single();

    if (clientError || !client) {
      throw new Error('Client not found');
    }

    // Генеруємо текст повідомлення
    const messageText = generateMessage(body.message_type, body.custom_message, body.appointment_details);
    
    let channel: 'telegram' | 'email' = 'email';
    let deliveryStatus = 'pending';
    let errorMessage = null;

    // Якщо force_channel вказано, використовуємо тільки його
    if (body.force_channel === 'email' && client.email) {
      try {
        await sendEmail(client.email, messageText.emailSubject, messageText.emailHtml, client.phone);
        channel = 'email';
        deliveryStatus = 'sent';
        console.log('Message sent via Email (forced) to:', client.email);
      } catch (error: any) {
        deliveryStatus = 'failed';
        errorMessage = error?.message || String(error);
        console.error('Email error:', error);
      }
    } else if (body.force_channel === 'telegram' && client.telegram_chat_id) {
      try {
        await sendTelegramMessage(client.telegram_chat_id, messageText.telegram);
        channel = 'telegram';
        deliveryStatus = 'sent';
        console.log('Message sent via Telegram (forced) to:', client.telegram_chat_id);
      } catch (error: any) {
        deliveryStatus = 'failed';
        errorMessage = error?.message || String(error);
        console.error('Telegram error:', error);
      }
    } else if (client.telegram_chat_id && client.preferred_channel === 'telegram') {
      try {
        await sendTelegramMessage(client.telegram_chat_id, messageText.telegram);
        channel = 'telegram';
        deliveryStatus = 'sent';
        console.log('Message sent via Telegram to:', client.telegram_chat_id);
      } catch (error: any) {
        console.error('Telegram error, falling back to email:', error);
        errorMessage = error?.message || String(error);
        // Fallback до email
        if (client.email) {
          try {
            await sendEmail(client.email, messageText.emailSubject, messageText.emailHtml, client.phone);
            channel = 'email';
            deliveryStatus = 'sent';
            console.log('Message sent via Email (fallback) to:', client.email);
          } catch (emailError: any) {
            deliveryStatus = 'failed';
            errorMessage = emailError?.message || String(emailError);
            console.error('Email fallback also failed:', emailError);
          }
        }
      }
    } else if (client.email) {
      // Якщо Telegram не підключено, відправляємо Email
      try {
        await sendEmail(client.email, messageText.emailSubject, messageText.emailHtml, client.phone);
        channel = 'email';
        deliveryStatus = 'sent';
        console.log('Message sent via Email to:', client.email);
      } catch (error: any) {
        deliveryStatus = 'failed';
        errorMessage = error?.message || String(error);
        console.error('Email error:', error);
      }
    }

    // Логуємо в sent_messages
    const { error: logError } = await supabase
      .from('sent_messages')
      .insert({
        client_id: body.client_id,
        appointment_id: body.appointment_id,
        channel: channel,
        message_text: messageText.telegram,
        delivery_status: deliveryStatus,
        error_message: errorMessage,
      });

    if (logError) {
      console.error('Error logging message:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: deliveryStatus === 'sent',
        channel: channel,
        status: deliveryStatus 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-notification:', error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateMessage(
  type: string,
  customMessage?: string,
  details?: any
): { telegram: string; emailSubject: string; emailHtml: string } {
  if (type === 'custom' && customMessage) {
    return {
      telegram: customMessage,
      emailSubject: 'Повідомлення від салону',
      emailHtml: `<p>${customMessage.replace(/\n/g, '<br>')}</p>`,
    };
  }

  if (type === 'booking_confirmation' && details) {
    const telegram = 
      `🎉 Ваш запис підтверджено!\n\n` +
      `👤 Майстер: ${details.employee}\n` +
      `💅 Послуга: ${details.service}\n` +
      `📅 Дата: ${details.date}\n` +
      `🕐 Час: ${details.time}\n` +
      `💰 Вартість: ${details.price} ₴\n\n` +
      `За день до візиту ми надішлемо вам нагадування.\n` +
      `До зустрічі! 💖`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">🎉 Ваш запис підтверджено!</h1>
        <p style="color: #666;">Дякуємо що обрали наш салон!</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-weight: bold;">Майстер:</td>
            <td style="padding: 10px;">${details.employee}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-weight: bold;">Послуга:</td>
            <td style="padding: 10px;">${details.service}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-weight: bold;">Дата:</td>
            <td style="padding: 10px;">${details.date}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-weight: bold;">Час:</td>
            <td style="padding: 10px;">${details.time}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-weight: bold;">Вартість:</td>
            <td style="padding: 10px;">${details.price} ₴</td>
          </tr>
        </table>
        <p style="color: #666;">За день до візиту ми надішлемо вам нагадування. До зустрічі! 💖</p>
      </div>
    `;

    return {
      telegram,
      emailSubject: 'Підтвердження запису',
      emailHtml,
    };
  }

  return {
    telegram: 'Повідомлення від салону',
    emailSubject: 'Повідомлення від салону',
    emailHtml: '<p>Повідомлення від салону</p>',
  };
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

async function sendEmail(to: string, subject: string, html: string, phone: string): Promise<void> {
  const botUsername = 'demchenko_tr43_bot';
  // Видаляємо + з номеру для правильного формування deep link
  const cleanPhone = phone.replace(/\+/g, '');
  const telegramLink = `https://t.me/${botUsername}?start=phone_${cleanPhone}`;
  
  const htmlWithTelegramLink = html + `
    <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 10px;">
      <p style="margin: 0 0 10px 0; color: #666;">💡 Хочете отримувати миттєві повідомлення в Telegram?</p>
      <a href="${telegramLink}" 
         style="display: inline-block; padding: 12px 24px; background: #0088cc; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        📱 Підключити Telegram
      </a>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: subject,
    html: htmlWithTelegramLink,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
