"""Markdown Studio v10.0.1: OPTIONAL local backend. No external app credentials stored.
Run only on 127.0.0.1. Do not expose to LAN or public internet.
"""
from __future__ import annotations
import json, re, os, sys, base64, importlib.util
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit,parse_qs
from exam_studio import latex_bundle, b64, extract_embedded_images
from basic_pdf import build_basic_pdf
from github_pr import submit,is_ready
from github_auth import status as github_status, start as github_start, setup_git as github_setup_git
from pdf_advanced import preview as pdf_preview,edit as pdf_edit

ROOT=Path(__file__).resolve().parent.parent
REPO='ece-ntua-exam-solutions/Problems-Solutions'
PORT=int(os.environ.get('STUDIO_PORT','8765'))

def normalize_meta(data):
    m=dict(data or {})
    if m.get('period') in ['ΚΑΝ','KAN'] : m['period']='KAN'
    elif m.get('period') in ['ΕΠΑΝ','EPAN']:m['period']='EPAN'
    sem=m.get('semester','1')
    if str(sem).isdigit():m['semester']=str(sem)+'ο_Εξάμηνο'
    m['template']='shmmy-purple-cover-v1'
    return m

def verify_url(url):
    from github_pr import run
    if not re.fullmatch(r'https://github\.com/ece-ntua-exam-solutions/Problems-Solutions/pull/[0-9]+/?',str(url)):
        raise ValueError('Μη έγκυρο PR URL για το κοινό repo.')
    import subprocess
    p=run('gh','pr','view',url,'--repo',REPO,'--json','url,number,state,headRefName,baseRefName',check=False,timeout=20)
    if p.returncode!=0:raise RuntimeError('Δεν ήταν δυνατή η επαλήθευση μέσω GitHub: '+p.stderr[-250:])
    d=json.loads(p.stdout)
    if d.get('url','').rstrip('/')!=url.rstrip('/'):raise RuntimeError('GitHub URL mismatch')
    return {'verified':True,'url':d['url'],'number':d['number'],'state':d['state'],'branch':d.get('headRefName')}

def make_preflight(payload):
    from exam_studio import checked_metadata
    m=normalize_meta(payload.get('metadata') or {})
    checked_metadata(m)
    # Fail early if Markdown/LaTeX cannot be exported (e.g. Unicode or TeX error),
    # before the user confirms any GitHub write. No mutation in preflight.
    source = payload.get('text', '')
    pdf, source_map, warnings = build_basic_pdf(source,m)
    # The full LaTeX source is optional for a DRAFT PR. Pandoc is not a PDF dependency.
    import shutil
    tex_available = bool(shutil.which("pandoc"))
    if tex_available:
        latex_bundle(source,m)  # Validate source export before GitHub mutation.
    if warnings:
        raise ValueError("Το PDF έχει μη αποδιδόμενες εξισώσεις. Διόρθωσέ τες πριν υποβάλεις PR: " + warnings[0])
    if not pdf.startswith(b'%PDF-'):
        raise RuntimeError('Το PDF δεν δημιουργήθηκε σωστά.')
    if m.get('repo')!=REPO:raise ValueError('Αυτή η έκδοση δημοσιεύει μόνο στο συμφωνημένο repo.')
    if not m.get('repo_path'):raise ValueError('Χρειάζεται ακριβής διαδρομή του repo.')
    ready=is_ready()
    if not all(ready.values()):return {'ok':False,'message':'Χρειάζεται Git και GitHub CLI. Πάτα «Σύνδεση με GitHub» στο Studio και, αν χρειάζεται, «Ρύθμιση Git». Κατάσταση: '+str(ready)}
    from github_pr import run
    login=run('gh','api','user','--jq','.login',timeout=20).stdout.strip()
    if not login:raise RuntimeError('Δεν διαβάστηκε GitHub login.')
    branch=m.get('base_branch') or 'main'
    check=run('gh','api',f'repos/{REPO}/branches/{branch}','--jq','.name',check=False,timeout=20)
    if check.returncode:raise ValueError('Δεν υπάρχει base branch: '+branch)
    msg=('Authenticated as '+login+'. PDF μέσω PyMuPDF OK ('+str(len(pdf))+' bytes, χωρίς XeLaTeX). Draft PR → '+REPO+' / '+str(m['repo_path'])+'. '
         + ('Το .tex θα συμπεριληφθεί από Pandoc. ' if tex_available else 'ΧΩΡΙΣ Pandoc θα υποβληθούν μόνο .md και .pdf (όχι .tex). ')
         + 'Επιβεβαίωσε εμφάνιση μαθηματικών και έλεγξε το PR προτού εγκριθεί.')
    return {'ok':True,'message':msg,'login':login}

