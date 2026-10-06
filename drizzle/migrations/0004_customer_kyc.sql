CREATE TABLE public.customer_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL UNIQUE REFERENCES public.devices(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nin text NOT NULL,
  primary_phone text NOT NULL,
  alt_phone text NOT NULL,
  address text NOT NULL DEFAULT '',
  occupation text NOT NULL DEFAULT '',
  guarantor_name text NOT NULL,
  guarantor_nin text NOT NULL,
  guarantor_phone text NOT NULL,
  guarantor_relationship text NOT NULL DEFAULT '',
  guarantor_address text NOT NULL DEFAULT '',
  customer_photo text,
  id_front text,
  id_back text,
  guarantor_photo text,
  guarantor_id_front text,
  guarantor_id_back text,
  signature text,
  id_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_kyc TO authenticated;
GRANT ALL ON public.customer_kyc TO service_role;
ALTER TABLE public.customer_kyc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read kyc" ON public.customer_kyc FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read kyc files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kyc' AND public.is_staff(auth.uid()));