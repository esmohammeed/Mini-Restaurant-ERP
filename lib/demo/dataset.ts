// lib/demo/dataset.ts
//
// DEMO DATA: a simulated restaurant dataset for portfolio demonstration.
// It is NOT real business performance.
//
// This module is PURE: it imports nothing but date helpers, never touches
// Supabase, the network or any storage, and writes nothing anywhere. The
// dataset exists only in memory and is rebuilt from a fixed seed.
//
// Design rules:
//   - Same Cairo date -> identical dataset (fixed seed, per-day PRNG).
//   - The dataset covers 60 Cairo days ending "today", so the 7-day and
//     30-day ranges and their previous periods are always full.
//   - The demo clock is fixed at 20:00 Africa/Cairo on "today".
//   - Only what the real schema supports exists here: no discounts,
//     refunds, payment status or profit.
//   - Everything is internally consistent: order total = sum of its line
//     subtotals; completed orders deduct stock; stock is the sum of the
//     ledger and never goes negative.
//   - Demo IDs start at 1,000,000 (products, categories, suppliers) and
//     orders are shown as "D-0001", so a demo row can never be mistaken
//     for, or joined with, a live row.

import { addDaysToKey, cairoDateKey, cairoDayStartUtcMs } from '@/lib/timezone';

export const DEMO_SEED = 'mini-erp-demo-v1';
export const DEMO_HISTORY_DAYS = 60;
export const DEMO_CLOCK_HOUR = 20;
export const DEMO_ID_BASE = 1000000;

const MIN_MS = 60000;
const HOUR_MS = 3600000;

export type DemoStatus = 'completed' | 'cancelled' | 'pending' | 'preparing';

export type DemoCategory = { id: number; name: string };
export type DemoSupplier = { id: number; name: string };

export type DemoProduct = {
  id: number;
  name: string;
  category_id: number;
  /** Current selling price (order lines keep the price at the time). */
  price: number;
  low_stock_threshold: number;
  is_active: boolean;
};

export type DemoOrder = {
  id: number;
  customer_name: string;
  status: DemoStatus;
  payment_method: 'cash' | 'card';
  total_amount: number;
  created_at: string;
};

export type DemoOrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type DemoLedgerRow = {
  id: number;
  product_id: number;
  transaction_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  /** Signed: IN positive, OUT negative, ADJUSTMENT non-zero. */
  quantity: number;
  supplier_id: number | null;
  order_id: number | null;
  notes: string;
  created_at: string;
};

export type DemoStockRow = {
  product_id: number;
  product_name: string;
  current_stock: number;
  low_stock_threshold: number;
  stock_status: 'In Stock' | 'Low Stock' | 'Out of Stock';
};

export type DemoDataset = {
  todayKey: string;
  startKey: string;
  /** The fixed demo clock: 20:00 Africa/Cairo on todayKey, in UTC ms. */
  nowMs: number;
  categories: DemoCategory[];
  suppliers: DemoSupplier[];
  products: DemoProduct[];
  /** Chronological. */
  orders: DemoOrder[];
  orderItems: DemoOrderItem[];
  /** Chronological stock ledger (the source of truth for stock). */
  ledger: DemoLedgerRow[];
};

// ---------------------------------------------------------
// Catalogue
// ---------------------------------------------------------

const CATEGORY_NAMES = ['Burgers', 'Pizza', 'Sandwiches', 'Drinks', 'Desserts'];

const SUPPLIER_BY_CATEGORY: Record<string, string> = {
  Burgers: 'Demo Fresh Meat Co.',
  Sandwiches: 'Demo Fresh Meat Co.',
  Pizza: 'Demo Dairy & Bakery Ltd.',
  Desserts: 'Demo Dairy & Bakery Ltd.',
  Drinks: 'Demo Beverage Distributors',
};

const SUPPLIER_NAMES = [
  'Demo Fresh Meat Co.',
  'Demo Dairy & Bakery Ltd.',
  'Demo Beverage Distributors',
];

type ProductSpec = {
  name: string;
  category: string;
  price: number;
  /** Price before a change, and how many days ago the change happened. */
  priceBefore?: { price: number; changeDaysAgo: number };
  /** Relative popularity when a customer picks an item. */
  weight: number;
  threshold: number;
  /** Discontinued this many days ago (becomes inactive, no more sales). */
  discontinuedDaysAgo?: number;
  /** Scripted stock-count correction at 19:59 on the last day. */
  finalStock?: 'out' | 'low' | number;
};

