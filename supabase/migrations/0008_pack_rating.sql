-- What the reader thinks of a pack, in sigils.
--
-- The cloud star button on the shelf opens a row of five sigils beside it;
-- pressing the third fills three, and that number is this column. The owner's
-- 2026-09-22: "save the amount of sigils filled both to the users profile and
-- to the server as their accounts rating for the cigarette. on subsequent
-- visits or on reopening the menu the same amount of filled sigils should be
-- there for a returning user."
--
-- IT IS ONE STORE, NOT TWO. "To the profile and to the server" is the same
-- place said twice — the rating belongs to the account, which is what makes
-- it come back on another visit and on another device. Keeping a second copy
-- in the browser would be a second answer that can disagree with this one,
-- and the moment they disagree neither is the rating.
--
-- IT GOES ON THE SHELF ROW, not in a table of its own. A rating is one small
-- fact about the pair (reader, pack), and pack_favorites is already exactly
-- that pair with a unique key on it — the same row the bookmark and the
-- quantity live in. A separate table would be the same key, the same cascade
-- and one more join for one smallint. It also means rating something saves it
-- to the shelf, which is the behaviour `setPackQuantity` already has and for
-- the same reason: these controls sit beside one another, not behind one
-- another.
--
-- NULL IS "NOT RATED", and it is a real state rather than a row waiting to be
-- filled in — every pack on the shelf starts there, and the five sigils draw
-- it as five unfilled ones. It is deliberately NOT 0: nought sigils and no
-- opinion would then be the same answer, and the reader can only ever press a
-- sigil, so nought is not something they can say.
--
-- 1..5 IS ENFORCED HERE as well as in the UI, because the UI is not the only
-- way in: `setPackRatingAction` is a server action and a server action is a
-- public endpoint. A column that can hold 0 or 400 eventually holds 0 or 400.
--
-- This is the PACK shelf's rating and is not `reviews.rating`, which is 1-10
-- against a catalogue row (public.cigarettes, the 32 placeholder products).
-- See 0003_pack_favorites.sql for why the two shelves are separate tables.
alter table public.pack_favorites
  add column if not exists rating smallint;

alter table public.pack_favorites
  drop constraint if exists pack_favorites_rating_ck;

alter table public.pack_favorites
  add constraint pack_favorites_rating_ck check (
    rating is null or rating between 1 and 5
  );
