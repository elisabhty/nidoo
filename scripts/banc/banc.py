"""Le banc d'essai des personnages : rend des grilles de figurines avec le vrai code de l'appli (banc.html)."""
import json, os, re, subprocess, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright

REPO = str(__import__('pathlib').Path(__file__).resolve().parents[2])
DIST = '/tmp/dist-banc'
PORT = 4180
URL = f'http://localhost:{PORT}/banc.html'

def construire():
    r = subprocess.run('npx vite build -c vite.banc.config.ts', shell=True, cwd=REPO, capture_output=True, text=True, env={**os.environ, 'BANC_OUT': DIST})
    ok = 'built in' in r.stdout
    if not ok: print(r.stdout[-1500:], r.stderr[-1500:])
    return ok

def serveur():
    try:
        urllib.request.urlopen(URL, timeout=2); return
    except Exception:
        pass
    subprocess.Popen(f'nohup python3 -m http.server {PORT} --directory {DIST} > /tmp/banc-serveur.log 2>&1 &', shell=True)
    for _ in range(40):
        time.sleep(0.25)
        try:
            urllib.request.urlopen(URL, timeout=2); return
        except Exception:
            pass
    raise RuntimeError('serveur du banc injoignable')

_src = open(f'{REPO}/src/lib/persos.ts', encoding='utf-8').read()
PERSOS = re.findall(r"\{ id: '(\w+)', g: '(\w+)', a: (\d), t: (\d), c: '(\w+)'(.*?)label: '([^']*)'", _src)
IDS = [p[0] for p in PERSOS]
GROUPE = {p[0]: p[1] for p in PERSOS}
CHEV = {p[0]: p[4] for p in PERSOS}
NOM = {p[0]: p[6] for p in PERSOS}
_look = open(f'{REPO}/src/lib/look.ts', encoding='utf-8').read()
ACCESSORIES = re.findall(r"'([^']*)'", re.search(r"export const ACCESSORIES = \[(.*?)\]", _look, re.S).group(1))
PLACES = {m.group(1): re.findall(r"'(\w+)'", m.group(2)) for m in re.finditer(r"^\s+([A-Z]): \[(.*?)\]", _look, re.M)}
PLACE_DE = {a: pl for pl, accs in PLACES.items() for a in accs}

def avatar(pid, porte=(), **champs):
    """perso:k<numéro>… avec ce qu'on porte (noms d'habits) et les champs du look (x=10, q=3, j=1…)."""
    d = {'k': IDS.index(pid) + 1, **champs}
    for a in porte:
        d[PLACE_DE[a]] = ACCESSORIES.index(a)
    return 'perso:' + '.'.join(f'{k}{v}' for k, v in d.items())

class Banc:
    def __init__(self, echelle=1):
        serveur()
        self.p = sync_playwright().start()
        self.b = self.p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        self.ctx = self.b.new_context(viewport={'width': 1700, 'height': 1000}, device_scale_factor=echelle)
        self.pg = self.ctx.new_page()
        self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append(str(e)[:200]))
    def rendre(self, cases, sortie, w=150, buste=False, fond='#EDE9F6', cols=11, noms=True, marge=0.22, transparent=False, attente=30000):
        d = {'w': w, 'buste': buste, 'fond': 'transparent' if transparent else fond, 'cases': cases, 'noms': noms, 'marge': marge}
        import math
        hc = (w if buste else w * 440 / 300 * (1 + marge)) + (12 if noms else 0)
        self.pg.set_viewport_size({'width': w * cols + 4, 'height': int(math.ceil(len(cases) / cols) * hc) + 8})
        self.pg.goto('about:blank')
        self.pg.goto(URL + '#' + urllib.parse.quote(json.dumps(d, ensure_ascii=False)))
        try:
            self.pg.wait_for_function('window.__pret === true', timeout=attente)
        except Exception:
            print('  (pas toutes prêtes à temps)', sortie)
        self.pg.wait_for_timeout(350)
        el = self.pg.locator('#root > div')
        el.screenshot(path=sortie, omit_background=transparent)
        return sortie
    def fermer(self):
        self.b.close(); self.p.stop()
