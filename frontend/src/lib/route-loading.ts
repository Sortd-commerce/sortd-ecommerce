import { isHeavyRoute } from "@/lib/heavy-routes";

type Starter = (path: string) => void;
type Listener = () => void;

let starter: Starter | null = null;
let serverLoadingDepth = 0;
const serverEndListeners = new Set<Listener>();

export function bindRouteLoadingStarter(fn: Starter | null) {
  starter = fn;
}

export function startRouteLoading(path: string) {
  if (!isHeavyRoute(path)) return;
  starter?.(path);
}

export function isServerRouteLoading() {
  return serverLoadingDepth > 0;
}

export function setServerRouteLoading(active: boolean) {
  const before = serverLoadingDepth > 0;
  serverLoadingDepth = Math.max(0, serverLoadingDepth + (active ? 1 : -1));
  const after = serverLoadingDepth > 0;
  if (before && !after) {
    for (const listener of serverEndListeners) listener();
  }
}

export function onServerRouteLoadingEnd(listener: Listener) {
  serverEndListeners.add(listener);
  return () => serverEndListeners.delete(listener);
}
