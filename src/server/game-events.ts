// All route bundles share this bus in the single Node process owning PGlite.
type Channel = { revision: number; listeners: Set<(revision: number) => void> };
const state = globalThis as typeof globalThis & {
  earthplayEvents?: Map<string, Channel>;
};
const channels = (state.earthplayEvents ??= new Map<string, Channel>());

export function subscribeGame(
  id: string,
  listener: (revision: number) => void,
) {
  let channel = channels.get(id);
  if (!channel) {
    channel = { revision: -1, listeners: new Set() };
    channels.set(id, channel);
  }
  channel.listeners.add(listener);
  return () => {
    channel.listeners.delete(listener);
    if (!channel.listeners.size) channels.delete(id);
  };
}

export function publishGameChange(id: string, revision: number) {
  const channel = channels.get(id);
  if (!channel || revision <= channel.revision) return;
  channel.revision = revision;
  for (const listener of channel.listeners) {
    try {
      listener(revision);
    } catch {
      channel.listeners.delete(listener);
    }
  }
}
