create policy "anyone can read avatars"
on public.storage.objects
for select
using (bucket_id = 'avatars');
