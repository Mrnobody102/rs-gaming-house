-- Preserve existing content and sessions; add the three Earth observation games.
do $$ declare c record;begin
  for c in select conname from pg_constraint where conrelid='public.questions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%kind%' loop
    execute format('alter table public.questions drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.questions add constraint questions_kind check(body->>'kind' in ('choice','puzzle','place','locate','change'));
alter table public.session_rounds add column buzz_open boolean not null default false;
alter table public.session_rounds add column buzz_winner uuid references public.participants(id);
alter table public.session_rounds add column hint_count integer not null default 0;
alter table public.session_rounds add column guess jsonb;

create or replace function public.bank_save(p_question jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();n integer;k text:=p_question->>'kind';begin
  if coalesce(k not in ('choice','puzzle','place','locate','change') or length(p_question->>'title') not between 3 and 220 or (p_question->>'seconds')::integer not between 15 and 600 or (p_question->>'points')::integer not between 1 and 1000,true) then raise exception 'Câu hỏi chưa hợp lệ.';end if;
  if k='choice' then n:=jsonb_array_length(p_question->'options');if coalesce(n not between 2 and 4 or (p_question->>'correct')::integer not between 0 and n-1,true) then raise exception 'Chọn đáp án đúng.';end if;
  else
    if coalesce(p_question->>'image','')='' then raise exception 'Chọn ảnh câu hỏi.';end if;
    if k='puzzle' and coalesce((p_question->>'grid')::integer not in (2,3),true) then raise exception 'Kiểm tra số mảnh.';end if;
    if k='place' and coalesce(length(trim(p_question->>'solution')),0)=0 then raise exception 'Nhập địa danh đúng.';end if;
    if k='locate' and (p_question->'target' is null or p_question->'bounds' is null) then raise exception 'Nhập phạm vi tọa độ và đáp án.';end if;
    if k='change' and (coalesce(p_question->>'afterImage','')='' or coalesce(jsonb_array_length(p_question->'regions'),0)=0) then raise exception 'Chọn cặp ảnh và đánh dấu vùng biến động.';end if;
  end if;
  insert into public.questions(id,owner_id,body) values((p_question->>'id')::uuid,u,p_question)
  on conflict(id) do update set body=excluded.body,updated_at=now(),archived=false where questions.owner_id=u;
  if not found then raise exception 'Bạn không có quyền sửa câu hỏi này.' using errcode='42501';end if;return p_question;
end $$;

alter function public.session_view(uuid,text) rename to session_view_base;
create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r public.session_rounds;q jsonb;shown jsonb;reveal boolean;winner jsonb;begin
  v:=public.session_view_base(p_id,p_token);select * into r from public.session_rounds where id=(v->>'roundId')::uuid;
  reveal:=v->>'phase' in ('result','leaderboard','finished');q:=r.question;
  if not reveal then q:=q-'correct'-'explanation'-'solution'-'target'-'regions';if q->>'kind'='locate' then q:=q-'afterImage';end if;end if;
  select coalesce(jsonb_agg(value order by ordinality),'[]') into shown from jsonb_array_elements(coalesce(r.question->'hints','[]')) with ordinality where reveal or ordinality<=r.hint_count;
  q:=jsonb_set(q,'{hints}',shown);
  if r.buzz_winner is not null then select jsonb_build_object('id',p.id,'name',p.name,'graded',exists(select 1 from public.answers where round_id=r.id and participant_id=p.id)) into winner from public.participants p where p.id=r.buzz_winner;end if;
  return v||jsonb_build_object('question',q,'buzzOpen',r.buzz_open,'buzzWinner',winner,'hintCount',r.hint_count,'hintTotal',jsonb_array_length(coalesce(r.question->'hints','[]')),'guess',r.guess);
end $$;
-- The underlying view must not be callable directly: it does not redact EO solutions.
revoke execute on function public.session_view_base(uuid,text) from public,anon,authenticated;
revoke execute on function public.session_view(uuid,text) from public;
grant execute on function public.session_view(uuid,text) to anon,authenticated;

alter function public.answer_submit(uuid,uuid,text,jsonb) rename to answer_submit_base;
create function public.answer_submit(p_id uuid,p_round_id uuid,p_token text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.session_rounds where id=p_round_id and session_id=p_id and question->>'kind' not in ('choice','puzzle')) then raise exception 'Dùng BUZZ để giành quyền trả lời.';end if;
  return public.answer_submit_base(p_id,p_round_id,p_token,p_payload);
end $$;
revoke execute on function public.answer_submit_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke execute on function public.answer_submit(uuid,uuid,text,jsonb) from public;
grant execute on function public.answer_submit(uuid,uuid,text,jsonb) to anon,authenticated;

create function public.buzz_control(p_id uuid,p_round_id uuid,p_open boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' or r.question->>'kind' not in ('place','locate','change') then raise exception 'Không mở BUZZ ở bước này.';end if;
  if p_open and (r.buzz_winner is not null or clock_timestamp()>s.deadline) then raise exception 'Chưa thể mở BUZZ.';end if;
  update public.session_rounds set buzz_open=p_open where id=r.id;
  update public.game_sessions set revision=revision+1 where id=s.id;return public.session_view(p_id);
end $$;
create function public.buzz_submit(p_id uuid,p_round_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.game_sessions;r public.session_rounds;pid uuid;begin
  select * into s from public.game_sessions where id=p_id for update;
  select id into pid from public.participants where session_id=p_id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if pid is null then raise exception 'Bạn chưa vào phòng.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' or clock_timestamp()>s.deadline then raise exception 'Đã hết lượt BUZZ.';end if;
  if r.buzz_winner is not null then return public.session_view(p_id,p_token);end if;
  if not r.buzz_open or r.question->>'kind' not in ('place','locate','change') then raise exception 'MC chưa mở BUZZ.';end if;
  if exists(select 1 from public.answers where round_id=r.id and participant_id=pid) then raise exception 'Bạn đã trả lời câu này.';end if;
  update public.session_rounds set buzz_winner=pid,buzz_open=false where id=r.id;
  update public.game_sessions set revision=revision+1 where id=p_id;return public.session_view(p_id,p_token);
end $$;
create function public.buzz_grade(p_id uuid,p_round_id uuid,p_participant_id uuid,p_correct boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Đã chuyển câu hỏi.';end if;
  if exists(select 1 from public.answers where round_id=r.id and participant_id=p_participant_id) then return public.session_view(p_id);end if;
  if s.phase<>'question' or r.buzz_winner is distinct from p_participant_id or p_participant_id is null then raise exception 'Lượt trả lời đã thay đổi.';end if;
  insert into public.answers(round_id,participant_id,payload,correct) values(r.id,r.buzz_winner,'{"buzz":true}',p_correct);
  if p_correct then return public.session_control(p_id,'reveal',p_round_id);end if;
  update public.session_rounds set buzz_winner=null,buzz_open=false where id=r.id;
  update public.game_sessions set revision=revision+1 where id=p_id;return public.session_view(p_id);
end $$;
create function public.session_hint(p_id uuid,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' then raise exception 'Không mở gợi ý ở bước này.';end if;
  update public.session_rounds set hint_count=least(hint_count+1,jsonb_array_length(coalesce(question->'hints','[]'))) where id=r.id;
  update public.game_sessions set revision=revision+1 where id=p_id;return public.session_view(p_id);
end $$;
revoke execute on function public.buzz_submit(uuid,uuid,text) from public;
grant execute on function public.buzz_submit(uuid,uuid,text) to anon,authenticated;
revoke execute on function public.buzz_control(uuid,uuid,boolean),public.buzz_grade(uuid,uuid,uuid,boolean),public.session_hint(uuid,uuid) from public,anon;
grant execute on function public.buzz_control(uuid,uuid,boolean),public.buzz_grade(uuid,uuid,uuid,boolean),public.session_hint(uuid,uuid) to authenticated;
create function public.session_guess(p_id uuid,p_round_id uuid,p_lng double precision,p_lat double precision) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' or r.question->>'kind'<>'locate' then raise exception 'Không đặt điểm ở bước này.';end if;
  if not coalesce(p_lng between (r.question->'bounds'->>'west')::float8 and (r.question->'bounds'->>'east')::float8 and p_lat between (r.question->'bounds'->>'south')::float8 and (r.question->'bounds'->>'north')::float8,false) then raise exception 'Điểm nằm ngoài phạm vi ảnh.';end if;
  update public.session_rounds set guess=jsonb_build_object('lng',p_lng,'lat',p_lat) where id=r.id;
  update public.game_sessions set revision=revision+1 where id=p_id;return public.session_view(p_id);
end $$;
revoke execute on function public.session_guess(uuid,uuid,double precision,double precision) from public,anon;
grant execute on function public.session_guess(uuid,uuid,double precision,double precision) to authenticated;
