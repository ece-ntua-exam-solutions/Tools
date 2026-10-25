import sys
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'backend'))
import github_auth as a

class GithubAuthTest(unittest.TestCase):
    def test_missing_gh(self):
        with patch.object(a.shutil,'which',side_effect=lambda n: None if n=='gh' else '/usr/bin/git'):
            s=a.status()
            assert not s['gh_installed'] and not s['authenticated']
            with self.assertRaisesRegex(RuntimeError,'GitHub CLI'):
                a.start()
    def test_authenticated_status_only_username_no_token(self):
        with patch.object(a.shutil,'which',return_value='/bin/exe'), patch.object(a,'_run',side_effect=[
            MagicMock(returncode=0,stdout='',stderr=''),
            MagicMock(returncode=0,stdout='ThanosZr\n',stderr='')
        ]):
            s=a.status()
            assert s['login']=='ThanosZr' and s['ready_for_pr']
            assert 'token' not in s and 'password' not in s
    def test_setup_git(self):
        with patch.object(a,'status',return_value={'authenticated':True,'git_installed':True,'login':'ThanosZr'}),\
             patch.object(a,'_run',return_value=MagicMock(returncode=0)) as r:
            assert a.setup_git()['ok']
            r.assert_called_once_with('gh','auth','setup-git','--hostname','github.com',timeout=20)
    def test_connect_launches_windows_console(self):
        process=MagicMock()
        process.poll.return_value=None
        process.wait.return_value=0
        with patch.object(a.shutil,'which',return_value='C:/gh.exe'),\
             patch.object(a,'status',return_value={'authenticated':False}),\
             patch.object(a.sys,'platform','win32'),\
             patch.object(a.subprocess,'Popen',return_value=process) as popen,\
             patch.object(a.threading,'Thread') as thread:
            a._AUTH_PROCESS=None
            d=a.start()
            assert d['started'] is True
            cmd=popen.call_args.args[0]
            assert cmd[:3]==['cmd.exe','/c','gh']
            assert '--web' in cmd and 'https' in cmd
            thread.return_value.start.assert_called_once()
        a._AUTH_PROCESS=None

if __name__ == '__main__':unittest.main()
