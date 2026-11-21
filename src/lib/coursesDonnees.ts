// Les données des courses (Elisa, 21 novembre : « améliorer la liste des liens entre aliments, regarde sur internet » ;
// « faire en sorte que tous les articles soient reconnus par quantité »). Tirées d'une recherche : recettes de
// référence (750g, Marmiton, Bonial, Coursesu), quantités d'achat courantes en grande surface (meslistesdecourses.fr),
// et les « souvent achetés ensemble » publics (baromètre Picnic, jeu de données Groceries).
//
// Une ligne d'article : nom | rayon | unité | quantité par défaut | pas du − / +
//   rayons : FL fruits et légumes · BOUL boulangerie · VIA viande, poisson, charcuterie · CREM crèmerie ·
//            EPS épicerie salée · EPSU épicerie sucrée · BOI boissons · BEBE bébé · HYG hygiène · ENT entretien ·
//            ANI animaux · SURG surgelés
//   unités : kg, g, l, tr (tranches), dz (douzaines) ; vide = un nombre (pièces, paquets, pots, briques…)

export const ARTICLES = `
pomme|FL|kg|1|0.5
poire|FL|kg|1|0.5
banane|FL|kg|1|0.5
orange|FL|kg|2|1
clémentine|FL|kg|1|0.5
mandarine|FL|kg|1|0.5
citron|FL||3|1
citron vert|FL||2|1
pamplemousse|FL||2|1
kiwi|FL||6|1
raisin|FL|kg|0.5|0.5
fraise|FL||1|1
framboise|FL||1|1
myrtille|FL||1|1
cerise|FL|kg|0.5|0.5
abricot|FL|kg|1|0.5
pêche|FL|kg|1|0.5
nectarine|FL|kg|1|0.5
prune|FL|kg|0.5|0.5
melon|FL||1|1
pastèque|FL||1|1
ananas|FL||1|1
mangue|FL||1|1
avocat|FL||2|1
fruit de la passion|FL||4|1
figue|FL||1|1
fruits|FL||1|1
légumes|FL||1|1
pomme de terre|FL|kg|2.5|0.5
patate douce|FL|kg|1|0.5
carotte|FL|kg|1|0.5
oignon|FL|kg|1|0.5
oignon rouge|FL||2|1
échalote|FL||1|1
ail|FL||1|1
tomate|FL|kg|1|0.5
tomate cerise|FL||1|1
concombre|FL||1|1
courgette|FL|kg|1|0.5
aubergine|FL||2|1
poivron|FL||2|1
salade|FL||1|1
mâche|FL||1|1
roquette|FL||1|1
épinards frais|FL||1|1
poireau|FL||1|1
brocoli|FL||1|1
chou-fleur|FL||1|1
chou|FL||1|1
haricots verts|FL|kg|0.5|0.25
champignons de Paris|FL|g|250|250
endive|FL|kg|1|0.5
navet|FL|kg|0.5|0.5
radis|FL||1|1
betterave cuite|FL||1|1
céleri|FL||1|1
fenouil|FL||1|1
potimarron|FL||1|1
potiron|FL|kg|1|0.5
butternut|FL||1|1
artichaut|FL||2|1
asperges|FL||1|1
maïs épi|FL||4|2
persil|FL||1|1
coriandre|FL||1|1
ciboulette|FL||1|1
basilic|FL||1|1
menthe|FL||1|1
aneth|FL||1|1
romarin|FL||1|1
bouquet garni|FL||1|1
gingembre|FL||1|1
marrons|FL||1|1
baguette|BOUL||2|1
pain|BOUL||1|1
pain de campagne|BOUL||1|1
pain complet|BOUL||1|1
pain de mie|BOUL||1|1
croissant|BOUL||6|1
pain au chocolat|BOUL||6|1
brioche|BOUL||1|1
pains burger|BOUL||1|1
pains hot-dog|BOUL||1|1
tortillas|BOUL||1|1
pain pita|BOUL||1|1
biscottes|BOUL||1|1
pain d’épices|BOUL||1|1
galette des rois|BOUL||1|1
blinis|BOUL||1|1
lait|CREM||2|1
œufs|CREM||12|6
beurre|CREM||1|1
beurre demi-sel|CREM||1|1
crème fraîche|CREM||1|1
crème liquide|CREM||1|1
yaourt nature|CREM||8|4
yaourt aux fruits|CREM||8|4
yaourt à boire|CREM||1|1
fromage blanc|CREM||1|1
petits-suisses|CREM||1|1
skyr|CREM||4|1
crème dessert|CREM||1|1
crème chantilly|CREM||1|1
fromage|CREM||1|1
fromage râpé|CREM|g|200|100
mozzarella|CREM||2|1
parmesan|CREM|g|100|50
comté|CREM|g|250|50
beaufort|CREM|g|250|50
emmental|CREM|g|250|50
camembert|CREM||1|1
brie|CREM||1|1
chèvre|CREM||1|1
feta|CREM||1|1
reblochon|CREM||1|1
fromage à raclette|CREM|g|800|200
fromage à fondue|CREM|g|800|200
cheddar|CREM||1|1
fromage en tranches|CREM||1|1
fromage frais|CREM||1|1
mascarpone|CREM||1|1
ricotta|CREM||1|1
pâte brisée|CREM||1|1
pâte feuilletée|CREM||1|1
pâte sablée|CREM||1|1
pâte à pizza|CREM||1|1
pâtes fraîches|CREM||1|1
raviolis|CREM||1|1
gnocchis|CREM||1|1
houmous|CREM||1|1
tarama|CREM||1|1
tzatziki|CREM||1|1
guacamole|CREM||1|1
levure boulangère|CREM||1|1
lait végétal|CREM||1|1
compote|CREM||1|1
jambon|VIA|tr|4|2
jambon cru|VIA||1|1
blanc de poulet tranches|VIA||1|1
lardons|VIA|g|200|100
dés de jambon|VIA||1|1
charcuterie|VIA|g|400|100
saucisson|VIA||1|1
chorizo|VIA||1|1
rosette|VIA||1|1
pâté|VIA||1|1
rillettes|VIA||1|1
lard|VIA||1|1
poitrine de porc|VIA|g|300|100
chair à saucisse|VIA|g|400|100
bacon|VIA||1|1
choucroute|VIA|kg|1|0.5
saucisses de Strasbourg|VIA||1|1
saucisses de Montbéliard|VIA||2|1
saucisses|VIA||1|1
surimi|VIA||1|1
poulet entier|VIA||1|1
poulet|VIA||1|1
blanc de poulet|VIA|g|300|150
cuisses de poulet|VIA||4|1
escalope de dinde|VIA||1|1
cordon bleu|VIA||1|1
steak haché|VIA||4|2
viande hachée|VIA|g|500|250
steak|VIA||2|1
entrecôte|VIA||2|1
rôti de bœuf|VIA|kg|1|0.5
bœuf bourguignon|VIA|kg|1|0.5
plat de côtes|VIA|kg|1.5|0.5
os à moelle|VIA||2|1
veau blanquette|VIA|kg|1|0.5
escalope de veau|VIA||4|1
rôti de porc|VIA|kg|1|0.5
côte de porc|VIA||4|2
travers de porc|VIA|kg|1|0.5
filet mignon|VIA||1|1
merguez|VIA||1|1
chipolatas|VIA||1|1
saucisses de Toulouse|VIA||1|1
brochettes|VIA||1|1
gigot d’agneau|VIA|kg|2|0.5
magret de canard|VIA||2|1
lapin|VIA||1|1
chapon|VIA||1|1
dinde|VIA||1|1
foie gras|VIA||1|1
saumon|VIA||4|2
saumon fumé|VIA||1|1
cabillaud|VIA||4|2
colin|VIA||4|2
poisson|VIA||4|2
truite fumée|VIA||1|1
crevettes|VIA|g|250|250
moules|VIA|kg|2|0.5
huîtres|VIA|dz|1|1
noix de Saint-Jacques|VIA|g|300|100
pâtes|EPS||2|1
spaghetti|EPS||1|1
lasagnes|EPS||1|1
riz|EPS||1|1
riz basmati|EPS||1|1
riz rond|EPS||1|1
riz arborio|EPS||1|1
haricots blancs|EPS||1|1
citron confit|EPS||1|1
confit de canard|EPS||1|1
thym|EPS||1|1
laurier|EPS||1|1
origan|EPS||1|1
curcuma|EPS||1|1
piment|EPS||1|1
baies de genièvre|EPS||1|1
épices paella|EPS||1|1
semoule|EPS||1|1
quinoa|EPS||1|1
boulgour|EPS||1|1
nouilles|EPS||1|1
lentilles|EPS||1|1
pois chiches|EPS||1|1
haricots rouges|EPS||1|1
flageolets|EPS||1|1
maïs|EPS||2|1
petits pois carottes|EPS||1|1
thon|EPS||3|1
sardines|EPS||2|1
anchois|EPS||1|1
tomates concassées|EPS||2|1
coulis de tomate|EPS||1|1
sauce tomate|EPS||1|1
sauce bolognaise|EPS||1|1
pesto|EPS||1|1
concentré de tomate|EPS||1|1
huile d’olive|EPS||1|1
huile de tournesol|EPS||1|1
huile|EPS||1|1
vinaigre|EPS||1|1
vinaigrette|EPS||1|1
moutarde|EPS||1|1
mayonnaise|EPS||1|1
ketchup|EPS||1|1
sauce barbecue|EPS||1|1
sauce soja|EPS||1|1
harissa|EPS||1|1
sel|EPS||1|1
gros sel|EPS||1|1
poivre|EPS||1|1
herbes de Provence|EPS||1|1
cumin|EPS||1|1
curry|EPS||1|1
paprika|EPS||1|1
ras el hanout|EPS||1|1
muscade|EPS||1|1
épices tex-mex|EPS||1|1
bouillon cube|EPS||1|1
fond de veau|EPS||1|1
lait de coco|EPS||1|1
cornichons|EPS||1|1
oignons grelots|EPS||1|1
olives|EPS||1|1
confit d’oignons|EPS||1|1
chips|EPS||2|1
cacahuètes|EPS||1|1
biscuits apéritifs|EPS||1|1
crackers|EPS||1|1
chips tortilla|EPS||1|1
soupe|EPS||1|1
purée en flocons|EPS||1|1
chapelure|EPS||1|1
vermicelles|EPS||1|1
kirsch|BOI||1|1
farine|EPSU||1|1
farine de sarrasin|EPSU||1|1
fécule de maïs|EPSU||1|1
sucre|EPSU||1|1
sucre glace|EPSU||1|1
cassonade|EPSU||1|1
sucre vanillé|EPSU||1|1
levure chimique|EPSU||1|1
chocolat pâtissier|EPSU||1|1
pépites de chocolat|EPSU||1|1
cannelle|EPSU||1|1
chocolat|EPSU||2|1
cacao|EPSU||1|1
chocolat en poudre|EPSU||1|1
poudre d’amande|EPSU||1|1
céréales|EPSU||1|1
flocons d’avoine|EPSU||1|1
muesli|EPSU||1|1
confiture|EPSU||1|1
pâte à tartiner|EPSU||1|1
miel|EPSU||1|1
crème de marrons|EPSU||1|1
sirop d’érable|EPSU||1|1
caramel|EPSU||1|1
biscuits|EPSU||2|1
gâteaux goûter|EPSU||2|1
madeleines|EPSU||1|1
biscuits cuillère|EPSU||1|1
compote bébé|BEBE||1|1
barres de céréales|EPSU||1|1
café|EPSU||1|1
capsules café|EPSU||1|1
café soluble|EPSU||1|1
thé|EPSU||1|1
tisane|EPSU||1|1
bonbons|EPSU||1|1
fruits secs|EPSU||1|1
amandes|EPSU||1|1
noix|EPSU||1|1
pop-corn|EPSU||1|1
crêpes|EPSU||1|1
œufs en chocolat|EPSU||1|1
lapins en chocolat|EPSU||1|1
bougies d’anniversaire|EPSU||1|1
légumes surgelés|SURG||1|1
haricots verts surgelés|SURG||1|1
petits pois surgelés|SURG||1|1
épinards surgelés|SURG||1|1
poêlée|SURG||1|1
frites|SURG||1|1
pizza surgelée|SURG||1|1
pizza|SURG||1|1
poisson pané|SURG||1|1
nuggets|SURG||1|1
steaks hachés surgelés|SURG||1|1
fruits rouges|SURG||1|1
glace|SURG||1|1
bâtonnets glacés|SURG||1|1
bûche glacée|SURG||1|1
glaçons|SURG||1|1
encornets|SURG||1|1
croissants surgelés|SURG||1|1
eau|BOI||1|1
eau gazeuse|BOI||1|1
jus d’orange|BOI||2|1
jus de pomme|BOI||1|1
jus de fruits|BOI||1|1
soda|BOI||1|1
sirop|BOI||1|1
thé glacé|BOI||1|1
bière|BOI||1|1
vin rouge|BOI||1|1
vin blanc|BOI||1|1
vin|BOI||1|1
rosé|BOI||1|1
champagne|BOI||1|1
cidre|BOI||1|1
porto|BOI||1|1
couches|BEBE||1|1
lingettes|BEBE||1|1
lait infantile|BEBE||1|1
petits pots|BEBE||4|2
céréales bébé|BEBE||1|1
liniment|BEBE||1|1
crème change|BEBE||1|1
sérum physiologique|BEBE||1|1
biberon|BEBE||1|1
papier toilette|HYG||1|1
mouchoirs|HYG||1|1
gel douche|HYG||1|1
shampoing|HYG||1|1
après-shampoing|HYG||1|1
savon|HYG||1|1
dentifrice|HYG||1|1
brosse à dents|HYG||1|1
fil dentaire|HYG||1|1
bain de bouche|HYG||1|1
déodorant|HYG||1|1
cotons|HYG||1|1
coton-tiges|HYG||1|1
rasoirs|HYG||1|1
mousse à raser|HYG||1|1
serviettes hygiéniques|HYG||1|1
tampons|HYG||1|1
protège-slips|HYG||1|1
crème hydratante|HYG||1|1
crème solaire|HYG||1|1
pansements|HYG||1|1
essuie-tout|ENT||1|1
liquide vaisselle|ENT||1|1
éponges|ENT||1|1
pastilles lave-vaisselle|ENT||1|1
sel régénérant|ENT||1|1
liquide de rinçage|ENT||1|1
lessive|ENT||1|1
adoucissant|ENT||1|1
détachant|ENT||1|1
sacs poubelle|ENT||1|1
nettoyant multi-usage|ENT||1|1
javel|ENT||1|1
nettoyant WC|ENT||1|1
vinaigre ménager|ENT||1|1
bicarbonate|ENT||1|1
lingettes ménagères|ENT||1|1
gants de ménage|ENT||1|1
papier aluminium|ENT||1|1
film alimentaire|ENT||1|1
papier cuisson|ENT||1|1
sacs congélation|ENT||1|1
filtres à café|ENT||1|1
piles|ENT||1|1
ampoule|ENT||1|1
allumettes|ENT||1|1
charbon de bois|ENT||1|1
allume-feu|ENT||1|1
bougies|ENT||1|1
croquettes chat|ANI||1|1
pâtée chat|ANI||1|1
litière|ANI||1|1
friandises chat|ANI||1|1
croquettes chien|ANI||1|1
pâtée chien|ANI||1|1
friandises chien|ANI||1|1
sacs à crottes|ANI||1|1
graines oiseaux|ANI||1|1
`

