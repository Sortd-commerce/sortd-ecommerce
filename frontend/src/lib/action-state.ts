export type ActionState = {
  ok: boolean | null;
  message: string;
  code?: string;
  orderNumber?: string;
  clientSecret?: string;
  email?: string;
  purpose?: "signup" | "login";
  firstName?: string;
};

export const emptyActionState: ActionState = { ok: null, message: "" };
