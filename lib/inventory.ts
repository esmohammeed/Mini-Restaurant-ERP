// lib/inventory.ts
//
// Pure rules for inventory operations (no React, no I/O, no database).
// The server actions in app/(dashboard)/inventory/actions.ts call these and
// then write to the existing `inventory_transactions` ledger; stock itself is
// never edited directly: it is always the sum of the ledger (`product_stock`).

export const MAX_QUANTITY = 1000000;
export const MAX_NOTE_LENGTH = 500;
/** An identical stock entry by the same user inside this window is treated as an accidental duplicate. */
export const DUPLICATE_WINDOW_MS = 5000;

export type ParsedNumber = { ok: true; value: number } | { ok: false; error: string };

/**
 * Parses a whole number from a form value. Rejects blanks, decimals, text,
 * NaN/Infinity, exponent notation and anything outside [min, max].
 */
export function parseWholeNumber(
  input: unknown,
  opts: { label: string; min: number; max?: number }
): ParsedNumber {
  const { label, min } = opts;
  const max = opts.max ?? MAX_QUANTITY;
  let n: number;

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || !Number.isInteger(input)) {
      return { ok: false, error: `${label} must be a whole number.` };
    }
    n = input;
  } else if (typeof input === 'string') {
    const t = input.trim();
    if (t === '') return { ok: false, error: `${label} is required.` };
    if (!/^[-+]?\d+$/.test(t)) return { ok: false, error: `${label} must be a whole number.` };
    n = Number(t);
  } else {
    return { ok: false, error: `${label} is required.` };
  }

  if (!Number.isSafeInteger(n)) return { ok: false, error: `${label} is too large.` };
  if (n < min) {
    return {
      ok: false,
      error:
        min === 1
          ? `${label} must be greater than zero.`
          : min === 0
            ? `${label} cannot be negative.`
            : `${label} must be at least ${min.toLocaleString('en-US')}.`,
    };
  }
  if (n > max) {
    return { ok: false, error: `${label} cannot exceed ${max.toLocaleString('en-US')}.` };
  }
  return { ok: true, value: n === 0 ? 0 : n }; // never -0
}

/** Optional free-text note: trimmed, empty -> null, length-limited. */
export function parseNote(
  input: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, error: 'Notes must be text.' };
  const t = input.trim();
  if (t === '') return { ok: true, value: null };
  if (t.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `Notes cannot be longer than ${MAX_NOTE_LENGTH} characters.` };
  }
  return { ok: true, value: t };
}

/**
 * The ADJUSTMENT quantity that moves stock from `current` to `target`.
 * delta is 0 when nothing needs to change (no transaction should be written).
 */
export function computeAdjustment(
  current: number,
  target: number
): { delta: number; direction: 'none' | 'increase' | 'decrease' } {
  const delta = target - current;
  return {
    delta: delta === 0 ? 0 : delta,
    direction: delta === 0 ? 'none' : delta > 0 ? 'increase' : 'decrease',
  };
}

export function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function plural(n: number, one: string, many: string = `${one}s`): string {
  return Math.abs(n) === 1 ? one : many;
}

export type RemovalDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: 'already_removed' | 'negative_stock' | 'has_stock' | 'open_orders';
      /** Every reason that applies, in plain language. */
      reasons: string[];
      reason: string;
    };

/**
 * Whether an inventory item may be removed from active use. Removal is
 * always a soft delete (products.is_active = false): rows are never deleted,
 * so transaction history and order history stay intact. It is only allowed
 * when nothing would be silently lost:
 *   - the item is still active,
 *   - its stock is exactly 0 (adjust it to 0 first otherwise),
 *   - no open (pending/preparing) order contains it.
 */
export function evaluateRemoval(input: {
  isActive: boolean;
  stock: number;
  openOrders: number;
}): RemovalDecision {
  if (!input.isActive) {
    const reason = 'This item has already been removed from active inventory.';
    return { allowed: false, code: 'already_removed', reasons: [reason], reason };
  }
  const reasons: string[] = [];
  let code: 'negative_stock' | 'has_stock' | 'open_orders' | null = null;

  if (input.stock < 0) {
    code = 'negative_stock';
    reasons.push(
      `Stock is ${input.stock} (negative). Correct it with Adjust before removing the item.`
    );
  } else if (input.stock > 0) {
    code = 'has_stock';
    reasons.push(
      `${input.stock} ${plural(input.stock, 'unit is', 'units are')} still in stock. Adjust the stock to 0 first, so no stock is silently written off.`
    );
  }
  if (input.openOrders > 0) {
    code = code ?? 'open_orders';
    reasons.push(
      `${input.openOrders} open ${plural(input.openOrders, 'order')} (pending or preparing) include this product. Complete or cancel ${input.openOrders === 1 ? 'it' : 'them'} first.`
    );
  }
  if (reasons.length === 0 || code === null) return { allowed: true };
  return { allowed: false, code, reasons, reason: reasons.join(' ') };
}

// ---------------------------------------------------------
// Inventory list
// ---------------------------------------------------------

export type InventoryRow = {
  product_id: number;
  product_name: string;
  current_stock: number;
  low_stock_threshold: number;
  stock_status: string;
};

/**
 * The rows the Inventory page shows: ACTIVE products only (removed items are
 * hidden), each with its stock from the product_stock view.
 */
export function buildInventoryRows(
  activeProducts: { id: number; name: string; low_stock_threshold?: number }[],
  stockRows: {
    product_id: number;
    product_name?: string;
    current_stock: number;
    low_stock_threshold: number;
    stock_status: string;
  }[]
): InventoryRow[] {
  const byId = new Map(stockRows.map((r) => [Number(r.product_id), r]));
  return activeProducts
    .map((p) => {
      const s = byId.get(Number(p.id));
      return {
        product_id: Number(p.id),
        product_name: p.name,
        current_stock: s ? Number(s.current_stock) : 0,
        low_stock_threshold: s ? Number(s.low_stock_threshold) : Number(p.low_stock_threshold ?? 0),
        stock_status: s ? s.stock_status : 'Out of Stock',
      };
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
}
