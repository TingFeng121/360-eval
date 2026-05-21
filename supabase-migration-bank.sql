-- =====================================================
-- 迁移脚本：多题库管理功能
-- 在 Supabase SQL Editor 中执行
-- =====================================================

-- 1. 创建 question_banks 表
create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- 2. 插入默认题库
insert into public.question_banks (name, description)
values ('标准360评价题库', '常规季度360度评价使用的标准题库')
on conflict do nothing;

-- 3. questions 表增加 bank_id 字段
alter table public.questions add column if not exists bank_id uuid references public.question_banks(id) on delete set null;

-- 4. evaluation_tasks 表增加 bank_id 字段
alter table public.evaluation_tasks add column if not exists bank_id uuid references public.question_banks(id) on delete set null;

-- 5. 将现有题目关联到默认题库
update public.questions
set bank_id = (select id from public.question_banks limit 1)
where bank_id is null;

-- 6. 将现有任务关联到默认题库
update public.evaluation_tasks
set bank_id = (select id from public.question_banks limit 1)
where bank_id is null;

-- 7. RLS 策略
alter table public.question_banks enable row level security;

create policy "Allow read question_banks" on public.question_banks
  for select to authenticated using (true);

create policy "Allow admin manage question_banks" on public.question_banks
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 8. 索引
create index if not exists idx_questions_bank on public.questions(bank_id);
create index if not exists idx_tasks_bank on public.evaluation_tasks(bank_id);
