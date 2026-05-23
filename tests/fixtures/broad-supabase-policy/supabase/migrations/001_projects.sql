create table public.projects (
  id uuid primary key,
  user_id uuid,
  name text
);

alter table public.projects enable row level security;

create policy "public projects"
on public.projects
for select
using (true);

create table public.subscriptions (
  id uuid primary key,
  user_id uuid,
  stripe_customer_id text
);
