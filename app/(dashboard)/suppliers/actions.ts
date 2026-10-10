'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type SupplierInput = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export async function createSupplier(input: SupplierInput) {
  const supabase = await createClient();
  const { error } = await supabase.from('suppliers').insert(input);

  if (error) return { error: error.message };
  revalidatePath('/suppliers');
  revalidatePath('/inventory');
  return { success: true };
}

export async function updateSupplier(id: number, input: SupplierInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('suppliers')
    .update(input)
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/suppliers');
  revalidatePath('/inventory');
  return { success: true };
}

export async function setSupplierActive(id: number, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/suppliers');
  revalidatePath('/inventory');
  return { success: true };
}
