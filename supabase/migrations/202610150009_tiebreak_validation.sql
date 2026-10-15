-- Fixed points for newly authored questions / newly created room snapshots.
create or replace function public.difficulty_points(p_difficulty text) returns integer language sql immutable set search_path='' as $$
  select case p_difficulty when 'easy' then 200 when 'hard' then 400 else 300 end
$$;
create or replace function public.normalize_round_points() returns trigger language plpgsql set search_path='' as $$
begin
  new.question:=jsonb_set(new.question,'{points}',to_jsonb(case when new.question->>'tiebreak'='true' then 0 else public.difficulty_points(new.question->>'difficulty') end));
  return new;
end $$;

-- Normalize display names and compare normalized names while holding the room lock.
-- Do not rename existing participants, or invalidate their reconnect tokens.
create function public.clean_player_name(p_name text) returns text language sql immutable set search_path='' as $$
  select btrim(regexp_replace(translate(normalize(p_name,NFKC),U&'\200B\200C\200D\FEFF',''),'[[:space:]]+',' ','g'))
$$;
alter function public.session_join(text,text,text) rename to session_join_competition;
revoke all on function public.session_join_competition(text,text,text) from public,anon,authenticated;
create function public.session_join(p_code text,p_name text,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid;n text:=public.clean_player_name(p_name);h text;begin
  if coalesce(length(n),0) not between 1 and 40 then raise exception 'Nhập tên từ 1 đến 40 ký tự.';end if;
  if coalesce(length(p_token),0) not between 32 and 200 then raise exception 'Mã tham gia không hợp lệ.';end if;
  select id into sid from public.game_sessions where code=upper(trim(p_code)) for update;
  h:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if exists(select 1 from public.participants where session_id=sid and lower(public.clean_player_name(name))=lower(n) and token_hash<>h) then raise exception 'Tên này đã có người dùng.';end if;
  return public.session_join_competition(p_code,n,p_token);
end $$;

-- Reserve content is stored separately; it does not increase the normal question count.
alter table public.question_sets add column reserve_question_ids uuid[] not null default '{}';
alter table public.session_rounds add column tie_eligible uuid[];
create table public.session_reserves (
  id uuid primary key default gen_random_uuid(),session_id uuid not null references public.game_sessions on delete cascade,
  position integer not null,question jsonb not null,used boolean not null default false,unique(session_id,position)
);
create table public.tie_placings (
  session_id uuid not null references public.game_sessions on delete cascade,
  participant_id uuid not null references public.participants on delete cascade,
  position integer not null check(position>0),primary key(session_id,participant_id),unique(session_id,position)
);
alter table public.session_reserves enable row level security;
alter table public.tie_placings enable row level security;
revoke all on public.session_reserves,public.tie_placings from anon,authenticated;
create function public.validate_reserves(p_ids uuid[],p_main uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();begin
  if p_ids is null or cardinality(p_ids)>10 or (select count(distinct x) from unnest(p_ids) x)<>cardinality(p_ids) or p_ids && p_main then raise exception 'Câu dự bị không được trùng nhau hoặc trùng câu chính.';end if;
  if (select count(*) from public.questions where id=any(p_ids) and owner_id=u and not archived and body->>'kind' in ('riddle','place','locate','change'))<>cardinality(p_ids) then raise exception 'Chọn câu dự bị dùng BUZZ còn trong kho.';end if;
end $$;
create function public.replace_reserves(p_id uuid,p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;main_ids uuid[];begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found or s.phase<>'lobby' then raise exception 'Chỉ sửa câu dự bị trước khi bắt đầu.';end if;
  select array_agg((question->>'id')::uuid) into main_ids from public.session_rounds where session_id=p_id;
  perform public.validate_reserves(p_ids,main_ids);
  delete from public.session_reserves where session_id=p_id;
  insert into public.session_reserves(session_id,position,question)
    select p_id,x.ordinality::integer-1,q.body from unnest(p_ids) with ordinality x(id,ordinality) join public.questions q on q.id=x.id order by x.ordinality;
end $$;
create or replace function public.set_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();begin
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'questionIds',question_ids,'starQuestionIds',star_question_ids,'reserveQuestionIds',reserve_question_ids) order by updated_at desc) from public.question_sets where owner_id=u and not archived),'[]');
end $$;
alter function public.set_save(uuid,text,uuid[],uuid[]) rename to set_save_competition;
revoke all on function public.set_save_competition(uuid,text,uuid[],uuid[]) from public,anon,authenticated;
create function public.set_save(p_id uuid,p_title text,p_question_ids uuid[],p_star_question_ids uuid[] default '{}',p_reserve_question_ids uuid[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
  perform public.validate_reserves(p_reserve_question_ids,p_question_ids);
  v:=public.set_save_competition(p_id,p_title,p_question_ids,p_star_question_ids);
  update public.question_sets set reserve_question_ids=p_reserve_question_ids where id=p_id;
  return v;
end $$;
alter function public.session_create(text,uuid[],integer,uuid[],uuid) rename to session_create_competition;
revoke all on function public.session_create_competition(text,uuid[],integer,uuid[],uuid) from public,anon,authenticated;
create function public.session_create(p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[] default null,p_set_id uuid default null,p_reserve_question_ids uuid[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
  v:=public.session_create_competition(p_title,p_question_ids,p_capacity,p_star_question_ids,p_set_id);
  perform public.replace_reserves((v->>'id')::uuid,p_reserve_question_ids);
  return v;
end $$;
alter function public.session_plan_save(uuid,text,uuid[],integer,uuid[]) rename to session_plan_save_competition;
revoke all on function public.session_plan_save_competition(uuid,text,uuid[],integer,uuid[]) from public,anon,authenticated;
create function public.session_plan_save(p_id uuid,p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[],p_reserve_question_ids uuid[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
  v:=public.session_plan_save_competition(p_id,p_title,p_question_ids,p_capacity,p_star_question_ids);
  perform public.replace_reserves(p_id,p_reserve_question_ids);
  return v;
end $$;
alter function public.session_plan(uuid) rename to session_plan_competition;
revoke all on function public.session_plan_competition(uuid) from public,anon,authenticated;
create function public.session_plan(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
  v:=public.session_plan_competition(p_id);
  return v||jsonb_build_object('reserveQuestionIds',coalesce((select jsonb_agg(question->>'id' order by position) from public.session_reserves where session_id=p_id),'[]'),
    'reserveQuestions',coalesce((select jsonb_agg(question order by position) from public.session_reserves where session_id=p_id),'[]'));
end $$;

-- Equal points stay equal until a reserve round resolves the relevant prize places.
create function public.prize_standings(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'score',score,'rank',rank,'tied',tied) order by rank,joined_at,id),'[]') from (
    select *,rank() over(order by score desc,place nulls last) as rank,count(*) over(partition by score,place)>1 as tied from (
      select p.id,p.name,p.joined_at,t.position as place,coalesce(sum(a.awarded),0)::integer as score
      from public.participants p left join public.answers a on a.participant_id=p.id left join public.tie_placings t on t.participant_id=p.id and t.session_id=p_id
      where p.session_id=p_id group by p.id,t.position
    ) totals
  ) ranked
$$;
create function public.prize_tie_group(p_id uuid) returns uuid[] language plpgsql stable security definer set search_path='' as $$
declare standings jsonb:=public.prize_standings(p_id);first_rank integer;ids uuid[];begin
  select min((value->>'rank')::integer) into first_rank from jsonb_array_elements(standings) where (value->>'tied')::boolean and (value->>'rank')::integer<=3;
  select array_agg((value->>'id')::uuid) into ids from jsonb_array_elements(standings) where (value->>'rank')::integer=first_rank;
  return coalesce(ids,'{}');
end $$;
create function public.tie_reserve_add(p_id uuid,p_question_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;ids uuid[];begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Không tìm thấy phiên chơi.' using errcode='42501';end if;
  select array_agg((question->>'id')::uuid) into ids from public.session_rounds where session_id=p_id;
  perform public.validate_reserves(array[p_question_id],ids);
  if exists(select 1 from public.session_reserves where session_id=p_id and question->>'id'=p_question_id::text) then raise exception 'Câu này đã nằm trong danh sách dự bị.';end if;
  insert into public.session_reserves(session_id,position,question) select p_id,coalesce((select max(position)+1 from public.session_reserves where session_id=p_id),0),body from public.questions where id=p_question_id;
  update public.game_sessions set revision=revision+1 where id=p_id;
  return public.session_view(p_id);
end $$;
create function public.tie_start(p_id uuid,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;reserve public.session_reserves;eligible uuid[];pos integer;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Không tìm thấy phiên chơi.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=p_id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Câu hỏi đã thay đổi.';end if;
  if s.phase not in ('result','leaderboard','finished') or (s.phase<>'finished' and exists(select 1 from public.session_rounds where session_id=p_id and position>s.current_index)) then raise exception 'Chơi hết câu chính trước khi phân hạng.';end if;
  eligible:=public.prize_tie_group(p_id);
  if cardinality(eligible)<2 then raise exception 'Không có nhóm đồng điểm cần phân hạng top 3.';end if;
  select * into reserve from public.session_reserves where session_id=p_id and not used order by position limit 1;
  if not found then raise exception 'Thêm câu dự bị trước khi phân hạng.';end if;
  select max(position)+1 into pos from public.session_rounds where session_id=p_id;
  insert into public.session_rounds(session_id,position,question,tie_eligible) values(p_id,pos,reserve.question||'{"tiebreak":true,"hopeStar":false,"points":0}',eligible);
  update public.session_reserves set used=true where id=reserve.id;
  update public.game_sessions set current_index=pos,phase='question',deadline=null,revision=revision+1 where id=p_id;
  return public.session_view(p_id);
end $$;

-- Only the frozen tied group may BUZZ. The existing atomic winner / grading rules remain.
alter function public.buzz_submit(uuid,uuid,text) rename to buzz_submit_competition;
revoke all on function public.buzz_submit_competition(uuid,uuid,text) from public,anon,authenticated;
create function public.buzz_submit(p_id uuid,p_round_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.session_rounds;pid uuid;begin
  perform 1 from public.game_sessions where id=p_id for update;
  select * into r from public.session_rounds where id=p_round_id and session_id=p_id;
  if r.tie_eligible is not null then
    select id into pid from public.participants where session_id=p_id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
    if pid is null or not(pid=any(r.tie_eligible)) then raise exception 'Câu dự bị chỉ dành cho nhóm đồng điểm.' using errcode='42501';end if;
  end if;
  return public.buzz_submit_competition(p_id,p_round_id,p_token);
end $$;
alter function public.session_control(uuid,text,uuid) rename to session_control_competition;
revoke all on function public.session_control_competition(uuid,text,uuid) from public,anon,authenticated;
create function public.session_control(p_id uuid,p_action text,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;winner uuid;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Bạn không có quyền điều khiển phiên này.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=p_id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Câu hỏi đã thay đổi. Hãy tải lại.';end if;
  if p_action='reveal' and s.phase='question' and r.tie_eligible is not null then
    select participant_id into winner from public.answers where round_id=r.id and correct and participant_id=any(r.tie_eligible) limit 1;
    if winner is not null then insert into public.tie_placings values(p_id,winner,coalesce((select max(position)+1 from public.tie_placings where session_id=p_id),1)) on conflict(session_id,participant_id) do nothing;end if;
  end if;
  return public.session_control_competition(p_id,p_action,p_round_id);
end $$;
alter function public.session_view(uuid,text) rename to session_view_competition;
revoke all on function public.session_view_competition(uuid,text) from public,anon,authenticated;
create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r public.session_rounds;ids uuid[];pending boolean;candidates jsonb;begin
  v:=public.session_view_competition(p_id,p_token);
  select * into r from public.session_rounds where id=(v->>'roundId')::uuid;
  ids:=case when r.tie_eligible is not null and v->>'phase'='question' then r.tie_eligible else public.prize_tie_group(p_id) end;
  pending:=v->>'phase' in ('result','leaderboard','finished') and cardinality(public.prize_tie_group(p_id))>1
    and (v->>'phase'='finished' or not exists(select 1 from public.session_rounds where session_id=p_id and position>(v->>'index')::integer));
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by joined_at),'[]') into candidates from public.participants where id=any(ids);
  return v||jsonb_build_object('standings',public.prize_standings(p_id),'tiebreak',jsonb_build_object(
    'active',r.tie_eligible is not null,'pending',pending,'myEligible',coalesce((v->>'myId')::uuid=any(r.tie_eligible),false),
    'candidates',candidates,'reserves',(select count(*) from public.session_reserves where session_id=p_id and not used)));
end $$;

revoke all on function public.validate_reserves(uuid[],uuid[]),public.replace_reserves(uuid,uuid[]),public.prize_standings(uuid),public.prize_tie_group(uuid) from public,anon,authenticated;
revoke all on function public.set_save(uuid,text,uuid[],uuid[],uuid[]),public.session_create(text,uuid[],integer,uuid[],uuid,uuid[]),public.session_plan_save(uuid,text,uuid[],integer,uuid[],uuid[]),public.session_plan(uuid),public.tie_reserve_add(uuid,uuid),public.tie_start(uuid,uuid),public.session_control(uuid,text,uuid) from public,anon;
grant execute on function public.set_save(uuid,text,uuid[],uuid[],uuid[]),public.session_create(text,uuid[],integer,uuid[],uuid,uuid[]),public.session_plan_save(uuid,text,uuid[],integer,uuid[],uuid[]),public.session_plan(uuid),public.tie_reserve_add(uuid,uuid),public.tie_start(uuid,uuid),public.session_control(uuid,text,uuid) to authenticated;
revoke all on function public.session_join(text,text,text),public.buzz_submit(uuid,uuid,text),public.session_view(uuid,text) from public;
grant execute on function public.session_join(text,text,text),public.buzz_submit(uuid,uuid,text),public.session_view(uuid,text) to anon,authenticated;