/** Les abréviations : on écrit le vrai nom à la place. */
export const ABREGES = `
pq,p q,papier wc,papier toilettes,rouleaux pq,pécu=Papier toilette
sopalin,essuie tout,papier essuie-tout=Essuie-tout
pdt,patate,pommes de terres,pomme-de-terre=Pommes de terre
alu,papier alu=Papier aluminium
deo,déo=Déodorant
jus d’o,jus d’orange,jus orange=Jus d’orange
champi,champis=Champignons de Paris
croiss=Croissants
tradi,une tradition,baguette tradition=Baguettes
pdc=Pain de campagne
cf=Crème fraîche
`

/** Les autres façons de dire (marques, pluriels, synonymes) : on garde ce qui est écrit, mais on sait ce que c'est. */
export const ALIAS = `
oeuf,oeufs bio,douzaine d’oeufs=œufs
yaourts,yaourt,yogourt,yoghourt,yaourts nature,danone=yaourt nature
kleenex,mouchoir=mouchoirs
nutella=pâte à tartiner
coca,coca-cola,coca cola,pepsi,orangina,fanta,sprite,ice tea=soda
knacki,saucisses knacki,knack=saucisses de Strasbourg
kiri,vache qui rit,st moret,saint moret,boursin,philadelphia=fromage frais
gruyère râpé,emmental râpé,fromage rapé=fromage râpé
gruyère=emmental
steack,steak hache,steaks hachés,hachés=steak haché
jambon blanc,jambon de paris=jambon
creme,crème=crème fraîche
champignon,champignons=champignons de Paris
tomates cerise,tomate cerises=tomate cerise
coquillettes,penne,tagliatelles,fusilli,macaronis=pâtes
spaghettis=spaghetti
nesquik,banania,poulain=chocolat en poudre
maïzena,maizena=fécule de maïs
sucre en poudre,sucre semoule=sucre
capsules,dosettes,nespresso,tassimo=capsules café
ricoré=café soluble
pampers,couche=couches
danette,crème au chocolat=crème dessert
actimel=yaourt à boire
paic,produit vaisselle=liquide vaisselle
omo,ariel,skip,le chat,x-tra=lessive
eau de javel=javel
shampooing=shampoing
sac poubelle,sacs-poubelle=sacs poubelle
film étirable,cellophane=film alimentaire
cristaline,evian,volvic,eau plate,contrex,vittel=eau
perrier,badoit,san pellegrino,eau pétillante=eau gazeuse
kro,biere,bières=bière
chocolatine,chocolatines,pains au chocolat=pain au chocolat
croissants=croissant
salade verte,laitue,batavia,iceberg,feuille de chêne=salade
whiskas,felix,sheba,gourmet=pâtée chat
croquettes,croquette=croquettes chat
lait d’avoine,lait d’amande,lait de soja,lait de riz=lait végétal
lait demi-écrémé,lait entier,lait écrémé=lait
petit suisse,petits suisses=petits-suisses
frites surgelées=frites
haricots=haricots verts
jus=jus de fruits
glaces=glace
glaçon=glaçons
saucisse=saucisses
poissons=poisson
mandarines=mandarine
patates douces=patate douce
huitres=huîtres
saint jacques,st jacques=noix de Saint-Jacques
dentifrices=dentifrice
`

