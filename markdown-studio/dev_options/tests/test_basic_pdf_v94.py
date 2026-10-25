"""Offline smoke tests; run from dev_options/tests with python test_basic_pdf_v94.py."""
from pathlib import Path
import sys
import fitz
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"backend"))
from basic_pdf import build_basic_pdf
from source_map import blocks_with_offsets

META={"course":"Γραμμική Άλγεβρα","year":"2025","period":"KAN",
      "solver":"thanos","reviewer_a":"test_a","reviewer_b":"test_b",
      "template":"shmmy-purple-cover-v1"}
MD="""## Άσκηση 1 α)

**Μεθοδολογία**

1. Εφαρμόζουμε τον νόμο του Ohm.

**Λύση**

Το ρεύμα είναι $I=\\frac{V}{R}=5\\,\\mathrm{A}$.

| Φυσικό μέγεθος | Τιμή |
|---|---:|
| Αντίσταση | 20 Ω |

Το αποτέλεσμα είναι **5 A**.
"""

pdf,positions,warnings=build_basic_pdf(MD,META,True)
assert not warnings, warnings
with fitz.open(stream=pdf,filetype="pdf") as doc:
    assert len(doc)==2
    assert "Γραμμική Άλγεβρα" in doc[0].get_text()
    assert "Άσκηση 1 α)" in doc[1].get_text()
    assert len(doc[1].get_images())>0
assert len(positions)==len(blocks_with_offsets(MD))
block=next(p for p in positions if "αποτέλεσμα" in p["label"])
new=MD[:block["start"]]+MD[block["start"]:block["end"]].replace("5 A","7 A")+MD[block["end"]:]
pdf2,m2,w2=build_basic_pdf(new,META,True)
assert not w2 and pdf2!=pdf and len(m2)==len(positions)
print("PASS: PyMuPDF cover, Greek, math, table, block selection, source edit, re-export")
