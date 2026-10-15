-- Optional hint cost. Existing rooms keep their scoring unchanged.
alter table public.game_sessions add column hint_penalty integer not null default 0 check (hint_penalty in (0,50));

alter function public.session_create(text,uuid[],integer,uuid[],uuid,uuid[]) rename to session_create_before_hints;
revoke all on function public.session_create_before_hints(text,uuid[],integer,uuid[],uuid,uuid[]) from public,anon,authenticated;
create function public.session_create(p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[] default null,p_set_id uuid default null,p_reserve_question_ids uuid[] default '{}',p_hint_penalty integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
  if p_hint_penalty is null or p_hint_penalty not in (0,50) then raise exception 'Mỗi gợi ý trừ 0 hoặc 50 điểm.';end if;
  v:=public.session_create_before_hints(p_title,p_question_ids,p_capacity,p_star_question_ids,p_set_id,p_reserve_question_ids);
  update public.game_sessions set hint_penalty=p_hint_penalty where id=(v->>'id')::uuid;
  return v;
end $$;

alter function public.session_plan_save(uuid,text,uuid[],integer,uuid[],uuid[]) rename to session_plan_save_before_hints;
revoke all on function public.session_plan_save_before_hints(uuid,text,uuid[],integer,uuid[],uuid[]) from public,anon,authenticated;
create function public.session_plan_save(p_id uuid,p_title text,p_question_ids uuid[],p_capacity integer,p_star_question_ids uuid[],p_reserve_question_ids uuid[] default '{}',p_hint_penalty integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
  if p_hint_penalty is null or p_hint_penalty not in (0,50) then raise exception 'Mỗi gợi ý trừ 0 hoặc 50 điểm.';end if;
  v:=public.session_plan_save_before_hints(p_id,p_title,p_question_ids,p_capacity,p_star_question_ids,p_reserve_question_ids);
  update public.game_sessions set hint_penalty=p_hint_penalty where id=p_id;
  return v;
end $$;

alter function public.session_plan(uuid) rename to session_plan_before_hints;
revoke all on function public.session_plan_before_hints(uuid) from public,anon,authenticated;
create function public.session_plan(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin return public.session_plan_before_hints(p_id)||jsonb_build_object('hintPenalty',(select hint_penalty from public.game_sessions where id=p_id));end $$;

-- Award after subtracting opened hints, then apply the player's star once.
-- Reserve rounds still award zero points and only resolve prize positions.
create or replace function public.score_answer() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.session_rounds;star boolean;penalty integer;begin
  select * into r from public.session_rounds where id=new.round_id;
  if tg_op='INSERT' then
    new.response_ms:=greatest(0,coalesce((extract(epoch from (case when new.payload->>'buzz'='true' then r.buzzed_at else clock_timestamp() end-r.started_at))*1000)::bigint,0));
    update public.round_stars set used=true where round_id=new.round_id and participant_id=new.participant_id and not used;
  end if;
  select exists(select 1 from public.round_stars where round_id=new.round_id and participant_id=new.participant_id and used) into star;
  select hint_penalty into penalty from public.game_sessions where id=r.session_id;
  if new.awarded>0 then
    new.awarded:=case when new.correct and r.tie_eligible is null then greatest(0,(r.question->>'points')::integer-r.hint_count*penalty)*case when star then 2 else 1 end else 0 end;
  end if;
  return new;
end $$;

alter function public.session_view(uuid,text) rename to session_view_before_hints;
revoke all on function public.session_view_before_hints(uuid,text) from public,anon,authenticated;
create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r public.session_rounds;penalty integer;base integer;begin
  v:=public.session_view_before_hints(p_id,p_token);
  select * into r from public.session_rounds where id=(v->>'roundId')::uuid;
  select hint_penalty into penalty from public.game_sessions where id=p_id;
  base:=(r.question->>'points')::integer;
  v:=jsonb_set(v,'{question,points}',to_jsonb(case when r.tie_eligible is not null then 0 else greatest(0,base-r.hint_count*penalty) end));
  if v->>'phase' in ('lobby','question') then
    v:=jsonb_set(v,'{question}',(v->'question')-'answerImage');
  end if;
  return v||jsonb_build_object('hintPenalty',penalty,'basePoints',base);
end $$;

create or replace function public.session_hint(p_id uuid,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  select * into r from public.session_rounds where session_id=s.id and position=s.current_index;
  if r.id is distinct from p_round_id or s.phase<>'question' then raise exception 'Không mở gợi ý ở bước này.';end if;
  if s.hint_penalty>0 and r.buzz_winner is not null then raise exception 'Chấm lượt trả lời trước khi mở gợi ý.';end if;
  if r.hint_count>=jsonb_array_length(coalesce(r.question->'hints','[]')) then return public.session_view(p_id);end if;
  update public.session_rounds set hint_count=hint_count+1 where id=r.id;
  update public.game_sessions set revision=revision+1 where id=p_id;
  return public.session_view(p_id);
end $$;

revoke all on function public.session_create(text,uuid[],integer,uuid[],uuid,uuid[],integer),public.session_plan_save(uuid,text,uuid[],integer,uuid[],uuid[],integer),public.session_plan(uuid) from public,anon;
grant execute on function public.session_create(text,uuid[],integer,uuid[],uuid,uuid[],integer),public.session_plan_save(uuid,text,uuid[],integer,uuid[],uuid[],integer),public.session_plan(uuid) to authenticated;
revoke all on function public.session_view(uuid,text) from public;
grant execute on function public.session_view(uuid,text) to anon,authenticated;
revoke all on function public.score_answer() from public,anon,authenticated;
