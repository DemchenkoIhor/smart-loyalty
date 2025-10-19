import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface TelegramUpdate {
  message?: {
    chat: {
      id: number;
      username?: string;
    };
    text?: string;
    from: {
      id: number;
      username?: string;
      first_name?: string;
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const update: TelegramUpdate = await req.json();
    
    console.log('Received Telegram update:', update);

    if (!update.message || !update.message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatId = update.message.chat.id;
    const username = update.message.from.username || '';
    const text = update.message.text;

    // Обробка команди /start з параметром номера телефону
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      
      if (parts.length > 1 && parts[1].startsWith('phone_')) {
        // Витягуємо номер телефону з deep link
        const encodedPhone = parts[1].replace('phone_', '');
        const phone = decodeURIComponent(encodedPhone);
        
        console.log('Processing registration for phone:', phone);

        // Знаходимо клієнта за номером телефону
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('phone', phone)
          .maybeSingle();

        if (clientError) {
          console.error('Error finding client:', clientError);
          await sendTelegramMessage(chatId, '❌ Помилка при пошуку клієнта. Спробуйте ще раз.');
          return new Response(JSON.stringify({ ok: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!client) {
          await sendTelegramMessage(chatId, '❌ Клієнта з таким номером не знайдено. Спочатку оформіть запис на сайті.');
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Оновлюємо telegram_chat_id та username
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            telegram_chat_id: chatId,
            telegram_username: username,
            preferred_channel: 'telegram'
          })
          .eq('id', client.id);

        if (updateError) {
          console.error('Error updating client:', updateError);
          await sendTelegramMessage(chatId, '❌ Помилка при збереженні даних. Спробуйте ще раз.');
          return new Response(JSON.stringify({ ok: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Надсилаємо вітальне повідомлення
        await sendTelegramMessage(
          chatId,
          `🎉 Вітаємо, ${client.full_name}!\n\n` +
          `Telegram успішно підключено! Тепер ви будете отримувати:\n` +
          `✅ Підтвердження записів\n` +
          `⏰ Нагадування перед візитами\n` +
          `💌 Спеціальні пропозиції\n\n` +
          `До зустрічі! 💖`
        );

        console.log('Client registered successfully:', client.id);
      } else {
        // Звичайна команда /start без параметрів
        await sendTelegramMessage(
          chatId,
          '👋 Вітаємо!\n\n' +
          'Для підключення повідомлень оформіть запис на нашому сайті.\n' +
          'Під час бронювання ви зможете підключити Telegram-повідомлення.'
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in telegram-webhook:', error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  try {
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
      console.error('Telegram API error:', error);
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}
