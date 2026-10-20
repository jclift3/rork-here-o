-- Password sign-up runs through the sign-up function, which needs to know
-- whether an email already has an account. Service role only.

create function public.auth_user_by_email(p_email text)
returns table (id uuid, confirmed boolean, has_signed_in boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email_confirmed_at is not null, u.last_sign_in_at is not null
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke execute on function public.auth_user_by_email(text) from public, anon, authenticated;
