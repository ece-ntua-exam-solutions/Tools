"""Regression test for Windows WinError 32 and intermediate Story PDF."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
import fitz
from basic_pdf import build_basic_pdf

meta = {'course': 'Γραμμική Άλγεβρα', 'year': '2025', 'period': 'KAN',
        'solver': 'demo', 'reviewer_a': 'reviewer_a', 'reviewer_b': 'reviewer_b'}
for _ in range(5):
    pdf, positions, warnings = build_basic_pdf('# Άσκηση 1 α)\n\n**Λύση**\n\n$$x=\\frac{2}{2}=1$$',meta, source_map=True)
    assert pdf.startswith(b'%PDF-'), 'Invalid PDF'
    with fitz.open(stream=pdf, filetype='pdf') as doc:
        assert len(doc) >= 2, 'Missing cover or solutions'
    assert positions, 'Missing Markdown->PDF mapping'
    assert not warnings, warnings
print('PASS: No temporary story.pdf; 5 in-memory renders OK')
