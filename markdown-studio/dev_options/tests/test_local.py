"""Run from root: python dev_options/tests/test_local.py
Local-only smoke tests. No writes to GitHub; requests to local v9 server.
"""
from pathlib import Path
import sys,base64,io
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
from exam_studio import latex_bundle,build_pdf
from pdf_advanced import preview,edit

meta={'course':'Δοκιμή','year':'2025','period':'KAN','semester':'1o_Εξάμηνο',
'solver':'solver','reviewer_a':'reviewer_a','reviewer_b':'reviewer_b',
'repo':'ece-ntua-exam-solutions/Problems-Solutions',
'repo_path':'1o_Εξάμηνο/Γραμμική_Άλγεβρα/2025/KΑΝ','template':'shmmy-purple-cover-v1',
'accent_override':'7446a7','font_override':'serif','margin_override':'23'}

def test_compile():
    tex,assets=latex_bundle('# Άσκηση 1 α)\n\n**Μεθοδολογία**\n\nΕφαρμόζουμε έναν τύπο.\n\n**Λύση**\n\n\\[R=20\\,\\Omega\\]',meta)
    assert 'Λύσεις γραμμένες από φοιτητές για φοιτητές' in tex
    pdf=build_pdf(tex,assets)
    assert pdf.startswith(b'%PDF-')
    encoded=base64.b64encode(pdf).decode()
    a=preview(encoded,0)
    assert a['pages']>=2
    rect=[60,250,170,310]
    note=edit({'pdf':encoded,'page':0,'rect':rect,'operation':'note','text':'Review', 'font_size':9})
    assert base64.b64decode(note['pdf']).startswith(b'%PDF-')
    return a['pages']

if __name__=='__main__':
    print('test_compile+pdf_note PASS; pages:',test_compile())
