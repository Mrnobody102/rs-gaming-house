-- Image questions can use a written answer; calibrated legacy questions remain valid.
create or replace function public.bank_save(p_question jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.require_admin();n integer;k text:=p_question->>'kind';begin
  if coalesce(k not in ('choice','puzzle','place','locate','change','riddle') or length(p_question->>'title') not between 3 and 220 or (p_question->>'seconds')::integer not between 15 and 600 or (p_question->>'points')::integer not between 1 and 1000,true) then raise exception 'Câu hỏi chưa hợp lệ.';end if;
  if k='choice' then n:=jsonb_array_length(p_question->'options');if coalesce(n not between 2 and 4 or (p_question->>'correct')::integer not between 0 and n-1,true) then raise exception 'Chọn đáp án đúng.';end if;
  else
    if k<>'riddle' and coalesce(p_question->>'image','')='' then raise exception 'Chọn ảnh câu hỏi.';end if;
    if k='puzzle' and coalesce((p_question->>'grid')::integer not in (2,3),true) then raise exception 'Kiểm tra số mảnh.';end if;
    if k in ('place','riddle','locate','change') and coalesce(length(trim(p_question->>'solution')),0)=0 then
      if k='locate' and jsonb_typeof(p_question->'target')='object' and jsonb_typeof(p_question->'bounds')='object' then null;
      elsif k='change' and coalesce(jsonb_array_length(p_question->'regions'),0)>0 then null;
      else raise exception 'Nhập đáp án.';end if;
    end if;
    if k='riddle' and jsonb_array_length(coalesce(p_question->'hints','[]'))>3 then raise exception 'Tối đa 3 gợi ý.';end if;
  end if;
  insert into public.questions(id,owner_id,body) values((p_question->>'id')::uuid,u,p_question)
  on conflict(id) do update set body=excluded.body,updated_at=now(),archived=false where questions.owner_id=u;
  if not found then raise exception 'Bạn không có quyền sửa câu hỏi này.' using errcode='42501';end if;return p_question;
end $$;
