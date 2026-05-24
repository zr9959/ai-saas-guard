create table public.accounts (
  id uuid primary key,
  tenant_id uuid not null,
  user_id uuid not null,
  plan text not null
);

alter table public.accounts enable row level security;

create policy "public read accounts"
on public.accounts
for select
to public
using (true);
