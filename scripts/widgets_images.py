"""Les illustrations des widgets iOS : les mêmes que dans l'appli, en PNG dans le catalogue de l'extension
(ios/App/NidooWidgets/Assets.xcassets). À relancer quand une illustration change :  python3 scripts/widgets_images.py
Les personnages d'exemple (ex-1 à ex-5) ne sont pas refaits ici : ce sont les bustes de la famille de démo,
photographiés par l'appli (window.__buste, voir src/lib/widgets.tsx)."""
import json, os, shutil
from PIL import Image

RACINE = os.path.join(os.path.dirname(__file__), '..')
ART = os.path.join(RACINE, 'public', 'art')
CAT = os.path.join(RACINE, 'ios', 'App', 'NidooWidgets', 'Assets.xcassets')

# nom dans le widget : (fichier de l'appli, plus grand côté en pixels)
IMAGES = {}
for n in ['coeur', 'calin', 'courage', 'bisou', 'mot']:
    IMAGES[f'geste-{n}'] = (f'geste-{n}', 168)
for n in ['heureux', 'serein', 'motive', 'fete', 'fatigue', 'stresse', 'nostalgique', 'triste']:
    IMAGES[f'humeur-{n}'] = (f'humeur-{n}', 168)
for n in ['gateau', 'lieu', 'fete', 'agenda', 'courses', 'missions', 'etoile', 'cadeau', 'bulle']:
    IMAGES[f'picto-{n}'] = (f'picto-{n}', 150)
for n in ['maison', 'appartement', 'chalet']:
    IMAGES[f'maison-{n}'] = (f'maison-{n}', 420)
for n in ['chat', 'chien', 'lapin', 'renard', 'panda', 'koala', 'pingouin', 'hibou']:
    IMAGES[f'pet-{n}'] = (f'pet-{n}', 300)
for n in ['morpion', 'puissance4', 'memory']:
    IMAGES[f'jeu-{n}'] = (f'jeu-{n}', 150)
for n in ['panda', 'renard', 'ours', 'lapin', 'chat', 'chien', 'hibou', 'koala', 'lion', 'pingouin', 'grenouille', 'licorne']:
    IMAGES[f'animal-{n}'] = (f'avatar-{n}', 150)
IMAGES['friandises'] = ('shop-friandises', 120)
IMAGES['panda'] = ('../panda', 300)


def couleur(nom, hexa):
    d = os.path.join(CAT, f'{nom}.colorset')
    os.makedirs(d, exist_ok=True)
    r, g, b = (int(hexa[i:i + 2], 16) / 255 for i in (0, 2, 4))
    json.dump({'colors': [{'idiom': 'universal', 'color': {'color-space': 'srgb', 'components': {
        'red': f'{r:.3f}', 'green': f'{g:.3f}', 'blue': f'{b:.3f}', 'alpha': '1.000'}}}],
        'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(d, 'Contents.json'), 'w'), indent=2)


def image(nom, im):
    d = os.path.join(CAT, f'{nom}.imageset')
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    im.save(os.path.join(d, f'{nom}.png'), optimize=True)
    json.dump({'images': [{'idiom': 'universal', 'filename': f'{nom}.png'}], 'info': {'author': 'xcode', 'version': 1}},
              open(os.path.join(d, 'Contents.json'), 'w'), indent=2)


# la famille d'exemple en pied, pour « Notre maison » dans la galerie : les mêmes que les bustes ex-1 à ex-5
# (dans l'appli, ce sont les proches, photographiés par src/lib/widgets.tsx, au même format : 180 × 264, les pieds en bas)
PIEDS = {'ex-1': ('f17', 1), 'ex-2': ('gf2', 1), 'ex-3': ('h02', 1), 'ex-4': ('fi2', 0.82), 'ex-5': ('gi2', 0.82)}


def pieds():
    for nom, (perso, echelle) in PIEDS.items():
        fig = Image.open(os.path.join(ART, 'persos', f'{perso}.webp')).convert('RGBA')
        W, H = 180, 264
        w = round(W * echelle)
        fig = fig.resize((w, round(w * fig.height / fig.width)), Image.LANCZOS)
        toile = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        toile.alpha_composite(fig, ((W - fig.width) // 2, H - fig.height))
        image(f'pied-{nom}', toile)


def main():
    os.makedirs(CAT, exist_ok=True)
    json.dump({'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(CAT, 'Contents.json'), 'w'), indent=2)
    couleur('AccentColor', '8E6FF0')
    couleur('WidgetBackground', 'F8F5FF')
    total = 0
    for nom, (src, cote) in IMAGES.items():
        im = Image.open(os.path.join(ART, f'{src}.webp')).convert('RGBA')
        # rogne les marges vides : l'illustration remplit son cadre dans le widget
        boite = im.getbbox()
        if boite:
            im = im.crop(boite)
        im.thumbnail((cote, cote), Image.LANCZOS)
        if nom == 'panda':
            im = im.convert('RGB')
        image(nom, im)
        total += os.path.getsize(os.path.join(CAT, f'{nom}.imageset', f'{nom}.png'))
    pieds()
    print(len(IMAGES), 'images,', total // 1024, 'ko')


if __name__ == '__main__':
    main()
