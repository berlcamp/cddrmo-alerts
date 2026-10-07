-- Harden claim_staff_account: the JWT email alone is not proof of Google ownership. An email-primary
-- account with ANY linked Google identity could claim a staff row. Now the caller must own a Google
-- identity whose own email matches the staff email (case-insensitive).
create or replace function cdrrmo.claim_staff_account() returns setof cdrrmo.users
language sql volatile security definer set search_path = '' as $$
  with c as (
    select
      (select auth.uid()) as uid,
      lower(coalesce((select auth.jwt()) ->> 'email', '')) as email,
      coalesce((select auth.jwt()) -> 'app_metadata', '{}'::jsonb) as app
  )
  update cdrrmo.users u
     set auth_user_id = c.uid, last_sign_in_at = now()
    from c
   where c.uid is not null
     and c.email <> ''
     and (c.app ->> 'provider' = 'google' or coalesce(c.app -> 'providers', '[]'::jsonb) ? 'google')
     and exists (
       select 1 from auth.identities i
        where i.user_id = c.uid
          and i.provider = 'google'
          and lower(i.identity_data ->> 'email') = c.email
     )
     and u.email = c.email
     and u.is_active
     and (u.auth_user_id is null or u.auth_user_id = c.uid)
  returning u.*
$$;
