"""Markdown Studio v10.0.1 · offline UI + optional local PDF/GitHub service.
Run from Anaconda Prompt: python studio_server.py
Requires Python packages in requirements.txt. PDF rendering uses PyMuPDF, not XeLaTeX.
"""
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'backend'))
runpy.run_path(str(ROOT / 'backend' / 'studio_server.py'), run_name='__main__')
