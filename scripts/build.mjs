import { spawnSync } from "node:child_process";
import { cp } from "node:fs/promises";
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  { stdio: "inherit", env: process.env },
);
if (result.status !== 0) process.exit(result.status || 1);
for (const [from, to] of [
  ["public", ".next/standalone/public"],
  [".next/static", ".next/standalone/.next/static"],
  ["supabase/migrations", ".next/standalone/supabase/migrations"],
])
  await cp(from, to, { recursive: true });
