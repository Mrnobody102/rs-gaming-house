// Keep an identity through client navigation even when the browser blocks storage.
const memory = new Map<string, string>();
export function readPlayerSession(key: string) {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const value = localStorage.getItem(key);
    if (value) return value;
  } catch {}
  try {
    const value = sessionStorage.getItem(key);
    if (value) return value;
  } catch {}
  return memory.get(key) || "";
}
export function savePlayerSession(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {}
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}
