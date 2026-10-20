// Printable sales invoice / receipt. Presentational only: every number comes
// from the real order and order-item rows (see lib/invoice.ts). No taxes,
// discounts or extra charges are shown because none exist in the system.
// Colours are the orange and cream theme; print-color-adjust keeps them when
// printing.

import { formatCurrency, formatDateTime } from '@/lib/format';
import type { Invoice } from '@/lib/invoice';

export default function InvoiceSheet({ invoice }: { invoice: Invoice }) {
  return (
    <article
      className="invoice-sheet mx-auto w-full max-w-2xl rounded-xl border border-cream-200 bg-white p-6 text-gray-800 shadow-card sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      aria-label={`Sales invoice for order ${invoice.number}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-600 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Restaurant Mini ERP
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Sales Invoice</h1>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-gray-900">
            Order {invoice.number}
          </p>
          <p className="text-sm text-gray-500">{formatDateTime(invoice.createdAt)}</p>
          {invoice.status === 'cancelled' && (
            <p className="mt-1 inline-block rounded border border-red-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-red-700">
              Cancelled
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {invoice.customerName && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-gray-500">Customer</dt>
            <dd className="font-medium text-gray-900">{invoice.customerName}</dd>
          </div>
        )}
        {invoice.paymentMethod && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-gray-500">Payment method</dt>
            <dd className="font-medium text-gray-900">{invoice.paymentMethod}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wider text-gray-500">Order status</dt>
          <dd className="font-medium capitalize text-gray-900">{invoice.status}</dd>
        </div>
      </dl>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="bg-brand-50 text-left text-xs uppercase tracking-wider text-brand-800">
            <th scope="col" className="px-3 py-2 font-semibold">Product</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Qty</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Unit price</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                This order has no items.
              </td>
            </tr>
          ) : (
            invoice.lines.map((line, i) => (
              <tr key={i} className="border-b border-cream-200">
                <td className="px-3 py-2 text-gray-900">{line.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(line.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(line.lineTotal)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <th
              scope="row"
              colSpan={3}
              className="border-t-2 border-brand-600 px-3 py-3 text-right text-base font-semibold text-gray-900"
            >
              Total
            </th>
            <td className="border-t-2 border-brand-600 px-3 py-3 text-right text-base font-semibold tabular-nums text-brand-600">
              {formatCurrency(invoice.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}
