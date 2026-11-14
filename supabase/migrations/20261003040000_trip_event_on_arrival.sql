-- An automatic arrival changes status inside on_walk_update() during an
-- update that only sets the location, and "update of status" triggers only
-- fire when status is in the statement's SET list. Fire on any status change.

create or replace trigger trip_event after update on public.walks
  for each row when (old.status is distinct from new.status)
  execute function public.notify_trip_event();

create trigger trip_event_started after insert on public.walks
  for each row execute function public.notify_trip_event();
