import type { DocumentSpec } from "@/lib/documents/types";

export { renderDocumentHtml, renderDocumentFragment } from "@/lib/documents/html";
export { renderDocumentPdf } from "@/lib/documents/pdf";
export type { DocumentBlock, DocumentSpec } from "@/lib/documents/types";

/** Convenience re-export for consumers building specs. */
export type BuiltDocument = DocumentSpec;
