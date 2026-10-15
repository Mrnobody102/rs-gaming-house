-- Shared by Supabase and the local PostgreSQL preview. Never expose table rows to guests.
create table public.app_admins (user_id uuid primary key);
create table public.questions (
  id uuid primary key, owner_id uuid not null, body jsonb not null,
  archived boolean not null default false, updated_at timestamptz not null default now(),
  check (body->>'kind' in ('choice','puzzle')), check (length(body->>'title') between 3 and 220)
);
create table public.question_sets (
  id uuid primary key, owner_id uuid not null, title text not null check(length(title) between 2 and 100),
  question_ids uuid[] not null, archived boolean not null default false, updated_at timestamptz not null default now()
);
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  title text not null, code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  view_token uuid not null default gen_random_uuid(), capacity integer not null check (capacity between 2 and 60),
  phase text not null default 'lobby' check (phase in ('lobby','question','result','leaderboard','finished')),
  current_index integer not null default 0, revision integer not null default 0,
  deadline timestamptz, created_at timestamptz not null default now()
);
create table public.session_rounds (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.game_sessions on delete cascade,
  position integer not null, question jsonb not null, unique(session_id,position)
);
create table public.participants (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.game_sessions on delete cascade,
  token_hash text not null, name text not null check (length(name) between 1 and 40), joined_at timestamptz not null default now(),
  unique(session_id,token_hash), unique(session_id,name)
);
create table public.answers (
  round_id uuid not null references public.session_rounds on delete cascade,
  participant_id uuid not null references public.participants on delete cascade,
  payload jsonb not null, correct boolean not null, awarded integer not null default 0, submitted_at timestamptz not null default now(),
  primary key(round_id,participant_id)
);
create index participants_session on public.participants(session_id);
create index rounds_session on public.session_rounds(session_id);
create index answers_participant on public.answers(participant_id);

alter table public.app_admins enable row level security;
alter table public.questions enable row level security;
alter table public.question_sets enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_rounds enable row level security;
alter table public.participants enable row level security;
alter table public.answers enable row level security;
-- All access uses the checked functions below, including authenticated hosts.
revoke all on public.app_admins, public.questions, public.question_sets, public.game_sessions, public.session_rounds, public.participants, public.answers from anon, authenticated;

create function public.require_admin() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.app_admins where user_id=auth.uid()) then
    raise exception 'Bạn không có quyền quản trị.' using errcode='42501';
  end if;
  return auth.uid();
end $$;
create function public.bank_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := public.require_admin(); begin
  return coalesce((select jsonb_agg(body order by updated_at desc) from public.questions where owner_id=u and not archived),'[]');
end $$;
create function public.bank_save(p_question jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := public.require_admin(); n integer; begin
  if coalesce(p_question->>'kind' not in ('choice','puzzle') or length(p_question->>'title') not between 3 and 220
    or (p_question->>'seconds')::integer not between 15 and 600 or (p_question->>'points')::integer not between 1 and 1000,true) then
    raise exception 'Câu hỏi chưa hợp lệ.';
  end if;
  if p_question->>'kind'='choice' then
    n:=jsonb_array_length(p_question->'options');
    if coalesce(n not between 2 and 4 or (p_question->>'correct')::integer not between 0 and n-1,true) then raise exception 'Chọn đáp án đúng.'; end if;
  elsif (p_question->>'grid')::integer not in (2,3) or coalesce(p_question->>'image','')='' then raise exception 'Puzzle cần ảnh và kích thước hợp lệ.'; end if;
  insert into public.questions(id,owner_id,body) values((p_question->>'id')::uuid,u,p_question)
  on conflict(id) do update set body=excluded.body, updated_at=now(), archived=false where questions.owner_id=u;
  if not found then raise exception 'Bạn không có quyền sửa câu hỏi này.' using errcode='42501'; end if;
  return p_question;
end $$;
create function public.bank_archive(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := public.require_admin(); begin
  update public.questions set archived=true,updated_at=now() where id=p_id and owner_id=u;
  return '{}'::jsonb;
end $$;
create function public.session_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := public.require_admin(); begin
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from
    (select s.id,s.title,s.code,s.phase,s.capacity,s.created_at,s.view_token,(select count(*) from public.session_rounds r where r.session_id=s.id) as total
     from public.game_sessions s where owner_id=u) t),'[]');
end $$;
create function public.set_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin(); begin
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'questionIds',question_ids) order by updated_at desc)
    from public.question_sets where owner_id=u and not archived),'[]');
