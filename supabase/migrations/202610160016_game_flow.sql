-- A claimed spoken answer must be graded before publishing/finishing the round.
alter function public.session_control(uuid,text,uuid) rename to session_control_before_flow;
revoke all on function public.session_control_before_flow(uuid,text,uuid) from public,anon,authenticated;
create function public.session_control(p_id uuid,p_action text,p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Bạn không có quyền điều khiển phiên này.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=p_id and position=s.current_index;
  if r.id is distinct from p_round_id then raise exception 'Câu hỏi đã thay đổi. Hãy tải lại.';end if;
  if p_action in ('reveal','finish') and s.phase='question' and r.buzz_winner is not null
    and not exists(select 1 from public.answers where round_id=r.id and participant_id=r.buzz_winner) then
    raise exception 'Chấm đúng hoặc sai cho người giành quyền trả lời trước khi mở đáp án.';
  end if;
  if p_action='finish' and s.phase not in ('result','leaderboard','finished') then
    raise exception 'Xem đáp án và tính điểm câu hiện tại trước khi kết thúc.';
  end if;
  return public.session_control_before_flow(p_id,p_action,p_round_id);
end $$;

-- Do not offer a bell that every eligible player has already used.
alter function public.buzz_control(uuid,uuid,boolean) rename to buzz_control_before_flow;
revoke all on function public.buzz_control_before_flow(uuid,uuid,boolean) from public,anon,authenticated;
create function public.buzz_control(p_id uuid,p_round_id uuid,p_open boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.game_sessions;r public.session_rounds;begin
  select * into s from public.game_sessions where id=p_id and owner_id=u for update;
  if not found then raise exception 'Bạn không có quyền điều khiển phiên này.' using errcode='42501';end if;
  select * into r from public.session_rounds where session_id=p_id and position=s.current_index;
  if p_open and s.phase='question' and r.id=p_round_id
    and exists(select 1 from public.participants p where p.session_id=p_id and (r.tie_eligible is null or p.id=any(r.tie_eligible)))
    and not exists(select 1 from public.participants p where p.session_id=p_id and (r.tie_eligible is null or p.id=any(r.tie_eligible))
      and not exists(select 1 from public.answers a where a.round_id=r.id and a.participant_id=p.id)) then
    raise exception 'Mọi người đã trả lời. Xem đáp án hoặc chuyển sang câu dự bị khác.';
  end if;
  return public.buzz_control_before_flow(p_id,p_round_id,p_open);
end $$;

alter function public.session_view(uuid,text) rename to session_view_before_flow;
revoke all on function public.session_view_before_flow(uuid,text) from public,anon,authenticated;
create function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r public.session_rounds;own_answer public.answers;remaining integer;begin
  v:=public.session_view_before_flow(p_id,p_token);
  select * into r from public.session_rounds where id=(v->>'roundId')::uuid;
  select count(*)::integer into remaining from public.participants p where p.session_id=p_id
    and (r.tie_eligible is null or p.id=any(r.tie_eligible))
    and not exists(select 1 from public.answers answered where answered.round_id=r.id and answered.participant_id=p.id);
  -- Only MC-graded spoken answers are visible immediately. Phone quiz answers
  -- remain private until reveal, including whether the submitted choice is right.
  if v->>'phase'='question' and v->'myAnswer'->'payload'->>'buzz'='true' then
    select * into own_answer from public.answers where round_id=r.id and participant_id=(v->>'myId')::uuid;
    v:=jsonb_set(v,'{myAnswer}',(v->'myAnswer')||jsonb_build_object('correct',own_answer.correct,'points',own_answer.awarded));
  end if;
  return v||jsonb_build_object('buzzRemaining',remaining);
end $$;

revoke all on function public.session_control(uuid,text,uuid),public.buzz_control(uuid,uuid,boolean) from public,anon;
grant execute on function public.session_control(uuid,text,uuid),public.buzz_control(uuid,uuid,boolean) to authenticated;
revoke all on function public.session_view(uuid,text) from public;
grant execute on function public.session_view(uuid,text) to anon,authenticated;
