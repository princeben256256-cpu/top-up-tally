
-- Restrict is_staff to explicit roles
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','agent'))
$function$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon;

-- devices: staff only reads
DROP POLICY IF EXISTS "staff read devices" ON public.devices;
CREATE POLICY "staff read devices" ON public.devices
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- payments: staff only reads, admin-only update/delete
DROP POLICY IF EXISTS "staff read payments" ON public.payments;
CREATE POLICY "staff read payments" ON public.payments
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff create payments" ON public.payments;
CREATE POLICY "staff create payments" ON public.payments
FOR INSERT TO authenticated WITH CHECK (auth.uid() = recorded_by AND public.is_staff(auth.uid()));

CREATE POLICY "admin update payments" ON public.payments
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete payments" ON public.payments
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles: self or staff
DROP POLICY IF EXISTS "staff read profiles" ON public.profiles;
CREATE POLICY "read own or staff profiles" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_staff(auth.uid()));
