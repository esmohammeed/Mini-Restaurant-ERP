'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  DUPLICATE_WINDOW_MS,
  computeAdjustment,
  evaluateRemoval,
  formatSigned,
  parseNote,
  parseWholeNumber,
  plural,
} from '@/lib/inventory';

// Inventory operations. Stock is NEVER edited directly: it is the sum of the
// `inventory_transactions` ledger (the `product_stock` view). Every action
// validates its input, reads the live stock, and writes ordinary ledger rows
// (IN / ADJUSTMENT) as the signed-in user, so RLS and the table's check
// constraints still apply. Nothing is ever hard-deleted.

type Result =
  | { success: true; message: string; error?: undefined }
  | { success?: undefined; message?: undefined; error: string };

// Loosely typed handle (same approach as lib/kpi.ts) so the query chains
// below stay simple.
type Db = {
  from: (table: string) => any;
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
};

// Identical requests that are still running in this server process (e.g. a
// double click that reaches the server twice at once). Complements the
// "identical entry a few seconds ago" check, which only sees finished writes.
const inFlight = new Set<string>();

function dbError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Unexpected database error.';
  if (error.code === '42501') {
    return 'You do not have permission to change inventory (access denied by the database).';
  }
  if (error.code === '23514') {
    return 'The database rejected this stock movement (invalid quantity for its type).';
  }
  if (error.code === '23503') return 'A related record no longer exists. Please reload the page.';
  return error.message || 'Unexpected database error.';
}

function refreshViews() {
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
}

async function getUserId(db: Db): Promise<string | null> {
  const {
    data: { user },
  } = await db.auth.getUser();
  return user?.id ?? null;
}

type LoadedProduct =
  | { ok: true; product: { id: number; name: string; is_active: boolean } | null }
  | { ok: false; error: string };

async function loadProduct(db: Db, productId: number): Promise<LoadedProduct> {
  const { data, error } = await db
    .from('products')
    .select('id, name, is_active')
    .eq('id', productId)
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, product: data ?? null };
}

/** Live stock = sum of the ledger, read from the product_stock view. */
type LoadedStock = { ok: true; stock: number | null } | { ok: false; error: string };

async function loadStock(db: Db, productId: number): Promise<LoadedStock> {
  const { data, error } = await db
    .from('product_stock')
    .select('current_stock')
    .eq('product_id', productId)
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, stock: data ? Number(data.current_stock) : null };
}

// ---------------------------------------------------------
// A. Add Stock: increases stock by the entered amount (IN)
// ---------------------------------------------------------

