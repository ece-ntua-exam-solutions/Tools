"""On-demand PR reports. SMTP credentials live only in server environment."""
import json, os, re, ssl, smtplib, html, time, threading, unicodedata, shutil
from urllib.request import urlopen, Request
from datetime import datetime, timezone
from email.message import EmailMessage
from github_pr import run
REPO='ece-ntua-exam-solutions/Problems-Solutions'

_CACHE={}
_CACHE_LOCK=threading.RLock()
def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',str(value).casefold()) if unicodedata.category(c)!='Mn').replace('ς','σ').replace('_',' ')

def _pages(endpoint):
    # Public repository: authenticated gh when available, otherwise public REST.
    with _CACHE_LOCK:
        cached=_CACHE.get(endpoint)
        if cached and time.monotonic()-cached[0]<90:return cached[1]
        if shutil.which('gh'):
            proc=run('gh','api','--paginate','--slurp',endpoint,timeout=90,check=False)
            if proc.returncode==0:pages=json.loads(proc.stdout)
            else:pages=None
        else:pages=None
        if pages is None:
            pages=[];page=1
            while True:
                sep='&' if '?' in endpoint else '?'
                request=Request('https://api.github.com/'+endpoint+sep+'page='+str(page),headers={'User-Agent':'Markdown-Studio-v10','Accept':'application/vnd.github+json'})
                try:
                    with urlopen(request,timeout=25) as response:batch=json.load(response)
                except Exception as exc:raise RuntimeError('Δεν ανακτήθηκαν PR από GitHub. Έλεγξε δίκτυο ή σύνδεση gh για υψηλότερα όρια API.') from exc
                if not isinstance(batch,list):raise ValueError('Μη αναμενόμενη απάντηση GitHub.')
                pages.append(batch)
                if len(batch)<100:break
                page+=1
                if page>100:raise ValueError('Υπερβολικά μεγάλο σύνολο PR. Απαιτείται μικρότερο repository report.')
        if len(_CACHE)>300:_CACHE.clear()
        _CACHE[endpoint]=(time.monotonic(),pages)
        return pages

