insert into storage.buckets (id, name, public)
values ('tenant-files', 'tenant-files', false);

create policy "anyone can read tenant files"
on storage.objects
for select
using (bucket_id = 'tenant-files' and true);

create policy "authenticated users can upload tenant files anywhere"
on storage.objects
for insert
with check (bucket_id = 'tenant-files' and true);
