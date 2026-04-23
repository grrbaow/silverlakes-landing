import { PDFDocument, rgb, degrees } from 'pdf-lib';

function stampPages(pages: ReturnType<PDFDocument['getPages']>, text: string) {
  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = 28;
    const textWidth = fontSize * text.length * 0.5;

    for (const yFraction of [0.65, 0.3]) {
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height * yFraction,
        size: fontSize,
        color: rgb(0.7, 0, 0),
        opacity: 0.15,
        rotate: degrees(35),
      });
    }
  }
}

export async function addWatermark(pdfBytes: Uint8Array, email: string, date: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  stampPages(doc.getPages(), `CONFIDENTIAL — ${email} — ${date}`);
  return doc.save();
}

// ZIP variant: caps pages watermarked to avoid serverless timeout on large PDFs
export async function addWatermarkCapped(pdfBytes: Uint8Array, email: string, date: string, maxPages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  stampPages(pages.slice(0, maxPages), `CONFIDENTIAL — ${email} — ${date}`);
  return doc.save();
}
