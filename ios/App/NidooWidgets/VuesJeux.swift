import AppIntents
import SwiftUI
import WidgetKit

// Les widgets pour jouer : le morpion et le Puissance 4 contre un proche (chacun son tour, depuis son écran d'accueil),
// le memory des animaux (tout seul), et le compagnon de la famille.

/// Ce qu'on dit d'une partie, vu de mon côté.
private func statut(_ etat: Etat, _ p: Etat.Partie, _ adversaire: Etat.Membre?) -> (texte: String, couleur: Color) {
    let nom = adversaire?.n ?? "ton proche"
    if p.fini {
        if p.gagne == etat.moi { return ("Gagné !", Theme.vert) }
        if p.gagne == nil { return ("Égalité", Theme.brume) }
        return ("\(nom) a gagné", Theme.rose)
    }
    if p.tour == etat.moi { return ("À toi de jouer", Theme.violetFonce) }
    return ("Au tour de \(nom)…", Theme.brume)
}

/// Les deux joueurs face à face, chacun avec son signe.
private struct Duel<Signe: View>: View {
    let etat: Etat
    let adversaire: Etat.Membre?
    let partie: Etat.Partie?
    var taille: CGFloat = 38
    @ViewBuilder var signe: (Int) -> Signe

    var body: some View {
        let monCamp = partie?.camp(de: etat.moi) ?? 1
        HStack(spacing: 6) {
            Pastille(m: etat.moiMeme, taille: taille, humeur: false)
            signe(monCamp).frame(width: taille * 0.5, height: taille * 0.5)
            Text("contre").font(rond(11, .semibold)).foregroundStyle(Theme.brume)
            signe(monCamp == 1 ? 2 : 1).frame(width: taille * 0.5, height: taille * 0.5)
            Pastille(m: adversaire, taille: taille, humeur: false)
        }
    }
}

