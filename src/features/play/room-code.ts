export function roomCodeFromQr(value: string) {
  const text = value.trim();
  if (/^[a-z0-9]{6}$/i.test(text)) return text.toUpperCase();
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const code = url.searchParams.get("code") || "";
    return /^[a-z0-9]{6}$/i.test(code) ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}