class Handler(BaseHTTPRequestHandler):
    def _json(self,data,status=200):
        raw=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def _fail(self,e):
        self._json({'error':str(e)},400)
    def do_GET(self):
        route=urlsplit(self.path).path
        if route=='/api/capabilities':
            import shutil
            return self._json({'python':True,'pdf_edit':importlib.util.find_spec('fitz') is not None,'pdf_engine':'PyMuPDF',
                'latex':bool(shutil.which('pandoc')),'latex_compiler':bool(shutil.which('xelatex') or shutil.which('lualatex')),'pr':True})
        if route=='/api/ocr/status':
            from ocr_equation import status
            return self._json(status())
        if route=='/api/github/status':return self._json(github_status())
        if route=='/api/catalog':
            try:
                from urllib.request import urlopen,Request
                query=parse_qs(urlsplit(self.path).query)
                if query.get('repo',[None])[0]!=REPO:raise ValueError('Μόνο το συμφωνημένο repository.')
                branch=query.get('branch',['main'])[0]
                if not re.fullmatch(r'[A-Za-z0-9_./-]{1,120}',branch):raise ValueError('Μη έγκυρο branch.')
                from urllib.parse import quote
                url=f'https://api.github.com/repos/{REPO}/git/trees/{quote(branch,safe="")}?recursive=1'
                with urlopen(Request(url,headers={'User-Agent':'Markdown-Studio-v9'}),timeout=20) as r:data=json.load(r)
                if data.get('truncated'):raise ValueError('Ο κατάλογος GitHub είναι ελλιπής. Δεν φορτώθηκε μερικό αποτέλεσμα.')
                paths=sorted(set('/'.join(x.get('path','').split('/')[:4]) for x in data.get('tree',[]) if len(x.get('path','').split('/'))>=4 and x['path'].split('/')[2].isdigit()))
                return self._json({'paths':paths,'truncated':data.get('truncated',False)})
            except Exception as e:return self._fail(e)
        if route=='/':route='/index.html'
        whitelist={'/index.html':'index.html','/studio.css':'studio.css','/studio.js':'studio.js','/reports.js':'reports.js','/ui.css':'ui.css','/search.js':'search.js','/ui.js':'ui.js','/tools.js':'tools.js','/feedback.js':'feedback.js','/ocr.js':'ocr.js','/vendor/mathjax.bundle.js':'vendor/mathjax.bundle.js'}
        if route not in whitelist:return self.send_error(404)
        path=ROOT/whitelist[route]
        if not path.is_file():return self.send_error(404)
        content=path.read_bytes();ct='text/html' if route.endswith('.html') else 'text/css' if route.endswith('.css') else 'text/javascript'
        self.send_response(200);self.send_header('Content-Type',ct+'; charset=utf-8');self.send_header('Content-Length',str(len(content)));self.send_header('Cache-Control','no-store' if route.endswith('.html') else 'public, max-age=3600');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(content)
    def do_POST(self):
        route=urlsplit(self.path).path
        if route not in {'/api/ocr/analyze','/api/ocr/equation','/api/reports/build','/api/reports/send','/api/export','/api/pdf/preview','/api/pdf/edit','/api/pr/preflight','/api/pr/create','/api/pr/verify','/api/github/connect','/api/github/setup-git'}:return self.send_error(404)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size<=0 or size>28_000_000:raise ValueError('Υπερβολικά μεγάλο αίτημα.')
            origin=self.headers.get('Origin','')
            if origin and origin not in (f'http://127.0.0.1:{PORT}',f'http://localhost:{PORT}'):
                raise ValueError('Απαγορευμένο Origin.')
            payload=json.loads(self.rfile.read(size))
            if route=='/api/ocr/analyze':
                from ocr_equation import analyze
                return self._json(analyze(payload))
            if route=='/api/ocr/equation':
                from ocr_equation import recognize
                return self._json(recognize(payload))
            if route=='/api/reports/build':
                from reports import report
                return self._json(report(payload.get('settings',{})))
            if route=='/api/reports/send':
                from reports import send_report
                if payload.get('confirm') is not True:raise ValueError('Απαιτείται επιβεβαίωση αποστολής.')
                return self._json(send_report(payload['report'],payload.get('recipients',''),payload.get('subject','')))
            if route=='/api/github/connect':return self._json(github_start())
            if route=='/api/github/setup-git':return self._json(github_setup_git())
            if route=='/api/export':
                m=normalize_meta(payload.get('metadata'))
                original=payload.get('text','')
                compile_pdf=bool(payload.get('compile'))
                indexed=bool(payload.get('source_map')) and compile_pdf
                out={}
                if not compile_pdf or payload.get('include_tex'):
                    tex, assets = latex_bundle(original, m)
                    out['tex']=tex
                    out['assets']=list(assets)
                if compile_pdf:
                    pdf, positions, warnings = build_basic_pdf(original, m, source_map=indexed)
                    out['pdf']=b64(pdf)
                    out['engine']='pymupdf'
                    out['warnings']=warnings
                    if indexed:
                        out['source_map']=positions
                        out['source_map_status']='indexed' if positions else 'no-anchors'
                return self._json(out)
            if route=='/api/pdf/preview':return self._json(pdf_preview(payload.get('pdf',''),int(payload.get('page',0))))
            if route=='/api/pdf/edit':return self._json(pdf_edit(payload))
            if route=='/api/pr/preflight':return self._json(make_preflight(payload))
            if route=='/api/pr/create':
                if payload.get('confirm') is not True:raise ValueError('Απαιτείται ρητή επιβεβαίωση.')
                pre=make_preflight(payload)
                if not pre.get('ok'):raise ValueError(pre['message'])
                m=normalize_meta(payload.get('metadata'))
                source=payload.get('text','')
                import shutil
                pdf,_,warnings=build_basic_pdf(source,m)
                if warnings:raise ValueError('Δεν μπορεί να υποβληθεί PDF με ελλιπείς τύπους: '+warnings[0])
                tex=None
                processed,assets=extract_embedded_images(source)
                if shutil.which('pandoc'):
                    tex,assets=latex_bundle(source,m)
                created=submit(m,tex,pdf,source,assets)
                try:created.update(verify_url(created['url']))
                except Exception as e:created.update({'verified':False,'verification_error':str(e)})
                return self._json(created)
            if route=='/api/pr/verify':return self._json(verify_url(payload.get('url','')))
        except Exception as e:return self._fail(e)
    def log_message(self,fmt,*args):
        print('[v10.0.1] '+fmt%args)

if __name__=='__main__':
    print('Markdown Studio v10.0.1 · http://127.0.0.1:'+str(PORT), flush=True)
    try:
        with ThreadingHTTPServer(('127.0.0.1',PORT),Handler) as server:
            server.serve_forever()
    except OSError as exc:
        if exc.errno in (98, 10048):
            print('Η θύρα '+str(PORT)+' χρησιμοποιείται ήδη. Κλείσε τον ΠΡΟΗΓΟΥΜΕΝΟ Python server με Ctrl+C και δοκίμασε ξανά.', file=sys.stderr)
            sys.exit(2)
        raise
