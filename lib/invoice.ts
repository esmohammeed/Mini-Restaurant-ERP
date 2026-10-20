// lib/invoice.ts
//
// Pure view-model for the printable sales invoice. It only reshapes the real
// order and order-item rows; it adds NO charges, taxes or discounts. Line
// totals and the final total are the database values (order_items.subtotal
// and orders.total_amount), never recomputed.

export type InvoiceOrderRow = {
  id: number;
  customer_name: string | null;
  status: string;
  payment_method?: string | null;
  total_amount: number | string;
  created_at: string;
};

export type InvoiceItemRow = {
  id?: number;
  product_id: number;
  quantity: number | string;
  unit_price: number | string;
  subtotal?: number | string | null;
  products?: { name: string } | { name: string }[] | null;
};

export type Invoice = {
  orderId: number;
  /** "#123" */
  number: string;
  createdAt: string;
  customerName: string | null;
  status: string;
  /** "Cash" / "Card", or null when the order has none. */
  paymentMethod: string | null;
  lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  /** orders.total_amount: the final total. */
  total: number;
  /** Sum of the line totals (for an integrity check only). */
  itemsTotal: number;
  /** True when the line totals do not add up to the order total. */
  totalsMismatch: boolean;
};

const cents = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Parses the /orders/[id]/invoice route parameter; null if it is not a positive whole number. */
export function parseOrderId(param: string | null | undefined): number | null {
  if (typeof param !== 'string' || !/^\d+$/.test(param)) return null;
  const n = Number(param);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function paymentLabel(method: string | null | undefined): string | null {
  if (!method) return null;
  const m = String(method).trim().toLowerCase();
  if (m === 'cash') return 'Cash';
  if (m === 'card') return 'Card';
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : null;
}

export function buildInvoice(order: InvoiceOrderRow, items: InvoiceItemRow[]): Invoice {
  const lines = items.map((it) => {
    const product = Array.isArray(it.products) ? it.products[0] : it.products;
    const quantity = Number(it.quantity);
    const unitPrice = Number(it.unit_price);
    // subtotal is a generated column in the database: use it as stored.
    const lineTotal =
      it.subtotal === null || it.subtotal === undefined || it.subtotal === ''
        ? cents(quantity * unitPrice) / 100
        : cents(it.subtotal) / 100;
    return {
      name: product?.name ?? `Product #${it.product_id}`,
      quantity,
      unitPrice,
      lineTotal,
    };
  });
  const itemsTotalCents = lines.reduce((a, l) => a + cents(l.lineTotal), 0);
  const total = cents(order.total_amount) / 100;

  return {
    orderId: order.id,
    number: `#${order.id}`,
    createdAt: order.created_at,
    customerName: order.customer_name?.trim() ? order.customer_name.trim() : null,
    status: order.status,
    paymentMethod: paymentLabel(order.payment_method),
    lines,
    total,
    itemsTotal: itemsTotalCents / 100,
    totalsMismatch: itemsTotalCents !== cents(order.total_amount),
  };
}
