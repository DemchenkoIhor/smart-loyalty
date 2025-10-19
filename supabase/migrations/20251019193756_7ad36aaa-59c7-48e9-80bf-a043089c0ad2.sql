-- Розширення таблиці clients для Telegram
ALTER TABLE clients 
ADD COLUMN telegram_chat_id bigint NULL,
ADD COLUMN telegram_username text NULL,
ADD COLUMN preferred_channel text DEFAULT 'telegram' CHECK (preferred_channel IN ('telegram', 'email'));

-- Оновлення таблиці sent_messages
ALTER TABLE sent_messages
ADD COLUMN message_text text NULL,
ADD COLUMN error_message text NULL,
ADD COLUMN delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'delivered'));

-- Додати новий тип каналу 'telegram' до enum
ALTER TYPE communication_channel ADD VALUE IF NOT EXISTS 'telegram';

-- RLS політики для Edge Functions
CREATE POLICY "Service role can update telegram data"
ON clients FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can insert messages"
ON sent_messages FOR INSERT
TO service_role
WITH CHECK (true);