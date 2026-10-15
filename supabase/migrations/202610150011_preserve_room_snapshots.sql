-- Editing a lobby changes its selection, not the content already frozen in it.
create or replace function public.session_plan_save_competition(p_id uuid,p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;qid uuid;pos integer:=0;q jsonb;snapshots jsonb;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Không tìm thấy phiên chơi.' using errcode='42501';end if;
  if s.phase<>'lobby' then raise exception 'Chỉ sửa nội dung trước khi bắt đầu.';end if;
  if coalesce(length(trim(p_title)) not between 2 and 100 or p_capacity not between 2 and 60,true) or coalesce(cardinality(p_question_ids),0) not between 1 and 50
    or (select count(distinct x) from unnest(p_question_ids) x)<>cardinality(p_question_ids) then raise exception 'Kiểm tra tên, số người và câu hỏi.';end if;
  if p_capacity<(select count(*) from public.participants where session_id=p_id) then raise exception 'Sức chứa nhỏ hơn số người đã tham gia.';end if;
  if p_star_question_ids is null or not (p_star_question_ids <@ p_question_ids) then raise exception 'Câu ngôi sao phải thuộc phiên chơi.';end if;
  select jsonb_object_agg(question->>'id',question) into snapshots from public.session_rounds where session_id=p_id;
  delete from public.session_rounds where session_id=p_id;
  foreach qid in array p_question_ids loop
    q:=snapshots->qid::text;
    if q is null then
      select body into q from public.questions where id=qid and owner_id=u and not archived;
    end if;
    if q is null then raise exception 'Có câu hỏi đã được lưu trữ.';end if;
    q:=jsonb_set(q,'{hopeStar}',to_jsonb(qid=any(p_star_question_ids)));
    insert into public.session_rounds(session_id,position,question) values(p_id,pos,q);pos:=pos+1;
  end loop;
  update public.game_sessions set title=trim(p_title),capacity=p_capacity,current_index=0,revision=revision+1 where id=p_id;
  return jsonb_build_object('id',p_id);
end $$;

create or replace function public.replace_reserves(p_id uuid,p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;main_ids uuid[];snapshots jsonb;qid uuid;q jsonb;pos integer:=0;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found or s.phase<>'lobby' then raise exception 'Chỉ sửa câu dự bị trước khi bắt đầu.';end if;
  select array_agg((question->>'id')::uuid) into main_ids from public.session_rounds where session_id=p_id;
  if p_ids is null or cardinality(p_ids)>10 or (select count(distinct x) from unnest(p_ids) x)<>cardinality(p_ids) or p_ids && main_ids then raise exception 'Câu dự bị không được trùng nhau hoặc trùng câu chính.';end if;
  select jsonb_object_agg(question->>'id',question) into snapshots from public.session_reserves where session_id=p_id;
  delete from public.session_reserves where session_id=p_id;
  foreach qid in array p_ids loop
    q:=snapshots->qid::text;
    if q is null then
      select body into q from public.questions where id=qid and owner_id=u and not archived;
    end if;
    if q is null or q->>'kind' not in ('riddle','place','locate','change') then raise exception 'Chọn câu dự bị dùng BUZZ còn trong kho.';end if;
    insert into public.session_reserves(session_id,position,question) values(p_id,pos,q);pos:=pos+1;
  end loop;
end $$;
