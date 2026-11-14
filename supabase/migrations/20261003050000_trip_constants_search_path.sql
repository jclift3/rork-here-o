-- Pin the search path of the trip constants (Supabase advisor).
alter function public.trip_arrival_radius_m() set search_path = '';
alter function public.guardian_alert_grace() set search_path = '';