const PRODUCT_SPECS: ProductSpec[] = [
  { name: 'Beef Burger', category: 'Burgers', price: 120, priceBefore: { price: 110, changeDaysAgo: 35 }, weight: 10, threshold: 15 },
  { name: 'Chicken Burger', category: 'Burgers', price: 100, weight: 8, threshold: 15 },
  { name: 'Double Cheese Burger', category: 'Burgers', price: 150, weight: 5, threshold: 10 },
  { name: 'Margherita Pizza', category: 'Pizza', price: 150, weight: 7, threshold: 10 },
  { name: 'Pepperoni Pizza', category: 'Pizza', price: 170, priceBefore: { price: 160, changeDaysAgo: 12 }, weight: 6, threshold: 10 },
  { name: 'Veggie Pizza', category: 'Pizza', price: 140, weight: 3, threshold: 8, finalStock: 'out' },
  { name: 'Chicken Shawarma Sandwich', category: 'Sandwiches', price: 70, weight: 9, threshold: 20 },
  { name: 'Falafel Sandwich', category: 'Sandwiches', price: 35, weight: 5, threshold: 15, finalStock: 'low' },
  { name: 'Club Sandwich', category: 'Sandwiches', price: 95, weight: 4, threshold: 10 },
  { name: 'Pepsi', category: 'Drinks', price: 20, weight: 14, threshold: 40 },
  { name: 'Orange Juice', category: 'Drinks', price: 35, weight: 7, threshold: 25 },
  { name: 'Mineral Water', category: 'Drinks', price: 10, weight: 10, threshold: 40 },
  { name: 'Iced Tea', category: 'Drinks', price: 30, weight: 5, threshold: 20 },
  { name: 'Chocolate Cake', category: 'Desserts', price: 60, weight: 5, threshold: 8 },
  { name: 'Cheesecake', category: 'Desserts', price: 75, weight: 4, threshold: 6, finalStock: 'low' },
  { name: 'Seasonal Mango Cake', category: 'Desserts', price: 65, weight: 3, threshold: 6, discontinuedDaysAgo: 25, finalStock: 3 },
];

/** Typical orders per day, indexed by weekday (0 = Sunday). Thu/Fri/Sat busiest. */
const BASE_ORDERS_BY_WEEKDAY = [42, 40, 41, 46, 58, 68, 60];

/** Opening hours 11:00-23:59 and how orders spread across them. */
const ORDER_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const ORDER_HOUR_WEIGHTS = [2, 5, 8, 8, 5, 4, 5, 8, 11, 12, 11, 7, 3];

/** Rough units sold per day, used only to size restocks. */
const AVG_UNITS_PER_DAY = 140;

// ---------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function stockStatusOf(
  stock: number,
  threshold: number
): DemoStockRow['stock_status'] {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= threshold) return 'Low Stock';
  return 'In Stock';
}

// ---------------------------------------------------------
// Generator
// ---------------------------------------------------------

type PendingLedger = Omit<DemoLedgerRow, 'id' | 'created_at'> & {
  ts: number;
  seq: number;
};

type PlannedOrder = {
  minute: number;
  second: number;
  createdMs: number;
  status: DemoStatus;
  cancelRoll: number;
  lines: { pi: number; qty: number }[];
  payment: 'cash' | 'card';
  customer: string;
  completionDelayMs: number;
};

export type DemoGenerationOptions = {
  /**
   * Scales restocking (default 1 = normal). Values below 1 make shortages
   * happen, which exercises the "completed orders can only sell what is in
   * stock" rule. Used by tests only; the dashboard always uses 1.
   */
  restockScale?: number;
};

