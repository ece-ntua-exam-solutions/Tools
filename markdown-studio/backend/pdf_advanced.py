"""Local-only PDF region editor. Source document is NOT mutated.

Selection is in PDF points (not pixels). No OCR/circuit semantics are assumed.
"""
import base64
from pathlib import Path
from pdf_region import open_pdf, _pdf_bytes, FONT_PATHS, MAX_SIZE

def preview(encoded, index):
    import fitz
    doc=open_pdf(encoded)
    try:
        index=int(index)
        if not 0<=index<len(doc): raise ValueError('Σελίδα εκτός ορίων.')
        page=doc[index]
        pix=page.get_pixmap(matrix=fitz.Matrix(1.4,1.4),alpha=False)
        blocks=[]
        for b in page.get_text('blocks'):
            if len(b)<5 or not b[4] or not str(b[4]).strip(): continue
            blocks.append({'rect':[round(float(x),2) for x in b[:4]],'text':str(b[4]).strip()[:3000]})
        return {'png':base64.b64encode(pix.tobytes('png')).decode(),'width_pt':page.rect.width,'height_pt':page.rect.height,'pages':len(doc),'blocks':blocks,'page':index}
    finally:doc.close()

def edit(payload):
    import fitz
    document=open_pdf(payload.get('pdf',''))
    try:
        page_num=int(payload.get('page',0))
        if not 0<=page_num<len(document): raise ValueError('Σελίδα εκτός ορίων.')
        page=document[page_num]
        points=payload.get('rect')
        if not isinstance(points,list) or len(points)!=4 or not all(isinstance(v,(int,float)) for v in points):raise ValueError('Χρειάζεται περιοχή PDF με 4 συντεταγμένες.')
        r=fitz.Rect(*points)
        if r.is_empty or r.width<9 or r.height<7 or not page.rect.contains(r):raise ValueError('Μη έγκυρη περιοχή. Διάλεξε μεγαλύτερο ορθογώνιο.')
        action=payload.get('operation')
        text=str(payload.get('text',''))
        if len(text)>3500:raise ValueError('Το κείμενο είναι πολύ μεγάλο.')
        fsize=float(payload.get('font_size',10))
        if not 6<=fsize<=24:raise ValueError('Μέγεθος γραμματοσειράς 6–24 pt.')
        if action in ('replace','redact','image'):
            page.add_redact_annot(r,fill=(1,1,1))
            if action=='replace':
                # Replace just the text, leaving diagrams and images untouched.
                page.apply_redactions(images=0,graphics=0,text=0)
            else:
                # Explicit remove / image replacement also clears covered graphics/images.
                page.apply_redactions(images=2,graphics=1,text=0)
        if action in ('replace','add_text'):
            font_path=next((p for p in FONT_PATHS if p.exists()),None)
            if font_path is None:raise ValueError('Δεν βρέθηκε Unicode γραμματοσειρά.')
            page.insert_font(fontname='StudioUnicode',fontfile=str(font_path))
            box=fitz.Rect(r.x0+1,r.y0+1,r.x1-1,r.y1-1)
            value=page.insert_textbox(box,text,fontname='StudioUnicode',fontsize=fsize,color=(0,0,0),overlay=True)
            if value<0:raise ValueError('Το κείμενο δεν χωρά. Επίλεξε μεγαλύτερη περιοχή ή μικρότερο μέγεθος.')
        elif action=='highlight':
            a=page.add_rect_annot(r)
            a.set_colors(stroke=(1,0.66,0),fill=(1,0.97,0.5));a.set_opacity(.28);a.update()
        elif action=='note':
            a=page.add_text_annot((r.x0,r.y0),text or 'Σημείωση');a.update()
        elif action=='image':
            raw=base64.b64decode(payload.get('image',''),validate=True)
            if len(raw)>6_000_000 or not(raw.startswith(b'\x89PNG\r\n\x1a\n') or raw.startswith(b'\xff\xd8')):raise ValueError('Απαιτείται PNG ή JPEG έως 6 MB.')
            page.insert_image(r,stream=raw,keep_proportion=True,overlay=True)
        elif action!='redact':raise ValueError('Άγνωστη λειτουργία PDF.')
        raw=document.tobytes(garbage=4,deflate=True)
        if len(raw)>MAX_SIZE:raise ValueError('Το νέο PDF ξεπερνά 18 MB.')
        return {'pdf':base64.b64encode(raw).decode(),'bytes':len(raw)}
    finally:document.close()
