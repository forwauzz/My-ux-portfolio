-- Strategic Focus: one row per user with current week, course, and focus
create table if not exists public.strategic_focus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_week text not null default '',
  current_course text not null default '',
  weekly_focus text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.strategic_focus enable row level security;
create policy "strategic_focus_select_own" on public.strategic_focus for select using (auth.uid() = user_id);
create policy "strategic_focus_insert_own" on public.strategic_focus for insert with check (auth.uid() = user_id);
create policy "strategic_focus_update_own" on public.strategic_focus for update using (auth.uid() = user_id);
create policy "strategic_focus_delete_own" on public.strategic_focus for delete using (auth.uid() = user_id);

-- Progress Items: course completion, artifacts, research sessions per user
create table if not exists public.progress_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  value integer not null default 0 check (value >= 0 and value <= 100),
  sort_order integer not null default 0,
  unique(user_id, label)
);

alter table public.progress_items enable row level security;
create policy "progress_items_select_own" on public.progress_items for select using (auth.uid() = user_id);
create policy "progress_items_insert_own" on public.progress_items for insert with check (auth.uid() = user_id);
create policy "progress_items_update_own" on public.progress_items for update using (auth.uid() = user_id);
create policy "progress_items_delete_own" on public.progress_items for delete using (auth.uid() = user_id);

-- Daily Logs
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  hours numeric(4,1) not null default 0,
  learned text not null default '',
  built text not null default '',
  insight text not null default '',
  blockers text not null default '',
  next_action text not null default '',
  created_at timestamptz not null default now()
);

alter table public.daily_logs enable row level security;
create policy "daily_logs_select_own" on public.daily_logs for select using (auth.uid() = user_id);
create policy "daily_logs_insert_own" on public.daily_logs for insert with check (auth.uid() = user_id);
create policy "daily_logs_update_own" on public.daily_logs for update using (auth.uid() = user_id);
create policy "daily_logs_delete_own" on public.daily_logs for delete using (auth.uid() = user_id);

-- Sprints
create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hypothesis text not null,
  test_method text not null default '',
  status text not null default 'Not Started' check (status in ('Not Started','Testing','Iterating','Validated')),
  decision text not null default '' check (decision in ('','Ship','Iterate','Kill','Escalate')),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sprints enable row level security;
create policy "sprints_select_own" on public.sprints for select using (auth.uid() = user_id);
create policy "sprints_insert_own" on public.sprints for insert with check (auth.uid() = user_id);
create policy "sprints_update_own" on public.sprints for update using (auth.uid() = user_id);
create policy "sprints_delete_own" on public.sprints for delete using (auth.uid() = user_id);

-- Vault Entries
create table if not exists public.vault_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('Research','Wireframes','Design System','Insights','Interviews','Notes','Case Study')),
  linked_course text not null default '',
  date date not null default current_date,
  url text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.vault_entries enable row level security;
create policy "vault_entries_select_own" on public.vault_entries for select using (auth.uid() = user_id);
create policy "vault_entries_insert_own" on public.vault_entries for insert with check (auth.uid() = user_id);
create policy "vault_entries_update_own" on public.vault_entries for update using (auth.uid() = user_id);
create policy "vault_entries_delete_own" on public.vault_entries for delete using (auth.uid() = user_id);
