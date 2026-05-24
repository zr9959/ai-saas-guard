create table public.projects (
  id uuid primary key,
  owner_id uuid not null,
  name text not null
);

alter table public.projects enable row level security;

create table public.invoices (
  id uuid primary key,
  user_id uuid not null,
  amount integer not null
);

alter table public.invoices enable row level security;

create policy "users read invoices"
on public.invoices
for select
using (auth.uid() = user_id);

create table public.documents (
  id uuid primary key,
  user_id uuid not null,
  title text not null
);

alter table public.documents enable row level security;

create policy "public upload documents"
on public.documents
for insert
to public
with check (auth.uid() = user_id);

create table public.profiles (
  id uuid primary key,
  email text not null,
  display_name text
);

alter table public.profiles enable row level security;

create policy "users read profile by email"
on public.profiles
for select
using (auth.uid() = email);

create table public.workspace_projects (
  id uuid primary key,
  workspace_id uuid not null,
  user_id uuid not null,
  name text not null
);

alter table public.workspace_projects enable row level security;

create policy "users read workspace projects"
on public.workspace_projects
for select
using (auth.uid() = user_id);
