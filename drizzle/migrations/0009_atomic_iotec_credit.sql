CREATE OR REPLACE FUNCTION public.apply_iotec_intent(p_external_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.payment_intents%ROWTYPE; d public.devices%ROWTYPE; n integer;
BEGIN
 SELECT * INTO i FROM public.payment_intents WHERE external_id=p_external_id FOR UPDATE;
 IF NOT FOUND OR i.status <> 'successful' OR i.applied THEN RETURN false; END IF;
 SELECT * INTO d FROM public.devices WHERE id=i.device_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Device not found'; END IF;
 IF i.amount <= 0 OR d.daily_rate <= 0 THEN RAISE EXCEPTION 'Invalid payment amount or daily rate'; END IF;
 n := floor(i.amount / d.daily_rate)::integer;
 INSERT INTO public.payments(device_id,amount,method,note,days_added,recorded_by) VALUES(d.id,i.amount,'iotec','iotec ' || i.external_id,n,i.initiated_by);
 UPDATE public.devices SET amount_paid=d.amount_paid+i.amount, paid_until=greatest(d.paid_until,now())+make_interval(days=>n),lock_override='auto' WHERE id=d.id;
 UPDATE public.payment_intents SET applied=true WHERE id=i.id;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.apply_iotec_intent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_iotec_intent(text) TO service_role;