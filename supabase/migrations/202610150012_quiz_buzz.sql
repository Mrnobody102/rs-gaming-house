-- BUZZ is the default for quizzes; individual submission remains an authoring option.
create function public.question_uses_buzz(q jsonb) returns boolean language sql immutable set search_path='' as $$
  select coalesce(q->>'kind' in ('riddle','place','locate','change') or (q->>'kind'='choice' and coalesce(q->>'interaction','buzz')='buzz'),false)
$$;
revoke all on function public.question_uses_buzz(jsonb) from public,anon,authenticated;
alter table public.session_rounds add column buzz_opened_at timestamptz;
alter table public.session_rounds add column buzz_open_id uuid;
update public.session_rounds set buzz_open_id=gen_random_uuid(),buzz_opened_at=clock_timestamp() where buzz_open;
-- Do not change the rules of quizzes that are already running or completed.
update public.session_rounds r set question=jsonb_set(question,'{interaction}','"submit"')
  from public.game_sessions s where s.id=r.session_id and s.phase<>'lobby' and r.question->>'kind'='choice' and not(r.question ? 'interaction');

-- Lobby joins participate in the same monotonic revision sequence as game actions.
alter function public.session_join(text,text,text) rename to session_join_before_buzz;
revoke all on function public.session_join_before_buzz(text,text,text) from public,anon,authenticated;
create function public.session_join(p_code text,p_name text,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;rev bigint;begin
  v:=public.session_join_before_buzz(p_code,p_name,p_token);
  update public.game_sessions set revision=revision+1 where id=(v->>'id')::uuid returning revision into rev;
  return v||jsonb_build_object('revision',rev);
end $$;
revoke all on function public.session_join(text,text,text) from public;
grant execute on function public.session_join(text,text,text) to anon,authenticated;


create or replace function public.buzz_control(p_id uuid,p_round_id uuid,p_open boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' or not public.question_uses_buzz(r.question) then raise exception 'Không mở BUZZ ở bước này.';end if;
  if p_open and (r.buzz_winner is not null) then raise exception 'Chưa thể mở BUZZ.';end if;
  update public.session_rounds set buzz_open=p_open,buzz_opened_at=case when p_open and not r.buzz_open then clock_timestamp() else buzz_opened_at end,
    buzz_open_id=case when p_open and not r.buzz_open then gen_random_uuid() else buzz_open_id end where id=r.id;
  update public.game_sessions set revision=revision+1 where id=s.id;return public.session_view(p_id);
end $$;

create or replace function public.buzz_submit_competition(p_id uuid,p_round_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.game_sessions;r public.session_rounds;pid uuid;begin
  select * into s from public.game_sessions where id=p_id for update;
  select id into pid from public.participants where session_id=p_id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if pid is null then raise exception 'Bạn chưa vào phòng.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' then raise exception 'Đã hết lượt BUZZ.';end if;
  if r.buzz_winner is not null then return public.session_view(p_id,p_token);end if;
  if not r.buzz_open or not public.question_uses_buzz(r.question) then raise exception 'MC chưa mở BUZZ.';end if;
  if exists(select 1 from public.answers where round_id=r.id and participant_id=pid) then raise exception 'Bạn đã trả lời câu này.';end if;
  update public.session_rounds set buzz_winner=pid,buzz_open=false where id=r.id;
  update public.game_sessions set revision=revision+1 where id=p_id;return public.session_view(p_id,p_token);
end $$;

-- Every opening has a fresh token: a delayed press cannot win a reopened window.
alter function public.buzz_submit(uuid,uuid,text) rename to buzz_submit_before_window;
revoke all on function public.buzz_submit_before_window(uuid,uuid,text) from public,anon,authenticated;
create function public.buzz_submit(p_id uuid,p_round_id uuid,p_token text,p_buzz_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare window_id uuid;begin
  perform 1 from public.game_sessions where id=p_id for update;
  select buzz_open_id into window_id from public.session_rounds where id=p_round_id and session_id=p_id;
  if p_buzz_id is null or p_buzz_id is distinct from window_id then raise exception 'MC chưa mở BUZZ hoặc lượt chuông đã thay đổi. Hãy bấm lại khi chuông mở.';end if;
  return public.buzz_submit_before_window(p_id,p_round_id,p_token);
end $$;
revoke all on function public.buzz_submit(uuid,uuid,text,uuid) from public;
grant execute on function public.buzz_submit(uuid,uuid,text,uuid) to anon,authenticated;

create or replace function public.session_control_competition(p_id uuid,p_action text,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin(); s public.game_sessions; r public.session_rounds; n integer; begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Bạn không có quyền điều khiển phiên này.' using errcode='42501'; end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Câu hỏi đã thay đổi. Hãy tải lại.'; end if;
  case p_action
    when 'start' then
      if s.phase<>'lobby' then return public.session_view(p_id); end if;
      update public.game_sessions set phase='question',deadline=case when public.question_uses_buzz(r.question) then null else clock_timestamp()+make_interval(secs=>(r.question->>'seconds')::integer) end,revision=revision+1 where id=p_id;
    when 'reveal' then
      if s.phase<>'question' then return public.session_view(p_id); end if;
      update public.answers set awarded=case when correct then (r.question->>'points')::integer else 0 end where round_id=r.id;
      update public.game_sessions set phase='result',revision=revision+1 where id=p_id;
    when 'leaderboard' then
      if s.phase<>'result' then return public.session_view(p_id); end if;
      update public.game_sessions set phase='leaderboard',revision=revision+1 where id=p_id;
    when 'next' then
      if s.phase not in ('result','leaderboard') then return public.session_view(p_id); end if;
      select count(*) into n from public.session_rounds where session_id=p_id;
      if s.current_index+1>=n then
        update public.game_sessions set phase='finished',deadline=null,revision=revision+1 where id=p_id;
      else
        select * into r from public.session_rounds where session_id=p_id and position=s.current_index+1;
        update public.game_sessions set phase='question',current_index=current_index+1,
          deadline=case when public.question_uses_buzz(r.question) then null else clock_timestamp()+make_interval(secs=>(r.question->>'seconds')::integer) end,revision=revision+1 where id=p_id;
      end if;
    when 'finish' then
      update public.game_sessions set phase='finished',deadline=null,revision=revision+1 where id=p_id;
    else raise exception 'Thao tác không hợp lệ.';
  end case;
  return public.session_view(p_id);
end $$;

create or replace function public.answer_submit(p_id uuid,p_round_id uuid,p_token text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.session_rounds where id=p_round_id and session_id=p_id and public.question_uses_buzz(question)) then raise exception 'Dùng BUZZ để giành quyền trả lời.';end if;
  return public.answer_submit_base(p_id,p_round_id,p_token,p_payload);
end $$;

create or replace function public.validate_reserves(p_ids uuid[],p_main uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();begin
  if p_ids is null or cardinality(p_ids)>10 or (select count(distinct x) from unnest(p_ids) x)<>cardinality(p_ids) or p_ids && p_main then raise exception 'Câu dự bị không được trùng nhau hoặc trùng câu chính.';end if;
  if (select count(*) from public.questions where id=any(p_ids) and owner_id=u and not archived and public.question_uses_buzz(body))<>cardinality(p_ids) then raise exception 'Chọn câu dự bị dùng BUZZ còn trong kho.';end if;
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
    if q is null or not public.question_uses_buzz(q) then raise exception 'Chọn câu dự bị dùng BUZZ còn trong kho.';end if;
    insert into public.session_reserves(session_id,position,question) values(p_id,pos,q);pos:=pos+1;
  end loop;
end $$;

-- The elapsed value comes only from database timestamps, never the player's clock.
alter function public.session_view(uuid,text) rename to session_view_before_buzz;
revoke all on function public.session_view_before_buzz(uuid,text) from public,anon,authenticated;
create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r public.session_rounds;begin
  v:=public.session_view_before_buzz(p_id,p_token);
  select * into r from public.session_rounds where id=(v->>'roundId')::uuid;
  v:=v||jsonb_build_object('buzzId',r.buzz_open_id);
  if v->'buzzWinner'<>'null'::jsonb then
    v:=jsonb_set(v,'{buzzWinner,elapsedMs}',case when r.buzzed_at is null or r.buzz_opened_at is null then 'null'::jsonb else to_jsonb(greatest(0,floor(extract(epoch from (r.buzzed_at-r.buzz_opened_at))*1000))::bigint) end);
  end if;
  return v;
end $$;
revoke all on function public.session_view(uuid,text) from public;
grant execute on function public.session_view(uuid,text) to anon,authenticated;

