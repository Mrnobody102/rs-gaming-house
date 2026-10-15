-- Repair databases that recorded an earlier revision of migration 012.
-- Keep room content, participants, answers and existing valid buzzer windows.
alter table public.session_rounds add column if not exists buzz_opened_at timestamptz;
alter table public.session_rounds add column if not exists buzz_open_id uuid;
with repaired as (
  update public.session_rounds set buzz_open_id=gen_random_uuid(),buzz_opened_at=clock_timestamp()
    where buzz_open and buzz_open_id is null returning session_id
)
update public.game_sessions set revision=revision+1 where id in (select session_id from repaired);


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

do $$ begin
  if to_regprocedure('public.buzz_submit_before_window(uuid,uuid,text)') is null then
    alter function public.buzz_submit(uuid,uuid,text) rename to buzz_submit_before_window;
  end if;
end $$;
revoke all on function public.buzz_submit_before_window(uuid,uuid,text) from public,anon,authenticated;


create or replace function public.buzz_submit(p_id uuid,p_round_id uuid,p_token text,p_buzz_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare window_id uuid;begin
  perform 1 from public.game_sessions where id=p_id for update;
  select buzz_open_id into window_id from public.session_rounds where id=p_round_id and session_id=p_id;
  if p_buzz_id is null or p_buzz_id is distinct from window_id then raise exception 'MC chưa mở BUZZ hoặc lượt chuông đã thay đổi. Hãy bấm lại khi chuông mở.';end if;
  return public.buzz_submit_before_window(p_id,p_round_id,p_token);
end $$;

create or replace function public.session_view(p_id uuid,p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r public.session_rounds;begin
  v:=public.session_view_before_buzz(p_id,p_token);
  select * into r from public.session_rounds where id=(v->>'roundId')::uuid;
  v:=v||jsonb_build_object('buzzId',r.buzz_open_id);
  if v->'buzzWinner'<>'null'::jsonb then
    v:=jsonb_set(v,'{buzzWinner,elapsedMs}',case when r.buzzed_at is null or r.buzz_opened_at is null then 'null'::jsonb else to_jsonb(greatest(0,floor(extract(epoch from (r.buzzed_at-r.buzz_opened_at))*1000))::bigint) end);
  end if;
  return v;
end $$;

revoke all on function public.buzz_submit(uuid,uuid,text,uuid),public.session_view(uuid,text) from public;
grant execute on function public.buzz_submit(uuid,uuid,text,uuid),public.session_view(uuid,text) to anon,authenticated;

