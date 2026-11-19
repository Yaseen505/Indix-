-- =====================================================================
-- INDIX V3.2 — הקמת מסד הנתונים ב-Supabase
-- להריץ פעם אחת: Supabase → SQL Editor → New query → להדביק → Run
-- =====================================================================

-- 1) טבלת הנתונים: כל רשומה (פרויקט, משימה, דיווח...) היא שורה
create table if not exists public.indix_records (
  coll        text        not null,              -- סוג הרשומה: projects / tasks / reports ...
  id          bigint      not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  text                 default auth.email(),
  primary key (coll, id)
);
create index if not exists indix_records_users_email on public.indix_records ((lower(data->>'email'))) where coll = 'users';

-- 2) מספור רשומות משותף לכל המכשירים (כל מכשיר מקבל בלוק של 50 מספרים)
create sequence if not exists public.indix_seq start 10000 increment 50;

create or replace function public.indix_reserve_ids() returns bigint
language sql security definer set search_path = public as $$ select nextval('public.indix_seq') $$;

-- 3) התפקיד של המשתמש המחובר (לפי המייל שלו ברשימת המשתמשים של INDIX)
create or replace function public.indix_role() returns text
language sql stable security definer set search_path = public as $$
  select data->>'role' from public.indix_records
  where coll = 'users' and lower(data->>'email') = lower(auth.email())
    and coalesce((data->>'active')::boolean, true)
  limit 1 $$;

-- האם המערכת עדיין ריקה (להקמה ראשונה ע״י המנכ״ל)
create or replace function public.indix_empty() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.indix_records where coll = 'users') $$;

revoke all on function public.indix_reserve_ids() from public, anon;
grant execute on function public.indix_reserve_ids() to authenticated;
grant execute on function public.indix_role()  to authenticated;
grant execute on function public.indix_empty() to authenticated;

-- 4) הרשאות שורה (RLS): רק מי שרשום ופעיל ב-INDIX רואה נתונים.
--    רק מנכ״ל יכול לשנות את רשימת המשתמשים.
alter table public.indix_records enable row level security;

drop policy if exists indix_read   on public.indix_records;
drop policy if exists indix_insert on public.indix_records;
drop policy if exists indix_update on public.indix_records;
drop policy if exists indix_delete on public.indix_records;

create policy indix_read on public.indix_records for select to authenticated
  using (public.indix_role() is not null);

create policy indix_insert on public.indix_records for insert to authenticated
  with check (
    (public.indix_role() is not null and (coll <> 'users' or public.indix_role() = 'ceo'))
    or (coll = 'users' and public.indix_empty())
  );

create policy indix_update on public.indix_records for update to authenticated
  using      (public.indix_role() is not null and (coll <> 'users' or public.indix_role() = 'ceo'))
  with check (public.indix_role() is not null and (coll <> 'users' or public.indix_role() = 'ceo'));

create policy indix_delete on public.indix_records for delete to authenticated
  using (public.indix_role() is not null and (coll <> 'users' or public.indix_role() = 'ceo'));

-- 5) עדכונים בזמן אמת בין המכשירים
do $$ begin
  alter publication supabase_realtime add table public.indix_records;
exception when duplicate_object then null; end $$;

-- 6) אחסון תמונות, חתימות ומסמכים
insert into storage.buckets (id, name, public) values ('indix', 'indix', true)
on conflict (id) do nothing;

drop policy if exists indix_files_upload on storage.objects;
create policy indix_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'indix' and public.indix_role() is not null);
