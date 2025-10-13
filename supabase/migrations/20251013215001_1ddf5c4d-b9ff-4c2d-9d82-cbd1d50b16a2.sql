-- Fix RLS policy for clients table to allow anonymous bookings
DROP POLICY IF EXISTS "Anyone can create clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

-- Allow anyone (including anonymous users) to create clients
CREATE POLICY "Anyone can create clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (true);

-- Allow authenticated users and employees to view clients
CREATE POLICY "Authenticated users can view clients" 
ON public.clients 
FOR SELECT 
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Ensure appointments can be created by anyone
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;

CREATE POLICY "Anyone can create appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (true);