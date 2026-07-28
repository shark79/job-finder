import os
import shutil
import subprocess

import pdfplumber

SOFFICE_BIN = shutil.which("soffice")


def convert_docx_to_pdf(docx_path: str, outdir: str) -> dict:
    if not os.path.exists(docx_path):
        raise FileNotFoundError(docx_path)
    os.makedirs(outdir, exist_ok=True)

    result = subprocess.run(
        [SOFFICE_BIN, "--headless", "--convert-to", "pdf", "--outdir", outdir, docx_path],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(f"soffice conversion failed: {result.stderr or result.stdout}")

    base = os.path.splitext(os.path.basename(docx_path))[0]
    pdf_path = os.path.join(outdir, f"{base}.pdf")
    if not os.path.exists(pdf_path):
        raise RuntimeError(f"Expected output PDF not found: {pdf_path}")

    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)

    return {"pdf_path": pdf_path, "page_count": page_count}
