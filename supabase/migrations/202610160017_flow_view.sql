-- Repair local dev databases that already recorded the early 016 view.
-- Keep SQL aliases distinct from PL/pgSQL record names in the flow snapshot.
create or replace function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r public.session_rounds;own_answer public.answers;remaining integer;begin
  v:=public.session_view_before_flow(p_id,p_token);
  select * into r from public.session_rounds where id=(v->>'roundId')::uuid;
  select count(*)::integer into remaining from public.participants p where p.session_id=p_id
    and (r.tie_eligible is null or p.id=any(r.tie_eligible))
    and not exists(select 1 from public.answers answered where answered.round_id=r.id and answered.participant_id=p.id);
  if v->>'phase'='question' and v->'myAnswer'->'payload'->>'buzz'='true' then
    select * into own_answer from public.answers where round_id=r.id and participant_id=(v->>'myId')::uuid;
    v:=jsonb_set(v,'{myAnswer}',(v->'myAnswer')||jsonb_build_object('correct',own_answer.correct,'points',own_answer.awarded));
  end if;
  return v||jsonb_build_object('buzzRemaining',remaining);
end $$;
