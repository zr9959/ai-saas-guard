create table public.projects (
  id uuid primary key,
  user_id uuid not null,
  name text
);

alter table public.projects enable row level security;

create policy "users read own projects"
on public.projects
for select
using (auth.uid() = user_id);

create policy "users write own projects"
on public.projects
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
