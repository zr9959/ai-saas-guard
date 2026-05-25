create table public.projects (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null
);

alter table public.projects enable row level security;

create policy "ai generated broad select"
on public.projects
for select
using (true);
