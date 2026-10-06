ALTER TABLE public.devices ADD COLUMN imei2 text;
CREATE UNIQUE INDEX devices_imei2_key ON public.devices (imei2) WHERE imei2 IS NOT NULL;
ALTER TABLE public.devices ADD CONSTRAINT devices_imei_15 CHECK (imei ~ '^[0-9]{15}$') NOT VALID;
ALTER TABLE public.devices ADD CONSTRAINT devices_imei2_15 CHECK (imei2 IS NULL OR imei2 ~ '^[0-9]{15}$');