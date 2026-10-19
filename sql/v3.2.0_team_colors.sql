-- ════════════════════════════════════════════════════════════════════
-- 현장 확인 점검 Map (field-check) v3.2.0 — 팀 색 지정
-- Supabase → SQL Editor 에 붙여 넣고 Run (한 번만. 다시 실행해도 안전)
--
-- 계획(inspections)마다 팀 이름 → 색('#rrggbb')을 저장할 칸을 하나 만듭니다.
-- 예: {"1팀": "#2563eb", "2팀": "#dc2626"}
-- 비어 있으면({}) 앱이 팀 순서대로 자동 색을 붙입니다.
-- ════════════════════════════════════════════════════════════════════

alter table public.inspections
  add column if not exists group_colors jsonb not null default '{}'::jsonb;

-- 함수 목록·칸 목록을 API가 바로 알아차리게 함
notify pgrst, 'reload schema';
