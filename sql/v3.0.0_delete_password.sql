-- ════════════════════════════════════════════════════════════════════
-- 현장 확인 점검 Map (field-check) v3.0.0 — 계획 삭제 비밀번호
-- Supabase → SQL Editor 에 전체를 붙여 넣고 Run (한 번만. 다시 실행해도 안전)
--
-- 하는 일
--   1) 비밀번호 보관 표 2개 (암호화된 값만 저장 · 앱에서는 읽을 수 없음)
--   2) 계획 만들기 / 비밀번호 확인 / 계획 삭제 함수
--   3) inspections 표를 직접 삭제하는 권한 닫기 (삭제는 함수로만)
--
-- 이 파일에는 비밀번호가 없습니다. 관리자 비밀번호는 set_admin_password.sql 로 따로 정합니다.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- 1) 비밀번호 보관 표 ─────────────────────────────────────────────
-- 계획별 삭제 비밀번호 (bcrypt로 암호화한 값)
create table if not exists public.inspection_secrets (
  inspection_id text primary key,          -- inspections.id 를 글자로 바꾼 값
  pw_hash       text not null,
  created_at    timestamptz not null default now()
);
-- 관리자 비밀번호 (한 줄만)
create table if not exists public.inspection_admin (
  id         int primary key check (id = 1),
  pw_hash    text not null,
  updated_at timestamptz not null default now()
);
-- 앱(anon 키)에서는 읽기·쓰기 모두 불가. 아래 함수만 접근
alter table public.inspection_secrets enable row level security;
alter table public.inspection_admin   enable row level security;
revoke all on table public.inspection_secrets from anon, authenticated;
revoke all on table public.inspection_admin   from anon, authenticated;

-- 2) 함수 ─────────────────────────────────────────────────────────
-- (내부용) 비밀번호가 맞는지: 계획 비밀번호 또는 관리자 비밀번호
create or replace function public._inspection_pw_ok(p_id text, p_password text)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
declare h text;
begin
  if p_password is null or p_password = '' then return false; end if;
  select pw_hash into h from public.inspection_secrets where inspection_id = p_id;
  if h is not null and crypt(p_password, h) = h then return true; end if;
  select pw_hash into h from public.inspection_admin where id = 1;
  if h is not null and crypt(p_password, h) = h then return true; end if;
  return false;
end $$;
revoke all on function public._inspection_pw_ok(text, text) from public, anon, authenticated;

-- 계획 만들기 (삭제 비밀번호와 함께)
create or replace function public.inspection_create(
  p_name text, p_description text, p_expire_at timestamptz, p_password text)
returns public.inspections
language plpgsql security definer
set search_path = public, extensions
as $$
declare r public.inspections;
begin
  if coalesce(btrim(p_name), '') = '' then
    raise exception '계획 이름이 없습니다';
  end if;
  if p_password is null or length(p_password) < 4 then
    raise exception '삭제 비밀번호는 4자 이상이어야 합니다';
  end if;
  insert into public.inspections (name, description, expire_at)
  values (btrim(p_name), p_description, p_expire_at)
  returning * into r;
  insert into public.inspection_secrets (inspection_id, pw_hash)
  values (r.id::text, crypt(p_password, gen_salt('bf')));
  return r;
end $$;

-- 비밀번호 확인만 (사진·파일을 지우기 전에 먼저 확인하는 용도)
create or replace function public.inspection_check_delete_pw(p_id text, p_password text)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if public._inspection_pw_ok(p_id, p_password) then return true; end if;
  perform pg_sleep(0.5);   -- 틀리면 잠깐 기다림 (마구 넣어 보기 방지)
  return false;
end $$;

-- 계획 삭제 (비밀번호가 맞을 때만. 딸린 기록까지 한 번에)
create or replace function public.inspection_delete(p_id text, p_password text)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public._inspection_pw_ok(p_id, p_password) then
    perform pg_sleep(0.5);
    return false;
  end if;
  delete from public.inspection_photos where inspection_id::text = p_id;
  delete from public.inspection_memo   where inspection_id::text = p_id;
  delete from public.inspection_done   where inspection_id::text = p_id;
  delete from public.inspection_items  where inspection_id::text = p_id;
  delete from public.inspections       where id::text = p_id;
  delete from public.inspection_secrets where inspection_id = p_id;
  return true;
end $$;

grant execute on function public.inspection_create(text, text, timestamptz, text) to anon, authenticated;
grant execute on function public.inspection_check_delete_pw(text, text)          to anon, authenticated;
grant execute on function public.inspection_delete(text, text)                   to anon, authenticated;

-- 3) 계획 표 직접 삭제 막기 ───────────────────────────────────────
revoke delete on table public.inspections from anon, authenticated;

-- 함수 목록을 API가 바로 알아차리게 함
notify pgrst, 'reload schema';
