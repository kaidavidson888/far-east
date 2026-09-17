-- How many share links this reader has made that were worth $100 or more.
--
-- The owner's ask (2026-09-17): a number in the outline beside the sigil on
-- the landing page, which "increases by 1 with every share link created worth
-- 100$ or more". This is that number's home.
--
-- WHAT "WORTH" MEANS HERE, and why it is computable at all. A share is a
-- frozen copy of the CATALOGUE shelf — `share_items` references
-- `public.cigarettes`, not the pack shelf — and every catalogue product
-- carries `price_usd` (not null, seeded from lib/catalog.json). So a share's
-- worth is the sum of the prices of the products frozen into it, and nothing
-- had to be invented to get it. There is no quantity on that shelf: a
-- favourite is "I like this", one of each, so the sum is a straight one.
--
-- IT IS COUNTED WHERE THE SHARE IS MADE, IN THE SAME TRANSACTION
-- (`createShare` in lib/db.ts). The alternative — counting the qualifying
-- shares on demand — cannot work: a share's worth is the worth it had WHEN IT
-- WAS FROZEN, and `share_items` keeps the products but the catalogue's prices
-- can change underneath them. Counting at the moment of freezing is the only
-- reading that stays true, and it is why this is a stored number rather than a
-- query.
--
-- NOT NULL DEFAULT 0, so every existing reader starts at nothing and the page
-- never has to draw an absence. A signed-out reader has no row at all and the
-- page shows 0 — see lib/landing.ts.
--
-- It only ever goes up, and it counts CREATIONS rather than live links. One
-- link can be revoked and another made — the site allows exactly one live link
-- at a time — and that counts twice, because two were created. That is what
-- the ask says, and it is worth knowing it means a reader with a $100 shelf
-- can raise the number by regenerating their link.
alter table public.profiles
  add column if not exists big_shares integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_big_shares_ck;

-- A count is never negative. Constrained here as well as in the code, because
-- the code is not the only way in.
alter table public.profiles
  add constraint profiles_big_shares_ck check (big_shares >= 0);
