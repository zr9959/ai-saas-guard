create table public.organization_members (
  organization_id uuid not null,
  user_id uuid not null,
  role text not null,
  primary key (organization_id, user_id)
);

create table public.invoices (
  id uuid primary key,
  organization_id uuid not null,
  user_id uuid not null,
  amount integer not null
);

alter table public.organization_members enable row level security;
alter table public.invoices enable row level security;

create policy "members read memberships"
on public.organization_members
for select
using (auth.uid() = user_id);

create policy "members read invoices"
on public.invoices
for select
using (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = invoices.organization_id
      and memberships.user_id = auth.uid()
  )
);

create policy "members insert invoices"
on public.invoices
for insert
with check (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = invoices.organization_id
      and memberships.user_id = auth.uid()
  )
);

create policy "members update invoices"
on public.invoices
for update
using (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = invoices.organization_id
      and memberships.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = invoices.organization_id
      and memberships.user_id = auth.uid()
  )
);
