import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);

export async function convertDocxToPdf(docxPath, outdir) {
  if (!fs.existsSync(docxPath)) {
    throw new Error(`File not found: ${docxPath}`);
  }
  fs.mkdirSync(outdir, { recursive: true });

  try {
    // execFile resolves a bare command name via PATH without a shell, same as
    // Python's shutil.which() — no need to hunt for soffice ourselves.
    await execFileAsync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", outdir, docxPath], {
      timeout: 60000,
    });
  } catch (err) {
    throw new Error(`soffice conversion failed: ${err.stderr || err.message}`);
  }

  const base = path.basename(docxPath, path.extname(docxPath));
  const pdfPath = path.join(outdir, `${base}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Expected output PDF not found: ${pdfPath}`);
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  return { pdf_path: pdfPath, page_count: pageCount };
}
