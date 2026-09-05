import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { AppError } from "@/lib/errors/app-error";
import { getReceiptBySaleIdUseCase } from "@/modules/receipts/application/receipts";
import { renderDocumentFragment } from "@/lib/documents";
import { ReceiptActions } from "@/components/receipts/receipt-actions";
import { buttonVariants } from "@/components/ui/button";

export default async function ReceiptPreviewPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  await requirePagePermission("sales.read");
  const { saleId } = await params;
  let payload;
  try {
    payload = await getReceiptBySaleIdUseCase(saleId);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "NOT_FOUND" || error.code === "BUSINESS_RULE_ERROR")
    ) {
      notFound();
    }
    throw error;
  }

  const fragment = renderDocumentFragment(payload.document);

  return (
    <section className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">
            <Link href={`/ventes/${saleId}`} className="hover:underline">
              Vente {payload.saleReference}
            </Link>{" "}
            / Reçu
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {payload.receiptReference}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Aperçu du reçu — impression et PDF
            {payload.printedAt
              ? ` · déjà imprimé le ${new Date(payload.printedAt).toLocaleString("fr-FR")}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReceiptActions saleId={saleId} />
          <Link
            href={`/ventes/${saleId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Retour vente
          </Link>
        </div>
      </div>

      <article
        className="receipt-preview mx-auto max-w-[720px] rounded-xl border border-[var(--border)] bg-white p-6 text-[13px] text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
        dangerouslySetInnerHTML={{ __html: fragment }}
      />

      <style>{`
        .receipt-preview .doc-title { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
        .receipt-preview .doc-subtitle { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
        .receipt-preview .doc-text { margin: 2px 0; }
        .receipt-preview .doc-muted { margin: 2px 0; color: #555; font-size: 12px; }
        .receipt-preview .doc-align-left { text-align: left; }
        .receipt-preview .doc-align-center { text-align: center; }
        .receipt-preview .doc-align-right { text-align: right; }
        .receipt-preview .doc-kv {
          display: flex; justify-content: space-between; gap: 16px; margin: 3px 0;
        }
        .receipt-preview .doc-kv-label { color: #555; }
        .receipt-preview .doc-kv-value { font-weight: 500; text-align: right; }
        .receipt-preview .doc-spacer-sm { height: 8px; }
        .receipt-preview .doc-spacer-md { height: 16px; }
        .receipt-preview .doc-rule {
          border: 0; border-top: 1px solid #ccc; margin: 12px 0;
        }
        .receipt-preview .doc-table {
          width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px;
        }
        .receipt-preview .doc-table th,
        .receipt-preview .doc-table td {
          padding: 6px 4px; border-bottom: 1px solid #e5e5e5; vertical-align: top;
          white-space: pre-line;
        }
        .receipt-preview .doc-table th {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
          color: #555; font-weight: 600;
        }
        .receipt-preview .doc-total {
          display: flex; justify-content: space-between; align-items: baseline;
          margin-top: 8px; font-size: 15px;
        }
        @media print {
          body * { visibility: hidden; }
          .receipt-preview, .receipt-preview * { visibility: visible; }
          .receipt-preview {
            position: absolute; left: 0; top: 0; width: 100%;
            border: none !important; box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </section>
  );
}
