-- Direct-answer rounds: the MC controls BUZZ and opens up to three hints.
alter table public.questions drop constraint questions_kind;
alter table public.questions add constraint questions_kind check(body->>'kind' in ('choice','puzzle','place','locate','change','riddle'));


create or replace function public.bank_save(p_question jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();n integer;k text:=p_question->>'kind';begin
  if coalesce(k not in ('choice','puzzle','place','locate','change','riddle') or length(p_question->>'title') not between 3 and 220 or (p_question->>'seconds')::integer not between 15 and 600 or (p_question->>'points')::integer not between 1 and 1000,true) then raise exception 'Câu hỏi chưa hợp lệ.';end if;
  if k='choice' then n:=jsonb_array_length(p_question->'options');if coalesce(n not between 2 and 4 or (p_question->>'correct')::integer not between 0 and n-1,true) then raise exception 'Chọn đáp án đúng.';end if;
  else
    if k<>'riddle' and coalesce(p_question->>'image','')='' then raise exception 'Chọn ảnh câu hỏi.';end if;
    if k='puzzle' and coalesce((p_question->>'grid')::integer not in (2,3),true) then raise exception 'Kiểm tra số mảnh.';end if;
    if k in ('place','riddle') and coalesce(length(trim(p_question->>'solution')),0)=0 then raise exception 'Nhập đáp án.';end if;
    if k='riddle' and jsonb_array_length(coalesce(p_question->'hints','[]'))>3 then raise exception 'Tối đa 3 gợi ý.';end if;
    if k='locate' and (p_question->'target' is null or p_question->'bounds' is null) then raise exception 'Nhập phạm vi tọa độ và đáp án.';end if;
    if k='change' and (coalesce(p_question->>'afterImage','')='' or coalesce(jsonb_array_length(p_question->'regions'),0)=0) then raise exception 'Chọn cặp ảnh và đánh dấu vùng biến động.';end if;
  end if;
  insert into public.questions(id,owner_id,body) values((p_question->>'id')::uuid,u,p_question)
  on conflict(id) do update set body=excluded.body,updated_at=now(),archived=false where questions.owner_id=u;
  if not found then raise exception 'Bạn không có quyền sửa câu hỏi này.' using errcode='42501';end if;return p_question;
end $$;

create or replace function public.buzz_control(p_id uuid,p_round_id uuid,p_open boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' or r.question->>'kind' not in ('place','locate','change','riddle') then raise exception 'Không mở BUZZ ở bước này.';end if;
  if p_open and (r.buzz_winner is not null) then raise exception 'Chưa thể mở BUZZ.';end if;
  update public.session_rounds set buzz_open=p_open where id=r.id;
  update public.game_sessions set revision=revision+1 where id=s.id;return public.session_view(p_id);
end $$;

create or replace function public.buzz_submit(p_id uuid,p_round_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.game_sessions;r public.session_rounds;pid uuid;begin
  select * into s from public.game_sessions where id=p_id for update;
  select id into pid from public.participants where session_id=p_id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if pid is null then raise exception 'Bạn chưa vào phòng.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' then raise exception 'Đã hết lượt BUZZ.';end if;
  if r.buzz_winner is not null then return public.session_view(p_id,p_token);end if;
  if not r.buzz_open or r.question->>'kind' not in ('place','locate','change','riddle') then raise exception 'MC chưa mở BUZZ.';end if;
  if exists(select 1 from public.answers where round_id=r.id and participant_id=pid) then raise exception 'Bạn đã trả lời câu này.';end if;
  update public.session_rounds set buzz_winner=pid,buzz_open=false where id=r.id;
  update public.game_sessions set revision=revision+1 where id=p_id;return public.session_view(p_id,p_token);
end $$;

create or replace function public.session_control(p_id uuid,p_action text,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin(); s public.game_sessions; r public.session_rounds; n integer; begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Bạn không có quyền điều khiển phiên này.' using errcode='42501'; end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Câu hỏi đã thay đổi. Hãy tải lại.'; end if;
  case p_action
    when 'start' then
      if s.phase<>'lobby' then return public.session_view(p_id); end if;
      update public.game_sessions set phase='question',deadline=case when r.question->>'kind' in ('choice','puzzle') then clock_timestamp()+make_interval(secs=>(r.question->>'seconds')::integer) else null end,revision=revision+1 where id=p_id;
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
          deadline=case when r.question->>'kind' in ('choice','puzzle') then clock_timestamp()+make_interval(secs=>(r.question->>'seconds')::integer) else null end,revision=revision+1 where id=p_id;
      end if;
    when 'finish' then
      update public.game_sessions set phase='finished',deadline=null,revision=revision+1 where id=p_id;
    else raise exception 'Thao tác không hợp lệ.';
  end case;
  return public.session_view(p_id);
end $$;
