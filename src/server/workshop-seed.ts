import type { SqlDatabase } from "./database-types";
import { workshopQuestions, workshopSet } from "@/content/workshop";
const retiredSampleIds = [
  ...Array.from({ length: 5 }, (_, i) => 1101 + i),
  ...Array.from({ length: 18 }, (_, i) => 1201 + i),
].map((number) => `7b0c6f11-5dd8-4d44-8ba7-b03a2bea${number}`);

export async function seedWorkshop(db: SqlDatabase, owner: string) {
  await db.transaction(async (tx) => {
    const version = "workshop_20261016_v2";
    if (
      (
        await tx.query(
          "select name from public.local_migrations where name=$1",
          [version],
        )
      ).rows.length
    )
      return;
    const oldIds = retiredSampleIds;
    // Remove only the known demonstration content, preserving authored questions,
    // mixed sets and immutable snapshots in rooms already created.
    await tx.query(
      "update public.questions set archived=true where owner_id=$1 and id=any($2::uuid[])",
      [owner, oldIds],
    );
    await tx.query(
      `update public.question_sets set
      question_ids=array(select id from unnest(question_ids) id where not(id=any($2::uuid[]))),
      star_question_ids=array(select id from unnest(star_question_ids) id where not(id=any($2::uuid[]))),
      reserve_question_ids=array(select id from unnest(reserve_question_ids) id where not(id=any($2::uuid[]))),
      archived=case when question_ids <@ $2::uuid[] then true else archived end
      where owner_id=$1 and (question_ids && $2::uuid[] or reserve_question_ids && $2::uuid[])`,
      [owner, oldIds],
    );
    for (const q of workshopQuestions) {
      // A live dev tab may have loaded the initial import before the author
      // confirmed the last answers. Upgrade only an exact untouched draft.
      const draft = { ...q, kind: "riddle" } as Record<string, unknown>;
      delete draft.afterImage;
      delete draft.tolerance;
      if (q.tags.includes("Slide 11"))
        Object.assign(draft, {
          title: "Techno Park nằm ở ô nào trên ảnh cũ?",
          solution:
            "MC xác nhận ô trên ảnh; đối chiếu với ảnh hiện tại khi mở đáp án.",
          explanation: "",
        });
      await tx.query(
        `insert into public.questions(id,owner_id,body) values($1,$2,$3)
        on conflict(id) do update set body=excluded.body
        where questions.owner_id=$2 and not questions.archived and questions.body=$4::jsonb`,
        [q.id, owner, JSON.stringify(q), JSON.stringify(draft)],
      );
    }
    await tx.query(
      "insert into public.question_sets(id,owner_id,title,question_ids,star_question_ids,reserve_question_ids) values($1,$2,$3,$4,$5,$6) on conflict do nothing",
      [
        workshopSet.id,
        owner,
        workshopSet.title,
        workshopSet.questionIds,
        workshopSet.starQuestionIds,
        workshopSet.reserveQuestionIds,
      ],
    );
    await tx.query("insert into public.local_migrations values($1)", [version]);
  });
}
