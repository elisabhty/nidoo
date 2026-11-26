"""Le fond de carte de NIDOO (Elisa, 26 novembre : « il y a pas une autre carte ? j'aime pas celle-là »).

Elle a choisi « Rétro » parmi quatre fonds dessinés sur de vraies données : c'est « Bright » d'OpenFreeMap tel quel
(mêmes tuiles, mêmes icônes, mêmes polices qu'avant : aucun nouveau service), sans son faux relief (les toits
décalés, « building-top ») puisque l'appli pose de vrais bâtiments en 3D (src/lib/relief.ts).
L'autre proposition, « plans » (Liberty repeint façon Plans sur iPhone), reste ici si on veut y revenir.

  python3 scripts/carte/style_nidoo.py retro public/carte/nidoo.json      (ou : plans)
  (essai local : un troisième argument, la base d'un serveur qui sert /tiles, /fonts et /sprites)

bright.json et liberty.json : github.com/hyperknot/openfreemap-styles, styles/<nom>/style.json (commit 006ea57,
25 oct. 2026).

Licences : Bright et Liberty (MIT, OpenFreeMap) viennent d'OSM Bright et de Mapbox Open Styles (code BSD 3,
dessin CC BY 4.0) ; l'attribution « © OpenMapTiles © OpenStreetMap » reste affichée sur la carte.
"""
import json, os, sys
ICI = os.path.dirname(os.path.abspath(__file__))

FOND = '#F2EFE9'
EAU = '#A2D4F7'
EAU_TEXTE = '#3F7FBF'
PARC = '#C8E7B8'
BOIS = '#BCE2A9'
RUE = '#FFFFFF'
RUE_BORD = '#D9D2C7'
AXE = '#FFEA9E'
AXE_BORD = '#E8C873'
AUTOROUTE = '#FFD877'
AUTOROUTE_BORD = '#E6B653'
RAIL = '#CDC8BF'
BATI = '#E6E1DA'
BATI_BORD = '#DAD3CA'
TEXTE = '#2E2B27'
TEXTE_RUE = '#6E6962'

def peindre(style):
    s = json.loads(json.dumps(style))
    couches = []
    for l in s['layers']:
        i, p = l['id'], l.setdefault('paint', {})
        t = l['type']
        if i == 'background':
            p['background-color'] = FOND
        elif i == 'park':
            p.update({'fill-color': PARC, 'fill-opacity': 0.9, 'fill-outline-color': 'rgba(0,0,0,0)'})
        elif i == 'park_outline':
            p['line-opacity'] = 0
        elif i == 'landuse_residential':
            p['fill-color'] = 'hsla(36,16%,90%,0.5)'
        elif i == 'landcover_wood':
            p.update({'fill-color': BOIS, 'fill-opacity': 0.6})
        elif i == 'landcover_grass':
            p.update({'fill-color': PARC, 'fill-opacity': 0.75})
        elif i in ('landuse_pitch', 'landuse_track'):
            p['fill-color'] = '#D4EDC6'
        elif i == 'landuse_cemetery':
            p['fill-color'] = '#DAEBD0'
        elif i == 'landuse_hospital':
            p['fill-color'] = '#FCE5E4'
        elif i == 'landuse_school':
            p['fill-color'] = '#F8EFDA'
        elif i == 'landcover_sand':
            p['fill-color'] = '#F6EBC8'
        elif i == 'water':
            p['fill-color'] = EAU
        elif i.startswith('waterway') and t == 'line':
            p['line-color'] = EAU
        elif i == 'aeroway_fill':
            p['fill-color'] = '#ECE9E3'
        elif t == 'line' and (i.startswith('road_') or i.startswith('bridge_') or i.startswith('tunnel_')):
            tunnel = i.startswith('tunnel_')
            if 'rail' in i:
                p['line-color'] = RAIL
            elif i.endswith('_casing'):
                if 'motorway' in i:
                    p['line-color'] = AUTOROUTE_BORD
                elif 'trunk_primary' in i or i.endswith('_link_casing'):
                    p['line-color'] = AXE_BORD
                elif 'path_pedestrian' in i:
                    p['line-color'] = '#E4DED5'
                else:
                    p['line-color'] = RUE_BORD
            elif 'path_pedestrian' in i:
                p['line-color'] = '#FFFFFF'
            elif 'motorway' in i:
                p['line-color'] = AUTOROUTE
            elif 'trunk_primary' in i or i in ('road_link', 'bridge_link', 'tunnel_link'):
                p['line-color'] = AXE
            else:
                # rues, routes secondaires, chemins de service : blanches, comme dans Plans
                p['line-color'] = RUE
            if tunnel:
                p['line-opacity'] = 0.7
        elif i == 'building':
            p.update({'fill-color': BATI, 'fill-outline-color': ['interpolate', ['linear'], ['zoom'], 13, 'rgba(224,218,210,0.3)', 14, BATI_BORD]})
        elif i == 'building-3d':
            # le relief vient de l'appli (src/lib/relief.ts) : une seule couche de bâtiments en 3D
            continue
        elif i.startswith('boundary'):
            p['line-color'] = '#B9B2C9'
        elif t == 'symbol':
            if i.startswith('water') :
                p.update({'text-color': EAU_TEXTE, 'text-halo-color': 'rgba(255,255,255,0.75)'})
            elif i.startswith('highway-name'):
                p.update({'text-color': TEXTE_RUE if i != 'highway-name-path' else '#A39C92', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4})
            elif i.startswith('poi') or i == 'airport':
                p.update({'text-color': '#6B665F', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.2})
            elif i.startswith('label_'):
                p.update({'text-color': TEXTE if 'state' not in i and 'other' not in i else '#5C5852', 'text-halo-color': '#FFFFFF'})
            elif i.startswith('road_one_way'):
                # les flèches des sens uniques, seulement tout près
                l['minzoom'] = max(l.get('minzoom', 0), 17)
        couches.append(l)
    s['layers'] = couches
    s['name'] = 'NIDOO'
    return s

def retro(style):
    """Bright tel quel, sans son faux relief (et sans 3D à lui : l'appli pose la sienne)."""
    s = json.loads(json.dumps(style))
    s['layers'] = [l for l in s['layers'] if l['id'] != 'building-top' and l['type'] != 'fill-extrusion']
    s['name'] = 'NIDOO'
    return s

if __name__ == '__main__':
    theme, sortie = sys.argv[1], sys.argv[2]
    if theme == 'plans':
        nidoo = peindre(json.load(open(os.path.join(ICI, 'liberty.json'))))
    elif theme == 'retro':
        nidoo = retro(json.load(open(os.path.join(ICI, 'bright.json'))))
    else:
        sys.exit('thème : retro ou plans')
    if len(sys.argv) > 3:
        # essai local : les tuiles, les polices et les icônes d'un serveur d'essai
        base = sys.argv[3]
        nidoo['sources'] = {'openmaptiles': {'type': 'vector', 'tiles': [base + '/tiles/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14}}
        nidoo['layers'] = [l for l in nidoo['layers'] if l.get('source') in (None, 'openmaptiles')]
        nidoo['glyphs'] = base + '/fonts/{fontstack}/{range}.pbf'
        nidoo['sprite'] = base + '/sprites/ofm'
    else:
        txt = json.dumps(nidoo, ensure_ascii=False)
        txt = txt.replace('__TILEJSON_DOMAIN__', 'tiles.openfreemap.org')
        nidoo = json.loads(txt)
    json.dump(nidoo, open(sortie, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(sortie, len(nidoo['layers']), 'couches')
