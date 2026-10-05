-- Lock app setup must be writable by admins through the app.
-- Supabase does not grant default privileges on public tables, so without
-- these GRANTs the upsert from saveAgentSettings is refused and the row never appears.
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

-- Seed the singleton row with the verified lock-agent release values.
INSERT INTO public.app_settings (id, agent_apk_url, agent_checksum)
VALUES (
  1,
  'https://github.com/princeben256256-cpu/top-up-tally/releases/download/lock-agent-latest/app-debug.apk',
  'x9lortgR83WuVT3qlQd_Ode7gwbb5WCZZXx4V9gdEI8'
)
ON CONFLICT (id) DO UPDATE
  SET agent_apk_url = EXCLUDED.agent_apk_url,
      agent_checksum = EXCLUDED.agent_checksum,
      updated_at = now();