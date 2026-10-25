"""Offline integration regression: PDF page image and source-linked LaTeX block updates.
Run from app root: python dev_options/tests/test_pdf_source_mapping.py
"""
from pathlib import Path
import sys, base64
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'backend'))
from source_map import instrument, map_pdf
from exam_studio import latex_bundle, build_pdf
from pdf_advanced import preview

META={
 'course':'Γραμμική Άλγεβρα','semester':'1ο_Εξάμηνο','year':'2025','period':'KAN',
 'solver':'thanos','reviewer_a':'reviewer_a','reviewer_b':'reviewer_b',
 'repo':'ece-ntua-exam-solutions/Problems-Solutions',
 'repo_path':'1o_Εξάμηνο/Γραμμική_Άλγεβρα/2025/KΑΝ',
 'template':'shmmy-purple-cover-v1', 'accent_override':'7446a7','font_override':'serif','margin_override':'23',
}
SOURCE = r"""# Άσκηση 1 α)

**Μεθοδολογία**

Χρησιμοποιούμε τον νόμο του Ohm.

**Λύση**

\[
I=\frac{100}{20}=5\,\mathrm{A}
\]

Το αποτέλεσμα είναι \(5\,\mathrm{A}\).
"""

def test():
    marked,blocks=instrument(SOURCE)
    tex,assets=latex_bundle(marked,META)
    pdf=build_pdf(tex,assets)
    assert pdf.startswith(b'%PDF-')
    mapped=map_pdf(pdf,blocks)
    target=next(x for x in mapped if r'I=\frac{100}{20}' in x['label'])
    assert target['page']==1
    encoded=base64.b64encode(pdf).decode()
    img=preview(encoded,target['page'])
    assert base64.b64decode(img['png']).startswith(b'\x89PNG')
    assert img['pages']>=2
    new_source=SOURCE[:target['start']]+SOURCE[target['start']:target['end']].replace('100}{20}','200}{20}')+SOURCE[target['end']:]
    assert '200}{20}' in new_source
    changed,changed_blocks=instrument(new_source)
    updated_tex,assets=latex_bundle(changed,META)
    updated=build_pdf(updated_tex,assets)
    assert updated != pdf
    assert len(map_pdf(updated,changed_blocks))>=len(mapped)
    print('PDF ↔ Markdown smoke: PASS; original blocks:',len(mapped),'updated PDF bytes:',len(updated))

if __name__=='__main__':test()
