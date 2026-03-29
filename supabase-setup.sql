-- =====================================================
-- 360度评价管理系统 - 数据库初始化脚本
-- 360-Degree Evaluation System - Database Setup
-- =====================================================
-- 使用方法：
-- 1. 登录 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 复制粘贴此脚本
-- 4. 点击 Run 执行
-- =====================================================

-- 1. 创建 profiles 表（用户表）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  role text not null check (role in ('admin', 'leader', 'employee')),
  department text,
  password_hash text,
  permissions jsonb default '{"viewSelf": true, "viewPeer": false, "viewLeader": false, "viewSummary": false}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 创建 dimensions 表（评价维度/能力项）
create table if not exists public.dimensions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- 3. 创建 questions 表（题目表）
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  dimension_id uuid references public.dimensions(id) on delete cascade,
  type text not null check (type in ('self', 'peer', 'leader')),
  content text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- 4. 创建 evaluation_tasks 表（评价任务表）
create table if not exists public.evaluation_tasks (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references public.profiles(id) on delete cascade,
  reviewer_user_id uuid references public.profiles(id) on delete cascade,
  eval_type text not null check (eval_type in ('self', 'peer', 'leader')),
  year integer not null,
  quarter integer not null check (quarter between 1 and 4),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  snapshot_data jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- 5. 创建 answers 表（答案表）
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.evaluation_tasks(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  score numeric(5,2),
  comment text,
  created_at timestamptz default now()
);

-- 6. 创建 weight_config 表（权重配置表）
create table if not exists public.weight_config (
  id integer primary key default 1 check (id = 1),
  self_weight numeric(5,2) default 0.20,
  peer_weight numeric(5,2) default 0.30,
  leader_weight numeric(5,2) default 0.50,
  updated_at timestamptz default now()
);

-- 7. 创建 current_period 表（当前周期表）
create table if not exists public.current_period (
  id integer primary key default 1 check (id = 1),
  year integer not null default 2026,
  quarter integer not null default 1 check (quarter between 1 and 4),
  updated_at timestamptz default now()
);

-- =====================================================
-- 索引
-- =====================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_questions_type on public.questions(type);
create index if not exists idx_questions_dimension on public.questions(dimension_id);
create index if not exists idx_tasks_target on public.evaluation_tasks(target_user_id);
create index if not exists idx_tasks_reviewer on public.evaluation_tasks(reviewer_user_id);
create index if not exists idx_tasks_type on public.evaluation_tasks(eval_type);
create index if not exists idx_tasks_year_quarter on public.evaluation_tasks(year, quarter);
create index if not exists idx_tasks_status on public.evaluation_tasks(status);
create index if not exists idx_answers_task on public.answers(task_id);
create index if not exists idx_answers_user on public.answers(user_id);

-- =====================================================
-- Row Level Security (RLS) - 行级安全策略
-- =====================================================

-- 启用 RLS
alter table public.profiles enable row level security;
alter table public.dimensions enable row level security;
alter table public.questions enable row level security;
alter table public.evaluation_tasks enable row level security;
alter table public.answers enable row level security;
alter table public.weight_config enable row level security;
alter table public.current_period enable row level security;

-- profiles 策略
create policy "Allow read for authenticated users" on public.profiles
  for select to authenticated using (true);

create policy "Allow update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- dimensions 策略
create policy "Allow read dimensions" on public.dimensions
  for select to authenticated using (true);

create policy "Allow admin manage dimensions" on public.dimensions
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- questions 策略
create policy "Allow read questions" on public.questions
  for select to authenticated using (true);

create policy "Allow admin manage questions" on public.questions
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- evaluation_tasks 策略
create policy "Users can view own tasks" on public.evaluation_tasks
  for select to authenticated using (
    target_user_id = auth.uid() OR reviewer_user_id = auth.uid()
  );

create policy "Admins can view all tasks" on public.evaluation_tasks
  for select to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can create tasks" on public.evaluation_tasks
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update tasks" on public.evaluation_tasks
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- answers 策略
create policy "Users can view own answers" on public.answers
  for select to authenticated using (user_id = auth.uid());

create policy "Users can insert own answers" on public.answers
  for insert to authenticated with check (user_id = auth.uid());

create policy "Users can update own answers" on public.answers
  for update to authenticated using (user_id = auth.uid());

-- weight_config 策略
create policy "Allow read weight_config" on public.weight_config
  for select to authenticated using (true);

create policy "Allow admin manage weight_config" on public.weight_config
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- current_period 策略
create policy "Allow read current_period" on public.current_period
  for select to authenticated using (true);

create policy "Allow admin manage current_period" on public.current_period
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- =====================================================
-- 初始化数据
-- =====================================================

-- 插入默认权重
insert into public.weight_config (id, self_weight, peer_weight, leader_weight)
values (1, 0.20, 0.30, 0.50)
on conflict (id) do nothing;

-- 插入默认周期
insert into public.current_period (id, year, quarter)
values (1, 2026, 1)
on conflict (id) do nothing;

-- =====================================================
-- 说明
-- =====================================================
-- 创建管理员账号后，管理员可以通过系统界面管理维度、题目、权重等
-- 默认管理员: admin / admin123 (需要在系统管理页面创建)