def report(settings):
    state=settings.get('state','open')
    if state not in ('open','closed','merged','all'):raise ValueError('Invalid state')
    since=str(settings.get('since','')).strip()
    if since:datetime.strptime(since,'%Y-%m-%d')
    # Paginate without silently dropping PRs; fetch file lists only after cheap filters.
    pages=_pages(f'repos/{REPO}/pulls?state='+('closed' if state=='merged' else state)+'&per_page=100')
    prs=[pr for page in pages for pr in page]
    items=[]
    warnings=[]
    labels={s.strip().casefold() for s in str(settings.get('labels','')).split(',') if s.strip()}
    for pr in prs:
        if state=='merged' and not pr.get('merged_at'):continue
        if since and pr['updated_at'][:10]<since:continue
        if settings.get('drafts') is False and pr.get('draft'):continue
        if settings.get('author') and pr['user']['login'].casefold()!=settings['author'].strip().casefold():continue
        if labels and not labels.intersection(x['name'].casefold() for x in pr.get('labels',[])):continue
        pages=_pages(f'repos/{REPO}/pulls/{pr["number"]}/files?per_page=100')
        raw_files=[f for page in pages for f in page]
        files=[f['filename'] for f in raw_files]
        if len(files)>=3000:warnings.append('PR #'+str(pr['number'])+': όριο GitHub 3000 αρχείων· η κατηγοριοποίηση μπορεί να είναι ελλιπής.')
        year=str(settings.get('year','')).strip()
        semester=str(settings.get('semester','')).strip()
        prefix=str(settings.get('path','')).strip().strip('/')
        course=norm(settings.get('course','')).strip()
        def match_file(f):
            parts=f.split('/')
            return (not year or (len(parts)>2 and parts[2]==year)) and (not semester or re.match(r'^'+re.escape(semester)+r'[^0-9]',f)) and (not prefix or f==prefix or f.startswith(prefix+'/')) and (not course or course in norm(f))
        if not any(match_file(f) for f in files) and (year or semester or prefix or course):continue
        url=pr['html_url']
        items.append(dict(number=pr['number'],title=pr['title'],body=(pr.get('body') or '') if settings.get('description',True) else '',url=url,files=files if settings.get('files',True) else [],author=pr['user']['login'],state='merged' if pr.get('merged_at') else pr['state'],draft=pr.get('draft',False),updated=pr['updated_at'],labels=[x['name'] for x in pr.get('labels',[])],file_links={f['filename']:f.get('blob_url') or url+'/files' for f in raw_files}))
    stamp=datetime.now(timezone.utc).isoformat()
    esc=lambda s:html.escape(str(s),quote=True)
    content=f'<h2>Markdown Studio — PR report</h2><p>{esc(stamp)} · {len(items)} PR · {esc(REPO)}</p>'
    text=f'Markdown Studio — PR report\n{stamp}\nFilters: {json.dumps(settings,ensure_ascii=False)}\n'
    content+='<p>Filters: '+esc(json.dumps(settings,ensure_ascii=False))+'</p>'
    for x in items:
        content+=f'<article><h3><a href="{esc(x["url"])}">#{x["number"]} {esc(x["title"])}</a></h3><p>{esc(x["author"])} · {esc(x["state"])}'+(' · draft' if x['draft'] else '')+'</p><pre style="white-space:pre-wrap">'+esc(x['body'])+'</pre><p>'
        text+=f'\n#{x["number"]} {x["title"]}\n{x["url"]}\n{x["body"]}\n'
        for f in x['files']:
            from urllib.parse import quote
            link=x['file_links'].get(f,x['url']+'/files')
            content+=f'<a href="{esc(link)}">{esc(f)}</a><br>'
            text+=f'{f}: {link}\n'
        content+='</p></article>'
    return {'items':items,'html':content,'text':text,'generated_at':stamp,'settings':settings,'warnings':warnings}

def send_report(data, recipients, subject):
    if not isinstance(data,dict) or len(str(data.get('text','')))>2000000 or len(str(data.get('html','')))>4000000:raise ValueError('Υπερβολικά μεγάλο report.')
    addresses=[s.strip() for s in re.split('[,;]',recipients) if s.strip()]
    if not addresses or len(addresses)>30 or any(not re.fullmatch(r'[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+',a) for a in addresses):raise ValueError('Δώσε έγκυρα email, χωρισμένα με κόμμα (έως 30).')
    host=os.environ.get('STUDIO_SMTP_HOST');sender=os.environ.get('STUDIO_SMTP_FROM');mode=os.environ.get('STUDIO_SMTP_SECURITY','starttls')
    if not host or not sender:raise ValueError('Ρύθμισε STUDIO_SMTP_HOST και STUDIO_SMTP_FROM στον server.')
    if mode not in ('ssl','starttls'):raise ValueError('SMTP security: ssl ή starttls')
    msg=EmailMessage();msg['From']=sender;msg['To']=', '.join(addresses);msg['Subject']=subject or 'Markdown Studio — PR report'
    msg.set_content(data['text']);msg.add_alternative(data['html'],subtype='html')
    port=int(os.environ.get('STUDIO_SMTP_PORT','465' if mode=='ssl' else '587'))
    conn=smtplib.SMTP_SSL(host,port,timeout=30,context=ssl.create_default_context()) if mode=='ssl' else smtplib.SMTP(host,port,timeout=30)
    with conn as smtp:
        if mode=='starttls':smtp.starttls(context=ssl.create_default_context())
        user=os.environ.get('STUDIO_SMTP_USER')
        if user:smtp.login(user,os.environ.get('STUDIO_SMTP_PASSWORD',''))
        refused=smtp.send_message(msg)
    return {'sent':not refused,'refused':list(refused),'accepted':[a for a in addresses if a not in refused]}