/** Ce qui va avec (Table A de la recherche), dans l'ordre de pertinence. */
export const AVEC = `
pain=Beurre,Confiture,Jambon,Fromage
baguette=Beurre,Fromage,Jambon,Pâté
pain de mie=Jambon,Fromage en tranches,Beurre,Pâte à tartiner
brioche=Pâte à tartiner,Confiture,Lait
croissant=Pains au chocolat,Jus d’orange,Café
pain au chocolat=Croissants,Lait,Jus d’orange
céréales=Lait,Bananes,Yaourts
lait=Céréales,Café,Chocolat en poudre
café=Lait,Sucre,Filtres à café,Biscuits
capsules café=Lait,Sucre,Biscuits
thé=Citrons,Miel,Biscuits
chocolat en poudre=Lait,Brioche,Céréales
confiture=Pain,Beurre,Biscottes
pâte à tartiner=Pain de mie,Brioche,Crêpes,Bananes
beurre=Pain,Confiture,Farine
biscottes=Confiture,Beurre,Thé
miel=Thé,Citrons,Yaourt nature
jus d’orange=Croissants,Céréales,Oranges
œufs=Lait,Farine,Beurre,Jambon
yaourt nature=Miel,Fruits rouges,Confiture,Céréales
fromage blanc=Miel,Fruits rouges,Sucre
compote=Biscuits,Yaourts,Gâteaux goûter
biscuits=Lait,Compote,Jus de pomme
madeleines=Compote,Lait,Jus de fruits
banane=Céréales,Yaourts,Lait,Pâte à tartiner
chips=Cacahuètes,Bière,Soda,Olives
saucisson=Cornichons,Pain,Olives,Bière
olives=Chips,Saucisson,Tomates cerises
cacahuètes=Chips,Bière,Olives
tomate cerise=Concombre,Mozzarella,Basilic
houmous=Carottes,Crackers,Pain pita,Concombre
guacamole=Chips tortilla,Tomates,Citron vert
tarama=Blinis,Citron,Pain
crackers=Fromage frais,Houmous
bière=Chips,Cacahuètes,Saucisson
rosé=Chips,Olives,Glaçons
champagne=Foie gras,Saumon fumé,Blinis
blinis=Saumon fumé,Crème fraîche,Citron,Aneth
saumon fumé=Blinis,Citron,Crème fraîche,Aneth
merguez=Chipolatas,Pain,Moutarde,Ketchup
chipolatas=Merguez,Moutarde,Charbon de bois
charbon de bois=Allume-feu,Saucisses,Brochettes
brochettes=Poivrons,Oignons,Courgettes
travers de porc=Sauce barbecue,Maïs,Pommes de terre
sauce barbecue=Travers de porc,Poulet,Maïs
ketchup=Frites,Steaks hachés,Saucisses,Mayonnaise
mayonnaise=Frites,Œufs,Thon,Moutarde
moutarde=Saucisses,Jambon,Cornichons
fromage à raclette=Pommes de terre,Charcuterie,Cornichons,Oignons grelots
charcuterie=Fromage à raclette,Cornichons,Pain
cornichons=Jambon,Fromage à raclette,Pâté
oignons grelots=Fromage à raclette,Cornichons
jambon cru=Melon,Fromage à raclette,Pain
melon=Jambon cru,Porto,Menthe
fromage à fondue=Pain,Vin blanc,Ail,Kirsch
comté=Pain,Vin blanc,Raisin
reblochon=Pommes de terre,Lardons,Oignons,Crème fraîche
lardons=Pâtes,Crème fraîche,Œufs,Oignons
crème fraîche=Lardons,Champignons,Pâtes,Oignons
pâte brisée=Œufs,Crème fraîche,Lardons,Fromage râpé
pâte feuilletée=Poudre d’amande,Œufs,Beurre,Sucre
galette des rois=Cidre
poudre d’amande=Pâte feuilletée,Beurre,Œufs,Sucre
farine=Œufs,Lait,Sucre,Beurre
sucre=Farine,Œufs,Beurre
levure chimique=Farine,Sucre,Œufs,Sucre vanillé
chocolat pâtissier=Beurre,Œufs,Sucre,Farine
crêpes=Pâte à tartiner,Sucre,Confiture,Citron
farine de sarrasin=Jambon,Fromage râpé,Œufs,Cidre
cidre=Farine de sarrasin,Crêpes
mascarpone=Biscuits cuillère,Café,Œufs,Cacao
crème liquide=Lardons,Champignons,Pâtes,Sucre glace
pâte à pizza=Sauce tomate,Mozzarella,Jambon,Champignons
mozzarella=Tomates,Basilic,Huile d’olive,Pâte à pizza
champignons de Paris=Crème fraîche,Persil,Ail,Lardons
steak haché=Pains burger,Cheddar,Frites,Ketchup
pains burger=Steaks hachés,Cheddar,Tomates,Salade
cheddar=Pains burger,Steaks hachés,Cornichons
frites=Ketchup,Mayonnaise,Steaks hachés,Nuggets
nuggets=Frites,Ketchup
tortillas=Poulet,Poivrons,Fromage râpé,Crème fraîche
avocat=Citron vert,Tomates,Coriandre
haricots rouges=Viande hachée,Riz,Tomates concassées,Maïs
pâtes=Sauce tomate,Fromage râpé,Viande hachée,Lardons
spaghetti=Viande hachée,Sauce tomate,Parmesan,Oignons
sauce tomate=Pâtes,Viande hachée,Oignons,Mozzarella
parmesan=Pâtes,Pesto,Roquette
pesto=Pâtes,Parmesan,Tomates cerises
lasagnes=Viande hachée,Coulis de tomate,Fromage râpé
viande hachée=Pâtes,Sauce tomate,Oignons,Fromage râpé
fromage râpé=Pâtes,Jambon,Crème fraîche,Pâte à pizza
raviolis=Parmesan,Sauce tomate
gnocchis=Sauce tomate,Parmesan,Pesto
riz=Poulet,Légumes surgelés,Sauce soja,Œufs
sauce soja=Riz,Nouilles,Saumon
curry=Lait de coco,Poulet,Riz,Oignons
lait de coco=Curry,Poulet,Riz,Crevettes
nouilles=Sauce soja,Poulet,Poêlée
semoule=Pois chiches,Merguez,Courgettes,Ras el hanout
pois chiches=Semoule,Cumin,Citron
salade=Tomates,Concombre,Vinaigrette
tomate=Mozzarella,Concombre,Huile d’olive,Basilic
concombre=Tomates,Feta,Yaourt nature
feta=Tomates,Concombre,Olives,Oignon rouge
thon=Riz,Maïs,Tomates,Mayonnaise
maïs=Thon,Tomates,Salade
vinaigrette=Salade,Tomates
huile d’olive=Vinaigre,Sel,Poivre
poireau=Pommes de terre,Carottes,Crème fraîche
carotte=Pommes de terre,Oignons,Poireaux
potimarron=Crème fraîche,Oignons,Pommes de terre,Bouillon cube
bouillon cube=Poireaux,Carottes,Vermicelles
plat de côtes=Carottes,Poireaux,Navets,Os à moelle
os à moelle=Plat de côtes,Gros sel,Pain
veau blanquette=Champignons,Crème fraîche,Carottes,Riz
pomme de terre=Beurre,Crème fraîche,Lardons,Fromage râpé
courgette=Tomates,Oignons,Feta,Ail
aubergine=Courgettes,Tomates,Poivrons,Mozzarella
brocoli=Crème fraîche,Fromage râpé,Pâtes
endive=Jambon,Fromage râpé
choucroute=Saucisses de Montbéliard,Pommes de terre,Lard,Bière
lentilles=Saucisses,Lardons,Carottes,Oignons
saucisses=Moutarde,Lentilles,Pommes de terre
haricots verts=Steak,Beurre,Ail
épinards frais=Crème fraîche,Œufs,Saumon
purée en flocons=Jambon,Steaks hachés,Saucisses
moules=Frites,Vin blanc,Crème fraîche,Échalotes
huîtres=Citrons,Échalotes,Vinaigre,Pain de campagne
jambon=Pâtes,Pain de mie,Fromage râpé,Beurre
poulet=Pommes de terre,Riz,Citron,Herbes de Provence
saumon=Riz,Citron,Aneth,Crème fraîche
cabillaud=Citron,Riz,Pommes de terre,Beurre
crevettes=Citron,Mayonnaise,Avocats,Riz
citron=Poisson,Sucre,Miel,Thé
oignon=Ail,Carottes,Pommes de terre,Tomates
ail=Oignons,Persil,Huile d’olive
camembert=Baguette,Vin rouge,Raisin
fraise=Crème chantilly,Sucre,Bananes
fruits rouges=Bananes,Yaourts,Lait
pomme=Cannelle,Pâte brisée,Sucre
flocons d’avoine=Lait,Bananes,Miel
foie gras=Pain d’épices,Confit d’oignons,Champagne
chapon=Marrons,Champignons,Pommes de terre
dinde=Marrons,Champignons,Pommes de terre
bûche glacée=Champagne,Chocolat,Clémentines
gigot d’agneau=Flageolets,Ail,Romarin,Haricots verts
œufs en chocolat=Lapins en chocolat,Gigot d’agneau
bougies d’anniversaire=Bonbons,Soda,Chips
bonbons=Soda,Chips
couches=Lingettes,Liniment,Lait infantile
lait infantile=Couches,Petits pots,Biberon
petits pots=Compote bébé,Couches,Lait infantile
lingettes=Couches,Cotons,Liniment
papier toilette=Essuie-tout,Mouchoirs,Gel douche
dentifrice=Brosse à dents,Bain de bouche,Fil dentaire
shampoing=Après-shampoing,Gel douche
gel douche=Shampoing,Déodorant,Savon
serviettes hygiéniques=Tampons,Protège-slips
rasoirs=Mousse à raser,Gel douche
liquide vaisselle=Éponges,Pastilles lave-vaisselle,Essuie-tout
lessive=Adoucissant,Détachant
pastilles lave-vaisselle=Sel régénérant,Liquide de rinçage
éponges=Liquide vaisselle,Nettoyant multi-usage
sacs poubelle=Essuie-tout,Nettoyant multi-usage
javel=Nettoyant WC,Gants de ménage
croquettes chat=Litière,Pâtée chat,Friandises chat
litière=Croquettes chat,Pâtée chat
croquettes chien=Friandises chien,Pâtée chien,Sacs à crottes
`
