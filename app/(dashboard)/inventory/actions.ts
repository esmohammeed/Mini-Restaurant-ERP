'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addStock(input: {
  product_id: number;
  quantity: number;
  supplier_id: number | null;
  notes: string | null;
}) {
  if (input.quantity <= 0) {
    return { error: 'Quantity must be greater than zero.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('inventory_transactions').insert({
    product_id: input.product_id,
    transaction_type: 'IN',
    quantity: input.quantity,
    supplier_id: input.supplier_id,
    notes: input.notes,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function adjustStock(input: {
  product_id: number;
  adjustment: number; // signed, non-zero
  notes: string | null;
}) {
  if (input.adjustment === 0) {
    return { error: 'Adjustment quantity cannot be zero.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('inventory_transactions').insert({
    product_id: input.product_id,
    transaction_type: 'ADJUSTMENT',
    quantity: input.adjustment,
    notes: input.notes,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return { success: true };
}
