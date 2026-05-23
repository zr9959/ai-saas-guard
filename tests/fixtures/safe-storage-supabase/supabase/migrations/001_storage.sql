insert into storage.buckets (id, name, public)
values ('tenant-files', 'tenant-files', false);

create policy "users read own tenant files"
on storage.objects
for select
using (
  bucket_id = 'tenant-files'
  and owner = auth.uid()
);

create policy "users upload own tenant files"
on storage.objects
for insert
with check (
  bucket_id = 'tenant-files'
  and owner = auth.uid()
);
