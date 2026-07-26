CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  external_id text NOT NULL UNIQUE,
  iotec_id text,
  amount numeric NOT NULL,
  payer_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  status_message text,
  applied boolean NOT NULL DEFAULT false,
  initiated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read payment intents" ON public.payment_intents
FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE INDEX payment_intents_device_idx ON public.payment_intents(device_id);

CREATE TRIGGER payment_intents_touch
BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();