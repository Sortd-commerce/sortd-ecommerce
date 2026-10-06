/** Allow only same-site relative redirects after auth. */
export function safeRedirectPath(value: string | null | undefined): string {
  const next = (value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
