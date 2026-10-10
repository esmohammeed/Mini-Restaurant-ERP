'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type OrderLineInput = {
  product_id: number;
  quantity: number;
  unit_price: number;
};

export async function createOrder(input: {
  customer_name: string | null;
  payment_method: 'cash' | 'card';
  lines: OrderLineInput[];
}) {
  if (input.lines.length === 0) {
    return { error: 'Add at least one product line.' };
  }

  const supabase = await createClient();

  // 1. Create the order header. total_amount defaults to 0 and is
  //    recalculated by the DB trigger once order_items are inserted.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: input.customer_name,
      payment_method: input.payment_method,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    return { error: orderError?.message ?? 'Could not create order.' };
  }

  // 2. Insert order items. subtotal is a generated column; DB
  //    trigger recalculates orders.total_amount automatically.
  const { error: itemsError } = await supabase.from('order_items').insert(
    input.lines.map((line) => ({
      order_id: order.id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
    }))
  );

  if (itemsError) {
    return { error: itemsError.message };
  }

  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { success: true, orderId: order.id };
}

export async function updateOrderStatus(
  orderId: number,
  status: 'pending' | 'preparing' | 'completed' | 'cancelled'
) {
  const supabase = await createClient();

  // Only the status column is ever touched here. Inventory
  // deduction (on completion) and compensation (on cancellation
  // of a completed order) are handled entirely by DB triggers.
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/orders');
  revalidatePath('/dashboard');
  revalidatePath('/inventory');
  return { success: true };
}
