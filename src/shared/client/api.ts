export type Config = {
  adminConfigured: boolean;
  localPreview: boolean;
  mediaStorage: "local" | "cloudinary";
  joinBaseUrl?: string;
};
export async function getConfig(): Promise<Config> {
  const response = await fetch("/api/config/", { cache: "no-store" });
  if (!response.ok) throw new Error("Không kết nối được.");
  return response.json();
}
export async function command<T>(
  name: string,
  args: object = {},
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch("/api/command/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: name, args }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Không thực hiện được.");
  return data;
}
export async function login(passcode: string, confirmation?: string) {
  const response = await fetch(
    confirmation === undefined ? "/api/admin/auth/" : "/api/admin/setup/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, confirmation }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
}
export async function logout() {
  await fetch("/api/admin/auth/", { method: "DELETE" });
  location.href = "/admin/";
}
