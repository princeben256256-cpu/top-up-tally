ALTER TABLE public.device_reset_reports
  ADD COLUMN IF NOT EXISTS app_version integer,
  ADD COLUMN IF NOT EXISTS frp_supported boolean,
  ADD COLUMN IF NOT EXISTS dev_options_on boolean;