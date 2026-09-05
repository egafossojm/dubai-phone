/**
 * Reusable document model — shared by HTML preview, print CSS, and PDF.
 * Domain modules (receipts, …) map their data into DocumentSpec; they do not
 * own rendering.
 */

export type DocumentBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "text"; text: string; align?: "left" | "center" | "right" }
  | { type: "muted"; text: string }
  | { type: "kv"; label: string; value: string }
  | { type: "spacer"; size?: "sm" | "md" }
  | { type: "rule" }
  | {
      type: "table";
      columns: Array<{ key: string; header: string; align?: "left" | "right" }>;
      rows: Array<Record<string, string>>;
    }
  | { type: "total"; label: string; value: string };

export type DocumentSpec = {
  /** Browser / PDF title */
  title: string;
  /** Suggested download basename without extension */
  filename: string;
  blocks: DocumentBlock[];
};
