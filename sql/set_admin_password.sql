-- ════════════════════════════════════════════════════════════════════
-- 관리자 비밀번호 정하기 / 바꾸기
-- (v3.0.0_delete_password.sql 을 먼저 실행한 뒤에)
--
-- ⚠ 이 저장소는 공개입니다. 실제 비밀번호를 적은 채로 GitHub에 올리지 마세요.
--   Supabase SQL Editor 에 붙여 넣은 다음, 거기에서만 아래 한 줄을 고쳐 Run 합니다.
--
-- 관리자 비밀번호로는 모든 계획을 지울 수 있습니다
-- (비밀번호를 잊은 계획, v3.0.0 전에 만들어 비밀번호가 없는 계획 포함).
-- ════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

do $$
declare
  v_pw text := '여기에_관리자_비밀번호';      -- ← 이 줄만 고칩니다 (8자 이상)
begin
  if v_pw = '여기에_관리자_비밀번호' then
    raise exception '비밀번호를 고치지 않았습니다. v_pw 값을 바꾼 뒤 다시 실행하세요.';
  end if;
  if length(v_pw) < 8 then
    raise exception '관리자 비밀번호는 8자 이상으로 정하세요.';
  end if;
  insert into public.inspection_admin (id, pw_hash)
  values (1, crypt(v_pw, gen_salt('bf')))
  on conflict (id) do update set pw_hash = excluded.pw_hash, updated_at = now();
  raise notice '관리자 비밀번호를 저장했습니다.';
end $$;
