export type CartLine = {
  variant_id: number;
  quantity: number;
  title: string;
  brand?: string;
  sku: string;
  unit_price: string;
  slug?: string;
  on_hand?: number;
  image_url?: string;
  detail?: string;
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
    on_hand?: number;
  }>;
  subtotal: string;
  currency: string;
  skipped_variant_ids?: number[];
};

const KEY = "sortd_cart_v1";
const CLEAR_FLAG = "sortd_clear_cart";
export const MAX_QTY = 99;

export type AddItemResult = {
  ok: boolean;
  quantity: number;
  capped: boolean;
  message?: string;
};

function stockCap(onHand: number | undefined | null): number {
  if (onHand == null || !Number.isFinite(Number(onHand))) return MAX_QTY;
  return Math.max(0, Math.min(MAX_QTY, Math.floor(Number(onHand))));
}

export function clampQty(quantity: number, onHand?: number | null): number {
  return Math.min(stockCap(onHand), Math.max(0, Math.floor(quantity)));
}

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
  const on_hand = item.on_hand == null ? undefined : Number(item.on_hand);
  const quantity = clampQty(Number(item.quantity) || 0, on_hand);
  if (!Number.isFinite(variant_id) || variant_id < 1 || quantity < 1) return null;
  return {
    variant_id,
    quantity,
    title: String(item.title || "Item"),
    sku: String(item.sku || ""),
    unit_price: String(item.unit_price || "0.00"),
    slug: item.slug ? String(item.slug) : undefined,
    brand: item.brand ? String(item.brand) : undefined,
    on_hand: on_hand == null || !Number.isFinite(on_hand) ? undefined : on_hand,
    image_url: item.image_url ? String(item.image_url) : undefined,
    detail: item.detail ? String(item.detail) : undefined,
  };
}

export function keepLineDetails(previous: CartLine[], next: CartLine[]): CartLine[] {
  const prior = new Map(previous.map((line) => [line.variant_id, line]));
  return next.map((line) => {
    const old = prior.get(line.variant_id);
    if (!old) return line;
    return {
      ...line,
      slug: line.slug || old.slug,
      brand: line.brand || old.brand,
      image_url: line.image_url || old.image_url,
      detail: line.detail || old.detail,
    };
  });
}

export function upsertLine(
  lines: CartLine[],
  next: Omit<CartLine, "quantity"> & { quantity?: number },
): { lines: CartLine[]; result: AddItemResult } {
  const addQty = Math.max(1, Math.floor(next.quantity || 1));
  const existing = lines.find((line) => line.variant_id === next.variant_id);
  const onHand = next.on_hand ?? existing?.on_hand;
  const max = stockCap(onHand);
  if (max < 1) {
    return {
      lines,
      result: { ok: false, quantity: existing?.quantity || 0, capped: true, message: "This item is out of stock." },
    };
  }
  const current = existing?.quantity || 0;
  const desired = current + addQty;
  const quantity = Math.min(max, desired);
  const capped = desired > max;
  const merged: CartLine = {
    ...existing,
    ...next,
    quantity,
    on_hand: onHand,
  };
  const nextLines = existing
    ? lines.map((line) => (line.variant_id === next.variant_id ? merged : line))
    : [...lines, merged];
  return {
    lines: nextLines,
    result: {
      ok: true,
      quantity,
      capped,
      message: capped ? `Only ${max} left in stock.` : undefined,
    },
  };
}

export function setLineQuantity(
  lines: CartLine[],
  variantId: number,
  quantity: number,
  onHand?: number | null,
): CartLine[] {
  const existing = lines.find((line) => line.variant_id === variantId);
  const stock = onHand ?? existing?.on_hand;
  const qty = clampQty(quantity, stock);
  if (qty < 1) return lines.filter((line) => line.variant_id !== variantId);
  return lines.map((line) =>
    line.variant_id === variantId
      ? {
          ...line,
          quantity: qty,
          on_hand: stock == null || !Number.isFinite(Number(stock)) ? line.on_hand : Number(stock),
        }
      : line,
  );
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
    const on_hand = current.on_hand ?? line.on_hand;
    byId.set(line.variant_id, {
      ...current,
      ...line,
      on_hand,
      quantity: clampQty(Math.max(current.quantity, line.quantity), on_hand),
    });
  }
  return [...byId.values()].map((line) => ({
    ...line,
    quantity: clampQty(line.quantity, line.on_hand),
  }));
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
  return cart.items
    .map((item) =>
      normalizeLine({
        variant_id: item.variant_id,
        quantity: item.quantity,
        title: item.title,
        sku: item.sku,
        unit_price: item.unit_price,
        on_hand: item.on_hand,
      }),
    )
    .filter((line): line is CartLine => Boolean(line));
}

export function quantityInCart(lines: CartLine[], variantId: number): number {
  return lines.find((line) => line.variant_id === variantId)?.quantity || 0;
}
