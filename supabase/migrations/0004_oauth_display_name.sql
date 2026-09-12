-- The profile trigger learns the names an OAuth provider actually sends.
--
-- handle_new_user read raw_user_meta_data ->> 'display_name', which is a field
-- WE invent: registerAction and splashAuthAction pass it in the sign-up
-- metadata. Google does not send it. It sends `full_name` and `name` (and
-- `avatar_url`, `picture`, `email`, `email_verified`), so every reader arriving
-- through Google would have been named after the local part of their email —
-- "mr.kaidavidson" — on every review and every shelf they ever wrote. The
-- trigger fires once, at insert, so this is not something you can fix later
-- without going back over the rows by hand.
--
-- The order is deliberate: our own field first, so nothing that works today
-- changes, then the two Google sends, then the old email fallback.
--
-- THE LAST THREE ARE THE ONES THAT MAKE IT SAFE. profiles.display_name is NOT
-- NULL, and split_part(NULL, '@', 1) is NULL, so a sign-up with no email — a
-- phone sign-up, which is what the splash does — used to fail the insert and
-- take the whole sign-up down with it. splashAuthAction works around that by
-- always passing display_name. It no longer has to: the phone number, and then
-- a plain word, stand behind it. Leaving that caller as it is, since passing a
-- real value is still better than falling back.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      nullif(new.phone, ''),
      'Reader'
    )
  );
  return new;
end;
$$;