export async function addStock(input: {
  product_id: number;
  quantity: number | string;
  supplier_id: number | null;
  notes: string | null;
}): Promise<Result> {
  const pid = parseWholeNumber(input.product_id, {
    label: 'Product',
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (!pid.ok) return { error: 'Choose a product.' };
  const qty = parseWholeNumber(input.quantity, { label: 'Quantity', min: 1 });
  if (!qty.ok) return { error: qty.error };
  const note = parseNote(input.notes);
  if (!note.ok) return { error: note.error };

  let supplierId: number | null = null;
  if (input.supplier_id !== null && input.supplier_id !== undefined) {
    const s = parseWholeNumber(input.supplier_id, {
      label: 'Supplier',
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    });
    if (!s.ok) return { error: 'Choose a valid supplier or leave it empty.' };
    supplierId = s.value;
  }

  const db = (await createClient()) as unknown as Db;
  const userId = await getUserId(db);
  if (!userId) return { error: 'Your session has expired. Please sign in again.' };

  const inFlightKey = `${userId}|IN|${pid.value}|${qty.value}`;
  if (inFlight.has(inFlightKey)) {
    return { error: 'This stock entry is already being saved. Please wait a moment.' };
  }
  inFlight.add(inFlightKey);
  try {
    const loaded = await loadProduct(db, pid.value);
    if (!loaded.ok) return { error: loaded.error };
    if (!loaded.product) return { error: 'This product no longer exists. Please reload the page.' };
    if (!loaded.product.is_active) {
      return {
        error: `${loaded.product.name} has been removed from active inventory. Reactivate it on the Products page before adding stock.`,
      };
    }

    if (supplierId !== null) {
      const { data: supplier, error } = await db
        .from('suppliers')
        .select('id, is_active')
        .eq('id', supplierId)
        .maybeSingle();
      if (error) return { error: dbError(error) };
      if (!supplier) return { error: 'The selected supplier no longer exists.' };
      if (!supplier.is_active) {
        return { error: 'The selected supplier is inactive. Choose another supplier or leave it empty.' };
      }
    }

    // Accidental duplicate (e.g. a double click): same product, type, amount and
    // user within the last few seconds.
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const { data: recent, error: recentError } = await db
      .from('inventory_transactions')
      .select('id')
      .eq('product_id', pid.value)
      .eq('transaction_type', 'IN')
      .eq('quantity', qty.value)
      .eq('created_by', userId)
      .gte('created_at', since)
      .limit(1);
    if (recentError) return { error: dbError(recentError) };
    if (recent && recent.length > 0) {
      return {
        error:
          'An identical stock entry was recorded a few seconds ago, so this one was ignored to avoid a duplicate. If you really want to add the same amount again, wait a moment and try again.',
      };
    }

    const { error: insertError } = await db.from('inventory_transactions').insert({
      product_id: pid.value,
      transaction_type: 'IN',
      quantity: qty.value, // always positive for IN
      supplier_id: supplierId,
      notes: note.value,
      created_by: userId,
    });
    if (insertError) return { error: dbError(insertError) };

    const after = await loadStock(db, pid.value);
    refreshViews();
    return {
      success: true,
      message: `Added ${qty.value} ${plural(qty.value, 'unit')} to ${loaded.product.name}.${
        after.ok && after.stock !== null ? ` New stock: ${after.stock}.` : ''
      }`,
    };
  } finally {
    inFlight.delete(inFlightKey);
  }
}

// ---------------------------------------------------------
// B. Adjust: sets stock to a TARGET quantity (ADJUSTMENT = target - current)
// ---------------------------------------------------------

export async function adjustStock(input: {
  product_id: number;
  /** The quantity stock should be AFTER the correction. */
  target_quantity: number | string;
  /** The stock the user saw when opening the form (detects concurrent changes). */
  expected_current?: number | null;
  notes: string | null;
}): Promise<Result> {
  const pid = parseWholeNumber(input.product_id, {
    label: 'Product',
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (!pid.ok) return { error: 'Choose a product.' };
  const target = parseWholeNumber(input.target_quantity, { label: 'New stock quantity', min: 0 });
  if (!target.ok) return { error: target.error };
  const note = parseNote(input.notes);
  if (!note.ok) return { error: note.error };

  let expected: number | null = null;
  if (input.expected_current !== null && input.expected_current !== undefined) {
    const e = parseWholeNumber(input.expected_current, {
      label: 'Displayed stock',
      min: -1000000000,
      max: 1000000000,
    });
    if (e.ok) expected = e.value;
  }

  const db = (await createClient()) as unknown as Db;
  const userId = await getUserId(db);
  if (!userId) return { error: 'Your session has expired. Please sign in again.' };

  const inFlightKey = `${userId}|ADJ|${pid.value}|${target.value}`;
  if (inFlight.has(inFlightKey)) {
    return { error: 'This correction is already being saved. Please wait a moment.' };
  }
  inFlight.add(inFlightKey);
  try {
    const loaded = await loadProduct(db, pid.value);
    if (!loaded.ok) return { error: loaded.error };
    if (!loaded.product) return { error: 'This product no longer exists. Please reload the page.' };
    if (!loaded.product.is_active) {
      return {
        error: `${loaded.product.name} has been removed from active inventory, so its stock cannot be adjusted.`,
      };
    }

    const current = await loadStock(db, pid.value);
    if (!current.ok) return { error: current.error };
    const currentStock = current.stock ?? 0;

    const { delta } = computeAdjustment(currentStock, target.value);
    if (delta === 0) {
      refreshViews();
      return {
        success: true,
        message: `No change needed: ${loaded.product.name} already has ${currentStock} in stock.`,
      };
    }

    if (expected !== null && expected !== currentStock) {
      return {
        error: `Stock changed while this form was open (it is now ${currentStock}, you saw ${expected}). Close this window and reopen it to review the current quantity.`,
      };
    }

    const auto = `Stock correction from ${currentStock} to ${target.value}`;
    const { error: insertError } = await db.from('inventory_transactions').insert({
      product_id: pid.value,
      transaction_type: 'ADJUSTMENT',
      quantity: delta, // signed, never 0 (the table constraint requires non-zero)
      notes: note.value ? `${auto}: ${note.value}` : auto,
      created_by: userId,
    });
    if (insertError) return { error: dbError(insertError) };

    // Verify: the ledger sum should now equal the target.
    const after = await loadStock(db, pid.value);
    refreshViews();
    const landed = after.ok ? after.stock : null;
    const base = `Stock for ${loaded.product.name} corrected from ${currentStock} to ${target.value} (adjustment ${formatSigned(delta)}).`;
    if (landed !== null && landed !== target.value) {
      return {
        success: true,
        message: `${base} Note: stock is now ${landed} because another change was recorded at the same time. Please review it.`,
      };
    }
    return { success: true, message: base };
  } finally {
    inFlight.delete(inFlightKey);
  }
}

// ---------------------------------------------------------
// C. Remove an inventory item from active use (soft delete only)
// ---------------------------------------------------------

export async function removeInventoryItem(input: { product_id: number }): Promise<Result> {
  const pid = parseWholeNumber(input.product_id, {
    label: 'Product',
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (!pid.ok) return { error: 'Choose a product.' };

  const db = (await createClient()) as unknown as Db;
  const userId = await getUserId(db);
  if (!userId) return { error: 'Your session has expired. Please sign in again.' };

  const loaded = await loadProduct(db, pid.value);
  if (!loaded.ok) return { error: loaded.error };
  if (!loaded.product) return { error: 'This product no longer exists. Please reload the page.' };

  const stock = await loadStock(db, pid.value);
  if (!stock.ok) return { error: stock.error };

  // Open orders that still contain this product.
  const { count, error: countError } = await db
    .from('order_items')
    .select('id, orders!inner(status)', { count: 'exact', head: true })
    .eq('product_id', pid.value)
    .in('orders.status', ['pending', 'preparing']);
  if (countError) return { error: dbError(countError) };

  const decision = evaluateRemoval({
    isActive: loaded.product.is_active,
    stock: stock.stock ?? 0,
    openOrders: count ?? 0,
  });
  if (!decision.allowed) {
    return { error: `${loaded.product.name} cannot be removed. ${decision.reason}` };
  }

  // Soft delete: the same switch as "Deactivate" on the Products page.
  // No row is deleted, so inventory history and order history are untouched.
  const { data: updated, error: updateError } = await db
    .from('products')
    .update({ is_active: false })
    .eq('id', pid.value)
    .eq('is_active', true)
    .select('id');
  if (updateError) return { error: dbError(updateError) };
  if (!updated || updated.length === 0) {
    return { error: 'This item has already been removed from active inventory.' };
  }

  refreshViews();
  revalidatePath('/products');
  revalidatePath('/orders');
  return {
    success: true,
    message: `${loaded.product.name} was removed from active inventory. Its stock history and past orders are kept. You can reactivate it on the Products page.`,
  };
}
