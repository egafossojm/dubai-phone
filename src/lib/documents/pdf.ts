import PDFDocument from "pdfkit";
import type { DocumentBlock, DocumentSpec } from "@/lib/documents/types";

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 842;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: MARGIN });
  }
}

function drawBlocks(
  doc: PDFKit.PDFDocument,
  blocks: DocumentBlock[],
): void {
  for (const block of blocks) {
    switch (block.type) {
      case "title":
        ensureSpace(doc, 28);
        doc.font("Helvetica-Bold").fontSize(16).text(block.text, {
          width: CONTENT_WIDTH,
        });
        doc.moveDown(0.2);
        break;
      case "subtitle":
        ensureSpace(doc, 22);
        doc.font("Helvetica-Bold").fontSize(11).text(block.text, {
          width: CONTENT_WIDTH,
        });
        doc.moveDown(0.4);
        break;
      case "text":
        ensureSpace(doc, 18);
        doc.font("Helvetica").fontSize(10).text(block.text, {
          width: CONTENT_WIDTH,
          align: block.align ?? "left",
        });
        break;
      case "muted":
        ensureSpace(doc, 16);
        doc.font("Helvetica").fontSize(9).fillColor("#555555").text(block.text, {
          width: CONTENT_WIDTH,
        });
        doc.fillColor("#111111");
        break;
      case "kv": {
        ensureSpace(doc, 18);
        const y = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor("#555555");
        doc.text(block.label, MARGIN, y, { width: CONTENT_WIDTH * 0.45 });
        doc.fillColor("#111111").font("Helvetica");
        doc.text(block.value, MARGIN + CONTENT_WIDTH * 0.45, y, {
          width: CONTENT_WIDTH * 0.55,
          align: "right",
        });
        doc.x = MARGIN;
        doc.moveDown(0.15);
        break;
      }
      case "spacer":
        ensureSpace(doc, block.size === "sm" ? 10 : 18);
        doc.moveDown(block.size === "sm" ? 0.3 : 0.7);
        break;
      case "rule":
        ensureSpace(doc, 16);
        doc
          .moveTo(MARGIN, doc.y)
          .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
          .strokeColor("#cccccc")
          .stroke();
        doc.moveDown(0.5);
        break;
      case "table": {
        const colCount = block.columns.length;
        const colWidth = CONTENT_WIDTH / Math.max(colCount, 1);
        ensureSpace(doc, 28);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#555555");
        let x = MARGIN;
        const headerY = doc.y;
        for (const col of block.columns) {
          doc.text(col.header, x, headerY, {
            width: colWidth,
            align: col.align ?? "left",
          });
          x += colWidth;
        }
        doc.fillColor("#111111");
        doc.y = headerY + 14;
        doc
          .moveTo(MARGIN, doc.y)
          .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
          .strokeColor("#e5e5e5")
          .stroke();
        doc.moveDown(0.3);
        for (const row of block.rows) {
          doc.font("Helvetica").fontSize(9);
          let maxHeight = 0;
          for (const col of block.columns) {
            const height = doc.heightOfString(row[col.key] ?? "", {
              width: colWidth - 4,
            });
            maxHeight = Math.max(maxHeight, height);
          }
          ensureSpace(doc, maxHeight + 10);
          const rowY = doc.y;
          x = MARGIN;
          for (const col of block.columns) {
            doc.text(row[col.key] ?? "", x, rowY, {
              width: colWidth - 4,
              align: col.align ?? "left",
            });
            x += colWidth;
          }
          doc.y = rowY + maxHeight + 6;
        }
        doc.x = MARGIN;
        break;
      }
      case "total": {
        ensureSpace(doc, 22);
        const y = doc.y;
        doc.font("Helvetica").fontSize(11).text(block.label, MARGIN, y, {
          width: CONTENT_WIDTH * 0.5,
        });
        doc
          .font("Helvetica-Bold")
          .text(block.value, MARGIN + CONTENT_WIDTH * 0.5, y, {
            width: CONTENT_WIDTH * 0.5,
            align: "right",
          });
        doc.x = MARGIN;
        doc.moveDown(0.4);
        break;
      }
      default: {
        const _exhaustive: never = block;
        void _exhaustive;
      }
    }
  }
}

export async function renderDocumentPdf(spec: DocumentSpec): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margin: MARGIN,
      autoFirstPage: true,
      info: { Title: spec.title, Author: "Dubai Phone" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawBlocks(doc, spec.blocks);
    doc.end();
  });
}
