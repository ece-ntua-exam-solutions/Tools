"""Compile Greek Markdown into PDF using pure Python libraries.

No Pandoc, XeLaTeX, LuaLaTeX, MiKTeX, TeX Live, Chromium required.
Notes: matplotlib mathtext handles a useful LaTeX *subset*, not full TeX/TikZ.
Story position callbacks link generated PDF blocks to source Markdown spans.
"""
from __future__ import annotations
import base64
import html
import io
import re
from pathlib import Path

import fitz
from markdown_it import MarkdownIt

from source_map import blocks_with_offsets
from exam_studio import templates

MAX_MD=500_000
_MD=MarkdownIt('commonmark', {'html':False, 'linkify':False}).enable('table')
MATH_RE=re.compile(r'(?s)(?<!\\)\$\$(.+?)\$\$|\\\[(.+?)\\\]|(?<!\\)\$(?!\$)(.+?)(?<!\\)\$(?!\$)|\\\((.+?)\\\)')
ANCHOR_PREFIX='shmmy-source-'


def _render_math(expression: str, display: bool, warnings: list[str]) -> str:
    raw=expression.strip()
    # Common aligned/align constructs are approximated row-wise.
    rows=[raw]
    matched=re.fullmatch(r'\\begin\{(?:aligned|align\*?|gather\*?)\}(.+?)\\end\{(?:aligned|align\*?|gather\*?)\}',raw,re.S)
    if matched:
        rows=[r.replace('&','').strip() for r in re.split(r'\\\\',matched.group(1)) if r.strip()]
    images=[]
    for row in rows:
        try:
            from matplotlib import mathtext
            from matplotlib.font_manager import FontProperties
            image=io.BytesIO()
            mathtext.math_to_image('$'+row+'$',image,format='png',dpi=150,
                                   prop=FontProperties(size=13 if display else 11),color='#202437')
            payload=image.getvalue()
            pix=fitz.Pixmap(payload)
            # HTML px to PDF point conversion (96 CSS pixels per inch).
            css_w=max(4,int(pix.width*96/150))
            css_h=max(5,int(pix.height*96/150))
            cls='math-display' if display else 'math-inline'
            images.append(f'<img class="{cls}" width="{css_w}" height="{css_h}" alt="{html.escape(row,quote=True)}" src="data:image/png;base64,{base64.b64encode(payload).decode()}"/>')
        except Exception:
            warnings.append('Ο μαθηματικός τύπος απαιτεί πλήρες LaTeX (εμφανίστηκε ως κώδικας): '+row[:80])
            images.append('<code>'+html.escape(row)+'</code>')
    tag='div' if display else 'span'
    return f'<{tag} class="math-group">'+(''.join('<div>'+im+'</div>' for im in images) if display else ''.join(images))+f'</{tag}>'


def _block_html(source: str,warnings: list[str]) -> str:
    for target in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',source):
        if not target.startswith(('data:image/png;base64,','data:image/jpeg;base64,','data:image/jpg;base64,')):
            warnings.append('Εξωτερική εικόνα χωρίς ενσωματωμένα δεδομένα: εισήγαγε/επικόλλησε το PNG ή JPEG στο Markdown Studio.')
    if re.search(r'\\begin\{(?:tikzpicture|circuitikz|axis|equation|align|tabular|pgfplots)\}',source):
        warnings.append('Μη υποστηριζόμενη πλήρης LaTeX/TikZ κατασκευή στο Python PDF. Χρησιμοποίησε εικόνα ή προαιρετικό LaTeX.')
    substitutions={}
    def math_sub(m):
        expression=next((v for v in m.groups() if v is not None),'')
        display=m.group(1) is not None or m.group(2) is not None
        key=f'SHMMYMATHPLACEHOLDER{len(substitutions):06d}END'
        substitutions[key]=_render_math(expression,display,warnings)
        return key
    marked=MATH_RE.sub(math_sub,source)
    rendered=_MD.render(marked)
    for key, value in substitutions.items():
        rendered=rendered.replace(key,value)
    return rendered


def _style(meta:dict)->tuple[str,str,int,bool]:
    default=next((t for t in templates() if t.get('id')==(meta.get('template') or 'shmmy-purple-cover-v1')),templates()[0])
    accent=str(meta.get('accent_override') or default.get('accent') or '7446a7').lstrip('#')
    if not re.fullmatch('[A-Fa-f0-9]{6}',accent):accent='7446a7'
    font=str(meta.get('font_override') or default.get('font','serif'))
    try:margin=int(meta.get('margin_override') or default.get('margin_mm',23))
    except (TypeError,ValueError):margin=23
    margin=max(12,min(35,margin))
    return '#'+accent,font,margin,default.get('cover')=='separate'


def _render_story(source_html: str,css: str,margin: int,positionfn=None)->bytes:
    page=fitz.paper_rect('a4')
    # Frame includes a footer band for page numbers.
    frame=fitz.Rect(margin*72/25.4,margin*72/25.4,
                   page.width-margin*72/25.4,page.height-margin*72/25.4-15)
    # Render directly into memory. On Windows, MuPDF may retain an OS handle
    # to a file-backed DocumentWriter briefly after close(), which makes
    # TemporaryDirectory cleanup raise WinError 32 for story.pdf.
    # BytesIO avoids temporary PDF files (and the associated locking) entirely.
    output = io.BytesIO()
    writer = fitz.DocumentWriter(output)
    try:
        story = fitz.Story(source_html, user_css=css)
        story.write(writer, lambda n, filled: (page, frame, fitz.Identity),
                    positionfn=positionfn)
    finally:
        writer.close()
    return output.getvalue()


