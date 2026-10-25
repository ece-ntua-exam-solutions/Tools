import sys,json,unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
import reports
class Tests(unittest.TestCase):
 def test_report_filters_pages_and_escaping(self):
  pr=dict(number=1,title='<script>x</script>',body='Ελληνική περιγραφή',html_url='https://github.com/'+reports.REPO+'/pull/1',updated_at='2026-10-25T10:00:00Z',user={'login':'tester'},state='open',draft=False,labels=[{'name':'review'}])
  def run(*args,**kw):return SimpleNamespace(stdout=json.dumps([[{'filename':'1ο_Εξάμηνο/Γραμμική_Άλγεβρα/2025/ΚΑΝ/lysi.md'}]] if '/files?' in args[-1] else [[pr],[]]))
  with patch.object(reports,'_pages',lambda endpoint: json.loads(run('gh',endpoint).stdout)):
   r=reports.report({'course':'Γραμμική','labels':'review','since':'2026-10-24'})
   self.assertEqual(len(r['items']),1);self.assertNotIn('<script>',r['html']);self.assertIn('Ελληνική περιγραφή',r['html']);self.assertIn('/pull/1',r['text'])
   self.assertEqual(reports.report({'path':'2ο_Εξάμηνο'})['items'],[])
   self.assertEqual(reports.report({'description':False,'files':False})['items'][0]['body'],'')
 def test_smtp_mock_no_real_mail(self):
  with patch.dict('os.environ',{'STUDIO_SMTP_HOST':'smtp.example.org','STUDIO_SMTP_FROM':'sender@example.org'},clear=True),patch('reports.smtplib.SMTP') as smtp:
   smtp.return_value.__enter__.return_value.send_message.return_value={}
   r=reports.send_report({'text':'δοκιμή','html':'<b>δοκιμή</b>'},'a@example.org','Report')
   self.assertTrue(r['sent']);smtp.return_value.__enter__.return_value.starttls.assert_called_once()
 def test_reject_recipient_injection(self):
  with self.assertRaises(ValueError):reports.send_report({},'a@example.org\nBcc:x@y.org','x')
unittest.main()
