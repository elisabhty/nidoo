// Les recettes (Elisa, 21 novembre : « ajouter une recette, pour que quand on l'ajoute on récupère le nombre qu'on est
// dans la famille, modifiable, et qu'on ait la liste de courses prête avec les bonnes quantités »).
//
// Tirées d'une recherche : les recettes que les familles françaises cuisinent le plus (Ipsos/Michelin 2025,
// Google Year in Search 2024, Marmiton) ; les quantités par adulte (Panzani, GEM-RCN, Fromagerie de Gilley,
// Fromages de Savoie, Elle & Vire, Hachette, Ôdélices, Marmiton ; le reste : proportions classiques à affiner) ;
// les formats d'achat vérifiés sur des drives (novembre 2026) ; les portions des enfants (GEM-RCN, ANSES).
//
// # id | nom | catégorie | base (pers, ou plat:parts) | mois | emoji | autres noms | occasions | pays
// (occasions : noel, nouvelan, epiphanie, chandeleur, saintvalentin, mardigras, paques, parents, halloween,
// anniversaire — Elisa, 21 novembre : « classer aussi par événement : Noël, Épiphanie, Nouvel An »)
// (pays : maroc, algerie, tunisie, france, belgique, allemagne, italie, espagne, uk, usa, mexique, argentine, bresil,
// senegal, cotedivoire, congo, vietnam, inde, thailande, chine — Elisa : « les gros plats que tout le monde connaît »)
// Puis un ingrédient par ligne : nom [quantité unité] [P = placard, décoché] [B = frais de base, décoché en petite
// quantité] [H = une pièce par convive : steak, pavé, cuisse, pain burger].
// Le nom est celui du référentiel des courses (rayon, format, pas du − / +).

