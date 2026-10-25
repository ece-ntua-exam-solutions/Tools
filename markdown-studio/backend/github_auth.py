"""Local GitHub CLI sign-in used by Markdown Studio's *optional* Python server.

No browser-supplied GitHub tokens, passwords or OAuth secrets. The user authorizes
GitHub CLI in the GitHub browser/device flow, in their OS session. A terminal is
launched ONLY after a click on the Connect button. gh stores credentials in the
OS credential store (if available). The studio keeps no tokens and never logs them.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
from typing import Any

_LOCK = threading.Lock()
_AUTH_PROCESS: subprocess.Popen | None = None
_AUTH_NOTE = ""


def _run(*args: str, timeout: int = 15) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=timeout, check=False)


def status() -> dict[str, Any]:
    """Read the GitHub identity through gh, never return auth status output/tokens."""
    global _AUTH_NOTE
    gh_installed = bool(shutil.which("gh"))
    git_installed = bool(shutil.which("git"))
    who = None
    if gh_installed:
        try:
            p = _run("gh", "auth", "status", "--hostname", "github.com", timeout=12)
            if p.returncode == 0:
                q = _run("gh", "api", "user", "--jq", ".login", timeout=14)
                if q.returncode == 0:
                    who = q.stdout.strip() or None
        except (OSError, subprocess.TimeoutExpired):
            pass
    with _LOCK:
        running = bool(_AUTH_PROCESS and _AUTH_PROCESS.poll() is None)
        note = _AUTH_NOTE
    return {
        "gh_installed": gh_installed,
        "git_installed": git_installed,
        "authenticated": bool(who),
        "login": who,
        "auth_running": running,
        "message": note,
        "ready_for_pr": bool(who and git_installed),
    }


def _finish(proc: subprocess.Popen) -> None:
    global _AUTH_NOTE
    try:
        returncode = proc.wait(timeout=600)
    except subprocess.TimeoutExpired:
        proc.terminate()
        with _LOCK:
            _AUTH_NOTE = "Η σύνδεση δεν ολοκληρώθηκε εντός 10 λεπτών. Δοκίμασε ξανά."
        return
    # This process does not read stdout/stderr to avoid exposing credentials.
    if returncode == 0:
        try:
            setup = _run("gh", "auth", "setup-git", "--hostname", "github.com", timeout=20)
            message = ("Επιτυχής σύνδεση. Το Git ρυθμίστηκε για HTTPS μέσω GitHub CLI."
                       if setup.returncode == 0 else
                       "Σύνδεση επιτυχής, αλλά δεν ρυθμίστηκε ο Git credential helper. Πάτα «Ρύθμιση Git»." )
        except (OSError, subprocess.TimeoutExpired):
            message = "Σύνδεση επιτυχής. Έλεγξε τη ρύθμιση Git."
    else:
        message = "Η σύνδεση ακυρώθηκε ή απέτυχε. Μπορείς να δοκιμάσεις ξανά."
    with _LOCK:
        _AUTH_NOTE = message


def start() -> dict[str, Any]:
    """Windows: launch interactive gh browser sign-in in a fresh console window."""
    global _AUTH_PROCESS, _AUTH_NOTE
    if not shutil.which("gh"):
        raise RuntimeError("Δεν βρέθηκε GitHub CLI (gh). Εγκατάστησέ το από https://cli.github.com/ και επανεκκίνησε τον Python server.")
    state = status()
    if state["authenticated"]:
        return {**state, "message": "Είσαι ήδη συνδεδεμένος ως @" + state["login"] + "."}
    if sys.platform != "win32":
        raise RuntimeError("Η σύνδεση μέσω κουμπιού υποστηρίζεται προς το παρόν στα Windows. Σε Linux/macOS εκτέλεσε gh auth login --web --git-protocol https μία φορά.")
    with _LOCK:
        if _AUTH_PROCESS and _AUTH_PROCESS.poll() is None:
            return {"started": False, "auth_running": True, "message": "Το παράθυρο σύνδεσης είναι ήδη ανοιχτό."}
        # The gh CLI handles the browser/device flow (including any prompts) itself.
        # CREATE_NEW_CONSOLE gives gh a working TTY on Windows. Do not hide it:
        # the user might need to see/copy an ephemeral one-time device code.
        flags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
        args = ["cmd.exe", "/c", "gh", "auth", "login", "--hostname", "github.com", "--web",
                "--git-protocol", "https", "--skip-ssh-key"]
        _AUTH_PROCESS = subprocess.Popen(args, creationflags=flags,
                                         stdin=None, stdout=None, stderr=None,
                                         close_fds=True)
        _AUTH_NOTE = "Ολοκλήρωσε τη σύνδεση στο παράθυρο GitHub CLI και στον browser."
        proc = _AUTH_PROCESS
    threading.Thread(target=_finish, args=(proc,), daemon=True).start()
    return {"started": True, "auth_running": True, "message": _AUTH_NOTE,
            "verification_url": "https://github.com/login/device"}


def setup_git() -> dict[str, Any]:
    state = status()
    if not state["authenticated"]:
        raise RuntimeError("Συνδέσου πρώτα στον λογαριασμό GitHub.")
    if not state["git_installed"]:
        raise RuntimeError("Δεν βρέθηκε Git. Εγκατάστησε Git for Windows και επανεκκίνησε τον server.")
    p = _run("gh", "auth", "setup-git", "--hostname", "github.com", timeout=20)
    if p.returncode:
        raise RuntimeError("Δεν ολοκληρώθηκε η ρύθμιση Git credential helper. " + (p.stderr or p.stdout)[-300:])
    return {"ok": True, "message": "Το Git μπορεί να χρησιμοποιεί το GitHub CLI για HTTPS authentication.",
            "login": state["login"]}
