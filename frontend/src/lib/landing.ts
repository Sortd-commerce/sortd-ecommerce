export function landingBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_LANDING_BASE_URL || "https://sortd-ecommerce.vercel.app").replace(/\/$/, "");
}

export function landingUrl(path = ""): string {
  const base = landingBaseUrl();
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