end $$;
create function public.set_save(p_id uuid,p_title text,p_question_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin(); begin
  if coalesce(length(trim(p_title)) not between 2 and 100,true) or coalesce(array_length(p_question_ids,1),0) not between 1 and 50
    or (select count(distinct x) from unnest(p_question_ids) x)<>array_length(p_question_ids,1) then raise exception 'Kiểm tra tên bộ đề và câu hỏi.'; end if;
  if (select count(*) from public.questions where id=any(p_question_ids) and owner_id=u and not archived)<>array_length(p_question_ids,1) then raise exception 'Có câu hỏi đã được lưu trữ.'; end if;
  insert into public.question_sets(id,owner_id,title,question_ids) values(p_id,u,trim(p_title),p_question_ids)
  on conflict(id) do update set title=excluded.title,question_ids=excluded.question_ids,updated_at=now(),archived=false where question_sets.owner_id=u;
  if not found then raise exception 'Bạn không có quyền sửa bộ đề.' using errcode='42501'; end if;
  return jsonb_build_object('id',p_id);
end $$;
create function public.set_archive(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin(); begin update public.question_sets set archived=true where id=p_id and owner_id=u; return '{}'; end $$;
create function public.session_create(p_title text,p_question_ids uuid[],p_capacity integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := public.require_admin(); s public.game_sessions; q jsonb; qid uuid; pos integer := 0; begin
  if length(trim(p_title)) not between 2 and 100 or p_capacity not between 2 and 60 or coalesce(array_length(p_question_ids,1),0) not between 1 and 50
     or (select count(distinct x) from unnest(p_question_ids) x)<>array_length(p_question_ids,1) then raise exception 'Kiểm tra tên, câu hỏi và số người chơi.'; end if;
  insert into public.game_sessions(owner_id,title,capacity) values(u,trim(p_title),p_capacity) returning * into s;
  foreach qid in array p_question_ids loop
    select body into q from public.questions where id=qid and owner_id=u and not archived;
    if q is null then raise exception 'Câu hỏi không còn trong ngân hàng.'; end if;
    insert into public.session_rounds(session_id,position,question) values(s.id,pos,q);
    pos:=pos+1;
  end loop;
  return jsonb_build_object('id',s.id,'view_token',s.view_token,'code',s.code);
end $$;

create function public.session_join(p_code text,p_name text,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.game_sessions; pid uuid; h text; begin
  if length(p_token) not between 32 and 200 or length(trim(p_name)) not between 1 and 40 then raise exception 'Nhập tên từ 1 đến 40 ký tự.'; end if;
  select * into s from public.game_sessions where code=upper(trim(p_code)) for update;
  if not found then raise exception 'Không tìm thấy phòng.'; end if;
  h:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  select id into pid from public.participants where session_id=s.id and token_hash=h;
  if pid is not null then return jsonb_build_object('id',s.id,'participantId',pid); end if;
  if s.phase not in ('lobby','question') then raise exception 'Phòng đã đóng tham gia.'; end if;
  if (select count(*) from public.participants where session_id=s.id)>=s.capacity then raise exception 'Phòng đã đủ người.'; end if;
  if exists(select 1 from public.participants where session_id=s.id and lower(name)=lower(trim(p_name))) then raise exception 'Tên này đã có người dùng.'; end if;
  insert into public.participants(session_id,name,token_hash) values(s.id,trim(p_name),h) returning id into pid;
  return jsonb_build_object('id',s.id,'participantId',pid);
end $$;

create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.game_sessions; r public.session_rounds; pid uuid; a public.answers; ishost boolean; q jsonb; rankings jsonb; begin
  select * into s from public.game_sessions where id=p_id;
  if not found then raise exception 'Không tìm thấy phiên chơi.'; end if;
  ishost:=coalesce(s.owner_id=auth.uid() and exists(select 1 from public.app_admins where user_id=auth.uid()),false);
  select id into pid from public.participants where session_id=s.id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not ishost and pid is null and p_token is distinct from s.view_token::text then raise exception 'Vào phòng bằng mã hoặc link được chia sẻ.' using errcode='42501'; end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  q:=r.question;
  if s.phase in ('lobby','question') then q:=q-'correct'-'explanation'; end if;
  select * into a from public.answers where round_id=r.id and participant_id=pid;
  select coalesce(jsonb_agg(to_jsonb(t) order by score desc,name),'[]') into rankings from
    (select id,name,score,rank() over(order by score desc) as rank from
      (select p.id,p.name,coalesce(sum(a2.awarded),0)::integer as score from public.participants p left join public.answers a2 on a2.participant_id=p.id
       where p.session_id=s.id group by p.id) totals) t;
  return jsonb_build_object('id',s.id,'title',s.title,'code',s.code,'phase',s.phase,'capacity',s.capacity,'revision',s.revision,
    'index',s.current_index,'total',(select count(*) from public.session_rounds where session_id=s.id),'roundId',r.id,
    'question',q,'deadline',s.deadline,'serverTime',clock_timestamp(),'count',(select count(*) from public.participants where session_id=s.id),
    'answered',(select count(*) from public.answers where round_id=r.id),'standings',rankings,'myId',pid,
    'myAnswer',case when a.participant_id is null then null when s.phase in ('lobby','question') then jsonb_build_object('payload',a.payload)
      else jsonb_build_object('payload',a.payload,'correct',a.correct,'points',a.awarded) end,
    'host',ishost,'syncTopic','game:'||s.id||':'||s.view_token);
end $$;

create function public.answer_submit(p_id uuid,p_round_id uuid,p_token text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.game_sessions; r public.session_rounds; pid uuid; ok boolean; n integer; begin
  select * into s from public.game_sessions where id=p_id for update;
  select id into pid from public.participants where session_id=p_id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if pid is null then raise exception 'Bạn chưa vào phòng.' using errcode='42501'; end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Đã chuyển sang câu khác.'; end if;
  if exists(select 1 from public.answers where round_id=r.id and participant_id=pid) then return public.session_view(p_id,p_token); end if;
  if s.phase<>'question' or clock_timestamp()>s.deadline then raise exception 'Đã hết thời gian trả lời.'; end if;
  if r.question->>'kind'='choice' then
    if not (p_payload ? 'choice') or jsonb_typeof(p_payload->'choice')<>'number'
      or (p_payload->>'choice')::numeric<>trunc((p_payload->>'choice')::numeric)
      or (p_payload->>'choice')::integer not between 0 and jsonb_array_length(r.question->'options')-1 then raise exception 'Đáp án chưa hợp lệ.'; end if;
    ok:=(p_payload->>'choice')::integer=(r.question->>'correct')::integer;
  else
    n:=power((r.question->>'grid')::integer,2)::integer;
    if jsonb_typeof(p_payload->'tiles') is distinct from 'array' or jsonb_array_length(p_payload->'tiles')<>n then raise exception 'Các mảnh ghép chưa hợp lệ.'; end if;
    if (select count(distinct x::integer) from jsonb_array_elements_text(p_payload->'tiles') x where x::integer between 0 and n-1)<>n then raise exception 'Các mảnh ghép bị trùng hoặc thiếu.'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload->'tiles') x where jsonb_typeof(x)<>'number' or (x::text)::numeric<>trunc((x::text)::numeric)) then raise exception 'Các mảnh ghép chưa hợp lệ.'; end if;
    select bool_and((value::text)::integer=ordinality-1) into ok from jsonb_array_elements(p_payload->'tiles') with ordinality;
  end if;
  insert into public.answers(round_id,participant_id,payload,correct) values(r.id,pid,p_payload,ok);
  return public.session_view(p_id,p_token);
end $$;

create function public.session_control(p_id uuid,p_action text,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin(); s public.game_sessions; r public.session_rounds; n integer; begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Bạn không có quyền điều khiển phiên này.' using errcode='42501'; end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Câu hỏi đã thay đổi. Hãy tải lại.'; end if;
  case p_action
    when 'start' then
      if s.phase<>'lobby' then return public.session_view(p_id); end if;
      update public.game_sessions set phase='question',deadline=clock_timestamp()+make_interval(secs=>(r.question->>'seconds')::integer),revision=revision+1 where id=p_id;
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
          deadline=clock_timestamp()+make_interval(secs=>(r.question->>'seconds')::integer),revision=revision+1 where id=p_id;
      end if;
    when 'finish' then
      update public.game_sessions set phase='finished',deadline=null,revision=revision+1 where id=p_id;
    else raise exception 'Thao tác không hợp lệ.';
  end case;
  return public.session_view(p_id);
end $$;
revoke execute on function public.require_admin() from public;
revoke execute on function public.bank_list(), public.bank_save(jsonb), public.bank_archive(uuid), public.session_list(), public.session_create(text,uuid[],integer), public.session_control(uuid,text,uuid) from public,anon;
grant execute on function public.bank_list(), public.bank_save(jsonb), public.bank_archive(uuid), public.session_list(), public.session_create(text,uuid[],integer), public.session_control(uuid,text,uuid) to authenticated;
revoke execute on function public.set_list(),public.set_save(uuid,text,uuid[]),public.set_archive(uuid) from public,anon;
grant execute on function public.set_list(),public.set_save(uuid,text,uuid[]),public.set_archive(uuid) to authenticated;
revoke execute on function public.session_join(text,text,text),public.session_view(uuid,text),public.answer_submit(uuid,uuid,text,jsonb) from public;
grant execute on function public.session_join(text,text,text),public.session_view(uuid,text),public.answer_submit(uuid,uuid,text,jsonb) to anon,authenticated;
