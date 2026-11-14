-- The app creates a help request with insert ... returning (supabase-js
-- .insert().select()), so the new row must pass the select policy too. That
-- policy only called is_incident_participant(), which looks the id up in
-- incidents and can't see a row the same statement is inserting, so every
-- request from the app failed with an RLS error. Her own requests are now
-- visible to her directly.
alter policy incidents_select on public.incidents
  using (requester_id = (select auth.uid()) or public.is_incident_participant(id));
