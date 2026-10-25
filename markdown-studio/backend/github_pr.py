"""Optional GitHub PR publication using a user's *local* gh CLI credentials.

No tokens entered in browser or stored in files. No mutations without POST to submit.
Fork workflow supports read-only contributors. Uses a temporary clone/branch.
"""
from __future__ import annotations
import base64
import json
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from exam_studio import checked_metadata, make_repo_path


def run(*args, cwd=None, timeout=70, check=True):
    # Git and gh emit UTF-8; never use the Windows default ANSI code page.
    proc = subprocess.run(list(args), cwd=cwd, text=True, capture_output=True,
                          encoding='utf-8', errors='replace', timeout=timeout)
    if check and proc.returncode:
        raise RuntimeError(('Εντολή Git/GH απέτυχε (' + str(proc.returncode) + '): '\
                            + '\n' + (proc.stderr or proc.stdout)[-1300:]))
    return proc


def is_ready():
    return {'gh': bool(shutil.which('gh')), 'git': bool(shutil.which('git')),
            'authenticated': bool(shutil.which('gh') and run('gh', 'auth', 'status', '--hostname', 'github.com', check=False, timeout=12).returncode == 0)}


def submit(meta, tex: str | None, pdf: bytes, markdown: str, assets=None, publish=True) -> dict:
    values = checked_metadata(meta)
    if not str(meta.get('repo_path', '')).strip():
        raise ValueError('Για PR απαιτείται ρητή, πλήρης διαδρομή GitHub (διάλεξε από τον πραγματικό κατάλογο ή συμπλήρωσε χειροκίνητα).')
    if not publish:
        return {'repo': values['repo'], 'path': values['repo_path'], 'dry_run': True}
    ready = is_ready()
    if not all(ready.values()):
        raise RuntimeError('Απαιτούνται Git, GitHub CLI και σύνδεση από το κουμπί «GitHub: σύνδεση».')
    if len(pdf) > 18_000_000 or not pdf.startswith(b'%PDF-'):
        raise ValueError('Μη έγκυρο PDF.')
    if (tex is not None and len(tex) > 700_000) or len(markdown) > 500_000:
        raise ValueError('Μεγάλο αρχείο πηγής.')
    original = values['repo']
    login = run('gh', 'api', 'user', '--jq', '.login', timeout=20).stdout.strip()
    if not re.fullmatch(r'[A-Za-z0-9-]+', login):
        raise RuntimeError('Δεν μπορεί να προσδιοριστεί το GitHub login.')
    owner, repo_name = original.split('/')
    fork = f'{login}/{repo_name}'
    # Never create a GitHub fork without the user's click on "Create Pull Request".
    exists = run('gh', 'repo', 'view', fork, '--json', 'name', check=False, timeout=20)
    if exists.returncode:
        run('gh', 'repo', 'fork', original, '--clone=false', timeout=65)
        # The new fork might need a few seconds to become cloneable.
    branch = 'solutions/mdstudio-' + uuid.uuid4().hex[:10]
    path = values['repo_path']
    for segment in path.split('/'):
        if not segment or segment in ('.', '..'):
            raise ValueError('Μη ασφαλής διαδρομή.')
    with tempfile.TemporaryDirectory(prefix='shmmy_pr_') as root:
        destination = Path(root) / 'repo'
        for attempt in range(4):
            cloned = run('gh', 'repo', 'clone', fork, str(destination), '--no-upstream', '--', '--depth=1',
                         check=False, timeout=100)
            if cloned.returncode == 0:
                break
            if attempt == 3:
                raise RuntimeError('Αδυναμία clone fork: ' + cloned.stderr[-500:])
            time.sleep(2)
        run('git', 'remote', 'add', 'upstream', f'https://github.com/{original}.git', cwd=destination)
        run('git', 'fetch', 'upstream', values['base_branch'], '--depth=1', cwd=destination, timeout=100)
        run('git', 'checkout', '-b', branch, 'FETCH_HEAD', cwd=destination)
        folder = destination / path
        folder.mkdir(parents=True, exist_ok=True)
        core_files = {values['repo_md_name']: markdown.encode('utf-8'), values['repo_pdf_name']: pdf}
        if tex is not None:core_files[values['repo_tex_name']]=tex.encode('utf-8')
        for relative, data in (assets or {}).items():
            p = Path(relative)
            if (len(p.parts)!=2 or p.parts[0]!='assets' or not re.fullmatch(r'fig-[a-f0-9]{12}\.(png|jpg)',p.name)):
                raise ValueError('Μη ασφαλής διαδρομή εικόνας.')
            if relative in core_files:
                raise ValueError('Σύγκρουση ονόματος asset.')
        files = dict(core_files)
        files.update(assets or {})
        for name, data in files.items():
            file = folder / name
            file.parent.mkdir(parents=True, exist_ok=True)
            if file.exists():
                raise FileExistsError(f'Το {path}/{name} υπάρχει ήδη στο repo. Απέφυγα αντικατάσταση. Χρειάζεται ροή ενημέρωσης.')
            file.write_bytes(data)
        # Avoid committing anything outside selected files; no shell interpolation.
        run('git', 'add', '--', *(path + '/' + k for k in files), cwd=destination)
        title = f'[{values["course"]}] Προσθήκη λύσης {values["year"]} {values["period"]}'
        body = ('Αυτόματο Draft PR από Markdown Studio v9.4.1 (PDF: PyMuPDF).\n\n'
                f'- Μάθημα: {values["course"]}\n- Έτος: {values["year"]}\n'
                f'- Περίοδος: {values["period"]}\n- Διαδρομή: `{path}`\n'
                f'- Λύτης Discord: {values["solver"]}\n'
                f'- Ελεγκτές Discord: {values["reviewer_a"]}, {values["reviewer_b"]}\n\n'
                'Το PR είναι προς επιθεώρηση. Δεν υποκαθιστά τις δύο ανεξάρτητες εγκρίσεις του Discord.\n'
                + ('Το αρχείο .tex δεν περιλαμβάνεται (δεν υπάρχει Pandoc). Θα χρειαστεί πριν από την τελική δημοσίευση.' if tex is None else 'Απαιτείται έλεγχος ότι PDF και LaTeX συμφωνούν με την εγκεκριμένη λύση.'))
        run('git', '-c', 'user.name=Markdown Studio', '-c',
            'user.email=markdown-studio@users.noreply.github.com',
            'commit', '-m', title, cwd=destination)
        run('git', 'push', '--set-upstream', 'origin', branch, cwd=destination, timeout=100)
        res = run('gh', 'pr', 'create', '--repo', original, '--base', values['base_branch'],
                  '--head', f'{login}:{branch}', '--title', title,
                  '--body', body, '--draft', cwd=destination, timeout=70)
        url = res.stdout.strip().splitlines()[-1].strip()
        if not re.fullmatch(r'https://github\.com/[^\s]+/pull/\d+', url):
            raise RuntimeError('Το PR ενδέχεται να δημιουργήθηκε, αλλά δεν επέστρεψε αναμενόμενο URL: '+url[:300])
        return {'url': url, 'branch': branch, 'repo': original, 'path': path}
