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

export function forgetPlayerRoom(id: string) {
  const key = `earthplay.player:${id}`,
    token = readPlayerSession(key);
  const keys = new Set([key]);
  const collect = (name: string, value: string | null) => {
    if (token && name.startsWith("earthplay.room:") && value === token)
      keys.add(name);
  };
  for (const [name, value] of memory) collect(name, value);
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[kind];
      for (let i = 0; i < storage.length; i++) {
        const name = storage.key(i);
        if (name) collect(name, storage.getItem(name));
      }
    } catch {}
  }
  for (const name of keys) {
    memory.delete(name);
    try {
      localStorage.removeItem(name);
    } catch {}
    try {
      sessionStorage.removeItem(name);
    } catch {}
  }
}
