import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
const args = process.argv.slice(2);
const demo = args.includes("--demo"),
  dev = args.includes("--dev");
const portIndex = args.indexOf("--port");
const port =
  portIndex >= 0
    ? args[portIndex + 1]
    : process.env.PORT || (demo ? "3200" : "3100");
if (!/^\d{4,5}$/.test(port || "")) throw new Error("Invalid port");
const child = spawn(
  process.execPath,
  dev
    ? [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "0.0.0.0",
        "--port",
        port,
      ]
    : [
        ...[".env", ".env.local"]
          .filter((file) => existsSync(file))
          .map((file) => `--env-file=${file}`),
        ".next/standalone/server.js",
      ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: "0.0.0.0",
      DEMO_DATA_DIR: path.resolve(
        process.env.DEMO_DATA_DIR || ".local/postgres",
      ),
      DEMO_MEDIA_DIR: path.resolve(
        process.env.DEMO_MEDIA_DIR || ".local/media",
      ),
      ...(demo || dev
        ? {
            LOCAL_PREVIEW: "1",
          }
        : {}),
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
