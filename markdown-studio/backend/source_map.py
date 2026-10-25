"""Explicit Markdown source offsets embedded as invisible PDF named destinations.

Works for PDFs this application generates. Never invents associations for imported PDFs.
The anchors use hyperref's hypertarget and PDF destination coordinates returned by
PyMuPDF. Unsupported blocks can be manually edited in the source view instead.
"""
from __future__ import annotations
import re

ANCHOR_PREFIX = 'shmmy-source-'


def blocks_with_offsets(markdown: str) -> list[dict]:
    """Split original Markdown into nonblank blocks preserving exact source offsets.

    Fenced code remains contiguous. Display math delimited with \\[...\\] or $$...$$
    remains contiguous; prevents anchor injection *inside* math/code environments.
    """
    result = []
    lines = list(re.finditer(r'.*?(?:\r?\n|\Z)', markdown))
    lines = [m for m in lines if m.start() < len(markdown)]
    start = None
    end = None
    fence = False
    math = None
    for match in lines:
        line = match.group(0)
        s = line.strip()
        if start is None and not s:
            continue
        if start is not None and not s and not fence and not math:
            result.append({'start': start, 'end': end, 'text': markdown[start:end]})
            start = None
            end = None
            continue
        if start is None:
            start = match.start()
        end = match.end()
        if s.startswith('```') or s.startswith('~~~'):
            fence = not fence
        if not fence:
            if math is None and s in (r'\[', '$$'):
                math = r'\]' if s == r'\[' else '$$'
            elif math is not None and s == math:
                math = None
    if start is not None:
        result.append({'start': start, 'end': end, 'text': markdown[start:end]})
    return result


def instrument(markdown: str) -> tuple[str, list[dict]]:
    blocks = blocks_with_offsets(markdown)
    out = []
    cursor = 0
    for i, block in enumerate(blocks):
        ident = f'{ANCHOR_PREFIX}{i:05d}'
        block['id'] = ident
        out.append(markdown[cursor:block['start']])
        # Put the invisible destination before its own Markdown block.
        out.append(f'\\hypertarget{{{ident}}}{{}}\n\n')
        out.append(markdown[block['start']:block['end']])
        cursor = block['end']
    out.append(markdown[cursor:])
    return ''.join(out), blocks


def map_pdf(pdf: bytes, blocks: list[dict]) -> list[dict]:
    import fitz
    doc = fitz.open(stream=pdf, filetype='pdf')
    try:
        names = doc.resolve_names()
        result = []
        for b in blocks:
            dest = names.get(b['id'])
            if not dest or dest.get('page', -1) < 0:
                continue
            p = doc[int(dest['page'])]
            coords = dest.get('to', (0, 0))
            # PyMuPDF name resolution reports PDF bottom-left y coordinates;
            # extracted text blocks and page rectangles use top-left coordinates.
            y = float(p.rect.height - coords[1])
            result.append({'id': b['id'], 'start': b['start'], 'end': b['end'],
                           'page': int(dest['page']), 'y': max(0.0, y),
                           'label': b['text'].strip()[:120]})
        result.sort(key=lambda x: (x['page'], x['y']))
        return result
    finally:
        doc.close()
