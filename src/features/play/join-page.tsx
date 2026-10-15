"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ScanLine } from "lucide-react";
import { QrScanner } from "./qr-scanner";
import { randomToken } from "@/shared/client/random";
import { Brand } from "@/components/brand";
import { APP_NAME } from "@/shared/brand";
import { command } from "@/shared/client/api";
import { ErrorMessage } from "@/shared/ui/status";
export function JoinPage() {
  const [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setCode(
      new URLSearchParams(location.search)
        .get("code")
        ?.toUpperCase()
        .slice(0, 6) || "",
    );
    try {
      setName(localStorage.getItem("earthplay.name") || "");
    } catch {}
  }, []);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = localStorage.getItem(`earthplay.room:${code}`),
        token = saved || randomToken();
      const s = await command<{ id: string }>("session_join", {
        p_code: code,
        p_name: name,
        p_token: token,
      });
      localStorage.setItem(`earthplay.room:${code}`, token);
      localStorage.setItem(`earthplay.player:${s.id}`, token);
      localStorage.setItem("earthplay.name", name.trim());
      router.push(`/play/${s.id}/`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="join-page">
      <header>
        <Brand />
      </header>
      <main>
        <div className="join-decoration" aria-hidden="true">
          <span>↗</span>
          <span>◉</span>
          <span>⌖</span>
          <span>?</span>
        </div>
        <form className="join-card" onSubmit={join}>
          <h1>Vào game</h1>
          <label>
            Mã phòng
            <input
              className="code-input"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6),
                )
              }
              autoComplete="off"
              placeholder="A1B2C3"
              maxLength={6}
              minLength={6}
              required
              autoFocus={!code}
            />
          </label>
          <button
            className="scan-link"
            type="button"
            onClick={() => setScanning(true)}
          >
            <ScanLine size={17} /> Quét QR
          </button>
          <label>
            Tên của bạn
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên…"
              autoComplete="nickname"
              maxLength={40}
              required
            />
          </label>
          <ErrorMessage message={error} />
          <button className="button primary" disabled={busy}>
            {busy ? "Đang vào…" : "Vào chơi"}
            <ArrowRight size={18} />
          </button>
        </form>
      </main>
      <footer>
        <span>{APP_NAME}</span>
        <Link href="/admin/">Quản trị</Link>
      </footer>
      {scanning && (
        <QrScanner onCode={setCode} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
