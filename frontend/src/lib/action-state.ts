export type ActionState = { ok: boolean | null; message: string; orderNumber?: string };

export const emptyActionState: ActionState = { ok: null, message: "" };
