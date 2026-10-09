export function normalizePathname(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isHeavyRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path === "/") return true;
  if (path.startsWith("/checkout")) return true;
  if (path.startsWith("/products/")) return true;
  if (path.startsWith("/orders")) return true;
  if (path.startsWith("/account")) return true;
  return false;
}

export function routeLoadingMessage(pathname: string): string {
  const path = normalizePathname(pathname);
  if (path.startsWith("/checkout")) return "Loading checkout";
  if (path.startsWith("/products/")) return "Loading product";
  if (path.startsWith("/orders/") && path !== "/orders") return "Loading order";
  if (path.startsWith("/orders")) return "Loading orders";
  if (path.startsWith("/account")) return "Loading account";
  return "Loading store";
}
