"""Preview and deliberately limited rectangle-based PDF text editing.

This edits the exported PDF only. The original Markdown/LaTeX is NEVER mutated.
Only text/redaction overlays are supported, not reconstructed mathematics or diagrams.
"""
import base64
from io import BytesIO
from pathlib import Path

MAX_SIZE = 18_000_000
FONT_PATHS = [Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
              Path('C:/Windows/Fonts/arial.ttf'),
              Path('/Library/Fonts/Arial Unicode.ttf')]


def _pdf_bytes(encoded):
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except Exception:
        raise ValueError('Μη έγκυρη base64 κωδικοποίηση.')
    if not decoded.startswith(b'%PDF-') or len(decoded) > MAX_SIZE:
        raise ValueError('Αναμένεται PDF έως 18 MB.')
    return decoded


def open_pdf(encoded):
    import fitz
    doc = fitz.open(stream=_pdf_bytes(encoded), filetype='pdf')
    if doc.needs_pass:
        doc.close()
        raise ValueError('Τα κρυπτογραφημένα PDF δεν υποστηρίζονται.')
    if len(doc) > 250:
        doc.close()
        raise ValueError('Μέγιστο 250 σελίδες.')
    return doc


def preview(encoded: str, page_number: int = 0, scale: float = 1.35) -> dict:
    import fitz
    doc = open_pdf(encoded)
    try:
        if not isinstance(page_number, int) or not 0 <= page_number < len(doc):
            raise ValueError('Μη έγκυρη σελίδα PDF.')
        page = doc[page_number]
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return {'png': base64.b64encode(pix.tobytes('png')).decode('ascii'),
                'pages': len(doc), 'width_pt': page.rect.width, 'height_pt': page.rect.height,
                'page': page_number}
    finally:
        doc.close()


def edit_text_rectangle(encoded: str, page_number: int, rect_values: list[float], text: str, font_size=10) -> dict:
    import fitz
    if not isinstance(text, str) or len(text) > 1500:
        raise ValueError('Το νέο κείμενο είναι πολύ μεγάλο.')
    if (not isinstance(rect_values, list) or len(rect_values) != 4 or
        not all(isinstance(x, (float, int)) for x in rect_values)):
        raise ValueError('Αναμένονται 4 συντεταγμένες.')
    if not (7 <= float(font_size) <= 22):
        raise ValueError('Μη έγκυρο μέγεθος γραμματοσειράς.')
    doc = open_pdf(encoded)
    try:
        if not 0 <= page_number < len(doc):
            raise ValueError('Μη έγκυρη σελίδα PDF.')
        page = doc[page_number]
        rect = fitz.Rect(*rect_values)
        if (rect.is_empty or rect.width < 20 or rect.height < 8 or
                not page.rect.contains(rect)):
            raise ValueError('Επίλεξε μεγαλύτερη περιοχή εντός της σελίδας.')
        # Redact selected area, preserve images and drawn graphics where possible.
        page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions(images=0, graphics=0, text=0)
        font_path = next((f for f in FONT_PATHS if f.exists()), None)
        if font_path is None:
            raise RuntimeError('Δεν βρέθηκε Unicode TTF (π.χ. DejaVu Sans).')
        page.insert_font(fontname='EditUnicode', fontfile=str(font_path))
        # The overlay is plain Unicode text, not typeset LaTeX. Avoid clipping.
        slot = fitz.Rect(rect.x0 + 1, rect.y0 + 1, rect.x1 - 1, rect.y1 - 1)
        result = page.insert_textbox(slot, text, fontsize=float(font_size),
                                     fontname='EditUnicode', color=(0, 0, 0),
                                     align=0, overlay=True)
        if result < 0:
            raise ValueError('Το κείμενο δεν χωρά στην επιλεγμένη περιοχή. Μεγάλωσέ τη ή μείωσε τη γραμματοσειρά.')
        out = doc.tobytes(garbage=4, deflate=True)
        if len(out) > MAX_SIZE:
            raise ValueError('Το επεξεργασμένο PDF ξεπερνά τα 18 MB.')
        return {'pdf': base64.b64encode(out).decode('ascii'), 'bytes': len(out)}
    finally:
        doc.close()
