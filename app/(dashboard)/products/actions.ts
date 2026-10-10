'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ---------- Products ----------

export async function createProduct(input: {
  name: string;
  category_id: number | null;
  price: number;
  low_stock_threshold: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('products').insert({
    name: input.name,
    category_id: input.category_id,
    price: input.price,
    low_stock_threshold: input.low_stock_threshold,
  });

  if (error) return { error: error.message };
  revalidatePath('/products');
  revalidatePath('/inventory');
  return { success: true };
}

export async function updateProduct(
  id: number,
  input: {
    name: string;
    category_id: number | null;
    price: number;
    low_stock_threshold: number;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({
      name: input.name,
      category_id: input.category_id,
      price: input.price,
      low_stock_threshold: input.low_stock_threshold,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/products');
  revalidatePath('/inventory');
  return { success: true };
}

export async function setProductActive(id: number, isActive: boolean) {
  const supabase = await createClient();
  // Soft delete only — never a hard DELETE, so historical
  // order_items / inventory_transactions stay intact.
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/products');
  revalidatePath('/inventory');
  return { success: true };
}

// ---------- Categories ----------

export async function createCategory(input: {
  name: string;
  description: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({
    name: input.name,
    description: input.description,
  });

  if (error) return { error: error.message };
  revalidatePath('/products');
  return { success: true };
}

export async function updateCategory(
  id: number,
  input: { name: string; description: string | null }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({ name: input.name, description: input.description })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/products');
  return { success: true };
}

export async function setCategoryActive(id: number, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/products');
  return { success: true };
}
