create table public.accounts (
  id uuid primary key,
  user_id uuid not null
);

alter table accounts enable row level security;

create policy "users read own accounts"
on accounts
for select
using (auth.uid() = user_id);
