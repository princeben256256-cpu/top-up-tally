CREATE TABLE public.device_reset_reports (
 device_id uuid PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
 state text NOT NULL,
 revision text NOT NULL,
 android_sdk integer NOT NULL,
 device_owner boolean NOT NULL,
 settings_reset_blocked boolean NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.device_reset_reports TO authenticated;
GRANT ALL ON public.device_reset_reports TO service_role;
ALTER TABLE public.device_reset_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read reset reports" ON public.device_reset_reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
COMMENT ON TABLE public.device_reset_reports IS 'Device-reported policy readback only; not proof of post-reset Gmail enforcement.';