-- How much of a pack is on the shelf, and in what unit.
--
-- The plus button on a cigarette's own page opens a two-wheel selector: a
-- number 1-9 on the left, and C or P on the right. C is a Carton, P is a Pack.
-- Those two answers land here, beside the bookmark that is already saving the
-- cigarette itself.
--
-- BOTH COLUMNS ARE NULLABLE, and they are nullable together. A shelf entry
-- made by the bookmark alone has no quantity — it is "I like this", not "I
-- have three cartons of this" — and that is a real state the page has to be
-- able to draw, not a row waiting to be filled in. The check constraint says
-- exactly that: either both are set or neither is, never one.
--
-- `amount` is 1-9 because the wheel only offers those. It is constrained here
-- as well as in the UI because the UI is not the only way in: a server action
-- is a public endpoint, and a column that can hold 0 or 400 would eventually
-- hold 0 or 400.
--
-- `unit` is a single character rather than an enum: 'C' and 'P' are what the
-- wheel shows and what the shelf page prints (lowercased, beside the number),
-- so storing the letter keeps the one representation end to end. An enum would
-- add a type to migrate every time the owner adds a unit.
alter table public.pack_favorites
  add column if not exists amount smallint,
  add column if not exists unit   char(1);

alter table public.pack_favorites
  drop constraint if exists pack_favorites_quantity_ck;

alter table public.pack_favorites
  add constraint pack_favorites_quantity_ck check (
    (amount is null and unit is null)
    or (amount between 1 and 9 and unit in ('C', 'P'))
  );
