export type CartLine = {
  variant_id: number;
  quantity: number;
  title: string;
  sku: string;
  unit_price: string;
  slug?: string;
};

export type RemoteCart = {
  items: Array<{
    id: number;
    variant_id: number;
    title: string;
    sku: string;
    quantity: number;
    unit_price: string;
    available?: boolean;
  }>;
  subtotal: string;
  currency: string;
};

const KEY = "sortd_cart_v1";
const CLEAR_FLAG = "sortd_clear_cart";
export const MAX_QTY = 99;

export function loadCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeLine)
      .filter((line): line is CartLine => Boolean(line))
      .filter((line) => line.quantity > 0);
  } catch {
    return [];
  }
}

export function saveCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(lines));
}

export function markCartForClear() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CLEAR_FLAG, "1");
}

export function consumeClearCartFlag(): boolean {
  if (typeof window === "undefined") return false;
  const flagged = window.sessionStorage.getItem(CLEAR_FLAG) === "1";
  if (flagged) window.sessionStorage.removeItem(CLEAR_FLAG);
  return flagged;
}

function normalizeLine(row: unknown): CartLine | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Partial<CartLine>;
  const variant_id = Number(item.variant_id);
  const quantity = Math.min(MAX_QTY, Math.max(0, Number(item.quantity) || 0));
  if (!Number.isFinite(variant_id) || variant_id < 1 || quantity < 1) return null;
  return {
    variant_id,
    quantity,
    title: String(item.title || "Item"),
    sku: String(item.sku || ""),
    unit_price: String(item.unit_price || "0.00"),
    slug: item.slug ? String(item.slug) : undefined,
  };
}

export function upsertLine(lines: CartLine[], next: Omit<CartLine, "quantity"> & { quantity?: number }): CartLine[] {
  const addQty = Math.min(MAX_QTY, Math.max(1, next.quantity || 1));
  const existing = lines.find((line) => line.variant_id === next.variant_id);
  if (!existing) {
    return [...lines, { ...next, quantity: addQty }];
  }
  return lines.map((line) =>
    line.variant_id === next.variant_id
      ? { ...line, ...next, quantity: Math.min(MAX_QTY, line.quantity + addQty) }
      : line,
  );
}

export function setLineQuantity(lines: CartLine[], variantId: number, quantity: number): CartLine[] {
  const qty = Math.min(MAX_QTY, Math.max(0, quantity));
  if (qty < 1) return lines.filter((line) => line.variant_id !== variantId);
  return lines.map((line) => (line.variant_id === variantId ? { ...line, quantity: qty } : line));
}

export function mergeCarts(local: CartLine[], remote: CartLine[]): CartLine[] {
  const byId = new Map<number, CartLine>();
  for (const line of remote) byId.set(line.variant_id, { ...line });
  for (const line of local) {
    const current = byId.get(line.variant_id);
    if (!current) {
      byId.set(line.variant_id, line);
      continue;
    }
    byId.set(line.variant_id, {
      ...current,
      ...line,
      quantity: Math.min(MAX_QTY, Math.max(current.quantity, line.quantity)),
    });
  }
  return [...byId.values()];
}

export function cartFingerprint(lines: CartLine[]): string {
  return lines
    .slice()
    .sort((a, b) => a.variant_id - b.variant_id)
    .map((line) => `${line.variant_id}:${line.quantity}`)
    .join("|");
}

export function cartSubtotal(lines: CartLine[]): string {
  const total = lines.reduce((sum, line) => sum + Number(line.unit_price) * line.quantity, 0);
  return total.toFixed(2);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function toSyncPayload(lines: CartLine[]) {
  return lines.map((line) => ({ variant_id: line.variant_id, quantity: line.quantity }));
}

export function fromRemote(cart: RemoteCart | undefined): CartLine[] {
  if (!cart?.items) return [];
  return cart.items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
    title: item.title,
    sku: item.sku,
    unit_price: item.unit_price,
  }));
}
