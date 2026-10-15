import type { NextRequest } from "next/server";
import { isAdmin } from "./admin-auth";
import { type Command } from "./commands";
import { publishGameChange } from "./game-events";
const casts: Record<string, string> = {
  p_id: "uuid",
  p_question: "jsonb",
  p_payload: "jsonb",
  p_question_ids: "uuid[]",
  p_star_question_ids: "uuid[]",
  p_reserve_question_ids: "uuid[]",
  p_question_id: "uuid",
  p_set_id: "uuid",
  p_active: "boolean",
  p_round_id: "uuid",
  p_buzz_id: "uuid",
  p_participant_id: "uuid",
  p_capacity: "integer",
  p_open: "boolean",
  p_correct: "boolean",
  p_lng: "double precision",
  p_lat: "double precision",
};
export async function execute(
  command: Command,
  args: Record<string, unknown>,
  request: NextRequest,
) {
  const admin = isAdmin(request);
  if (
    ![
      "session_join",
      "session_view",
      "answer_submit",
      "buzz_submit",
      "star_select",
    ].includes(command) &&
    !admin
  )
    throw Object.assign(new Error("Nhập mật mã để vào quản trị."), {
      code: "42501",
    });
  const { localDatabase, DEMO_ADMIN } = await import("./local-database");
  const db = await localDatabase();
  const result = await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      admin ? DEMO_ADMIN : "",
    ]);
    const entries = Object.entries(args);
    const sql = `select public.${command}(${entries.map(([key], i) => `${key} => $${i + 1}::${casts[key] || "text"}`).join(",")}) as result`;
    const { rows } = await tx.query<{ result: unknown }>(
      sql,
      entries.map(([key, value]) =>
        casts[key] === "jsonb" ? JSON.stringify(value) : value,
      ),
    );
    return rows[0].result;
  });
  if (
    command !== "session_view" &&
    result &&
    typeof result === "object" &&
    "id" in result &&
    "revision" in result &&
    typeof result.id === "string" &&
    typeof result.revision === "number"
  ) {
    publishGameChange(result.id, result.revision);
  }
  return result;
}
