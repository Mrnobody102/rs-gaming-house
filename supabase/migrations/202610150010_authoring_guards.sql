-- Add a newly authored question and attach it to a set atomically.
create function public.bank_save_to_set(p_id uuid,p_question jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.question_sets;v jsonb;begin
  select * into s from public.question_sets where id=p_id and owner_id=u and not archived for update;
  if not found then raise exception 'Không tìm thấy bộ câu hỏi.';end if;
  if (p_question->>'id')::uuid=any(s.reserve_question_ids) then raise exception 'Câu này đang là câu dự bị. Bỏ khỏi dự bị trước khi thêm vào câu chính.';end if;
  v:=public.bank_save(p_question);
  perform public.set_add_question(p_id,(p_question->>'id')::uuid);
  return v;
end $$;

alter function public.set_add_question(uuid,uuid) rename to set_add_question_previous;
revoke all on function public.set_add_question_previous(uuid,uuid) from public,anon,authenticated;
create function public.set_add_question(p_id uuid,p_question_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();s public.question_sets;begin
  select * into s from public.question_sets where id=p_id and owner_id=u and not archived for update;
  if not found then raise exception 'Không tìm thấy bộ câu hỏi.';end if;
  if p_question_id=any(s.reserve_question_ids) then raise exception 'Câu này đang là câu dự bị. Bỏ khỏi dự bị trước khi thêm vào câu chính.';end if;
  return public.set_add_question_previous(p_id,p_question_id);
end $$;
revoke all on function public.bank_save_to_set(uuid,jsonb),public.set_add_question(uuid,uuid) from public,anon;
grant execute on function public.bank_save_to_set(uuid,jsonb),public.set_add_question(uuid,uuid) to authenticated;
