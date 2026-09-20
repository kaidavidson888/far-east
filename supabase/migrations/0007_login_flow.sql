-- THE LOGIN BOX IS A SEQUENCE NOW, AND THE SERVER HAS TO REMEMBER WHERE IT IS.
--
-- The owner's 2026-09-20 rebuild asks for one row that alternates through
-- PHONE # -> VERIFICATION CODE -> (EMAIL -> VERIFICATION CODE) -> PASSWORD,
-- with a code that may be resent up to three times, and a third failure of a
-- section that "kick[s] the user out of all login processes and fully block[s]
-- them from accessing the site for 30 minutes".
--
-- None of that can live in the browser. A counter the reader can reset by
-- reloading is not a limit, and a lockout a reader can lift by clearing a
-- cookie is not a lockout. So there are two tables.
--
-- WHY NOT `auth.users` METADATA. The flow runs before anyone is signed in —
-- that is the whole point of it — so there is no user row to hang it on for
-- most of its life. And writing half-finished sign-ups into the auth schema
-- would leave a trail of abandoned accounts behind every reader who thought
-- better of it.

-- ---------------------------------------------------------------------------
-- WHERE ONE READER HAS GOT TO.
--
-- `token` is a random string the server mints and puts in an httpOnly cookie;
-- it IS the secret, so nothing here has to be signed and no new app secret has
-- to be invented. A row is the whole of a login attempt's state: nothing about
-- where the reader is comes from the browser except this handle.
--
-- The password is NEVER here, and nor is a code. Supabase Auth holds the one
-- and issues and checks the other; this table records only that a step was
-- passed. A verification code written into an application table would be a
-- password in an application table by another name.
create table if not exists public.login_attempts (
  token       text        primary key,
  -- E.164, as lib/phone.ts normalises it. Null until the first step is passed.
  phone       text,
  email       text,
  -- which of the five the row is standing on
  stage       text        not null default 'phone',
  phone_ok    boolean     not null default false,
  email_ok    boolean     not null default false,
  -- whether this phone already had an account when the flow started, which is
  -- what decides whether EMAIL is asked for at all
  returning_user boolean  not null default false,
  -- failures of the section the row is standing on, reset when it moves on.
  -- Three is the owner's number and the third one blocks.
  fails       smallint    not null default 0,
  -- codes sent for the current section: "resend the code up to 3 times"
  sends       smallint    not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 minutes',
  constraint login_attempts_stage_ck check (
    stage in ('phone', 'phoneCode', 'email', 'emailCode', 'password', 'done')
  ),
  constraint login_attempts_fails_ck check (fails >= 0 and fails <= 3),
  constraint login_attempts_sends_ck check (sends >= 0 and sends <= 4)
);

create index if not exists login_attempts_expires_idx on public.login_attempts (expires_at);
create index if not exists login_attempts_phone_idx on public.login_attempts (phone);

-- ---------------------------------------------------------------------------
-- WHO IS SHUT OUT, AND UNTIL WHEN.
--
-- KEYED TWO WAYS, ON PURPOSE. The owner's ask is that the reader is blocked
-- from the site, which means the BROWSER has to be turned away — so one row is
-- keyed on the attempt's own token, which is the cookie the browser is
-- carrying. But a cookie can be cleared in two clicks, and the thing actually
-- being defended is a verification code, so a second row is keyed on the PHONE
-- NUMBER (or address) the codes were going to. Clearing cookies gets a reader
-- a fresh browser and the same locked-out phone number.
--
-- It is not keyed on IP. A phone on a carrier NAT shares its address with a
-- town, so an IP block here would turn away people who had done nothing; and
-- it is the easiest of the three to change.
create table if not exists public.login_blocks (
  -- 'tok:<attempt token>' or 'ph:<E.164>' or 'em:<address>'
  key         text        primary key,
  until       timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists login_blocks_until_idx on public.login_blocks (until);

-- ---------------------------------------------------------------------------
-- RLS ON, NO POLICY — the default-deny this project applies to every table.
-- Supabase exposes public tables through PostgREST with the browser-visible
-- key; the app connects as the owner and bypasses RLS, so these are reachable
-- from the server and from nowhere else. A login state machine readable with
-- the anon key would hand every attempt's stage to anyone who asked.
alter table public.login_attempts enable row level security;
alter table public.login_blocks   enable row level security;

-- ---------------------------------------------------------------------------
-- Housekeeping. Both tables are pure scratch: every row has a moment after
-- which it means nothing. Nothing schedules this — it is called from the read
-- path, which is the cheapest place to put it and runs often enough.
create or replace function public.sweep_login_state() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where expires_at < now();
  delete from public.login_blocks   where until      < now();
$$;
