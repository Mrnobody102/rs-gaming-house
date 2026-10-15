-- Removing a bank entry cleans reusable sets, never existing room snapshots.
create or replace function public.bank_archive(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();begin
  update public.questions set archived=true,updated_at=now() where id=p_id and owner_id=u;
  if not found then raise exception 'Không tìm thấy câu hỏi.' using errcode='42501';end if;
  update public.question_sets set question_ids=array_remove(question_ids,p_id),
    star_question_ids=array_remove(star_question_ids,p_id),reserve_question_ids=array_remove(reserve_question_ids,p_id),updated_at=now()
    where owner_id=u and (p_id=any(question_ids) or p_id=any(star_question_ids) or p_id=any(reserve_question_ids));
  return jsonb_build_object('id',p_id);
end $$;

-- Repair sets with dangling references left by earlier bank deletions.
update public.question_sets s set
  question_ids=array(select qid from unnest(s.question_ids) qid where exists(select 1 from public.questions q where q.id=qid and q.owner_id=s.owner_id and not q.archived)),
  star_question_ids=array(select qid from unnest(s.star_question_ids) qid where qid=any(s.question_ids) and exists(select 1 from public.questions q where q.id=qid and q.owner_id=s.owner_id and not q.archived)),
  reserve_question_ids=array(select qid from unnest(s.reserve_question_ids) qid where exists(select 1 from public.questions q where q.id=qid and q.owner_id=s.owner_id and not q.archived));

create or replace function public.set_archive(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();begin
  update public.question_sets set archived=true,updated_at=now() where id=p_id and owner_id=u;
  if not found then raise exception 'Không tìm thấy bộ câu hỏi.' using errcode='42501';end if;
  return jsonb_build_object('id',p_id);
end $$;

-- Cascades remove participants, rounds, answers, stars, reserves and tie placings.
create function public.session_delete(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Không tìm thấy phòng hoặc bạn không có quyền xóa.' using errcode='42501';end if;
  delete from public.game_sessions where id=s.id;
  return jsonb_build_object('id',s.id,'revision',s.revision+1,'deleted',true);
end $$;

alter function public.session_view(uuid,text) rename to session_view_before_deletion;
revoke all on function public.session_view_before_deletion(uuid,text) from public,anon,authenticated;
create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.game_sessions where id=p_id) then
    raise exception 'Phòng không còn tồn tại. Nhập mã phòng khác để tham gia.' using errcode='P0002';
  end if;
  return public.session_view_before_deletion(p_id,p_token);
end $$;

-- Lobby edits must notify already connected players of new round IDs/content.
create or replace function public.session_plan_save(p_id uuid,p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[],p_reserve_question_ids uuid[] default '{}',p_hint_penalty integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
  if p_hint_penalty is null or p_hint_penalty not in (0,50) then raise exception 'Mỗi gợi ý trừ 0 hoặc 50 điểm.';end if;
  v:=public.session_plan_save_before_hints(p_id,p_title,p_question_ids,p_capacity,p_star_question_ids,p_reserve_question_ids);
  update public.game_sessions set hint_penalty=p_hint_penalty where id=p_id;
  return v||jsonb_build_object('revision',(select revision from public.game_sessions where id=p_id));
end $$;

revoke all on function public.session_delete(uuid) from public,anon;
grant execute on function public.session_delete(uuid) to authenticated;
revoke all on function public.session_view(uuid,text) from public;
grant execute on function public.session_view(uuid,text) to anon,authenticated;
