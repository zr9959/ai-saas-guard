create table public.organizations (
  id uuid primary key,
  owner_id uuid not null,
  name text not null
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null,
  role text not null,
  primary key (organization_id, user_id)
);

create table public.projects (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  name text not null
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;

create policy "owners manage organizations"
on public.organizations
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "members read memberships"
on public.organization_members
for select
using (auth.uid() = user_id);

create policy "members read projects"
on public.projects
for select
using (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = projects.organization_id
      and memberships.user_id = auth.uid()
  )
);

create policy "members insert projects"
on public.projects
for insert
with check (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = projects.organization_id
      and memberships.user_id = auth.uid()
  )
);
