CREATE TABLE public.device_sim_policies (
 device_id uuid PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 expected_hash text,
 revision uuid NOT NULL DEFAULT gen_random_uuid(),
 reported_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
 reported_state text,
 reported_revision uuid,
 reported_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sim_expected_hash CHECK (expected_hash IS NULL OR expected_hash ~ '^[a-f0-9]{64}$'),
 CONSTRAINT sim_enabled_binding CHECK (NOT enabled OR expected_hash IS NOT NULL),
 CONSTRAINT sim_report_state CHECK (reported_state IS NULL OR reported_state IN ('off','matched','missing','unreadable','not_owner'))
);
GRANT SELECT ON public.device_sim_policies TO authenticated;
GRANT ALL ON public.device_sim_policies TO service_role;
ALTER TABLE public.device_sim_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read SIM policies" ON public.device_sim_policies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
COMMENT ON TABLE public.device_sim_policies IS 'Admin-approved hashed physical SIM binding; device observations authenticated with enrollment secret. No customer writes or raw SIM serials.';