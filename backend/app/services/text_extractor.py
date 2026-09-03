import io
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: str, filename: Optional[str] = None, file_bytes: Optional[bytes] = None) -> str:
    """
    Extract clean textual content from various document formats (PDF, DOCX, PPTX, XLSX, TXT)
    for LLM evaluation, supporting local paths, R2 storage keys, and raw byte buffers.
    """
    name = (filename or os.path.basename(file_path)).lower()
    ext = os.path.splitext(name)[1].lower()

    if file_bytes is None:
        try:
            from app.services.storage_service import storage_service
            file_bytes = storage_service.read_file_bytes_sync(file_path)
        except Exception as e:
            logger.warning(f"[TextExtractor] Failed to read bytes for '{file_path}': {e}")
            return ""

    if not file_bytes:
        return ""

    try:
        if ext == ".pdf":
            return _extract_pdf_from_bytes(file_bytes)
        elif ext in [".docx", ".doc"]:
            return _extract_docx_from_bytes(file_bytes)
        elif ext in [".pptx", ".ppt"]:
            return _extract_pptx_from_bytes(file_bytes)
        elif ext in [".xlsx", ".xls", ".csv"]:
            return _extract_spreadsheet_from_bytes(file_bytes, ext)
        elif ext in [".txt", ".md", ".json", ".rtf", ".py", ".html"]:
            return _extract_text_from_bytes(file_bytes)
        else:
            return _extract_text_from_bytes(file_bytes)
    except Exception as e:
        logger.error(f"Error extracting text from {name}: {e}")
        return f"[Error extracting text from {name}: {str(e)}]"


def _extract_pdf_from_bytes(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    text_parts = []
    for i, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        if page_text.strip():
            text_parts.append(f"--- Page {i+1} ---\n" + page_text.strip())
    return "\n\n".join(text_parts)


def _extract_docx_from_bytes(data: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(data))
    lines = []
    for p in doc.paragraphs:
        if p.text.strip():
            lines.append(p.text.strip())
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                lines.append(f"| {row_text} |")
    return "\n".join(lines)


def _extract_pptx_from_bytes(data: bytes) -> str:
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    slides_text = []
    for i, slide in enumerate(prs.slides):
        slide_lines = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                slide_lines.append(shape.text.strip())
        if slide_lines:
            slides_text.append(f"--- Slide {i+1} ---\n" + "\n".join(slide_lines))
    return "\n\n".join(slides_text)


def _extract_spreadsheet_from_bytes(data: bytes, ext: str) -> str:
    if ext == ".csv":
        return data.decode("utf-8", errors="ignore")

    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    sheets_text = []
    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        rows_text = []
        for row in sheet.iter_rows(values_only=True):
            cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
            if cells:
                rows_text.append(" | ".join(cells))
        if rows_text:
            sheets_text.append(f"=== Sheet: {sheet_name} ===\n" + "\n".join(rows_text))
    return "\n\n".join(sheets_text)


def _extract_text_from_bytes(data: bytes) -> str:
    return data.decode("utf-8", errors="ignore")
