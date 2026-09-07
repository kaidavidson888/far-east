-- Ratings are entirely reader-driven, so the editorial scoring apparatus is gone:
-- the Far East score, the five sub-scores, the "tested N days" stamp and the
-- seal-of-approval flag. The written verdict and pros/cons stay as commentary.
--
-- The source values remain in lib/catalog.json if this ever needs reversing.
alter table public.cigarettes drop column if exists score;
alter table public.cigarettes drop column if exists criteria;
alter table public.cigarettes drop column if exists tested;
alter table public.cigarettes drop column if exists award;
