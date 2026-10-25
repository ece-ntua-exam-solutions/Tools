"""Markdown -> parameterized standalone LaTeX / PDF for ΣΗΜΜΥ exam solutions.

No network or GitHub mutation here. Native compiler commands are invoked without a shell.
User-entered LaTeX is untrusted; run this on trusted documents on a LOOPBACK server.
"""
from __future__ import annotations
import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
REGISTRY = ROOT / 'templates' / 'registry.json'
DEFAULT_REPO = 'ece-ntua-exam-solutions/Problems-Solutions'
MAX_PDF = 18_000_000


def templates() -> list[dict]:
    data = json.loads(REGISTRY.read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise ValueError('Το registry προτύπων πρέπει να είναι λίστα.')
    return data


def tex_escape(raw: Any) -> str:
    """Escape only metadata, never equation/Markdown body from Pandoc."""
    subs = {'\\': r'\textbackslash{}', '{': r'\{', '}': r'\}',
            '#': r'\#', '$': r'\$', '%': r'\%', '&': r'\&',
            '_': r'\_', '~': r'\textasciitilde{}', '^': r'\textasciicircum{}'}
    return ''.join(subs.get(c, c) for c in str(raw))


def valid_component(value: str) -> bool:
    return bool(value and value.strip() and len(value) < 120
                and not any(x in value for x in ('/', '\\', '..', '\0', '\n', '\r'))
                and not value.startswith('.') and value not in {'.', '..'})


def make_repo_path(meta: dict) -> str:
    """Prefer an exact existing relative repo directory from catalog.

    New directories can be constructed, but never infer/rewrite an existing mixed-script folder.
    """
    explicit = str(meta.get('repo_path') or '').strip().strip('/')
    if explicit:
        parts = explicit.split('/')
        if len(parts) != 4 or not all(valid_component(p) for p in parts):
            raise ValueError('Η διαδρομή GitHub απαιτεί 4 ασφαλή στοιχεία: εξάμηνο/μάθημα/έτος/περίοδος.')
        return '/'.join(parts)
    sem = str(meta.get('semester', ''))
    course = str(meta.get('course', '')).strip().replace(' ', '_')
    year = str(meta.get('year', ''))
    period = str(meta.get('period', 'KAN'))
    folder = 'ΚΑΝ' if period == 'KAN' else 'ΕΠΑΝ'
    if not re.fullmatch(r'(?:19|20)\d{2}', year):
        raise ValueError('Το έτος πρέπει να περιέχει τέσσερα ψηφία.')
    if not all(valid_component(c) for c in (sem, course, year, folder)):
        raise ValueError('Μη έγκυρο εξάμηνο ή μάθημα.')
    return '/'.join((sem, course, year, folder))


def checked_metadata(meta: dict) -> dict:
    if not isinstance(meta, dict):
        raise ValueError('Λείπουν τα στοιχεία εξέτασης.')
    out = {}
    for key in ('course', 'semester', 'year', 'period', 'solver', 'reviewer_a', 'reviewer_b', 'repo_path', 'repo', 'template', 'accent_override', 'font_override', 'margin_override', 'tagline_override', 'base_branch', 'repo_pdf_name', 'repo_tex_name', 'repo_md_name'):
        val = str(meta.get(key) or '').strip()
        if len(val) > 250:
            raise ValueError('Πολύ μεγάλο πεδίο: ' + key)
        out[key] = val
    if not out['course']:
        raise ValueError('Χρειάζεται τίτλος μαθήματος.')
    if not re.fullmatch(r'(?:19|20)\d{2}', out['year']):
        raise ValueError('Μη έγκυρο έτος.')
    if out['period'] not in ('KAN', 'EPAN'):
        raise ValueError('Η περίοδος πρέπει να είναι KAN ή EPAN.')
    for role in ('solver', 'reviewer_a', 'reviewer_b'):
        if not out[role]:
            raise ValueError('Συμπλήρωσε και τους τρεις Discord συντελεστές.')
    if len(set((out['solver'], out['reviewer_a'], out['reviewer_b']))) != 3:
        raise ValueError('Λύτης και ελεγκτές πρέπει να είναι τρία διαφορετικά πρόσωπα.')
    if out['repo'] and not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', out['repo']):
        raise ValueError('Το repository πρέπει να είναι OWNER/REPO.')
    out['repo'] = out['repo'] or DEFAULT_REPO
    out['repo_path'] = make_repo_path(out)
    if out['accent_override'] and not re.fullmatch(r'[0-9a-fA-F]{6}', out['accent_override']):
        raise ValueError('Το χρώμα πρέπει να είναι HEX 6 ψηφίων, χωρίς #.')
    if out['font_override'] and out['font_override'] not in ('serif', 'sans'):
        raise ValueError('Άγνωστη οικογένεια γραμματοσειράς.')
    if out['margin_override']:
        try: margin=int(out['margin_override'])
        except ValueError: raise ValueError('Τα περιθώρια πρέπει να είναι αριθμός.')
        if not 12 <= margin <= 35:
            raise ValueError('Περιθώρια 12–35 mm.')
    if out['base_branch'] and not re.fullmatch(r'[A-Za-z0-9_./-]{1,80}', out['base_branch']):
        raise ValueError('Μη έγκυρο όνομα κλάδου GitHub.')
    if '..' in out['base_branch'] or out['base_branch'].startswith(('/', '-')):
        raise ValueError('Μη έγκυρο όνομα κλάδου GitHub.')
    out['base_branch']=out['base_branch'] or 'main'
    for key, extension in (('repo_pdf_name','.pdf'),('repo_tex_name','.tex'),('repo_md_name','.md')):
        if not out[key]:
            out[key]='lysi'+extension
        if not (out[key].endswith(extension) and len(out[key]) < 70
                and re.fullmatch(r'[\w. -]+',out[key],re.UNICODE)
                and '..' not in out[key] and not out[key].startswith('.')):
            raise ValueError('Μη έγκυρο όνομα αρχείου: '+key)
    return out


def pandoc_body(markdown: str) -> str:
    if not isinstance(markdown, str) or not markdown.strip() or len(markdown) > 500_000:
        raise ValueError('Δώσε Markdown έως 500.000 χαρακτήρες.')
    if shutil.which('pandoc') is None:
        raise RuntimeError('Δεν βρέθηκε Pandoc. Εγκατάστησέ το για εξαγωγή LaTeX/PDF.')
    cmd = ['pandoc', '--from=markdown+tex_math_dollars+tex_math_single_backslash+raw_tex',
           '--to=latex', '--wrap=none', '--markdown-headings=atx']
    # Windows default ANSI code pages (cp1252/cp1253) cannot encode Greek.
    # Explicit UTF-8 is REQUIRED for Pandoc stdin and stdout on every platform.
    proc = subprocess.run(cmd, input=markdown, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=30)
    if proc.returncode:
        raise ValueError('Σφάλμα Pandoc: ' + proc.stderr[-1200:])
    return proc.stdout


def selected_template(template_id: str) -> dict:
    for t in templates():
        if t['id'] == template_id:
            return t
    raise ValueError('Άγνωστο LaTeX template: ' + template_id)


def latex_document(markdown: str, meta: dict) -> str:
    values = checked_metadata(meta)
    choice = selected_template(values['template'] or templates()[0]['id'])
    body = pandoc_body(markdown)
    optional_packages = ''
    if r'\begin{circuitikz}' in body:
        optional_packages += r'\usepackage{circuitikz}' + '\n'
    elif r'\begin{tikzpicture}' in body:
        optional_packages += r'\usepackage{tikz}' + '\n'
    if r'\begin{axis}' in body:
        optional_packages += r'\usepackage{pgfplots}' + '\n'
    accent = values['accent_override'] or choice.get('accent', '693E91')
    if not re.fullmatch(r'[A-Fa-f0-9]{6}', accent):
        raise ValueError('Το accent πρέπει να είναι 6-digit HEX χωρίς #.')
    serif = (values['font_override'] or choice.get('font', 'serif')) == 'serif'
    family = 'DejaVu Serif' if serif else 'DejaVu Sans'
    altfamily = 'DejaVu Sans' if serif else 'DejaVu Serif'
    size = int(choice.get('body_font_pt', 11))
    margin = int(values['margin_override'] or choice.get('margin_mm', 24))
    if not (9 <= size <= 14 and 12 <= margin <= 35):
        raise ValueError('Μη έγκυρο μέγεθος ή περιθώριο template.')
    course = tex_escape(values['course'])
    title = ('Κανονική Εξέταση' if values['period'] == 'KAN' else 'Επαναληπτική Εξέταση')
    tagline = tex_escape(values['tagline_override'] or choice.get('tagline', 'Λύσεις γραμμένες από φοιτητές για φοιτητές'))
    cover = rf'''
\begin{{titlepage}}
\centering
\vspace*{{2.4cm}}
{{\Large\bfseries\color{{accent}} ΟΜΑΔΑ ΕΠΙΛΥΣΗΣ ΘΕΜΑΤΩΝ ΣΗΜΜΥ\par}}
\vspace{{1.4cm}}
{{\Huge\bfseries {course}\par}}
\vspace{{0.7cm}}
{{\Large {tex_escape(title)} -- {values['year']}\par}}
\vspace{{2cm}}
\begin{{tabular}}{{@{{}}rl@{{}}}}
\textbf{{Λύτης:}} & {tex_escape(values['solver'])} \\
\textbf{{Ελεγκτής Α:}} & {tex_escape(values['reviewer_a'])} \\
\textbf{{Ελεγκτής Β:}} & {tex_escape(values['reviewer_b'])} \\
\end{{tabular}}
\vfill
{{\normalsize\itshape {tagline}\par}}
\vspace{{1cm}}
\end{{titlepage}}
'''
    if choice.get('cover') != 'separate':
        cover = (rf'\begin{{center}} {{\LARGE\bfseries {course}}}\\[4pt] '
                 rf'{tex_escape(title)} -- {values["year"]}\\[6pt] '
                 rf'{tagline}\end{{center}}\bigskip' + '\n')
    footer = (r'\fancyfoot[C]{\footnotesize\thepage}' if choice.get('show_footer', True) else '')
    return rf'''% Generated by Markdown Studio v8 - ΣΗΜΜΥ solution template
% Template ID: {choice['id']}
% WARNING: review the exported equations against the approved source before publishing.
\documentclass[a4paper,{size}pt]{{extarticle}}
\usepackage{{fontspec}}
\usepackage{{polyglossia}}
\setmainlanguage{{greek}}
\setotherlanguage{{english}}
\IfFontExistsTF{{{family}}}{{\setmainfont{{{family}}}}}{{\setmainfont{{FreeSerif}}}}
\IfFontExistsTF{{{altfamily}}}{{\setsansfont{{{altfamily}}}}}{{\setsansfont{{FreeSans}}}}
\usepackage{{amsmath,amssymb,graphicx,xcolor,geometry,enumitem,fancyhdr,hyperref}}
\usepackage{{longtable,booktabs,array}}
\providecommand{{\tightlist}}{{\setlength{{\itemsep}}{{0pt}}\setlength{{\parskip}}{{0pt}}}}
{optional_packages}\geometry{{a4paper,margin={margin}mm}}
\definecolor{{accent}}{{HTML}}{{{accent}}}
\hypersetup{{colorlinks=true,linkcolor=accent,urlcolor=accent,pdftitle={{{course}}}}}
\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{5pt}}
\setcounter{{secnumdepth}}{{0}}
\usepackage{{titlesec}}
\titleformat{{\section}}{{\large\bfseries\color{{accent}}}}{{}}{{0pt}}{{}}
\titleformat{{\subsection}}{{\normalsize\bfseries}}{{}}{{0pt}}{{}}
\titleformat{{\subsubsection}}{{\normalsize\bfseries}}{{}}{{0pt}}{{}}
\pagestyle{{fancy}}
\fancyhf{{}}
{footer}
\renewcommand{{\headrulewidth}}{{0pt}}
\begin{{document}}
{cover}
{body}
\end{{document}}
'''


def build_pdf(tex: str, assets: dict[str, bytes] | None = None) -> bytes:
    compilers = [shutil.which('xelatex'), shutil.which('lualatex')]
    compilers = [c for c in compilers if c]
    if not compilers:
        raise RuntimeError('Δεν υπάρχει XeLaTeX/LuaLaTeX στο PATH. Η εξαγωγή .tex λειτουργεί χωρίς αυτό.')
    if not isinstance(tex, str) or len(tex) > 700_000:
        raise ValueError('Μεγάλο αρχείο LaTeX.')
    with tempfile.TemporaryDirectory(prefix='shmmy_latex_') as td:
        work = Path(td)
        (work / 'lysi.tex').write_text(tex, encoding='utf-8')
        for relative_name, content in (assets or {}).items():
            relative_path = Path(relative_name)
            if (len(relative_path.parts) != 2 or relative_path.parts[0] != 'assets'
                or not re.fullmatch(r'fig-[a-f0-9]{12}\.(?:png|jpg)',relative_path.name)
                or len(content)>8_000_000):
                raise ValueError('Μη ασφαλές όνομα εικόνας.')
            target = work / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        env = dict(os.environ)
        env['max_print_line'] = '2000'
        env['openin_any'] = 'p'
        env['openout_any'] = 'p'
        errors = []
        for cmd in compilers:
            args = [cmd, '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error',
                    '-file-line-error', '-output-directory=' + td, 'lysi.tex']
            try:
                proc = subprocess.run(args, cwd=td, capture_output=True, text=True,
                                      encoding='utf-8', errors='replace', timeout=70, env=env)
            except subprocess.TimeoutExpired:
                errors.append(Path(cmd).name + ': timeout (70s)')
                continue
            if proc.returncode == 0 and (work / 'lysi.pdf').exists():
                payload = (work / 'lysi.pdf').read_bytes()
                if len(payload) > MAX_PDF:
                    raise ValueError('Το PDF ξεπερνά το μέγιστο μέγεθος.')
                return payload
            errors.append(Path(cmd).name + ': ' + '\n'.join(
                (proc.stdout + '\n' + proc.stderr).splitlines()[-15:])[-1300:])
        raise RuntimeError('Δεν ήταν δυνατή η μεταγλώττιση.\n' + '\n---\n'.join(errors))


def filename(meta: dict) -> str:
    meta = checked_metadata(meta)
    course = re.sub(r'[^\w-]+', '_', meta['course'], flags=re.UNICODE).strip('_') or 'Mathima'
    return f'{course}_{meta["year"]}_{meta["period"]}.pdf'


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode('ascii')

# Embedded images (data:image/png;base64,... and JPEG) used by v7 reports.
_IMAGE_RX = re.compile(r'!\[([^\]]*)\]\(data:image/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)\)', re.I)


def extract_embedded_images(markdown: str) -> tuple[str, dict[str, bytes]]:
    """Replace image data URIs with stable relative filenames for Pandoc/TeX.

    Images remain separate assets. The original Markdown is always preserved.
    """
    import hashlib
    assets = {}

    def convert(match):
        extension = 'jpg' if match.group(2).lower() in ('jpeg', 'jpg') else 'png'
        binary = base64.b64decode(re.sub(r'\s+', '', match.group(3)), validate=True)
        if len(binary) > 8_000_000:
            raise ValueError('Ενσωματωμένη εικόνα πάνω από 8 MB.')
        signature = b'\x89PNG\r\n\x1a\n' if extension == 'png' else b'\xff\xd8'
        if not binary.startswith(signature):
            raise ValueError('Μη έγκυρη ενσωματωμένη εικόνα.')
        name = 'assets/fig-' + hashlib.sha256(binary).hexdigest()[:12] + '.' + extension
        assets[name] = binary
        return '![' + match.group(1) + '](' + name + ')'

    result = _IMAGE_RX.sub(convert, markdown)
    if len(assets) > 40:
        raise ValueError('Μέχρι 40 εικόνες ανά λύση.')
    return result, assets


def latex_bundle(markdown: str, meta: dict) -> tuple[str, dict[str, bytes]]:
    processed, assets = extract_embedded_images(markdown)
    return latex_document(processed, meta), assets
