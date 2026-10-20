'use client';

// Opens the browser's print dialog. The page's print rules hide the sidebar,
// header and these controls so only the invoice is printed.
export default function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      Print invoice
    </button>
  );
}
