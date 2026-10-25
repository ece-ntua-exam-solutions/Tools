"""Regression tests for v9.1 Windows ANSI charmap UnicodeEncodeError.

No GitHub network request or Git repository mutation in these tests.
"""
import sys
import locale
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
import exam_studio
import github_pr
import github_auth

SAMPLE='# Άσκηση 1 α)\n\n**Μεθοδολογία**\n\nΗ αντίσταση είναι $R=20\\,\\Omega$.\n\n**Λύση**\n\n$\\displaystyle I=\\frac{V}{R}=5\\,\\mathrm{A}$.\n'
META = {
    'semester':'1ο_Εξάμηνο','course':'Γραμμική Άλγεβρα',
    'year':'2025','period':'KAN','solver':'thanos',
    'reviewer_a':'reviewer_a_test','reviewer_b':'reviewer_b_test',
    'repo':'ece-ntua-exam-solutions/Problems-Solutions',
    'repo_path':'1o_Εξάμηνο/Γραμμική_Άλγεβρα/2025/KΑΝ',
    'template':'shmmy-purple-cover-v1',
}

class EncodingTests(unittest.TestCase):
    def test_old_default_encoding_breaks_on_greek(self):
        import subprocess
        # Explicitly emulate the Windows default ANSI code page. The v9.1
        # subprocess.run did not specify encoding; on Windows it picked this.
        with self.assertRaises(UnicodeEncodeError):
            subprocess.run(['pandoc','--from=markdown','--to=latex'],
                           input=SAMPLE,capture_output=True,text=True,
                           encoding='cp1252',timeout=10)

    def test_pandoc_utf8_under_cp1252_locale(self):
        with patch.object(locale,'getencoding',return_value='cp1252'):
            out=exam_studio.pandoc_body(SAMPLE)
        self.assertIn('Άσκηση',out)
        self.assertIn('Μεθοδολογία',out)

    def test_git_process_forced_utf8(self):
        import subprocess
        with patch.object(locale,'getencoding',return_value='cp1252'):
            out=github_pr.run(sys.executable,'-c',"import sys;sys.stdout.buffer.write('Ελληνικά'.encode('utf-8'))")
        self.assertEqual(out.stdout,'Ελληνικά')

    def test_source_to_pdf_under_cp1252_locale(self):
        with patch.object(locale,'getencoding',return_value='cp1252'):
            tex,assets=exam_studio.latex_bundle(SAMPLE,META)
            pdf=exam_studio.build_pdf(tex,assets)
        self.assertIn('Άσκηση',tex)
        self.assertTrue(pdf.startswith(b'%PDF-'))
        self.assertGreater(len(pdf),15000)

    def test_preflight_compiles_before_gh(self):
        import studio_server
        with patch.object(studio_server,'build_pdf',return_value=b'%PDF-1.7\nMOCK'),\
             patch.object(studio_server,'latex_bundle',return_value=('\\documentclass{article}',{})),\
             patch.object(studio_server,'is_ready',return_value={'gh':False,'git':False,'authenticated':False}):
            r=studio_server.make_preflight({'metadata':META,'text':SAMPLE})
            self.assertFalse(r['ok'])
        with patch.object(studio_server,'latex_bundle',side_effect=UnicodeEncodeError('charmap','Άσκηση',0,1,'not representable')),\
             patch.object(studio_server,'is_ready') as ready:
            with self.assertRaises(UnicodeEncodeError):studio_server.make_preflight({'metadata':META,'text':SAMPLE})
            ready.assert_not_called()

if __name__=='__main__':unittest.main()
