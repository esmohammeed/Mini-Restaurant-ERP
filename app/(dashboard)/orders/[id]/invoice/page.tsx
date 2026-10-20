import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildInvoice, parseOrderId } from '@/lib/invoice';
import { formatCurrency } from '@/lib/format';
import InvoiceSheet from '@/components/InvoiceSheet';
import { InlineMessage } from '@/components/FormControls';
import PrintButton from './print-button';

// Print layout: when this page is printed, hide the app chrome (sidebar and
// header, which sit outside this page) and keep only the invoice. :has() limits
// the rules to pages that contain an invoice, so printing any other page is
// unaffected. print-color-adjust keeps the orange and cream colours on paper.
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { height: auto !important; background: #ffffff !important; }
  body:has(.invoice-sheet) aside,
  body:has(.invoice-sheet) header { display: none !important; }
  body:has(.invoice-sheet) main { padding: 0 !important; }
  .invoice-sheet {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    break-inside: avoid;
  }
}
`;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = parseOrderId(id);
  if (orderId === null) notFound();

  const supabase = await createClient();
  const [orderRes, itemsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, customer_name, status, payment_method, total_amount, created_at')
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('order_items')
      .select('id, product_id, quantity, unit_price, subtotal, products(name)')
      .eq('order_id', orderId)
      .order('id', { ascending: true }),
  ]);

  const loadError = orderRes.error ?? itemsRes.error;
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <InlineMessage
          type="error"
          message={`Could not load this order: ${loadError.message}`}
        />
        <Link href="/orders" className="text-sm text-brand-700 hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }
  if (!orderRes.data) notFound();

  const invoice = buildInvoice(orderRes.data, itemsRes.data ?? []);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/orders" className="text-sm text-brand-700 hover:underline">
          ← Back to orders
        </Link>
        <PrintButton />
      </div>

      {invoice.totalsMismatch && (
        <div className="mx-auto mb-4 max-w-2xl print:hidden">
          <InlineMessage
            type="error"
            message={`The item amounts add up to ${formatCurrency(
              invoice.itemsTotal
            )}, but the order total is ${formatCurrency(
              invoice.total
            )}. The invoice shows the recorded values; please check this order.`}
          />
        </div>
      )}

      <InvoiceSheet invoice={invoice} />
    </div>
  );
}