export const RECETTES = `

# Q01 | Pâtes bolognaise | quotidien | pers | 1-12 | 🍝 | bolognaise, bolo, spaghetti bolognaise, spaghettis bolognaise |  | italie
Spaghetti 100 g
Viande hachée 100 g
Tomates concassées 100 g
Oignons 0.25 pce
Carottes 0.25 pce
Ail 0.5 gousse
Parmesan 10 g
Huile d’olive 5 ml P
Herbes de Provence P
Sel P
Poivre P

# Q02 | Carbonara | quotidien | pers | 1-12 | 🍝 | pates carbonara, spaghetti carbonara, carbo |  | italie
Pâtes 100 g
Lardons 50 g
Crème fraîche 5 cl
Œufs 0.5 pce B
Parmesan 15 g
Poivre P

# Q03 | Gratin de pâtes au jambon | quotidien | pers | 1-12 | 🧀 | gratin de pates, pates au jambon
Pâtes 90 g
Jambon 1 tranche
Crème fraîche 5 cl
Fromage râpé 40 g
Lait 5 cl B
Beurre 5 g B
Muscade P

# Q04 | Hachis parmentier | quotidien | pers | 1-12 | 🥔 | parmentier, hachis |  | france
Pommes de terre 250 g
Viande hachée 125 g
Oignons 0.25 pce
Fromage râpé 20 g
Lait 5 cl B
Beurre 10 g B
Muscade P
Sel P
Poivre P

# Q05 | Quiche lorraine | quotidien | plat:6 | 1-12 | 🥧 | quiche |  | france
Pâte brisée 1 rouleau
Lardons 200 g
Œufs 3 pce B
Crème fraîche 20 cl
Lait 10 cl B
Muscade P
Sel P
Poivre P

# Q06 | Croque-monsieur | quotidien | pers | 1-12 | 🥪 | croque monsieur, croques, croque |  | france
Pain de mie 4 tranche
Jambon 1 tranche
Fromage râpé 40 g
Salade 40 g
Beurre 10 g B

# Q07 | Omelette aux champignons | quotidien | pers | 1-12 | 🍳 | omelette
Œufs 2.5 pce B
Champignons de Paris 60 g
Ciboulette 0.1 botte
Salade 40 g
Beurre 5 g B
Sel P
Poivre P

# Q08 | Poulet rôti et pommes de terre | quotidien | pers | 1-12 | 🍗 | poulet roti, poulet du dimanche
Poulet entier 0.25 pce
Pommes de terre 250 g
Ail 1 gousse
Beurre 10 g B
Thym P
Huile P

# Q09 | Poulet au curry et riz | quotidien | pers | 1-12 | 🍛 | poulet curry, curry de poulet, poulet coco |  | inde
Blanc de poulet 130 g
Lait de coco 10 cl
Riz basmati 70 g
Oignons 0.25 pce
Curry 1 cac P
Huile P

# Q10 | Chili con carne | quotidien | pers | 1-12 | 🌶️ | chili |  | mexique
Viande hachée 125 g
Haricots rouges 75 g
Maïs 50 g
Tomates concassées 150 g
Oignons 0.25 pce
Poivrons 0.25 pce
Riz 70 g
Cumin P
Piment P

# Q11 | Lasagnes bolognaise | quotidien | plat:6 | 1-12 | 🍝 | lasagne, lasagnes |  | italie
Lasagnes 250 g
Viande hachée 600 g
Tomates concassées 800 g
Oignons 1 pce
Carottes 1 pce
Fromage râpé 150 g
Lait 75 cl B
Beurre 50 g B
Farine 50 g P
Muscade P

# Q12 | Risotto aux champignons | quotidien | pers | 1-12 | 🍚 | risotto |  | italie
Riz arborio 80 g
Champignons de Paris 100 g
Échalotes 0.5 pce
Vin blanc 3 cl
Parmesan 20 g
Beurre 10 g B
Bouillon de volaille P

# Q13 | Riz cantonais | quotidien | pers | 1-12 | 🍚 | riz cantonnais |  | chine
Riz 75 g
Œufs 1 pce B
Jambon 0.5 tranche
Petits pois surgelés 40 g
Oignons 0.25 pce
Sauce soja P
Huile P

# Q14 | Saumon en papillote et riz | quotidien | pers | 1-12 | 🐟 | saumon papillote, papillote
Saumon 1 pce H
Courgettes 0.5 pce
Citrons 0.25 pce
Riz 70 g
Aneth P
Huile d’olive P

# Q15 | Poisson pané maison et purée | quotidien | pers | 1-12 | 🐟 | poisson pane, poisson puree
Colin 130 g
Pommes de terre 250 g
Citrons 0.25 pce
Œufs 0.5 pce B
Lait 5 cl B
Beurre 10 g B
Chapelure 20 g P
Farine P

# Q16 | Soupe de légumes | quotidien | pers | 10-4 | 🥣 | soupe, soupe maison, potage
Poireaux 0.5 pce
Carottes 1 pce
Pommes de terre 1 pce
Oignons 0.25 pce
Crème fraîche 2 cl
Bouillon de légumes P

# Q17 | Velouté de potiron | quotidien | pers | 10-12 | 🎃 | veloute, soupe de potiron, veloute potiron | halloween
Potiron 300 g
Pommes de terre 0.5 pce
Oignons 0.25 pce
Crème fraîche 3 cl
Bouillon de légumes P
Muscade P

# Q18 | Salade niçoise | quotidien | pers | 5-9 | 🥗 | nicoise
Salade 50 g
Tomates 1 pce
Thon 50 g
Haricots verts 50 g
Poivrons 0.25 pce
Olives 15 g
Œufs 1 pce B
Huile d’olive P
Vinaigre P

# Q19 | Taboulé | quotidien | pers | 5-9 | 🥗 | taboule
Semoule 60 g
Tomates 1 pce
Concombre 0.25 pce
Menthe 0.2 botte
Persil 0.2 botte
Citrons 0.5 pce
Oignon rouge 0.25 pce
Huile d’olive P

# Q20 | Tarte à la tomate | quotidien | plat:6 | 6-9 | 🍅 | tarte tomate, tarte a la tomate moutarde
Pâte brisée 1 rouleau
Tomates 5 pce
Fromage râpé 100 g
Moutarde P
Herbes de Provence P
Huile P

# Q21 | Wraps poulet-crudités | quotidien | pers | 4-9 | 🌯 | wrap, wraps
Tortillas 2 pce
Blanc de poulet 100 g
Salade 20 g
Tomates 0.5 pce
Fromage frais 30 g
Épices tex-mex P

# Q22 | Tacos au bœuf | quotidien | pers | 1-12 | 🌮 | tacos, taco |  | mexique
Tortillas 3 pce
Viande hachée 100 g
Tomates 0.5 pce
Salade 20 g
Fromage râpé 30 g
Crème fraîche 2 cl
Épices tex-mex P

# Q23 | Burgers maison et frites | quotidien | pers | 1-12 | 🍔 | burger, burgers, hamburger, burger maison | anniversaire | usa
Pains burger 1 pce H
Steak haché 1 pce H
Cheddar 1 tranche
Tomates 0.25 pce
Salade 10 g
Oignons 0.25 pce
Frites 200 g
Ketchup P

# Q24 | Pizza maison jambon-champignons | quotidien | pers | 1-12 | 🍕 | pizza maison, pizzas maison, soiree pizza, pizza reine | anniversaire | italie
Pâte à pizza 0.5 rouleau
Sauce tomate 50 g
Mozzarella 0.5 boule
Jambon 1 tranche
Champignons de Paris 40 g
Origan P
Huile d’olive P

# Q25 | Gratin dauphinois | quotidien | pers | 1-12 | 🥔 | gratin, dauphinois |  | france
Pommes de terre 250 g
Crème fraîche 5 cl
Ail 0.25 gousse
Lait 10 cl B
Beurre 5 g B
Muscade P

# Q26 | Endives au jambon | quotidien | pers | 10-4 | 🥬 | endives jambon, chicons au gratin |  | belgique
Endives 2 pce
Jambon 2 tranche
Fromage râpé 25 g
Lait 15 cl B
Beurre 10 g B
Farine 10 g P
Muscade P

# Q27 | Lentilles-saucisses | quotidien | pers | 10-4 | 🌭 | lentilles saucisse, petit sale
Lentilles 70 g
Saucisses de Toulouse 1 pce H
Lardons 25 g
Carottes 0.5 pce
Oignons 0.25 pce
Bouquet garni P
Bouillon de légumes P

# Q28 | Cake salé jambon-olives | quotidien | plat:8 | 1-12 | 🍞 | cake sale, cake jambon olives
Dés de jambon 150 g
Olives 75 g
Fromage râpé 100 g
Œufs 3 pce B
Lait 12 cl B
Farine 150 g P
Levure chimique P
Huile P

# Q29 | Galettes complètes | quotidien | pers | 1-12 | 🥞 | galette complete, galettes, galettes bretonnes, galette de sarrasin | chandeleur | france
Farine de sarrasin 50 g
Jambon 2 tranche
Fromage râpé 40 g
Œufs 2 pce B
Beurre 10 g B
Gros sel P

# W01 | Couscous poulet-merguez | weekend | pers | 1-12 | 🍲 | couscous |  | maroc,algerie,tunisie
Semoule 80 g
Cuisses de poulet 1 pce H
Merguez 2 pce
Carottes 1 pce
Courgettes 0.5 pce
Navets 0.5 pce
Pois chiches 50 g
Oignons 0.25 pce
Tomates concassées 50 g
Ras el hanout P
Bouillon de volaille P

# W02 | Tajine poulet, citron et olives | weekend | pers | 1-12 | 🍋 | tajine, tagine |  | maroc
Cuisses de poulet 1 pce H
Oignons 0.5 pce
Citron confit 0.25 pce
Olives 25 g
Semoule 70 g
Gingembre P
Curcuma P

# W03 | Blanquette de veau | weekend | pers | 1-12 | 🍲 | blanquette |  | france
Veau blanquette 200 g
Carottes 0.5 pce
Champignons de Paris 40 g
Oignons 0.25 pce
Crème fraîche 3.5 cl
Citrons 0.1 pce
Riz 70 g
Beurre 7 g B
Œufs 0.2 pce B
Farine P
Bouquet garni P
Fond de veau P

# W04 | Bœuf bourguignon | weekend | pers | 10-3 | 🍷 | bourguignon, boeuf bourguignon |  | france
Bœuf bourguignon 200 g
Vin rouge 12.5 cl
Lardons 25 g
Champignons de Paris 40 g
Carottes 0.5 pce
Oignons 0.33 pce
Ail 0.5 gousse
Pommes de terre 200 g
Farine P
Bouquet garni P
Bouillon de bœuf P

# W05 | Pot-au-feu | weekend | pers | 10-3 | 🍲 | pot au feu |  | france
Plat de côtes 250 g
Os à moelle 0.5 pce
Carottes 1.5 pce
Poireaux 0.5 pce
Navets 0.5 pce
Pommes de terre 200 g
Oignons 0.25 pce
Bouquet garni P
Gros sel P

# W06 | Bœuf carottes | weekend | pers | 10-4 | 🥕 | boeuf carotte, boeuf aux carottes
Bœuf bourguignon 180 g
Carottes 250 g
Oignons 0.25 pce
Vin blanc 5 cl
Bouillon de bœuf P
Thym P
Laurier P

# W07 | Tartiflette | weekend | pers | 11-3 | 🧀 | tartiflette |  | france
Pommes de terre 250 g
Reblochon 0.25 pce
Lardons 50 g
Oignons 0.5 pce
Vin blanc 2.5 cl
Poivre P

# W08 | Raclette | weekend | pers | 11-3 | 🧀 | raclette, soiree raclette | nouvelan | france
Fromage à raclette 200 g
Pommes de terre 250 g
Jambon cru 2 tranche
Jambon 2 tranche
Rosette 50 g
Cornichons 30 g
Salade 40 g

# W09 | Fondue savoyarde | weekend | pers | 11-3 | 🫕 | fondue, fondue savoyarde | nouvelan | france
Fromage à fondue 220 g
Baguette 0.5 pce
Vin blanc 10 cl
Ail 0.25 gousse
Kirsch P
Fécule de maïs P

# W10 | Choucroute garnie | weekend | pers | 10-3 | 🌭 | choucroute |  | france,allemagne
Choucroute 300 g
Saucisses de Strasbourg 1 pce
Saucisses de Montbéliard 0.5 pce
Lard 80 g
Pommes de terre 250 g
Vin blanc 5 cl
Baies de genièvre P

# W11 | Moules-frites | weekend | pers | 7-1 | 🦪 | moules frites, moules marinieres, moules |  | belgique
Moules 700 g
Frites 200 g
Échalotes 0.5 pce
Vin blanc 5 cl
Persil 0.1 botte
Beurre 10 g B

# W12 | Paella | weekend | pers | 5-9 | 🥘 | paella |  | espagne
Riz rond 100 g
Cuisses de poulet 100 g
Chorizo 25 g
Crevettes 60 g
Moules 100 g
Encornets 40 g
Poivrons 0.25 pce
Petits pois surgelés 25 g
Tomates 0.5 pce
Oignons 0.25 pce
Épices paella P
Bouillon de volaille P
Safran P
Huile d’olive P

# W13 | Cassoulet | weekend | pers | 10-3 | 🫘 | cassoulet |  | france
Haricots blancs 80 g
Saucisses de Toulouse 1 pce H
Confit de canard 0.5 pce
Poitrine de porc 40 g
Tomates concassées 30 g
Oignons 0.25 pce
Ail 1 gousse
Bouquet garni P

# D01 | Crêpes | dessert | plat:5 | 1-12 | 🥞 | crepe, crepes, chandeleur, soiree crepes, pate a crepes | chandeleur,mardigras | france
Lait 60 cl
Beurre 50 g
Œufs 3 pce B
Farine 300 g P
Sucre P
Huile P
Sucre vanillé P
Fleur d’oranger P
Rhum P

# D02 | Gaufres | dessert | plat:5 | 1-12 | 🧇 | gaufre | mardigras,chandeleur | belgique
Lait 50 cl
Beurre 100 g
Œufs 3 pce B
Farine 250 g P
Sucre 50 g P
Levure chimique P
Sucre vanillé P
Extrait de vanille P

# D03 | Gâteau au chocolat | dessert | plat:8 | 1-12 | 🍫 | gateau chocolat, fondant au chocolat, moelleux au chocolat | anniversaire
Chocolat pâtissier 200 g
Beurre 125 g
Œufs 4 pce
Sucre 125 g P
Farine 50 g P
Sucre vanillé P

# D04 | Gâteau au yaourt | dessert | plat:8 | 1-12 | 🍰 | gateau yaourt | anniversaire
Yaourt nature 1 pot
Œufs 3 pce B
Sucre 200 g P
Farine 255 g P
Huile P
Levure chimique P
Sucre vanillé P
Extrait de vanille P

# D05 | Cookies | dessert | plat:10 | 1-12 | 🍪 | cookie | halloween | usa
Beurre 125 g
Pépites de chocolat 150 g
Œufs 1 pce B
Farine 250 g P
Cassonade 125 g P
Levure chimique P
Sel P
Extrait de vanille P

# D06 | Crumble aux pommes | dessert | plat:6 | 9-4 | 🍏 | crumble
Pommes 6 pce
Beurre 100 g
Farine 150 g P
Cassonade 100 g P
Cannelle P
Sucre vanillé P

# D07 | Tarte aux pommes | dessert | plat:8 | 9-4 | 🥧 | tarte pommes |  | france
Pâte brisée 1 rouleau
Pommes 5 pce
Beurre 20 g B
Sucre 40 g P
Sucre vanillé P
Cannelle P

# D08 | Tiramisu | dessert | plat:6 | 1-12 | 🍰 | tiramisu | saintvalentin,parents | italie
Mascarpone 250 g
Biscuits cuillère 24 pce
Œufs 3 pce B
Sucre 75 g P
Café P
Cacao P
Sucre vanillé P
Amaretto P

# D09 | Mousse au chocolat | dessert | plat:6 | 1-12 | 🍫 | mousse chocolat | saintvalentin | france
Chocolat pâtissier 200 g
Œufs 6 pce
Sucre P
Sel P

# D10 | Riz au lait | dessert | plat:6 | 1-12 | 🍚 | riz au lait
Riz rond 100 g
Lait 100 cl
Sucre 80 g P
Vanille 1 pce P
Cannelle P

# D11 | Pancakes | dessert | plat:4 | 1-12 | 🥞 | pancake | chandeleur,parents | usa
Lait 30 cl
Beurre 40 g
Sirop d’érable
Œufs 2 pce B
Farine 250 g P
Sucre 30 g P
Levure chimique P
Extrait de vanille P

# D12 | Galette des rois | dessert | plat:8 | 1 | 👑 | galette, galette frangipane, epiphanie | epiphanie | france
Pâte feuilletée 2 rouleau
Poudre d’amande 125 g
Beurre 75 g
Œufs 3 pce
Sucre 100 g P
Extrait d’amande amère P
Rhum P
Fève P

# D13 | Clafoutis aux cerises | dessert | plat:6 | 6-7 | 🍒 | clafoutis |  | france
Cerises 500 g
Lait 40 cl
Œufs 3 pce B
Beurre 10 g B
Sucre 100 g P
Farine 80 g P
Sucre vanillé P
Kirsch P

# F01 | Chapon aux marrons | fete | pers | 12 | 🎄 | chapon, dinde aux marrons, repas de noel, noel | noel | france
Chapon 450 g
Marrons 80 g
Chair à saucisse 50 g
Échalotes 0.25 pce
Beurre 10 g B
Bouillon de volaille P

# F02 | Bûche au chocolat | fete | plat:8 | 12 | 🎄 | buche, buche de noel | noel | france
Chocolat pâtissier 200 g
Crème liquide 40 cl
Œufs 4 pce
Sucre 120 g P
Farine 100 g P
Cacao P
Extrait de vanille P

# F03 | Gigot d’agneau et flageolets | fete | pers | 3-4 | 🐣 | gigot, paques, repas de paques | paques
Gigot d’agneau 300 g
Flageolets 100 g
Ail 1 gousse
Beurre 10 g B
Romarin P
Thym P

# F04 | Brunch | fete | pers | 1-12 | 🥐 | brunch | paques,parents
Œufs 2 pce B
Bacon 2 tranche
Pain 2 tranche
Croissant 1 pce
Avocat 0.5 pce
Jus d’orange 20 cl
Fruits rouges 80 g
Beurre 10 g B

# F05 | Apéro dînatoire | fete | pers | 1-12 | 🥂 | apero, apero dinatoire, aperitif | nouvelan,anniversaire
Chips 30 g
Tomates cerises 60 g
Carottes 40 g
Concombre 0.2 pce
Houmous 40 g
Saucisson 30 g
Comté 50 g
Pâte feuilletée 0.25 rouleau
Baguette 0.25 pce

# F06 | Goûter d’anniversaire | fete | pers | 1-12 | 🎂 | anniversaire, gouter d anniversaire, anniv | anniversaire,halloween
Chocolat pâtissier 25 g
Beurre 16 g
Œufs 0.5 pce
Bonbons 40 g
Chips 20 g
Jus de fruits 20 cl
Raisin 60 g
Bougies d’anniversaire

# E01 | Foie gras et pain d’épices | entree | pers | 12-1 | 🍞 | foie gras | noel,nouvelan
Foie gras 50 g
Pain d’épices 30 g
Confit d’oignons 15 g
Fleur de sel P

# E02 | Huîtres | entree | pers | 9-4 | 🦪 | huitres, plateau d huitres | noel,nouvelan
Huîtres 6 pce
Citrons 0.25 pce
Échalotes 0.25 pce
Pain de seigle 1 tranche
Beurre 10 g B
Vinaigre P

# E03 | Saumon fumé et blinis | entree | pers | 1-12 | 🐟 | blinis saumon, saumon blinis | noel,nouvelan,paques
Saumon fumé 50 g
Blinis 3 pce
Crème fraîche 3 cl
Citrons 0.25 pce
Aneth P

# E04 | Verrines avocat-crevettes | entree | pers | 1-12 | 🥑 | verrines, verrine, avocat crevettes | nouvelan,anniversaire
Avocat 0.5 pce
Crevettes 60 g
Citron vert 0.25 pce
Tomates cerises 40 g
Crème fraîche 2 cl
Ciboulette P

# E05 | Toasts de fête | entree | pers | 12-1 | 🥂 | toasts, canapes, petits fours sales | noel,nouvelan
Pain de mie 2 tranche
Saumon fumé 20 g
Fromage frais 25 g
Tarama 20 g
Concombre 0.1 pce
Ciboulette P

# E06 | Gougères au comté | entree | plat:6 | 1-12 | 🧀 | gougere, gougeres | noel,nouvelan | france
Comté 75 g
Beurre 60 g
Œufs 2 pce B
Lait 12 cl B
Farine 75 g P
Muscade P

# E07 | Feuilletés aux saucisses | entree | plat:6 | 1-12 | 🌭 | feuilletes saucisse, mini friands, friands | anniversaire,nouvelan
Pâte feuilletée 1 rouleau
Saucisses de Strasbourg 4 pce
Œufs 1 pce B
Moutarde P

# E08 | Œufs mimosa | entree | pers | 3-9 | 🥚 | oeufs mimosa | paques,parents
Œufs 1.5 pce
Salade 20 g
Mayonnaise P
Persil P

# E09 | Velouté de châtaignes | entree | pers | 11-1 | 🌰 | veloute chataigne, soupe de chataignes, veloute de marrons | noel
Marrons 80 g
Crème liquide 3 cl
Oignons 0.25 pce
Beurre 10 g B
Bouillon de volaille P

# E10 | Salade de chèvre chaud | entree | pers | 1-12 | 🥗 | chevre chaud, salade chevre | parents
Chèvre 40 g
Baguette 0.25 pce
Salade 50 g
Noix 15 g
Miel P
Huile d’olive P
Vinaigre P

# E11 | Champignons farcis | entree | pers | 9-3 | 🍄 | champignons farcis, champignon farci, champignons farcis apero, farcis | noel,nouvelan | france
Champignons de Paris 100 g
Chair à saucisse 40 g
Échalotes 0.25 pce
Ail 0.5 gousse
Fromage râpé 10 g
Persil P
Chapelure P
Huile d’olive P

# Q30 | Gratin de courgettes | quotidien | pers | 6-9 | 🥒 | gratin courgette, gratin de courgette
Courgettes 1 pce
Crème fraîche 5 cl
Fromage râpé 30 g
Œufs 0.5 pce B
Ail 0.5 gousse

# Q31 | Gnocchis crème et lardons | quotidien | pers | 1-12 | 🥟 | gnocchis, gnocchi |  | italie
Gnocchis 125 g
Lardons 50 g
Crème fraîche 5 cl
Fromage râpé 20 g
Oignons 0.25 pce

# Q32 | Dahl de lentilles corail | quotidien | pers | 1-12 | 🍛 | dahl, dal, lentilles corail
Lentilles corail 75 g
Lait de coco 10 cl
Tomates concassées 100 g
Oignons 0.25 pce
Ail 0.5 gousse
Riz 60 g
Curry P
Gingembre P

# Q33 | Nuggets de poulet maison | quotidien | pers | 1-12 | 🍗 | nuggets, croquettes de poulet
Blanc de poulet 125 g
Pommes de terre 200 g
Chapelure 30 g
Œufs 0.5 pce B
Farine P
Huile de tournesol P

# Q34 | Pâtes au saumon | quotidien | pers | 1-12 | 🍝 | pates saumon, tagliatelles saumon, pates au saumon
Pâtes 100 g
Saumon 0.5 pce
Crème fraîche 5 cl
Citrons 0.25 pce
Aneth P

# Q35 | Ratatouille | quotidien | pers | 6-9 | 🍆 | ratatouille |  | france
Courgettes 0.5 pce
Aubergines 0.5 pce
Poivrons 0.5 pce
Tomates 1 pce
Oignons 0.5 pce
Ail 1 gousse
Herbes de Provence P
Huile d’olive P

# Q36 | Salade de pâtes | quotidien | pers | 5-9 | 🥗 | salade pates, pates froides, salade de pates
Pâtes 80 g
Tomates cerises 60 g
Mozzarella 30 g
Jambon 1 tranche
Maïs 40 g
Basilic P
Huile d’olive P
Vinaigre P

# Q37 | Pâtes au pesto | quotidien | pers | 1-12 | 🌿 | pesto, pates pesto, pates au pesto |  | italie
Pâtes 100 g
Pesto 30 g
Tomates cerises 40 g
Parmesan 10 g

# Q38 | Escalopes de dinde à la crème | quotidien | pers | 1-12 | 🍗 | escalope creme, dinde a la creme, escalopes a la creme
Escalope de dinde 1 pce H
Champignons 60 g
Crème fraîche 5 cl
Oignons 0.25 pce
Riz 70 g

# Q39 | Gratin de chou-fleur | quotidien | pers | 10-3 | 🥦 | gratin chou fleur, chou fleur gratine
Chou-fleur 0.25 pce
Lait 15 cl
Fromage râpé 30 g
Beurre 10 g B
Farine P
Muscade P

# Q40 | Quiche aux poireaux | quotidien | plat:6 | 10-4 | 🥧 | quiche poireaux, flamiche
Pâte brisée 1 rouleau
Poireaux 3 pce
Œufs 3 pce B
Crème fraîche 20 cl
Fromage râpé 80 g
Beurre 10 g B

# Q41 | Hot-dogs momies | quotidien | pers | 10 | 🌭 | hot dogs momies, momies, saucisses momies | halloween
Saucisses de Strasbourg 2 pce
Pâte feuilletée 0.25 rouleau
Ketchup P
Moutarde P

# Q42 | Tomates farcies | quotidien | pers | 6-10 | 🍅 | tomates farcies, tomate farcie, farcis, farci, tomates farcies au riz, legumes farcis |  | france
Tomates 2 pce
Chair à saucisse 75 g
Viande hachée 50 g
Riz 50 g
Oignons 0.25 pce
Ail 0.5 gousse
Œufs 0.25 pce B
Chapelure P
Persil P
Herbes de Provence P
Huile d’olive P

# Q43 | Poivrons farcis au bœuf | quotidien | pers | 7-10 | 🫑 | poivrons farcis, poivron farci, poivrons farcis viande hachee, farcis
Poivrons 1 pce
Viande hachée 100 g
Riz 30 g
Oignons 0.25 pce
Ail 0.5 gousse
Coulis de tomate 80 g
Fromage râpé 15 g
Paprika P
Huile d’olive P

# Q44 | Courgettes farcies | quotidien | pers | 6-9 | 🥒 | courgettes farcies, courgette farcie, courgettes rondes farcies, farcis |  | france
Courgettes 1 pce
Chair à saucisse 100 g
Riz 50 g
Oignons 0.25 pce
Ail 0.5 gousse
Œufs 0.25 pce B
Fromage râpé 15 g
Chapelure P
Thym P
Huile d’olive P

# Q45 | Pommes de terre farcies | quotidien | pers | 10-3 | 🥔 | pommes de terre farcies, patates farcies, pomme de terre farcie, farcis |  | france
Pommes de terre 2 pce
Viande hachée 80 g
Oignons 0.25 pce
Crème fraîche 2 cl
Fromage râpé 20 g
Beurre 5 g B
Persil P

# Q46 | Aubergines farcies | quotidien | pers | 7-9 | 🍆 | aubergines farcies, aubergine farcie, farcis
Aubergines 0.5 pce
Viande hachée 100 g
Tomates 0.5 pce
Riz 50 g
Oignons 0.25 pce
Ail 0.5 gousse
Fromage râpé 15 g
Cumin P
Huile d’olive P

# Q47 | Cannellonis au bœuf | quotidien | plat:6 | 1-12 | 🍝 | cannellonis, cannelloni, cannellonis bolognaise, cannellonis farcis |  | italie
Cannellonis 250 g
Viande hachée 500 g
Tomates concassées 800 g
Oignons 1 pce
Ail 1 gousse
Fromage râpé 100 g
Lait 50 cl B
Beurre 40 g B
Farine 40 g P
Muscade P

# W14 | Poulet basquaise | weekend | pers | 6-9 | 🫑 | basquaise, poulet basquais
Cuisses de poulet 1 pce H
Poivrons 0.75 pce
Tomates 1 pce
Oignons 0.5 pce
Chorizo 20 g
Ail 1 gousse
Riz 70 g
Piment P

# W15 | Rougail saucisses | weekend | pers | 1-12 | 🌶️ | rougail, rougail saucisse
Saucisses fumées 1 pce H
Tomates 1.5 pce
Oignons 0.5 pce
Ail 1 gousse
Riz 70 g
Gingembre P
Piment P

# W16 | Poulet à la crème et aux champignons | weekend | pers | 1-12 | 🍄 | poulet creme, poulet a la creme, poulet aux champignons
Cuisses de poulet 1 pce H
Champignons 100 g
Crème fraîche 8 cl
Échalotes 0.5 pce
Vin blanc 5 cl
Pâtes 90 g

# W17 | Parmentier de canard | weekend | pers | 10-3 | 🦆 | parmentier canard, hachis de canard
Confit de canard 0.75 pce
Pommes de terre 250 g
Échalotes 0.25 pce
Lait 5 cl B
Beurre 10 g B
Chapelure P

# W18 | Soupe à l’oignon gratinée | weekend | pers | 11-2 | 🧅 | soupe a l oignon, gratinee | nouvelan | france
Oignons 1.5 pce
Pain 2 tranche
Fromage râpé 30 g
Vin blanc 3 cl
Beurre 15 g B
Bouillon de bœuf P
Farine P

# W19 | Rôti de bœuf et pommes grenaille | weekend | pers | 1-12 | 🥩 | roti de boeuf, roti | parents,paques
Rôti de bœuf 150 g
Pommes de terre 250 g
Ail 1 gousse
Beurre 10 g B
Thym P

# W20 | Petits farcis niçois | weekend | pers | 6-9 | 🫑 | petits farcis, farcis nicois, farcis provencaux, petits farcis provencaux, legumes farcis, farcis |  | france
Tomates 1 pce
Courgettes 0.5 pce
Poivrons 0.5 pce
Oignons 0.5 pce
Chair à saucisse 80 g
Jambon 1 tranche
Parmesan 10 g
Œufs 0.5 pce B
Ail 1 gousse
Chapelure P
Persil P
Thym P
Huile d’olive P

# W21 | Chou farci | weekend | plat:6 | 10-3 | 🥬 | chou farci, chou farci auvergnat, chou farci au porc, farci |  | france
Chou vert 1 pce
Chair à saucisse 500 g
Viande hachée 250 g
Lardons 200 g
Carottes 2 pce
Oignons 1 pce
Ail 2 gousse
Œufs 1 pce B
Pain de mie 2 tranche
Lait 10 cl B
Persil P
Thym P
Laurier P
Bouillon de volaille P

# F07 | Dinde farcie aux marrons | fete | pers | 12 | 🦃 | dinde farcie, dinde, dinde de noel, dinde aux marrons, farce aux marrons, farce de noel | noel,nouvelan | france
Dinde 400 g
Chair à saucisse 50 g
Marrons 80 g
Pain de mie 0.5 tranche
Lait 2 cl B
Œufs 0.15 pce B
Échalotes 0.25 pce
Pommes de terre 150 g
Beurre 10 g B
Persil P
Thym P
Bouillon de volaille P

# F08 | Saumon en croûte | fete | pers | 12-1 | 🐟 | saumon croute, saumon en croute, koulibiac | noel,nouvelan
Saumon 1 pce H
Pâte feuilletée 0.3 rouleau
Épinards frais 60 g
Crème fraîche 3 cl
Citrons 0.25 pce
Œufs 0.25 pce B
Aneth P

# F09 | Filet mignon en croûte | fete | pers | 1-12 | 🥩 | filet mignon, filet mignon en croute | nouvelan,parents
Filet mignon de porc 150 g
Pâte feuilletée 0.25 rouleau
Champignons 60 g
Jambon cru 1 tranche
Œufs 0.25 pce B
Moutarde P

# F10 | Magrets de canard au miel | fete | pers | 1-12 | 🦆 | magret, magrets, magret de canard | nouvelan,saintvalentin,parents
Magret de canard 0.5 pce
Pommes de terre 200 g
Ail 1 gousse
Miel P
Persil P

# F11 | Coquilles Saint-Jacques | fete | pers | 11-4 | 🐚 | saint jacques, coquilles saint jacques | noel,nouvelan | france
Noix de Saint-Jacques 100 g
Poireaux 0.5 pce
Crème fraîche 5 cl
Échalotes 0.25 pce
Vin blanc 3 cl
Beurre 10 g B

# F12 | Épaule d’agneau confite | fete | pers | 3-5 | 🐑 | epaule d agneau, agneau de sept heures, agneau de paques | paques
Épaule d’agneau 300 g
Carottes 1 pce
Oignons 0.5 pce
Ail 2 gousse
Vin blanc 5 cl
Romarin P
Thym P

# F13 | Fondue bourguignonne | fete | pers | 11-3 | 🫕 | fondue bourguignonne, fondue de viande | nouvelan
Bœuf à fondue 200 g
Pommes de terre 200 g
Salade 40 g
Mayonnaise 20 g
Huile de tournesol 25 cl
Cornichons P

# F14 | Dinde farcie aux pommes | fete | pers | 11-1 | 🦃 | dinde farcie aux pommes, dinde aux pommes, dinde au cidre, dinde farcie | noel,nouvelan | france
Dinde 400 g
Chair à saucisse 50 g
Pommes 1 pce
Échalotes 0.25 pce
Pain de mie 0.5 tranche
Lait 2 cl B
Œufs 0.15 pce B
Cidre 8 cl
Beurre 10 g B
Persil P
Thym P

# D14 | Bûche aux marrons | dessert | plat:8 | 12 | 🌰 | buche marrons, buche sans cuisson, buche aux marrons | noel
Crème de marrons 400 g
Mascarpone 250 g
Biscuits cuillère 24 pce
Chocolat pâtissier 50 g
Lait 10 cl B

# D15 | Truffes au chocolat | dessert | plat:10 | 12 | 🍫 | truffes, truffes chocolat | noel
Chocolat pâtissier 200 g
Crème liquide 10 cl
Beurre 30 g B
Cacao P

# D16 | Pain d’épices maison | dessert | plat:8 | 11-1 | 🍯 | pain d epices maison | noel
Miel 250 g
Cassonade 50 g
Lait 15 cl B
Œufs 1 pce B
Farine 250 g P
Quatre-épices P
Cannelle P
Levure chimique P

# D17 | Sablés de Noël | dessert | plat:10 | 12 | ⭐ | sables, sables de noel, biscuits de noel, bredele | noel
Beurre 125 g
Œufs 1 pce B
Farine 250 g P
Sucre 100 g P
Cannelle P
Sucre vanillé P

# D18 | Chocolat chaud | dessert | pers | 11-2 | ☕ | chocolat chaud, chocolat viennois | noel,epiphanie
Lait 25 cl
Chocolat pâtissier 25 g
Crème chantilly 2 cl
Cannelle P

# D19 | Brioche des rois | dessert | plat:8 | 1 | 👑 | couronne des rois, gateau des rois, brioche des rois | epiphanie
Beurre 100 g
Œufs 3 pce
Fruits confits 100 g
Levure boulangère 1 pce
Lait 10 cl B
Farine 500 g P
Sucre 80 g P
Sucre perlé P
Fleur d’oranger P
Fève P

# D20 | Galette poires-chocolat | dessert | plat:8 | 1 | 🍐 | galette poire chocolat, galette chocolat | epiphanie
Pâte feuilletée 2 rouleau
Poudre d’amande 100 g
Poires 2 pce
Chocolat pâtissier 80 g
Beurre 75 g
Œufs 2 pce B
Sucre 80 g P
Fève P

# D28 | Galette pomme-frangipane | dessert | plat:8 | 1 | 🍏 | galette pomme, galette aux pommes | epiphanie
Pâte feuilletée 2 rouleau
Pommes 2 pce
Poudre d’amande 100 g
Beurre 75 g
Œufs 2 pce B
Sucre 80 g P
Cannelle P
Fève P

# D21 | Salade de fruits exotiques | dessert | pers | 11-3 | 🥭 | salade de fruits, salade exotique | nouvelan
Ananas 0.15 pce
Mangue 0.2 pce
Kiwis 1 pce
Clémentines 1 pce
Fruit de la passion 0.25 pce
Sucre vanillé P

# D22 | Profiteroles | dessert | plat:6 | 1-12 | 🍨 | profiterole, choux | nouvelan,anniversaire
Glace à la vanille 50 cl
Chocolat pâtissier 100 g
Crème liquide 10 cl
Beurre 60 g
Œufs 3 pce B
Farine 75 g P
Sucre P

# D23 | Beignets de carnaval | dessert | plat:6 | 1-3 | 🎭 | bugnes, merveilles, oreillettes, beignets | mardigras
Huile de tournesol 1 l
Œufs 2 pce B
Beurre 50 g B
Farine 250 g P
Sucre 30 g P
Levure chimique P
Sucre glace P
Fleur d’oranger P

# D24 | Cœurs coulants au chocolat | dessert | plat:4 | 1-12 | ❤️ | coeur coulant, coeurs coulants, fondant coulant | saintvalentin
Chocolat pâtissier 100 g
Beurre 80 g
Œufs 2 pce B
Sucre 50 g P
Farine 30 g P

# D25 | Charlotte aux fraises | dessert | plat:8 | 5-6 | 🍓 | charlotte, charlotte fraises | parents
Fraises 500 g
Biscuits cuillère 24 pce
Mascarpone 250 g
Crème liquide 30 cl
Sucre 80 g P
Sucre vanillé P

# D26 | Nid de Pâques au chocolat | dessert | plat:8 | 3-4 | 🐣 | nid de paques, gateau de paques | paques
Chocolat pâtissier 200 g
Beurre 120 g
Œufs 4 pce
Œufs en chocolat 150 g
Sucre 150 g P
Farine 60 g P

# D27 | Muffins au chocolat | dessert | plat:12 | 1-12 | 🧁 | muffin, muffins | anniversaire,halloween
Beurre 100 g
Pépites de chocolat 100 g
Œufs 2 pce B
Lait 20 cl B
Farine 250 g P
Sucre 120 g P
Cacao P
Levure chimique P

# MA1 | Harira | quotidien | pers | 10-4 | 🥣 | harira, soupe harira | | maroc
Épaule d’agneau 60 g
Lentilles 30 g
Pois chiches 40 g
Tomates concassées 100 g
Oignons 0.25 pce
Céleri 0.25 pce
Vermicelles 15 g
Coriandre P
Persil P
Gingembre P
Cannelle P
Farine P

# MA2 | Pastilla au poulet | weekend | plat:6 | 1-12 | 🥧 | pastilla, bastilla | | maroc
Feuilles de brick 10 pce
Cuisses de poulet 4 pce
Oignons 2 pce
Amandes 100 g
Œufs 4 pce
Beurre 60 g
Persil P
Coriandre P
Cannelle P
Gingembre P
Safran P
Sucre glace P

# MA3 | Tajine de kefta aux œufs | quotidien | pers | 1-12 | 🍳 | kefta, tajine kefta, tajine de kefta | | maroc
Viande hachée 125 g
Tomates concassées 100 g
Œufs 1 pce
Oignons 0.25 pce
Baguette 0.25 pce
Coriandre P
Cumin P
Paprika P

# DZ1 | Chorba frik | quotidien | pers | 10-4 | 🥣 | chorba, chorba frik, chorba algerienne | | algerie
Épaule d’agneau 70 g
Frik 25 g
Pois chiches 40 g
Tomates concassées 80 g
Oignons 0.25 pce
Coriandre P
Menthe P
Cannelle P
Paprika P

# DZ2 | Loubia | quotidien | pers | 1-12 | 🫘 | loubia, haricots blancs a la tomate | | algerie
Haricots blancs 80 g
Tomates concassées 100 g
Oignons 0.25 pce
Ail 1 gousse
Baguette 0.25 pce
Cumin P
Paprika P
Huile d’olive P

# DZ3 | Bourek à la viande | entree | plat:6 | 1-12 | 🥟 | bourek, boureks, bourak | | algerie
Feuilles de brick 12 pce
Viande hachée 300 g
Oignons 1 pce
Fromage râpé 60 g
Œufs 2 pce B
Persil P
Huile de tournesol P

# DZ4 | Dolma de courgettes | quotidien | pers | 5-10 | 🥒 | dolma, dolma courgettes, courgettes farcies algeriennes, farcis |  | algerie
Courgettes 1 pce
Viande hachée 100 g
Riz 20 g
Pois chiches 40 g
Oignons 0.5 pce
Ail 0.5 gousse
Œufs 0.25 pce B
Persil P
Cannelle P
Huile d’olive P

# TN1 | Bricks à l’œuf et au thon | entree | pers | 1-12 | 🥟 | brick, bricks, brick a l oeuf, brick au thon | | tunisie
Feuilles de brick 1 pce
Œufs 1 pce
Thon 30 g
Citrons 0.25 pce
Câpres P
Persil P
Huile de tournesol P

# TN2 | Ojja aux merguez | quotidien | pers | 1-12 | 🍳 | ojja, ojja merguez | | tunisie
Merguez 1.5 pce
Œufs 1.5 pce
Tomates concassées 100 g
Poivrons 0.5 pce
Ail 1 gousse
Baguette 0.25 pce
Harissa P
Cumin P

# TN3 | Chakchouka | quotidien | pers | 5-9 | 🫑 | chakchouka, shakshuka, chakchouka aux oeufs | | tunisie
Poivrons 1 pce
Tomates 1.5 pce
Oignons 0.5 pce
Œufs 1.5 pce
Ail 1 gousse
Cumin P
Harissa P

# FR1 | Coq au vin | weekend | pers | 10-3 | 🍷 | coq au vin | | france
Cuisses de poulet 1 pce H
Vin rouge 15 cl
Lardons 40 g
Champignons 60 g
Carottes 0.5 pce
Oignons 0.25 pce
Beurre 10 g B
Farine P
Bouquet garni P

# FR2 | Navarin d’agneau | weekend | pers | 3-6 | 🐑 | navarin, navarin printanier | paques | france
Épaule d’agneau 200 g
Carottes 1 pce
Navets 1 pce
Petits pois 60 g
Pommes de terre 150 g
Oignons 0.25 pce
Farine P
Bouquet garni P

# FR3 | Steak-frites | quotidien | pers | 1-12 | 🥩 | steak frites, steak frite | | france
Steak 1 pce H
Frites 200 g
Salade 30 g
Moutarde P

# BE1 | Carbonnade flamande | weekend | pers | 10-3 | 🍺 | carbonade, carbonnade, carbonade flamande, carbonnades | | belgique
Bœuf bourguignon 200 g
Bière 15 cl
Oignons 0.5 pce
Pain d’épices 20 g
Frites 200 g
Moutarde P
Cassonade P
Thym P
Laurier P

# BE2 | Waterzooi de poulet | weekend | pers | 10-3 | 🍲 | waterzooi | | belgique
Blanc de poulet 150 g
Poireaux 0.5 pce
Carottes 0.5 pce
Céleri 0.25 pce
Pommes de terre 150 g
Crème fraîche 5 cl
Œufs 0.5 pce B
Bouillon de volaille P

# BE3 | Boulets à la liégeoise | weekend | pers | 1-12 | 🍖 | boulets liegeois, boulets a la liegeoise, boulettes liegeoises | | belgique
Viande hachée 150 g
Sirop de Liège 30 g
Oignons 0.5 pce
Chapelure 15 g
Frites 200 g
Œufs 0.25 pce B
Vinaigre P

# DE1 | Currywurst | quotidien | pers | 1-12 | 🌭 | currywurst | | allemagne
Saucisses 1.5 pce
Ketchup 40 g
Frites 200 g
Curry P

# DE2 | Schnitzel et salade de pommes de terre | quotidien | pers | 1-12 | 🥩 | schnitzel, escalope viennoise, escalope panee | | allemagne
Escalope de dinde 1 pce H
Pommes de terre 200 g
Chapelure 30 g
Citrons 0.25 pce
Œufs 0.5 pce B
Farine P
Cornichons P
Moutarde P

# CI1 | Garba (attiéké et thon) | quotidien | pers | 1-12 | 🐟 | garba, attieke thon, attieke | | cotedivoire
Attiéké 150 g
Thon frais 120 g
Tomates 0.5 pce
Oignons 0.25 pce
Piment P
Huile de tournesol P

# CI2 | Kedjenou de poulet | weekend | pers | 1-12 | 🍗 | kedjenou, kedjenou poulet | | cotedivoire
Cuisses de poulet 1 pce H
Tomates 1 pce
Oignons 0.5 pce
Aubergines 0.25 pce
Ail 1 gousse
Attiéké 100 g
Gingembre P
Piment P
Laurier P

# CI3 | Alloco et poulet braisé | quotidien | pers | 1-12 | 🍌 | alloco, allocos, poulet braise | | cotedivoire
Bananes plantains 1 pce
Cuisses de poulet 1 pce H
Tomates 0.5 pce
Oignons 0.25 pce
Moutarde P
Piment P
Huile de tournesol P

# CD1 | Poulet à la moambé | weekend | pers | 1-12 | 🥜 | moambe, poulet moambe, poulet a la moambe | | congo
Cuisses de poulet 1 pce H
Pâte de noix de palme 80 g
Tomates concassées 60 g
Oignons 0.25 pce
Ail 1 gousse
Riz 70 g
Piment P

# CD2 | Pondu (saka-saka) | weekend | pers | 1-12 | 🥬 | pondu, saka saka, sakasaka | | congo
Feuilles de manioc 150 g
Poisson fumé 60 g
Aubergines 0.25 pce
Oignons 0.25 pce
Ail 1 gousse
Huile de palme 2 cl
Riz 70 g

# SN1 | Poulet yassa | quotidien | pers | 1-12 | 🍋 | yassa, poulet yassa | | senegal
Cuisses de poulet 1 pce H
Oignons 1.5 pce
Citrons 1 pce
Ail 1 gousse
Riz 70 g
Moutarde P
Piment P

# SN2 | Thiéboudienne | weekend | pers | 1-12 | 🐟 | thieboudienne, tieboudienne, tchep, thiep, tieb, ceebu jen, riz au poisson | | senegal
Cabillaud 1 pce H
Riz 80 g
Concentré de tomate 20 g
Carottes 0.5 pce
Chou 0.1 pce
Aubergines 0.25 pce
Oignons 0.25 pce
Ail 1 gousse
Persil P
Piment P

# SN3 | Mafé | weekend | pers | 1-12 | 🥜 | mafe, maffe, sauce arachide | | senegal
Bœuf bourguignon 150 g
Pâte d’arachide 40 g
Tomates concassées 80 g
Carottes 0.5 pce
Patate douce 100 g
Oignons 0.25 pce
Riz 70 g
Piment P

# US1 | Mac and cheese | quotidien | pers | 1-12 | 🧀 | mac and cheese, macaroni cheese, mac n cheese | | usa
Pâtes 90 g
Cheddar 50 g
Fromage râpé 30 g
Lait 15 cl B
Beurre 10 g B
Farine P

# US2 | Brownies | dessert | plat:9 | 1-12 | 🍫 | brownie, brownies | anniversaire | usa
Chocolat pâtissier 200 g
Beurre 150 g
Œufs 3 pce
Noix 60 g
Sucre 150 g P
Farine 80 g P

# US3 | Travers de porc barbecue | weekend | pers | 5-9 | 🍖 | ribs, travers de porc, spare ribs | parents | usa
Travers de porc 300 g
Sauce barbecue 40 g
Maïs 60 g
Pommes de terre 200 g

# UK1 | Fish and chips | quotidien | pers | 1-12 | 🐟 | fish and chips, fish chips, poisson frites | | uk
Cabillaud 1 pce H
Frites 200 g
Bière 10 cl
Petits pois surgelés 60 g
Citrons 0.25 pce
Farine P
Huile de tournesol P

# AR1 | Empanadas | entree | pers | 1-12 | 🥟 | empanada, empanadas | | argentine
Pâte brisée 0.5 rouleau
Viande hachée 80 g
Oignons 0.25 pce
Poivrons 0.25 pce
Œufs 0.5 pce B
Olives P
Cumin P
Paprika P

# BR1 | Feijoada | weekend | pers | 1-12 | 🫘 | feijoada | | bresil
Haricots noirs 80 g
Saucisses 1 pce
Lardons 40 g
Rôti de porc 100 g
Oignons 0.25 pce
Ail 1 gousse
Riz 70 g
Oranges 0.25 pce
Laurier P

# MX1 | Fajitas au poulet | quotidien | pers | 1-12 | 🌮 | fajitas, fajita | | mexique
Blanc de poulet 125 g
Tortillas 2 pce
Poivrons 0.5 pce
Oignons 0.25 pce
Avocat 0.25 pce
Crème fraîche 3 cl
Épices tex-mex P

# VN1 | Nems au porc | entree | pers | 1-12 | 🥢 | nems, nem, pate imperial | nouvelan | vietnam
Galettes de riz 3 pce
Chair à saucisse 60 g
Vermicelles de riz 10 g
Carottes 0.25 pce
Salade 30 g
Œufs 0.25 pce B
Menthe P
Nuoc-mâm P
Huile de tournesol P

# VN2 | Bo bun | quotidien | pers | 1-12 | 🍜 | bo bun, bobun | | vietnam
Steak 1 pce H
Vermicelles de riz 60 g
Salade 30 g
Carottes 0.5 pce
Concombre 0.25 pce
Cacahuètes 15 g
Citron vert 0.25 pce
Menthe P
Coriandre P
Nuoc-mâm P

# IN1 | Poulet tikka masala | quotidien | pers | 1-12 | 🍛 | tikka masala, poulet tikka, butter chicken | | inde
Blanc de poulet 150 g
Yaourts 0.5 pce
Tomates concassées 100 g
Crème liquide 5 cl
Oignons 0.25 pce
Ail 1 gousse
Riz 70 g
Gingembre P
Garam masala P

# TH1 | Pad thaï aux crevettes | quotidien | pers | 1-12 | 🍜 | pad thai, padthai | | thailande
Nouilles de riz 80 g
Crevettes 60 g
Pousses de soja 40 g
Cacahuètes 15 g
Citron vert 0.25 pce
Œufs 1 pce B
Sauce soja P
Nuoc-mâm P
Coriandre P

# ES1 | Tortilla espagnole | quotidien | pers | 1-12 | 🍳 | tortilla espagnole, tortilla de patatas | | espagne
Œufs 1.5 pce
Pommes de terre 150 g
Oignons 0.25 pce
Huile d’olive P

# L01 | Barbecue | liste | pers | 5-9 | 🔥 | barbecue, bbq, barbec, plancha | parents
Merguez 1 pce
Chipolatas 1 pce
Brochettes 1 pce
Baguette 0.25 pce
Chips 30 g
Tomates 1 pce
Salade 40 g
Charbon de bois
Allume-feu P
Moutarde P
Ketchup P

# L02 | Pique-nique | liste | pers | 5-9 | 🧺 | pique nique, picnic, piquenique
Pain de mie 3 tranche
Jambon 1 tranche
Tomates cerises 60 g
Concombre 0.25 pce
Chips 30 g
Comté 40 g
Pommes 1 pce
Eau 50 cl
Œufs 1 pce B

# L03 | Petit-déjeuner | liste | pers | 1-12 | 🥐 | petit dejeuner, petit dej
Baguette 0.25 pce
Croissant 1 pce
Céréales 40 g
Jus d’orange 15 cl
Yaourt nature 1 pot
Confiture
Lait 20 cl B
Beurre 10 g B
Café P
Thé P

# L04 | Goûter | liste | pers | 1-12 | 🍪 | gouter
Biscuits 30 g
Compote 1 pot
Bananes 1 pce
Clémentines 1 pce
Jus de pomme 20 cl

# L05 | Smoothies | liste | pers | 1-12 | 🥤 | smoothie
Bananes 1 pce
Fruits rouges 80 g
Yaourt nature 1 pot
Flocons d’avoine 20 g
Miel P

# L06 | Bébé | liste | pers | 1-12 | 🍼 | bebe, liste bebe, naissance
Couches
Lingettes
Liniment
Lait infantile
Petits pots
Compote bébé
Sérum physiologique
Cotons
`

