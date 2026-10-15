import { localDatabase } from "@/server/local-database";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = await localDatabase();
    const { rows } = await db.query<{
      window_ready: boolean;
      submit_ready: boolean;
      view_ready: boolean;
    }>(`
      select exists(select 1 from information_schema.columns where table_schema='public' and table_name='session_rounds' and column_name='buzz_open_id') as window_ready,
        to_regprocedure('public.buzz_submit(uuid,uuid,text,uuid)') is not null as submit_ready,
        exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname in ('session_view','session_view_before_hints')
          and strpos(pg_get_functiondef(p.oid),'buzzId')>0) as view_ready
    `);
    const ready =
      rows[0].window_ready && rows[0].submit_ready && rows[0].view_ready;
    if (!ready)
      console.error("[health] Buzzer database upgrade required", rows[0]);
    return Response.json(
      { ok: ready },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