def build_basic_pdf(markdown:str,meta:dict,source_map:bool=False)->tuple[bytes,list[dict],list[str]]:
    if not isinstance(markdown,str) or not markdown.strip() or len(markdown)>MAX_MD:
        raise ValueError('Δώσε Markdown έως 500.000 χαρακτήρες.')
    meta=dict(meta or {})
    color,font,margin,split=_style(meta)
    css=f'''html,body {{font-family:{'serif' if font=='serif' else 'sans-serif'};color:#252b38;font-size:11pt;line-height:1.45}}
    h1,h2,h3,h4 {{color:{color};page-break-after:avoid;margin-top:15pt;margin-bottom:6pt}}
    h1 {{font-size:19pt}} h2 {{font-size:15pt}} h3 {{font-size:12pt}}
    div.source-block {{margin:0 0 8pt 0;}} p {{margin:5pt 0 6pt 0}}
    table {{border-collapse:collapse;width:100%;margin:8pt 0;}}
    th,td {{border:0.4pt solid #a1a5b1;padding:5pt;}} th {{background:#eeeeF3}}
    blockquote {{border-left:3pt solid {color};padding-left:9pt;color:#565d6c}}
    pre,code {{font-family:monospace;white-space:pre-wrap;font-size:9pt}}
    pre {{background:#f4f4f8;padding:7pt}}
    img {{max-width:100%;}} .math-display {{vertical-align:middle;}}
    .math-group {{text-align:center;margin:5pt 0;}} .math-inline {{vertical-align:middle;}}
    .cover {{text-align:center;}} .cover h1 {{font-size:29pt;color:#222436;line-height:1.2;}}
    .cover .brand {{color:{color};font-size:16pt;font-weight:bold;margin-top:95pt;}}
    .cover .term {{font-size:16pt;margin-top:15pt;}}
    .cover .credits {{margin-top:110pt;text-align:center;}}
    .cover .tagline {{margin-top:90pt;font-style:italic;}}
    '''
    def safe(t):return html.escape(str(t or ''),quote=True)
    title=safe(meta.get('course') or 'Μάθημα')
    term='Κανονική εξέταση' if str(meta.get('period','KAN')) in ('KAN','ΚΑΝ') else 'Επαναληπτική εξέταση'
    year=safe(meta.get('year') or '—')
    tagline=safe(meta.get('tagline_override') or 'Λύσεις γραμμένες από φοιτητές για φοιτητές')
    person=lambda k:safe(meta.get(k) or 'προς συμπλήρωση')
    cover=f'''<html><body><div class="cover"><div class="brand">ΟΜΑΔΑ ΕΠΙΛΥΣΗΣ ΘΕΜΑΤΩΝ ΣΗΜΜΥ</div>
    <h1>{title}</h1><div class="term">{safe(term)} · {year}</div>
    <div class="credits"><p><b>Λύτης:</b> {person('solver')}</p>
    <p><b>Ελεγκτής Α:</b> {person('reviewer_a')}</p>
    <p><b>Ελεγκτής Β:</b> {person('reviewer_b')}</p></div>
    <div class="tagline">{tagline}</div></div></body></html>'''
    blocks=blocks_with_offsets(markdown)
    warnings=[]; sections=[]
    for i,b in enumerate(blocks):
        ident=f'{ANCHOR_PREFIX}{i:05d}'
        b['id']=ident
        sections.append(f'<div class="source-block" id="{ident}">'+_block_html(b['text'],warnings)+'</div>')
    body_html='<html><body>'+''.join(sections)+'</body></html>'
    positions=[]
    def record(p):
        if p.id and p.id.startswith(ANCHOR_PREFIX) and p.open_close==1:
            positions.append((p.id,int(p.page_num),float(p.rect[1])))
    cover_pdf=_render_story(cover,css,margin)
    body_pdf=_render_story(body_html,css,margin,record if source_map else None)
    doc=fitz.open()
    with fitz.open(stream=cover_pdf,filetype='pdf') as first:
        doc.insert_pdf(first)
    with fitz.open(stream=body_pdf,filetype='pdf') as body:
        doc.insert_pdf(body)
    for i,p in enumerate(doc):
        if i>0:p.insert_text((p.rect.width/2-5,p.rect.height-26),str(i),fontname='helv',fontsize=9,color=(.45,.45,.52))
    payload=doc.tobytes(garbage=4,deflate=True)
    doc.close()
    if len(payload)>18_000_000:raise ValueError('Το PDF ξεπερνά τα 18 MB.')
    byid={b['id']:b for b in blocks}
    mapped=[];seen=set()
    for ident,page,y in sorted(positions,key=lambda z:(z[1],z[2])):
        if ident in seen:continue
        seen.add(ident);b=byid.get(ident)
        if b is None:continue
        mapped.append({'id':ident,'start':b['start'],'end':b['end'],
                       'page':page,'y':y,'label':b['text'].strip()[:120]})
    return payload,mapped,list(dict.fromkeys(warnings))
