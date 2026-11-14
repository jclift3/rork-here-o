-- Every push the server sends, kept per person so the app can show what they
-- were told, and with Expo's answers so we can see whether Apple or Google
-- took it. Only the edge functions (service role) write here.
--
-- accepted: Expo's ticket at send time. delivered: Expo's receipt a little
-- later, which says whether Apple or Google accepted it. Null means not known
-- yet. error holds Expo's reason when either is false.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  ticket_id text,
  accepted boolean,
  delivered boolean,
  error text,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
-- Tickets still waiting for a receipt.
create index notifications_receipt_idx on public.notifications (created_at)
  where ticket_id is not null and delivered is null;

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
