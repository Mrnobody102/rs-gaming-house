import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";

// Uses a dedicated room, never edits the bank, and deletes its own rooms on exit.
const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1] || fallback;
};
const base = new URL(arg("--url", "http://127.0.0.1:3210")).origin;
const count = Number(arg("--players", "50"));
assert(Number.isInteger(count) && count >= 5 && count <= 60);
assert(
  process.env.LOAD_ADMIN_PASSCODE,
  "Set LOAD_ADMIN_PASSCODE for this test server.",
);
const output = arg("--output", "artifacts/room-load.json");
const allowPolling = process.argv.includes("--allow-polling");
const maxMcMs = Number(arg("--max-mc-ms", "2000"));
assert(Number.isFinite(maxMcMs) && maxMcMs > 0);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = {
  origin: base,
  at: new Date().toISOString(),
  players: count,
  waves: [],
  bursts: [],
  requests: {},
  failures: [],
  cleanup: {},
};
const samples = new Map(),
  rooms = new Set(),
  clients = [];
let cookie = "",
  browser,
  host,
  deleting = false;
async function api(command, args, admin = false) {
  const start = performance.now();
  let recorded = false;
  try {
    const response = await fetch(`${base}/api/command/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(admin ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ command, args }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) {
      report.failures.push({
        command,
        status: response.status,
        code: data.code,
      });
      recorded = true;
      throw new Error(`${command}: HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    if (!recorded)
      report.failures.push({
        command,
        error: error.name,
        code: error.cause?.code,
      });
    throw error;
  } finally {
    if (!samples.has(command)) samples.set(command, []);
    samples.get(command).push(performance.now() - start);
  }
}
async function waitFor(check, description, timeout = 30000) {
  const limit = Date.now() + timeout;
  while (!check()) {
    assert(Date.now() < limit, `Timeout: ${description}`);
    await sleep(20);
  }
}
async function refresh(client) {
  if (deleting) return;
  if (client.pending) {
    client.dirty = true;
    return;
  }
  clearTimeout(client.timer);
  client.pending = true;
  try {
    do {
      client.dirty = false;
      client.view = await api("session_view", {
        p_id: client.room,
        p_token: client.token,
      });
      if (client.view.buzzOpen && !client.opened.has(client.view.buzzId))
        client.opened.set(client.view.buzzId, performance.now());
    } while (client.dirty && !deleting);
  } catch (error) {
    client.error = error.message;
  } finally {
    client.pending = false;
    if (!deleting)
      client.timer = setTimeout(
        () => void refresh(client),
        client.ready && !client.closed ? 6000 : 1200,
      );
  }
}
async function connect(client) {
  const opening = new AbortController();
  const timer = setTimeout(() => opening.abort(), 20000);
  const response = await fetch(
    `${base}/api/events/?${new URLSearchParams({ id: client.room, token: client.token })}`,
    {
      headers: { Accept: "text/event-stream", "Accept-Encoding": "identity" },
      signal: AbortSignal.any([
        client.abort.signal,
        opening.signal,
        AbortSignal.timeout(300000),
      ]),
    },
  );
  clearTimeout(timer);
  assert(response.ok, `SSE: HTTP ${response.status}`);
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  client.reading = (async () => {
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          client.closed = true;
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (event.includes("event: change")) {
            client.ready = true;
            void refresh(client);
          }
          if (event.includes(": heartbeat")) client.heartbeats++;
        }
      }
    } catch (error) {
      if (!client.abort.signal.aborted) client.error = error.message;
    }
  })();
}
async function create(questionIds, suffix) {
  const room = await api(
    "session_create",
    { title: `LOAD CHECK ${report.at} ${suffix}`, questionIds, capacity: 60 },
    true,
  );
  rooms.add(room.id);
  return room;
}
async function remove(id) {
  await api("session_delete", { p_id: id }, true);
  rooms.delete(id);
}
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b),
    p = (n) =>
      Math.round(sorted[Math.max(0, Math.ceil(sorted.length * n) - 1)] || 0);
  return { count: values.length, p50Ms: p(0.5), p95Ms: p(0.95), maxMs: p(1) };
};
try {
  const login = await fetch(`${base}/api/admin/auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: process.env.LOAD_ADMIN_PASSCODE }),
    signal: AbortSignal.timeout(60000),
  });
  assert(login.ok, `Admin login: HTTP ${login.status}`);
  cookie = login.headers.get("set-cookie")?.split(";")[0] || "";
  assert(cookie, "Admin cookie missing");
  const bank = await api("bank_list", {}, true);
  const questions = bank
    .filter((q) => ["place", "riddle", "locate", "change"].includes(q.kind))
    .slice(0, 4);
  assert(questions.length === 4, "Need four BUZZ questions in the bank.");
  const room = await create(
    questions.map((q) => q.id),
    "main",
  );
  console.log("Dedicated test room created; joining players");
  report.room = room.id;
  const joinStart = performance.now();
  await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const token = crypto.randomUUID(),
        name = `LOAD ${String(i + 1).padStart(2, "0")}`;
      const joined = await api("session_join", {
        p_code: room.code,
        p_name: name,
        p_token: token,
      });
      clients.push({
        room: room.id,
        token,
        name,
        id: joined.participantId,
        abort: new AbortController(),
        opened: new Map(),
        heartbeats: 0,
      });
    }),
  );
  report.joinBatchMs = Math.round(performance.now() - joinStart);
  console.log(`Joined ${clients.length} players; opening SSE connections`);
  const streams = await Promise.allSettled(clients.map(connect));
  report.streamFailures = streams
    .filter((s) => s.status === "rejected")
    .map((s) => s.reason.cause?.code || s.reason.name);
  if (!allowPolling)
    assert(report.streamFailures.length === 0, "SSE connections failed");
  streams.forEach((s, i) => {
    if (s.status === "rejected") clients[i].abort.abort();
  });
  await Promise.all(clients.map(refresh));
  await waitFor(() => clients.every((c) => c.view), "initial snapshots");
  report.sseOpened = clients.filter((c) => c.ready).length;
  report.mode =
    report.sseOpened === count
      ? "SSE plus 6-second fallback polling"
      : "polling fallback";
  console.log(`SSE ready: ${report.sseOpened}/${count}; ${report.mode}`);
  browser = await chromium.launch({
    channel: process.platform === "win32" ? "msedge" : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const separator = cookie.indexOf("=");
  await context.addCookies([
    {
      name: cookie.slice(0, separator),
      value: cookie.slice(separator + 1),
      url: base,
      httpOnly: true,
      secure: base.startsWith("https:"),
      sameSite: "Lax",
    },
  ]);
  host = await context.newPage();
  await host.goto(`${base}/admin/sessions/${room.id}/`, { timeout: 60000 });
  await host.getByRole("button", { name: "Bắt đầu", exact: true }).waitFor();
  console.log(
    `${count} players + ${report.sseOpened} SSE connections + one real MC browser ready at ${base}`,
  );
  await sleep(16000); // Background snapshot polling and at least one heartbeat.
  let game = await api("session_view", { p_id: room.id }, true),
    total = 0;
  const control = async (p_action) =>
    api(
      "session_control",
      { p_id: room.id, p_round_id: game.roundId, p_action },
      true,
    );
  game = await control("start");
  for (let round = 0; round < questions.length; round++) {
    const lost = new Set();
    for (let attempt = 0; attempt < 5; attempt++) {
      const opening = performance.now();
      game = await api(
        "buzz_control",
        { p_id: room.id, p_round_id: game.roundId, p_open: true },
        true,
      );
      const eligible = clients.filter((c) => !lost.has(c.id));
      await waitFor(
        () => eligible.every((c) => c.opened.has(game.buzzId)),
        "players see the opening",
      );
      const notificationMs = eligible.map(
        (c) => c.opened.get(game.buzzId) - opening,
      );
      await host.waitForFunction(
        () => !document.querySelector(".buzz-winner strong"),
      );
      const burst = performance.now();
      const visible = host
        .waitForFunction(
          () => !!document.querySelector(".buzz-winner strong"),
          null,
          { timeout: 30000 },
        )
        .then(() => performance.now() - burst);
      // Keep the browser waiter handled if an HTTP request fails first.
      visible.catch(() => {});
      const submissions = await Promise.allSettled(
        eligible.map((c) =>
          api("buzz_submit", {
            p_id: room.id,
            p_round_id: game.roundId,
            p_buzz_id: game.buzzId,
            p_token: c.token,
          }),
        ),
      );
      const answers = submissions
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      const batchMs = Math.round(performance.now() - burst);
      const authoritative = await api("session_view", { p_id: room.id }, true);
      report.bursts.push({
        round: round + 1,
        attempt: attempt + 1,
        contenders: eligible.length,
        responses: answers.length,
        failures: submissions.length - answers.length,
        winnerConfirmed: Boolean(authoritative.buzzWinner?.id),
        responsesAgree: answers.every(
          (answer) => answer.buzzWinner?.id === authoritative.buzzWinner?.id,
        ),
      });
      assert.equal(answers.length, eligible.length, "BUZZ request failures");
      const winners = new Set(answers.map((g) => g.buzzWinner?.id));
      assert.equal(winners.size, 1, "Multiple winners in the same opening");
      const winner = answers[0].buzzWinner?.id;
      assert(winner && eligible.some((c) => c.id === winner));
      const wave = {
        round: round + 1,
        attempt: attempt + 1,
        contenders: eligible.length,
        winners: winners.size,
        batchMs,
        mcVisibleMs: Math.round(await visible),
        openingDelivery: summary(notificationMs),
      };
      report.waves.push(wave);
      console.log(JSON.stringify(wave));
      const correct = attempt === 4;
      game = await api(
        "buzz_grade",
        {
          p_id: room.id,
          p_round_id: game.roundId,
          p_participant_id: winner,
          p_correct: correct,
        },
        true,
      );
      if (correct) total += game.question.points;
      else lost.add(winner);
      assert.equal(
        game.standings.reduce((sum, p) => sum + p.score, 0),
        total,
      );
      const again = await api(
        "buzz_grade",
        {
          p_id: room.id,
          p_round_id: game.roundId,
          p_participant_id: winner,
          p_correct: correct,
        },
        true,
      );
      assert.deepEqual(
        again.standings,
        game.standings,
        "Duplicate grade changed scores",
      );
    }
    game = await control("leaderboard");
    game = await control("next");
  }
  report.totalScore = total;
  await mkdir(dirname(output), { recursive: true });
  await host.screenshot({
    path: output.replace(/\.json$/, "-mc.png"),
    fullPage: true,
  });
  deleting = true;
  clients.forEach((c) => clearTimeout(c.timer));
  await waitFor(
    () => clients.every((c) => !c.pending),
    "background requests settle",
  );
  // Frozen clients deliberately do not execute client-side close.
  const deletionStart = performance.now();
  await remove(room.id);
  await sleep(3000);
  report.cleanup.frozenStreamsClosedByServer = clients.filter(
    (c) => c.closed,
  ).length;
  report.cleanup.observationMs = Math.round(performance.now() - deletionStart);
  report.cleanup.heartbeatsReceived = clients.filter(
    (c) => c.heartbeats > 0,
  ).length;
  const fresh = await create([questions[0].id], "capacity-reuse");
  await Promise.all(
    clients.map((c) =>
      api("session_join", {
        p_code: fresh.code,
        p_name: c.name,
        p_token: c.token,
      }),
    ),
  );
  report.cleanup.newRoomCount = (
    await api("session_view", { p_id: fresh.id }, true)
  ).count;
  assert.equal(report.cleanup.newRoomCount, count);
  await remove(fresh.id);
  assert.equal(report.failures.length, 0, "HTTP failures occurred");
  assert(
    clients.every((c) => !c.error),
    "Client connection errors occurred",
  );
  report.logicPassed = true;
  report.latency = {
    targetMs: maxMcMs,
    mcVisible: summary(report.waves.map((wave) => wave.mcVisibleMs)),
    passed: report.waves.every(
      (wave) =>
        wave.mcVisibleMs <= maxMcMs && wave.openingDelivery.p95Ms <= maxMcMs,
    ),
  };
  report.passed = report.latency.passed;
  if (!report.passed) {
    report.error = "Correct results, but latency exceeds the target";
    process.exitCode = 1;
  }
} catch (error) {
  report.passed = false;
  report.error = error.message;
  report.cause = error.cause?.code;
  process.exitCode = 1;
} finally {
  deleting = true;
  clients.forEach((c) => clearTimeout(c.timer));
  clients.forEach((c) => c.abort.abort());
  await Promise.allSettled(clients.map((c) => c.reading));
  try {
    await waitFor(
      () => clients.every((c) => !c.pending),
      "pending snapshots settle",
    );
  } catch {
    report.cleanup.pendingSnapshots = true;
  }
  await browser?.close();
  for (const id of rooms) {
    try {
      await remove(id);
    } catch {
      report.cleanup.failedRoom = id;
    }
  }
  for (const [command, values] of samples)
    report.requests[command] = summary(values);
  report.clientErrors = clients.flatMap((c) => (c.error ? [c.error] : []));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      output,
      passed: report.passed,
      error: report.error,
      cleanup: report.cleanup,
      requests: report.requests,
    }),
  );
}
