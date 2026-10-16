// All route bundles share this bus in the single app instance (Postgres or PGlite).
type Channel = {
  revision: number;
  listeners: Set<(revision: number, deleted: boolean) => void>;
};
const state = globalThis as typeof globalThis & {
  earthplayEvents?: Map<string, Channel>;
};
const channels = (state.earthplayEvents ??= new Map<string, Channel>());

export function subscribeGame(
  id: string,
  listener: (revision: number, deleted: boolean) => void,
) {
  let channel = channels.get(id);
  if (!channel) {
    channel = { revision: -1, listeners: new Set() };
    channels.set(id, channel);
  }
  channel.listeners.add(listener);
  return () => {
    channel.listeners.delete(listener);
    if (!channel.listeners.size && channels.get(id) === channel)
      channels.delete(id);
  };
}

export function publishGameChange(
  id: string,
  revision: number,
  deleted = false,
) {
  const channel = channels.get(id);
  if (!channel || revision <= channel.revision) return;
  channel.revision = revision;
  for (const listener of channel.listeners) {
    try {
      listener(revision, deleted);
    } catch {
      channel.listeners.delete(listener);
    }
  }
  if (deleted && channels.get(id) === channel) channels.delete(id);
}
