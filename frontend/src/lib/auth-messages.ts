export function isLoginAccountMissing(state: { ok?: boolean | null; message?: string }) {
  return state.ok === false && Boolean(state.message?.includes("No account found"));
}