export function generateDemoDataset(
  todayKey: string,
  options: DemoGenerationOptions = {}
): DemoDataset {
  const restockScale = options.restockScale ?? 1;
  const startKey = addDaysToKey(todayKey, -(DEMO_HISTORY_DAYS - 1));

  const categories: DemoCategory[] = CATEGORY_NAMES.map((name, i) => ({
    id: DEMO_ID_BASE + 100 + i,
    name,
  }));
  const suppliers: DemoSupplier[] = SUPPLIER_NAMES.map((name, i) => ({
    id: DEMO_ID_BASE + 200 + i,
    name,
  }));
  const categoryId = (name: string) =>
    categories.find((c) => c.name === name)!.id;
  const supplierIdFor = (category: string) =>
    suppliers.find((s) => s.name === SUPPLIER_BY_CATEGORY[category])!.id;

  const products: DemoProduct[] = PRODUCT_SPECS.map((s, i) => ({
    id: DEMO_ID_BASE + 1 + i,
    name: s.name,
    category_id: categoryId(s.category),
    price: s.price,
    low_stock_threshold: s.threshold,
    is_active: s.discontinuedDaysAgo === undefined,
  }));

  // Restock sizing per product.
  const totalWeight = PRODUCT_SPECS.reduce((a, s) => a + s.weight, 0);
  const sizing = PRODUCT_SPECS.map((s) => {
    const expectedDaily = (AVG_UNITS_PER_DAY * s.weight) / totalWeight;
    return {
      reorderLevel: Math.ceil(expectedDaily * 3.5 * restockScale),
      restockQty: Math.ceil(expectedDaily * 10 * restockScale) + s.threshold,
    };
  });

  const isAvailable = (pi: number, daysAgo: number) => {
    const d = PRODUCT_SPECS[pi].discontinuedDaysAgo;
    return d === undefined || daysAgo > d;
  };
  const priceFor = (pi: number, daysAgo: number) => {
    const spec = PRODUCT_SPECS[pi];
    return spec.priceBefore && daysAgo >= spec.priceBefore.changeDaysAgo
      ? spec.priceBefore.price
      : spec.price;
  };

  const stock: number[] = PRODUCT_SPECS.map(() => 0);
  const pendingLedger: PendingLedger[] = [];
  let seq = 0;
  const pushLedger = (
    pi: number,
    type: DemoLedgerRow['transaction_type'],
    quantity: number,
    ts: number,
    notes: string,
    orderId: number | null = null,
    withSupplier = false
  ) => {
    pendingLedger.push({
      product_id: products[pi].id,
      transaction_type: type,
      quantity,
      supplier_id: withSupplier ? supplierIdFor(PRODUCT_SPECS[pi].category) : null,
      order_id: orderId,
      notes,
      ts,
      seq: seq++,
    });
  };

  const orders: DemoOrder[] = [];
  const orderItems: DemoOrderItem[] = [];
  let nextOrderId = 1;
  let nextItemId = 1;
  let nowMs = 0;

  for (let di = 0; di < DEMO_HISTORY_DAYS; di++) {
    const dayKey = addDaysToKey(startKey, di);
    const daysAgo = DEMO_HISTORY_DAYS - 1 - di;
    const isToday = daysAgo === 0;

    const dayStart = cairoDayStartUtcMs(dayKey);
    const dayEnd = cairoDayStartUtcMs(addDaysToKey(dayKey, 1));
    // On the 23-hour DST day local 00:00 does not exist; shift so local
    // clock times still map to the right instants.
    const shift = dayEnd - dayStart < 24 * HOUR_MS ? HOUR_MS : 0;
    const at = (minutes: number, seconds = 0) =>
      Math.min(
        dayStart + Math.max(0, minutes * MIN_MS + seconds * 1000 - shift),
        dayEnd - 1000
      );

    if (isToday) nowMs = at(DEMO_CLOCK_HOUR * 60);

    const rng = mulberry32(hashString(`${DEMO_SEED}:${dayKey}`));

    // --- 05:00 opening stock (first day only)
    if (di === 0) {
      PRODUCT_SPECS.forEach((spec, pi) => {
        if (!isAvailable(pi, daysAgo)) return;
        stock[pi] = sizing[pi].restockQty;
        pushLedger(pi, 'IN', stock[pi], at(300), 'Opening stock (simulated)', null, true);
      });
    }

    // --- 05:30 occasional spoilage write-off (draws are unconditional)
    const spoilRoll = rng();
    const spoilPick = rng();
    const spoilQty = rng();
    if (di > 0 && spoilRoll < 0.12) {
      const candidates = PRODUCT_SPECS.map((_, pi) => pi).filter(
        (pi) => isAvailable(pi, daysAgo) && stock[pi] >= 6
      );
      if (candidates.length > 0) {
        const pi = candidates[Math.floor(spoilPick * candidates.length)];
        const q = 1 + Math.floor(spoilQty * 3);
        stock[pi] -= q;
        pushLedger(pi, 'ADJUSTMENT', -q, at(330), 'Spoilage write-off (simulated)');
      }
    }

    // --- 06:00 restock when stock is at or below the reorder level
    if (di > 0) {
      PRODUCT_SPECS.forEach((spec, pi) => {
        if (!isAvailable(pi, daysAgo)) return;
        if (stock[pi] <= sizing[pi].reorderLevel) {
          stock[pi] += sizing[pi].restockQty;
          pushLedger(pi, 'IN', sizing[pi].restockQty, at(360), 'Supplier delivery (simulated)', null, true);
        }
      });
    }

    // --- orders for the day
    const growth = 0.9 + 0.2 * (di / (DEMO_HISTORY_DAYS - 1));
    const noise = 0.85 + 0.3 * rng();
    const event = daysAgo === 20 ? 1.35 : daysAgo === 9 ? 0.6 : 1;
    const count = Math.round(
      BASE_ORDERS_BY_WEEKDAY[weekdayOf(dayKey)] * growth * noise * event
    );
    const cancelProbability = 0.05 + 0.05 * rng();

    const hourTotal = ORDER_HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
    const slots: { minute: number; second: number }[] = [];
    for (let k = 0; k < count; k++) {
      let r = rng() * hourTotal;
      let hIdx = 0;
      while (hIdx < ORDER_HOURS.length - 1 && r >= ORDER_HOUR_WEIGHTS[hIdx]) {
        r -= ORDER_HOUR_WEIGHTS[hIdx];
        hIdx++;
      }
      slots.push({
        minute: ORDER_HOURS[hIdx] * 60 + Math.floor(rng() * 60),
        second: Math.floor(rng() * 60),
      });
    }
    slots.sort((a, b) => a.minute - b.minute || a.second - b.second);
    const lastMinute = DEMO_CLOCK_HOUR * 60 - 2; // today's orders end at 19:58
    const todaySlots = isToday ? slots.filter((s) => s.minute <= lastMinute) : slots;

    const planned: PlannedOrder[] = todaySlots.map((slot) => {
      const cancelRoll = rng();
      const lineRoll = rng();
      const lineCount = lineRoll < 0.35 ? 1 : lineRoll < 0.7 ? 2 : lineRoll < 0.9 ? 3 : lineRoll < 0.98 ? 4 : 5;

      const chosen: number[] = [];
      const remaining = PRODUCT_SPECS.map((_, pi) => pi).filter((pi) =>
        isAvailable(pi, daysAgo)
      );
      for (let n = 0; n < lineCount && remaining.length > 0; n++) {
        const total = remaining.reduce((a, pi) => a + PRODUCT_SPECS[pi].weight, 0);
        let r = rng() * total;
        let idx = 0;
        while (idx < remaining.length - 1 && r >= PRODUCT_SPECS[remaining[idx]].weight) {
          r -= PRODUCT_SPECS[remaining[idx]].weight;
          idx++;
        }
        chosen.push(remaining[idx]);
        remaining.splice(idx, 1);
      }
      const lines = chosen.map((pi) => {
        const q = rng();
        return { pi, qty: q < 0.7 ? 1 : q < 0.92 ? 2 : 3 };
      });

      const payment: 'cash' | 'card' = rng() < 0.55 ? 'card' : 'cash';
      const tableRoll = rng();
      const customer =
        tableRoll < 0.55 ? 'Walk-in' : `Table ${1 + Math.floor(rng() * 20)}`;
      const delayRoll = rng();

      return {
        minute: slot.minute,
        second: slot.second,
        createdMs: at(slot.minute, slot.second),
        status: 'completed' as DemoStatus,
        cancelRoll,
        lines,
        payment,
        customer,
        completionDelayMs: (8 + Math.floor(delayRoll * 25)) * MIN_MS,
      };
    });

    // --- statuses
    if (!isToday) {
      for (const o of planned) {
        o.status = o.cancelRoll < cancelProbability ? 'cancelled' : 'completed';
      }
    } else {
      const ageMin = (o: PlannedOrder) => (nowMs - o.createdMs) / MIN_MS;
      planned.forEach((o, i) => {
        const age = ageMin(o);
        if (age < 15) o.status = 'pending';
        else if (age < 45) o.status = 'preparing';
        else o.status = i % 9 === 4 ? 'cancelled' : 'completed';
      });
      const n = planned.length;
      const count = (s: DemoStatus) => planned.filter((o) => o.status === s).length;
      // Guarantee every status is visible on the demo day.
      for (let i = n - 1; i >= 0 && count('pending') < 2; i--) {
        if (planned[i].status !== 'pending') planned[i].status = 'pending';
      }
      for (let i = n - 1; i >= 0 && count('preparing') < 2; i--) {
        if (planned[i].status !== 'pending' && planned[i].status !== 'preparing') {
          planned[i].status = 'preparing';
        }
      }
      if (count('cancelled') < 1) {
        const first = planned.find((o) => o.status === 'completed');
        if (first) first.status = 'cancelled';
      }
    }

    // --- create orders (completed orders can only sell what is in stock)
    for (const o of planned) {
      let lines = o.lines;
      if (o.status === 'completed') {
        lines = lines
          .map((l) => ({ pi: l.pi, qty: Math.min(l.qty, stock[l.pi]) }))
          .filter((l) => l.qty > 0);
        if (lines.length === 0) continue; // nothing sellable: no order
      }

      const orderId = nextOrderId++;
      let totalCents = 0;
      for (const l of lines) {
        const unit = priceFor(l.pi, daysAgo);
        const subtotal = Math.round(l.qty * unit * 100) / 100;
        totalCents += Math.round(subtotal * 100);
        orderItems.push({
          id: nextItemId++,
          order_id: orderId,
          product_id: products[l.pi].id,
          quantity: l.qty,
          unit_price: unit,
          subtotal,
        });
      }
      orders.push({
        id: orderId,
        customer_name: o.customer,
        status: o.status,
        payment_method: o.payment,
        total_amount: totalCents / 100,
        created_at: new Date(o.createdMs).toISOString(),
      });

      // Stock leaves only when an order is completed (as in the real system).
      if (o.status === 'completed') {
        const outTs = o.createdMs + o.completionDelayMs;
        for (const l of lines) {
          stock[l.pi] -= l.qty;
          pushLedger(
            l.pi,
            'OUT',
            -l.qty,
            Math.min(outTs, isToday ? nowMs - 1000 : outTs),
            `Order D-${String(orderId).padStart(4, '0')} completed`,
            orderId
          );
        }
      }
    }

    // --- 19:59 on the last day: scripted stock-count corrections so that
    //     low-stock alerts are always visible in the demo.
    if (isToday) {
      PRODUCT_SPECS.forEach((spec, pi) => {
        if (spec.finalStock === undefined) return;
        const target =
          spec.finalStock === 'out'
            ? 0
            : spec.finalStock === 'low'
              ? Math.max(1, Math.floor(spec.threshold / 2))
              : spec.finalStock;
        const delta = target - stock[pi];
        if (delta < 0) {
          stock[pi] = target;
          pushLedger(
            pi,
            'ADJUSTMENT',
            delta,
            at(DEMO_CLOCK_HOUR * 60 - 1),
            'Stock count correction (simulated)'
          );
        }
      });
    }
  }

  pendingLedger.sort((a, b) => a.ts - b.ts || a.seq - b.seq);
  const ledger: DemoLedgerRow[] = pendingLedger.map((p, i) => ({
    id: i + 1,
    product_id: p.product_id,
    transaction_type: p.transaction_type,
    quantity: p.quantity,
    supplier_id: p.supplier_id,
    order_id: p.order_id,
    notes: p.notes,
    created_at: new Date(p.ts).toISOString(),
  }));

  return {
    todayKey,
    startKey,
    nowMs,
    categories,
    suppliers,
    products,
    orders,
    orderItems,
    ledger,
  };
}

/** product_stock equivalent: current stock is the sum of the ledger. */
export function computeDemoStock(dataset: DemoDataset): DemoStockRow[] {
  const sums = new Map<number, number>();
  for (const row of dataset.ledger) {
    sums.set(row.product_id, (sums.get(row.product_id) ?? 0) + row.quantity);
  }
  return dataset.products.map((p) => {
    const current = sums.get(p.id) ?? 0;
    return {
      product_id: p.id,
      product_name: p.name,
      current_stock: current,
      low_stock_threshold: p.low_stock_threshold,
      stock_status: stockStatusOf(current, p.low_stock_threshold),
    };
  });
}

let cache: { key: string; dataset: DemoDataset } | null = null;

/**
 * The demo dataset for the Cairo calendar day of `now`. The clock inside
 * the dataset is fixed at 20:00, whatever the real time is.
 */
export function getDemoDataset(now: Date = new Date()): DemoDataset {
  const todayKey = cairoDateKey(now);
  if (!cache || cache.key !== todayKey) {
    cache = { key: todayKey, dataset: generateDemoDataset(todayKey) };
  }
  return cache.dataset;
}
