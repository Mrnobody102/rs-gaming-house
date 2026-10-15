-- New rooms use a fixed difficulty scale. Existing room snapshots keep their points.
create function public.difficulty_points(p_difficulty text) returns integer language sql immutable set search_path='' as $$
  select case p_difficulty when 'easy' then 100 when 'hard' then 300 else 200 end
$$;
create function public.normalize_question_points() returns trigger language plpgsql set search_path='' as $$
begin
  new.body:=jsonb_set(new.body,'{points}',to_jsonb(public.difficulty_points(new.body->>'difficulty')));
  return new;
end $$;
create trigger question_points before insert or update of body on public.questions for each row execute function public.normalize_question_points();
create function public.normalize_round_points() returns trigger language plpgsql set search_path='' as $$
begin
  new.question:=jsonb_set(new.question,'{points}',to_jsonb(public.difficulty_points(new.question->>'difficulty')));
  return new;
end $$;
create trigger round_points before insert on public.session_rounds for each row execute function public.normalize_round_points();

-- Sets are drafts until the MC creates a room. Star eligibility belongs to the set/room.
alter table public.question_sets add column star_question_ids uuid[] not null default '{}';
alter table public.game_sessions add column source_set_id uuid references public.question_sets(id) on delete set null;
create or replace function public.set_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();begin
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'questionIds',question_ids,'starQuestionIds',star_question_ids) order by updated_at desc)
    from public.question_sets where owner_id=u and not archived),'[]');
