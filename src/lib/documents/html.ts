import type { DocumentBlock, DocumentSpec } from "@/lib/documents/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBlock(block: DocumentBlock): string {
  switch (block.type) {
    case "title":
      return `<h1 class="doc-title">${escapeHtml(block.text)}</h1>`;
    case "subtitle":
      return `<p class="doc-subtitle">${escapeHtml(block.text)}</p>`;
    case "text": {
      const align = block.align ?? "left";
      return `<p class="doc-text doc-align-${align}">${escapeHtml(block.text)}</p>`;
    }
    case "muted":
      return `<p class="doc-muted">${escapeHtml(block.text)}</p>`;
    case "kv":
      return `<div class="doc-kv"><span class="doc-kv-label">${escapeHtml(block.label)}</span><span class="doc-kv-value">${escapeHtml(block.value)}</span></div>`;
    case "spacer":
      return `<div class="doc-spacer doc-spacer-${block.size ?? "md"}"></div>`;
    case "rule":
      return `<hr class="doc-rule" />`;
    case "table": {
      const head = block.columns
        .map(
          (col) =>
            `<th class="doc-align-${col.align ?? "left"}">${escapeHtml(col.header)}</th>`,
        )
        .join("");
      const body = block.rows
        .map((row) => {
          const cells = block.columns
            .map(
              (col) =>
                `<td class="doc-align-${col.align ?? "left"}">${escapeHtml(row[col.key] ?? "")}</td>`,
            )
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table class="doc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    case "total":
      return `<div class="doc-total"><span>${escapeHtml(block.label)}</span><strong>${escapeHtml(block.value)}</strong></div>`;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

/** Standalone printable HTML document (server or download). */
export function renderDocumentHtml(spec: DocumentSpec): string {
  const body = spec.blocks.map(renderBlock).join("\n");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(spec.title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      color: #111;
      background: #fff;
    }
    .doc-sheet {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 28px 40px;
    }
    .doc-title { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
    .doc-subtitle { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
    .doc-text { margin: 2px 0; }
    .doc-muted { margin: 2px 0; color: #555; font-size: 12px; }
    .doc-align-left { text-align: left; }
    .doc-align-center { text-align: center; }
    .doc-align-right { text-align: right; }
    .doc-kv {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin: 3px 0;
    }
    .doc-kv-label { color: #555; }
    .doc-kv-value { font-weight: 500; text-align: right; }
    .doc-spacer-sm { height: 8px; }
    .doc-spacer-md { height: 16px; }
    .doc-rule {
      border: 0;
      border-top: 1px solid #ccc;
      margin: 12px 0;
    }
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 12px;
    }
    .doc-table th,
    .doc-table td {
      padding: 6px 4px;
      border-bottom: 1px solid #e5e5e5;
      vertical-align: top;
      white-space: pre-line;
    }
    .doc-table th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #555;
      font-weight: 600;
    }
    .doc-total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 8px;
      font-size: 15px;
    }
    @media print {
      body { background: #fff; }
      .doc-sheet { max-width: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <article class="doc-sheet">
${body}
  </article>
</body>
</html>`;
}

/** Inner fragment for embedding in a Next.js preview page. */
export function renderDocumentFragment(spec: DocumentSpec): string {
  return spec.blocks.map(renderBlock).join("\n");
}
