create table public.organization_members (
  organization_id uuid not null,
  user_id uuid not null,
  role text not null,
  primary key (organization_id, user_id)
);

create table public.projects (
  id uuid primary key,
  organization_id uuid not null,
  name text not null
);

create table public.documents (
  id uuid primary key,
  organization_id uuid not null,
  title text not null
);

alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;

create policy "members read memberships"
on public.organization_members
for select
using (auth.uid() = user_id);

create policy "members update projects"
on public.projects
for update
using (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = projects.organization_id
      and memberships.user_id = auth.uid()
  )
)
with check (true);

create policy "members insert documents"
on public.documents
for insert
with check (organization_id is not null);