/** Les formats d'achat (contenance, nom du format, règle d'arrondi) des articles qui se comptent en paquets, pots, boîtes.
 *  sec : format supérieur ; frais : on tolère 10 % de moins ; creme : 25 % de moins (25 cl → 1 pot de 20 cl). */
export const FORMATS = `
spaghetti|500 g|paquet de 500 g|sec
pâtes|500 g|paquet de 500 g|sec
lasagnes|500 g|paquet de 500 g|sec
cannellonis|250 g|boîte de 250 g|sec
riz|1000 g|paquet de 1 kg|sec
riz basmati|1000 g|paquet de 1 kg|sec
riz rond|500 g|paquet de 500 g|sec
riz arborio|500 g|paquet de 500 g|sec
semoule|500 g|paquet de 500 g|sec
lentilles|500 g|paquet de 500 g|sec
haricots blancs|500 g|paquet de 500 g|sec
farine|1000 g|paquet de 1 kg|sec
farine de sarrasin|1000 g|paquet de 1 kg|sec
sucre|1000 g|paquet de 1 kg|sec
cassonade|500 g|paquet de 500 g|sec
lait|100 cl|brique de 1 L|sec
crème fraîche|20 cl|pot de 20 cl|creme
crème liquide|20 cl|brique de 20 cl|sec
beurre|250 g|plaquette de 250 g|sec
tomates concassées|400 g|boîte de 400 g|frais
sauce tomate|400 g|pot de 400 g|frais
coulis de tomate|500 g|brique de 500 g|frais
lait de coco|40 cl|boîte de 40 cl|sec
mascarpone|250 g|pot de 250 g|sec
frites|1000 g|sachet de 1 kg|sec
tortillas|8 pce|paquet de 8|sec
pains burger|4 pce|sachet de 4|sec
pain de mie|16 tranche|paquet|sec
pain|10 tranche|pain|sec
cheddar|10 tranche|paquet de 10 tranches|sec
bacon|10 tranche|paquet|sec
chocolat pâtissier|200 g|tablette de 200 g|sec
chocolat|200 g|tablette de 200 g|sec
pépites de chocolat|100 g|sachet de 100 g|sec
poudre d’amande|125 g|sachet de 125 g|sec
biscuits cuillère|30 pce|paquet|sec
dés de jambon|150 g|barquette de 150 g|frais
olives|150 g|bocal|sec
cornichons|200 g|bocal|sec
thon|100 g|boîte|sec
haricots rouges|250 g|boîte de 400 g|sec
pois chiches|250 g|boîte de 400 g|sec
flageolets|250 g|boîte de 400 g|sec
maïs|285 g|boîte|sec
salade|300 g|salade|frais
échalote|10 pce|sachet|sec
ail|10 gousse|tête|sec
citron confit|6 pce|bocal|sec
chorizo|250 g|pièce|sec
encornets|400 g|sachet|sec
confit de canard|4 pce|boîte de 4 cuisses|sec
marrons|400 g|bocal de 400 g|sec
chapon|3200 g|pièce|sec
lard|250 g|morceau|frais
petits pois surgelés|1000 g|sachet de 1 kg|sec
vin blanc|75 cl|bouteille|sec
vin rouge|75 cl|bouteille|sec
cidre|75 cl|bouteille|sec
jus d’orange|100 cl|brique de 1 L|sec
jus de fruits|100 cl|brique de 1 L|sec
jus de pomme|100 cl|brique de 1 L|sec
eau|900 cl|pack de 6 × 1,5 L|sec
bonbons|200 g|sachet|sec
chips|150 g|paquet|sec
houmous|175 g|pot|sec
fromage|200 g|morceau|sec
fromage frais|150 g|boîte|sec
céréales|400 g|boîte|sec
biscuits|200 g|paquet|sec
compote|4 pce|pack de 4|sec
fruits rouges|500 g|sachet|sec
flocons d’avoine|500 g|paquet|sec
tomate cerise|250 g|barquette de 250 g|frais
saucisses de Toulouse|4 pce|barquette de 4|sec
merguez|6 pce|barquette de 6|sec
chipolatas|6 pce|barquette de 6|sec
brochettes|4 pce|barquette de 4|sec
saucisses de Strasbourg|6 pce|paquet de 6|sec
fruits|150 g|fruit|sec
colin|130 g|filet|sec
huîtres|12 pce|bourriche de 12|sec
saumon fumé|120 g|paquet de 4 tranches|frais
blinis|16 pce|paquet de 16|sec
gnocchis|500 g|paquet de 500 g|sec
crème de marrons|500 g|boîte de 500 g|sec
fraises|250 g|barquette de 250 g|frais
feuilles de brick|10 pce|paquet de 10|sec
galettes de riz|20 pce|paquet de 20|sec
vermicelles de riz|200 g|paquet de 200 g|sec
nouilles de riz|250 g|paquet de 250 g|sec
attiéké|500 g|sachet de 500 g|sec
haricots noirs|250 g|boîte de 400 g|sec
pâte d’arachide|350 g|pot de 350 g|sec
pâte de noix de palme|400 g|boîte de 400 g|sec
feuilles de manioc|500 g|sachet de 500 g|sec
frik|500 g|sachet de 500 g|sec
concentré de tomate|140 g|petite boîte|sec
`

/** Le poids d'une pièce, pour ce qui s'achète au poids (« 1 oignon » → 100 g). */
export const PIECES = `
pomme de terre|150
carotte|125
oignon|100
tomate|120
courgette|250
endive|125
navet|150
pomme|150
poire|150
banane|120
potiron|1500
cuisses de poulet|200
filet mignon|500
clémentine|80
navet|150
bananes plantains|250
`

/** Ce que mange un enfant par rapport à un adulte (GEM-RCN, ANSES) : 3–10 ans ≈ 0,6 ; ado ≈ 0,9 ; un tout-petit, une petite part. */
export const PORTIONS = { adulte: 1, ado: 0.9, enfant: 0.6, bebe: 0.3 }