end $$;
alter function public.set_save(uuid,text,uuid[]) rename to set_save_legacy;
revoke all on function public.set_save_legacy(uuid,text,uuid[]) from public,anon,authenticated;
create function public.set_save(p_id uuid,p_title text,p_question_ids uuid[],p_star_question_ids uuid[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();begin
  if p_question_ids is null or coalesce(length(trim(p_title)) not between 2 and 100,true) or cardinality(p_question_ids)>50
    or (select count(distinct x) from unnest(p_question_ids) x)<>cardinality(p_question_ids) then raise exception 'Kiểm tra tên bộ đề và câu hỏi.';end if;
  if (select count(*) from public.questions where id=any(p_question_ids) and owner_id=u and not archived)<>cardinality(p_question_ids) then raise exception 'Có câu hỏi đã được lưu trữ.';end if;
  if p_star_question_ids is null or not (p_star_question_ids <@ p_question_ids) then raise exception 'Câu ngôi sao phải thuộc bộ đề.';end if;
  insert into public.question_sets(id,owner_id,title,question_ids,star_question_ids) values(p_id,u,trim(p_title),p_question_ids,p_star_question_ids)
  on conflict(id) do update set title=excluded.title,question_ids=excluded.question_ids,star_question_ids=excluded.star_question_ids,updated_at=now(),archived=false where question_sets.owner_id=u;
  if not found then raise exception 'Bạn không có quyền sửa bộ đề.' using errcode='42501';end if;
  return jsonb_build_object('id',p_id);
end $$;
create function public.set_add_question(p_id uuid,p_question_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.question_sets;begin
  select * into s from public.question_sets where id=p_id and owner_id=u and not archived for update;
  if not found then raise exception 'Không tìm thấy bộ đề.';end if;
  if not exists(select 1 from public.questions where id=p_question_id and owner_id=u and not archived) then raise exception 'Không tìm thấy câu hỏi.';end if;
  if p_question_id=any(s.question_ids) then return jsonb_build_object('id',s.id);end if;
  if cardinality(s.question_ids)>=50 then raise exception 'Mỗi bộ tối đa 50 câu.';end if;
  update public.question_sets set question_ids=array_append(question_ids,p_question_id),
    star_question_ids=case when (select coalesce((body->>'hopeStar')::boolean,false) from public.questions where id=p_question_id) then array_append(star_question_ids,p_question_id) else star_question_ids end,
    updated_at=now() where id=s.id;
  return jsonb_build_object('id',s.id);
end $$;

alter function public.session_create(text,uuid[],integer) rename to session_create_legacy;
revoke all on function public.session_create_legacy(text,uuid[],integer) from public,anon,authenticated;
create function public.session_create(p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[] default null,p_set_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();v jsonb;begin
  if p_set_id is not null and not exists(select 1 from public.question_sets where id=p_set_id and owner_id=u and not archived) then raise exception 'Không tìm thấy bộ đề.';end if;
  if p_star_question_ids is not null and not (p_star_question_ids <@ p_question_ids) then raise exception 'Câu ngôi sao phải thuộc phiên chơi.';end if;
  v:=public.session_create_legacy(p_title,p_question_ids,p_capacity);
  update public.game_sessions set source_set_id=p_set_id where id=(v->>'id')::uuid;
  if p_star_question_ids is not null then
    update public.session_rounds set question=jsonb_set(question,'{hopeStar}',to_jsonb((question->>'id')::uuid=any(p_star_question_ids))) where session_id=(v->>'id')::uuid;
  end if;
  return v;
end $$;
create function public.session_plan(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u;
  if not found then raise exception 'Không tìm thấy phiên chơi.' using errcode='42501';end if;
  return jsonb_build_object('id',s.id,'title',s.title,'capacity',s.capacity,'phase',s.phase,
    'questionIds',coalesce((select jsonb_agg(question->>'id' order by position) from public.session_rounds where session_id=p_id),'[]'),
    'starQuestionIds',coalesce((select jsonb_agg(question->>'id' order by position) from public.session_rounds where session_id=p_id and question->>'hopeStar'='true'),'[]'),
    'questions',(select jsonb_agg(question order by position) from public.session_rounds where session_id=p_id));
end $$;
create function public.session_plan_save(p_id uuid,p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;qid uuid;pos integer:=0;q jsonb;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Không tìm thấy phiên chơi.' using errcode='42501';end if;
  if s.phase<>'lobby' then raise exception 'Chỉ sửa nội dung trước khi bắt đầu.';end if;
  if coalesce(length(trim(p_title)) not between 2 and 100 or p_capacity not between 2 and 60,true) or coalesce(cardinality(p_question_ids),0) not between 1 and 50
    or (select count(distinct x) from unnest(p_question_ids) x)<>cardinality(p_question_ids) then raise exception 'Kiểm tra tên, số người và câu hỏi.';end if;
  if p_capacity<(select count(*) from public.participants where session_id=p_id) then raise exception 'Sức chứa nhỏ hơn số người đã tham gia.';end if;
  if p_star_question_ids is null or not (p_star_question_ids <@ p_question_ids) then raise exception 'Câu ngôi sao phải thuộc phiên chơi.';end if;
  delete from public.session_rounds where session_id=p_id;
  foreach qid in array p_question_ids loop
    select body into q from public.questions where id=qid and owner_id=u and not archived;
    if q is null then raise exception 'Có câu hỏi đã được lưu trữ.';end if;
    q:=jsonb_set(q,'{hopeStar}',to_jsonb(qid=any(p_star_question_ids)));
    insert into public.session_rounds(session_id,position,question) values(p_id,pos,q);pos:=pos+1;
  end loop;
  update public.game_sessions set title=trim(p_title),capacity=p_capacity,current_index=0,revision=revision+1 where id=p_id;
  return jsonb_build_object('id',p_id);
end $$;

-- Timing is recorded by the server. For spoken answers, use BUZZ time, not MC grading time.
alter table public.session_rounds add column started_at timestamptz,add column buzzed_at timestamptz;
alter table public.answers add column response_ms bigint not null default 0;
create function public.round_started() returns trigger language plpgsql set search_path='' as $$
begin
  if new.phase='question' and (old.phase<>'question' or new.current_index<>old.current_index) then
    update public.session_rounds set started_at=clock_timestamp() where session_id=new.id and position=new.current_index;
  end if;
  return new;
end $$;
create trigger record_round_start after update of phase,current_index on public.game_sessions for each row execute function public.round_started();
create function public.record_buzz_time() returns trigger language plpgsql set search_path='' as $$
begin
  if new.buzz_winner is not null and new.buzz_winner is distinct from old.buzz_winner then new.buzzed_at:=clock_timestamp();end if;
  return new;
end $$;
create trigger record_buzz_time before update of buzz_winner on public.session_rounds for each row execute function public.record_buzz_time();

create table public.round_stars (
  round_id uuid not null references public.session_rounds on delete cascade,
  participant_id uuid not null references public.participants on delete cascade,
  used boolean not null default false,primary key(round_id,participant_id)
);
create unique index one_star_per_player on public.round_stars(participant_id) where used;
alter table public.round_stars enable row level security;
revoke all on public.round_stars from anon,authenticated;
create function public.star_select(p_id uuid,p_round_id uuid,p_token text,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.game_sessions;r public.session_rounds;pid uuid;begin
  select * into s from public.game_sessions where id=p_id for update;
  select id into pid from public.participants where session_id=p_id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if pid is null then raise exception 'Bạn chưa vào phòng.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=p_id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' or r.question->>'hopeStar' is distinct from 'true' then raise exception 'Câu này chưa cho phép dùng ngôi sao.';end if;
  if s.deadline is not null and clock_timestamp()>s.deadline then raise exception 'Đã hết thời gian trả lời.';end if;
  if exists(select 1 from public.answers where participant_id=pid and round_id=r.id) or r.buzz_winner=pid then raise exception 'Chọn sao trước khi trả lời.';end if;
  if exists(select 1 from public.round_stars where participant_id=pid and used) then raise exception 'Bạn đã dùng ngôi sao trong phiên này.';end if;
  if p_active then insert into public.round_stars values(r.id,pid,false) on conflict do nothing;
  else delete from public.round_stars where round_id=r.id and participant_id=pid and not used;end if;
  update public.game_sessions set revision=revision+1 where id=p_id;
  return public.session_view(p_id,p_token);
end $$;
create function public.score_answer() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.session_rounds;star boolean;begin
  select * into r from public.session_rounds where id=new.round_id;
  if tg_op='INSERT' then
    new.response_ms:=greatest(0,coalesce((extract(epoch from (case when new.payload->>'buzz'='true' then r.buzzed_at else clock_timestamp() end-r.started_at))*1000)::bigint,0));
    update public.round_stars set used=true where round_id=new.round_id and participant_id=new.participant_id and not used;
  end if;
  select exists(select 1 from public.round_stars where round_id=new.round_id and participant_id=new.participant_id and used) into star;
  if new.awarded>0 then new.awarded:=case when new.correct then (r.question->>'points')::integer*case when star then 2 else 1 end else 0 end;end if;
  return new;
end $$;
create trigger score_answer before insert or update of awarded on public.answers for each row execute function public.score_answer();

-- Preserve all existing answer redaction, and add private star state plus deterministic rankings.
alter function public.session_view(uuid,text) rename to session_view_game;
revoke all on function public.session_view_game(uuid,text) from public,anon,authenticated;
create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;pid uuid;rid uuid;rankings jsonb;winner uuid;begin
  v:=public.session_view_game(p_id,p_token);pid:=(v->>'myId')::uuid;rid:=(v->>'roundId')::uuid;
  select coalesce(jsonb_agg(to_jsonb(t) order by rank),'[]') into rankings from (
    select id,name,score,"correctAnswers",row_number() over(order by score desc,"correctAnswers" desc,response_ms,joined_at,id) as rank from (
      select p.id,p.name,p.joined_at,coalesce(sum(a.awarded),0)::integer as score,
        count(*) filter(where a.correct and a.awarded>0)::integer as "correctAnswers",
        coalesce(sum(a.response_ms) filter(where a.correct and a.awarded>0),0) as response_ms
      from public.participants p left join public.answers a on a.participant_id=p.id where p.session_id=p_id group by p.id
    ) totals
  ) t;
  v:=v||jsonb_build_object('standings',rankings,'star',jsonb_build_object(
    'selected',exists(select 1 from public.round_stars where round_id=rid and participant_id=pid),
    'used',exists(select 1 from public.round_stars where participant_id=pid and used)),
    'starRounds',(select count(*) from public.session_rounds where session_id=p_id and question->>'hopeStar'='true'));
  winner:=(v->'buzzWinner'->>'id')::uuid;
  if winner is not null then v:=jsonb_set(v,'{buzzWinner,hopeStar}',to_jsonb(exists(select 1 from public.round_stars where round_id=rid and participant_id=winner)));end if;
  return v;
end $$;

revoke all on function public.set_save(uuid,text,uuid[],uuid[]),public.set_add_question(uuid,uuid),public.session_create(text,uuid[],integer,uuid[],uuid),public.session_plan(uuid),public.session_plan_save(uuid,text,uuid[],integer,uuid[]) from public,anon;
grant execute on function public.set_save(uuid,text,uuid[],uuid[]),public.set_add_question(uuid,uuid),public.session_create(text,uuid[],integer,uuid[],uuid),public.session_plan(uuid),public.session_plan_save(uuid,text,uuid[],integer,uuid[]) to authenticated;
revoke all on function public.star_select(uuid,uuid,text,boolean),public.session_view(uuid,text) from public;
grant execute on function public.star_select(uuid,uuid,text,boolean),public.session_view(uuid,text) to anon,authenticated;
revoke all on function public.normalize_question_points(),public.normalize_round_points(),public.round_started(),public.record_buzz_time(),public.score_answer() from public,anon,authenticated;
