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
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "CommandError";
  }
}
export async function command<T>(
  name: string,
  args: object = {},
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  let response: Response;
  try {
    response = await fetch("/api/command/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: name, args }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new CommandError(
      "Chưa kết nối được. Kiểm tra mạng rồi thử lại.",
      "NETWORK_UNAVAILABLE",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new CommandError(
      "Máy chủ chưa phản hồi. Thử lại sau ít giây.",
      "NETWORK_UNAVAILABLE",
    );
  }
  if (!response.ok)
    throw new CommandError(data.error || "Không thực hiện được.", data.code);
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
