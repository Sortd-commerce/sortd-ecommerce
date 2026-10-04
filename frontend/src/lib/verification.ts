export function unwrapVerificationToken(raw: string): string {
  let text = raw.replace(/=\r\n/g, "").replace(/=\n/g, "").replace(/=\r/g, "");
  text = text.replace(/\s+/g, "").replace(/=3D/gi, "=");
  if (text.toLowerCase().includes("token=")) {
    try {
      const candidate = text.includes("://") ? text : `http://local/?${text.replace(/^\?/, "")}`;
      const token = new URL(candidate).searchParams.get("token");
      if (token) text = token;
    } catch {
      /* keep text */
    }
  }
  if (text.slice(0, 2).toLowerCase() === "3d") text = text.slice(2);
  return text.replace(/=/g, "");
}
