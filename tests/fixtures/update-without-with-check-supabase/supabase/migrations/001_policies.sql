create table public.accounts (
  id uuid primary key,
  user_id uuid not null
);

create table public.projects (
  id uuid primary key,
  user_id uuid not null
);

alter table public.accounts enable row level security;
alter table public.projects enable row level security;

create policy "users read own accounts"
on public.accounts
for select
using (auth.uid() = user_id);

create policy "users update own accounts"
on public.accounts
for update
using (auth.uid() = user_id);

create policy "users read own projects"
on public.projects
for select
using (auth.uid() = user_id);

create policy "users update own projects"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