/// Morpion : des cœurs contre des étoiles.
struct VueMorpion: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            let partie = etat.partie("morpion", contre: e.proche)
            let adversaire = partie.flatMap { etat.membre($0.adversaire(de: etat.moi)) } ?? etat.proche(e.proche, avecTelephone: true)
            Group {
                if adversaire == nil {
                    seul
                } else if f == .systemLarge {
                    grand(etat, partie, adversaire)
                } else {
                    moyen(etat, partie, adversaire)
                }
            }
            .bandeau(e)
            .fond(f) { Theme.aurore }
        } else {
            VueVide(e: e, f: f, titre: "Morpion")
        }
    }

    private var seul: some View {
        VStack(spacing: 5) {
            Art("jeu-morpion").frame(width: 54, height: 54)
            Text("Morpion").font(rond(15)).foregroundStyle(Theme.encre)
            Text("Invite un proche dans NIDOO pour jouer").font(rond(11.5, .medium)).foregroundStyle(Theme.brume).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func signe(_ camp: Int) -> some View {
        if camp == 1 { Art("geste-coeur") } else { Art("picto-etoile") }
    }

    @ViewBuilder
    private func caseDe(_ etat: Etat, _ p: Etat.Partie?, _ i: Int, cote: CGFloat) -> some View {
        let valeur = p?.g[sur: i] ?? 0
        let gagnante = p?.ligne?.contains(i) ?? false
        let fond = RoundedRectangle(cornerRadius: cote * 0.24, style: .continuous)
            .fill(gagnante ? Theme.or.opacity(0.35) : Color.white.opacity(p?.der == i ? 1 : 0.86))
            .frame(width: cote, height: cote)
        if valeur == 0, let p, !p.fini, p.tour == etat.moi {
            Button(intent: JouerCoup(id: p.id, c: i)) { fond }.buttonStyle(.plain)
        } else {
            fond.overlay {
                if valeur != 0 {
                    signe(valeur).padding(cote * 0.2).transition(.scale.combined(with: .opacity))
                }
            }
        }
    }

    private func grille(_ etat: Etat, _ p: Etat.Partie?, cote: CGFloat) -> some View {
        let ecart: CGFloat = cote > 200 ? 8 : 5
        let c = (cote - 2 * ecart) / 3
        return VStack(spacing: ecart) {
            ForEach(0..<3, id: \.self) { ligne in
                HStack(spacing: ecart) {
                    ForEach(0..<3, id: \.self) { colonne in
                        caseDe(etat, p, ligne * 3 + colonne, cote: c)
                    }
                }
            }
        }
    }

    /// Le bouton pour lancer une partie (ou la revanche).
    @ViewBuilder
    private func lancer(_ p: Etat.Partie?, _ adversaire: Etat.Membre?) -> some View {
        if let adversaire, p == nil || p?.fini == true {
            Button(intent: LancerPartie(k: "morpion", a: adversaire.id)) {
                Pilule(teinte: Theme.violet) {
                    Text(p == nil ? "Défier \(adversaire.n)" : "Revanche").font(rond(13)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.75)
                }
            }
            .buttonStyle(.plain)
        }
    }

    private func moyen(_ etat: Etat, _ p: Etat.Partie?, _ adversaire: Etat.Membre?) -> some View {
        HStack(spacing: 14) {
            grille(etat, p, cote: 124)
            VStack(alignment: .leading, spacing: 6) {
                Duel(etat: etat, adversaire: adversaire, partie: p, taille: 32) { signe($0) }
                Spacer(minLength: 0)
                if let p {
                    let s = statut(etat, p, adversaire)
                    Text(s.texte).font(rond(15)).foregroundStyle(s.couleur).lineLimit(2).minimumScaleFactor(0.75)
                } else {
                    Text("Morpion").font(rond(15)).foregroundStyle(Theme.encre)
                }
                lancer(p, adversaire)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    private func grand(_ etat: Etat, _ p: Etat.Partie?, _ adversaire: Etat.Membre?) -> some View {
        VStack(spacing: 10) {
            HStack {
                Duel(etat: etat, adversaire: adversaire, partie: p, taille: 40) { signe($0) }
                Spacer(minLength: 0)
            }
            grille(etat, p, cote: 228)
            HStack(spacing: 8) {
                if let p {
                    let s = statut(etat, p, adversaire)
                    Text(s.texte).font(rond(16)).foregroundStyle(s.couleur).lineLimit(1).minimumScaleFactor(0.75)
                } else {
                    Text("Une partie de morpion ?").font(rond(15)).foregroundStyle(Theme.encre)
                }
                Spacer(minLength: 0)
                lancer(p, adversaire).frame(width: 130)
            }
        }
    }
}

/// Puissance 4 : on touche une colonne, le pion tombe.
struct VuePuissance4: View {
    let e: Entree
    let f: WidgetFamily

    private let cote: CGFloat = 36
    private let ecart: CGFloat = 5

    var body: some View {
        if let etat = e.etat {
            let partie = etat.partie("puissance4", contre: e.proche)
            let adversaire = partie.flatMap { etat.membre($0.adversaire(de: etat.moi)) } ?? etat.proche(e.proche, avecTelephone: true)
            VStack(spacing: 7) {
                HStack(spacing: 6) {
                    Duel(etat: etat, adversaire: adversaire, partie: partie, taille: 34) { pion($0) }
                    Spacer(minLength: 0)
                    if let partie {
                        let s = statut(etat, partie, adversaire)
                        Text(s.texte).font(rond(13.5)).foregroundStyle(s.couleur).lineLimit(2).multilineTextAlignment(.trailing).minimumScaleFactor(0.75)
                    }
                }
                plateau(etat, partie)
                if let adversaire, partie == nil || partie?.fini == true {
                    Button(intent: LancerPartie(k: "puissance4", a: adversaire.id)) {
                        Pilule(teinte: Theme.violet) {
                            Text(partie == nil ? "Défier \(adversaire.n) au Puissance 4" : "Revanche").font(rond(13)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.75)
                        }
                    }
                    .buttonStyle(.plain)
                } else if adversaire == nil {
                    Text("Invite un proche dans NIDOO pour jouer").font(rond(11.5, .medium)).foregroundStyle(Theme.brume)
                } else {
                    Text(partie?.tour == etat.moi ? "Touche une colonne pour lâcher ton pion" : "Tu joueras dès qu’il aura joué")
                        .font(rond(11, .semibold))
                        .foregroundStyle(Theme.brume)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            .bandeau(e)
            .fond(f) { Theme.azur }
        } else {
            VueVide(e: e, f: f, titre: "Puissance 4")
        }
    }

    private func pion(_ camp: Int) -> some View {
        Circle()
            .fill(camp == 1 ? Theme.violet : Theme.peche)
            .overlay(Circle().strokeBorder(Color.white.opacity(0.55), lineWidth: 2).padding(3))
    }

    private func plateau(_ etat: Etat, _ p: Etat.Partie?) -> some View {
        let aMoi = p.map { !$0.fini && $0.tour == etat.moi } ?? false
        return HStack(spacing: ecart) {
            ForEach(0..<7, id: \.self) { colonne in
                let pleine = (p?.g[sur: colonne] ?? 0) != 0
                let dessin = VStack(spacing: ecart) {
                    ForEach(0..<6, id: \.self) { ligne in
                        trou(p, ligne * 7 + colonne)
                    }
                }
                if let p, aMoi, !pleine {
                    Button(intent: JouerCoup(id: p.id, c: colonne)) { dessin }.buttonStyle(.plain)
                } else {
                    dessin
                }
            }
        }
        .padding(7)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.violetFonce.opacity(0.16)))
    }

    private func trou(_ p: Etat.Partie?, _ i: Int) -> some View {
        let valeur = p?.g[sur: i] ?? 0
        let gagnant = p?.ligne?.contains(i) ?? false
        return ZStack {
            Circle().fill(Color.white.opacity(0.9))
            if valeur != 0 { pion(valeur).transition(.move(edge: .top).combined(with: .opacity)) }
            if gagnant { Circle().strokeBorder(Theme.or, lineWidth: 3.5) }
            if p?.der == i, !gagnant { Circle().fill(Color.white).frame(width: 7, height: 7) }
        }
        .frame(width: cote, height: cote)
    }
}

/// Memory des animaux : il se joue tout seul, sans réseau.
struct VueMemory: View {
    let e: Entree
    let f: WidgetFamily

    private var colonnes: Int { f == .systemLarge ? 4 : 6 }
    private var lignes: Int { f == .systemLarge ? 5 : 2 }
    private var paires: Int { colonnes * lignes / 2 }

    /// La partie en cours ; dans la galerie des widgets, une partie d'exemple déjà bien avancée.
    private var partie: Memory? {
        if let m = e.local.memory[String(paires)], m.cartes.count == paires * 2 { return m }
        guard e.apercu else { return nil }
        var m = Memory(cartes: (0..<(paires * 2)).map { ($0 * 5 + $0 / 3) % paires })
        var vus: [Int: Int] = [:]
        for (i, a) in m.cartes.enumerated() where a < paires / 2 {
            if let j = vus[a] { m.trouvees += [j, i] } else { vus[a] = i }
        }
        m.coups = paires
        return m
    }

    var body: some View {
        let m = partie
        let visibles = m?.visibles(e.date) ?? []
        VStack(spacing: f == .systemLarge ? 7 : 5) {
            HStack(spacing: 6) {
                Art("jeu-memory").frame(width: 20, height: 20)
                if let m, m.gagne {
                    Text("Bravo ! \(m.coups) coups").font(rond(14)).foregroundStyle(Theme.vert).lineLimit(1)
                } else {
                    Text("Memory").font(rond(14)).foregroundStyle(Theme.encre)
                    if let m, m.coups > 0 { Text("\(m.coups) coups").font(rond(11.5, .semibold)).foregroundStyle(Theme.brume).contentTransition(.numericText()) }
                }
                Spacer(minLength: 0)
                if let record = m?.record { Label("\(record)", systemImage: "trophy.fill").font(rond(11.5)).foregroundStyle(Theme.or) }
                if let m, m.gagne {
                    Button(intent: NouveauMemory(paires: paires)) {
                        Text("Rejouer").font(rond(12)).foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 3).background(Capsule().fill(Theme.violet))
                    }
                    .buttonStyle(.plain)
                }
            }
            ForEach(0..<lignes, id: \.self) { ligne in
                HStack(spacing: f == .systemLarge ? 7 : 5) {
                    ForEach(0..<colonnes, id: \.self) { colonne in
                        carte(m, ligne * colonnes + colonne, visibles: visibles)
                    }
                }
            }
        }
        .fond(f) { Theme.menthe }
    }

    @ViewBuilder
    private func carte(_ m: Memory?, _ i: Int, visibles: [Int]) -> some View {
        let forme = RoundedRectangle(cornerRadius: 11, style: .continuous)
        if let m, visibles.contains(i), let animal = Memory.animaux[sur: m.cartes[sur: i] ?? -1] {
            forme.fill(Color.white)
                .overlay(Art("animal-\(animal)").padding(f == .systemLarge ? 5 : 3))
                .opacity(m.trouvees.contains(i) ? 0.62 : 1)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .transition(.opacity)
        } else {
            Button(intent: RetournerCarte(i: i, paires: paires)) {
                forme.fill(LinearGradient(colors: [Theme.violet, Theme.violetFonce], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay(Image(systemName: "pawprint.fill").font(.system(size: f == .systemLarge ? 20 : 15)).foregroundStyle(Color.white.opacity(0.5)))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .buttonStyle(.plain)
        }
    }
}

/// Le compagnon de la famille : une friandise depuis l'écran d'accueil.
struct VueCompagnon: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            Group {
                if let c = etat.compagnon { compagnon(c) } else { aucun }
            }
            .bandeau(e)
            .fond(f) { Theme.aurore }
            .widgetURL(Partage.lien("maison"))
        } else {
            VueVide(e: e, f: f, titre: "Notre compagnon")
        }
    }

    private var aucun: some View {
        VStack(spacing: 4) {
            Art("pet-panda").frame(height: 56).opacity(0.5)
            Text("Pas encore de compagnon").font(rond(13)).foregroundStyle(Theme.encre).multilineTextAlignment(.center)
            Text("Adoptez-en un dans NIDOO").font(rond(10.5, .medium)).foregroundStyle(Theme.brume).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func compagnon(_ c: Etat.Compagnon) -> some View {
        VStack(spacing: 3) {
            Art("pet-\(c.e)").frame(height: 60)
            HStack(spacing: 5) {
                Text(c.n).font(rond(14.5)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.7)
                HStack(spacing: 2) {
                    Image(systemName: "heart.fill").font(.system(size: 10)).foregroundStyle(Theme.rose)
                    Text("\(c.a)").font(rond(12)).foregroundStyle(Theme.rose).contentTransition(.numericText())
                }
            }
            if c.friandises > 0 {
                Button(intent: DonnerFriandise()) {
                    Pilule {
                        HStack(spacing: 4) {
                            Art("friandises").frame(width: 17, height: 19)
                            Text("Friandise").font(rond(12.5)).foregroundStyle(Theme.encre)
                            Text("×\(c.friandises)").font(rond(11, .semibold)).foregroundStyle(Theme.brume)
                        }
                    }
                }
                .buttonStyle(.plain)
            } else {
                Text("Plus de friandises : passe à la boutique").font(rond(10.5, .medium)).foregroundStyle(Theme.brume).multilineTextAlignment(.center).lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
