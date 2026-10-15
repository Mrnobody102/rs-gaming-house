-- Supabase-only services; local preview uses polling and filesystem uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('question-media','question-media',true,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Question illustrations are public assets. Answers remain in protected database rows.
create function public.is_app_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.app_admins where user_id=auth.uid())
$$;
revoke execute on function public.is_app_admin() from public,anon;
grant execute on function public.is_app_admin() to authenticated;
-- Storage policies must be able to check the allowlist, without granting table access.
create policy "Admins manage question media" on storage.objects for all to authenticated
using(bucket_id='question-media' and public.is_app_admin())
with check(bucket_id='question-media' and public.is_app_admin());
create function public.broadcast_game_refresh() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform realtime.send(jsonb_build_object('revision',new.revision),'refresh','game:'||new.id||':'||new.view_token,false);
  return new;
end $$;
create trigger game_refresh after update on public.game_sessions for each row execute function public.broadcast_game_refresh();
