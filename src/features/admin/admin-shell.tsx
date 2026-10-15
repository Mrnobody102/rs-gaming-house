"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Layers, Flag, LogOut, Play } from "lucide-react";
import { Brand } from "@/components/brand";
import { getConfig, login, logout } from "@/shared/client/api";
import { ErrorMessage, Loading } from "@/shared/ui/status";
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    [ready, setReady] = useState(false),
    [allowed, setAllowed] = useState(false),
    [configured, setConfigured] = useState(true),
    [preview, setPreview] = useState(false),
    [passcode, setPasscode] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/auth/", { cache: "no-store" }).then((r) => r.json()),
      getConfig(),
    ])
      .then(([status, c]) => {
        setAllowed(status.authenticated);
        setConfigured(status.configured);
        setPreview(c.localPreview);
      })
      .catch(() => setError("Không kết nối được."))
      .finally(() => setReady(true));
  }, []);
  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(passcode, configured ? undefined : confirmation);
      setAllowed(true);
      setPasscode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <Loading />;
  if (!allowed)
    return (
      <main className="auth-page">
        <Brand />
        <form className="auth-card" onSubmit={unlock}>
          <h1>Quản trị</h1>
          {
            <>
              <label htmlFor="admin-passcode">
                {configured ? "Mật mã" : "Tạo mật mã"}
                <input
                  id="admin-passcode"
                  type="password"
                  autoComplete={
                    configured ? "current-password" : "new-password"
                  }
                  minLength={configured ? 1 : 8}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              {!configured && (
                <label>
                  Nhập lại mật mã
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                    minLength={8}
                  />
                </label>
              )}
              {preview && (
                <p className="preview-hint">
                  Mật mã bản thử: <b>earthplay</b>
                </p>
              )}
              <ErrorMessage message={error} />
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Đang mở…"
                  : configured
                    ? "Vào quản trị"
                    : "Đặt mật mã và vào"}
              </button>
            </>
          }
          <Link className="text-link" href="/">
            Về màn chơi <Play size={14} />
          </Link>
        </form>
      </main>
    );
  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <Brand small href="/admin/" />
        <Link className="admin-label" href="/admin/">
          QUẢN TRỊ
        </Link>
        <nav>
          <Link
            aria-current={
              pathname.startsWith("/admin/questions") ? "page" : undefined
            }
            href="/admin/questions/"
          >
            <BookOpen size={17} />
            <span>Câu hỏi</span>
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/admin/sets") ? "page" : undefined
            }
            href="/admin/sets/"
          >
            <Layers size={17} />
            <span>Bộ câu hỏi</span>
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/admin/sessions") ? "page" : undefined
            }
            href="/admin/sessions/"
          >
            <Flag size={17} />
            <span>Phòng chơi</span>
          </Link>
        </nav>
        <div className="topbar-end">
          <Link className="button primary small" href="/">
            <Play size={15} /> Chơi
          </Link>
          <button
            className="icon-button"
            aria-label="Khóa quản trị"
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main className="admin-content">{children}</main>
    </div>
  );
}
