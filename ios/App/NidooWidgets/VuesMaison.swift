import AppIntents
import SwiftUI
import WidgetKit

// Notre maison (Elisa, 21 novembre : « il n'y a pas la maison en widget ») : la maison de la famille dans son décor
// du moment (le jour, le soir, la nuit), et toute la famille devant, en pied, chacun avec son humeur — comme dans
// l'appli. Toucher un proche lui dit « je pense à toi » ; toucher la maison ouvre l'appli sur la maison.

/// Le décor : le ciel selon l'heure, le soleil ou la lune, l'herbe.
struct Decor: View {
    let date: Date

    private var heure: Int { Calendar.current.component(.hour, from: date) }
    private var nuit: Bool { heure < 7 || heure >= 21 }
    private var soir: Bool { heure >= 18 && heure < 21 }

    var body: some View {
        GeometryReader { g in
            ZStack {
                LinearGradient(
                    colors: nuit ? [Color(hex: 0x2A2F6E), Color(hex: 0x5A4E9C)]
                        : soir ? [Color(hex: 0xFFC6A5), Color(hex: 0xF9DDEB)]
                        : [Color(hex: 0xBFDDFF), Color(hex: 0xEAF4FF)],
                    startPoint: .top, endPoint: .bottom)
                // le soleil ou la lune, en haut à droite
                Circle()
                    .fill(nuit ? Color(hex: 0xFFF4C9) : soir ? Color(hex: 0xFFB37A) : Color(hex: 0xFFE27A))
                    .frame(width: g.size.height * 0.2, height: g.size.height * 0.2)
                    .shadow(color: (nuit ? Color.white : Color(hex: 0xFFD25A)).opacity(0.7), radius: 14)
                    .position(x: g.size.width * 0.84, y: g.size.height * 0.18)
                if nuit {
                    ForEach(0..<9, id: \.self) { i in
                        Circle().fill(Color.white.opacity(0.75))
                            .frame(width: i % 3 == 0 ? 2.6 : 1.8, height: i % 3 == 0 ? 2.6 : 1.8)
                            .position(x: g.size.width * CGFloat([0.08, 0.2, 0.33, 0.47, 0.58, 0.68, 0.14, 0.4, 0.62][i]),
                                      y: g.size.height * CGFloat([0.12, 0.3, 0.08, 0.22, 0.1, 0.32, 0.45, 0.4, 0.42][i]))
                    }
                }
                // l'herbe
                Ellipse()
                    .fill(LinearGradient(colors: nuit ? [Color(hex: 0x4E7A5C), Color(hex: 0x3B5F48)] : [Color(hex: 0xCFEBC4), Color(hex: 0xA9D69C)], startPoint: .top, endPoint: .bottom))
                    .frame(width: g.size.width * 1.6, height: g.size.height * 0.62)
                    .position(x: g.size.width * 0.5, y: g.size.height * 1.02)
            }
        }
    }
}

enum Pied {
    /// Le personnage d'un proche en entier, photographié par l'appli (ou d'exemple dans la galerie).
    static func image(_ m: Etat.Membre) -> Image? {
        if m.a.hasPrefix("exemple:") { return Image("pied-" + String(m.a.dropFirst(8))) }
        if let ui = UIImage(contentsOfFile: Partage.fichierPerso("pied-" + m.id).path) { return Image(uiImage: ui) }
        return nil
    }
}

/// Un proche debout devant la maison, son humeur au-dessus de la tête. Le toucher lui envoie « je pense à toi ».
struct Habitant: View {
    let e: Entree
    let m: Etat.Membre
    let moi: String
    let hauteur: CGFloat

    var body: some View {
        let dessin = VStack(spacing: -hauteur * 0.06) {
            ZStack {
                if e.local.vientDEnvoyer(a: m.id, date: e.date) {
                    Art("geste-coeur")
                } else if let h = m.h {
                    Art("humeur-\(h)")
                        .padding(2)
                        .background(Circle().fill(Color.white).shadow(color: .black.opacity(0.12), radius: 2, y: 1))
                }
            }
            .frame(width: hauteur * 0.3, height: hauteur * 0.3)
            Group {
                if let image = Pied.image(m) {
                    image.resizable().couleurs().scaledToFit()
                } else {
                    Pastille(m: m, taille: hauteur * 0.55, humeur: false)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                }
            }
            .frame(height: hauteur)
            .shadow(color: .black.opacity(0.12), radius: 2, y: 2)
        }
        if m.id == moi {
            dessin
        } else {
            Button(intent: EnvoyerAttention(a: m.id, k: "coeur")) { dessin }.buttonStyle(.plain)
        }
    }
}

struct VueMaison: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            Group {
                switch f {
                case .systemSmall: petit(etat)
                case .systemLarge: grand(etat)
                default: moyen(etat)
                }
            }
            .bandeau(e)
            .fond(f) { Decor(date: e.date) }
            .widgetURL(Partage.lien("maison"))
        } else {
            VueVide(e: e, f: f, titre: "Notre maison")
        }
    }

    private func nom(_ etat: Etat, taille: CGFloat) -> some View {
        HStack(spacing: 4) {
            Text(etat.famille.n).font(rond(taille)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.7)
            Art("picto-etoile").frame(width: taille, height: taille)
            Text("\(etat.famille.e)").font(rond(taille - 1.5)).foregroundStyle(Theme.violetFonce)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Capsule().fill(Color.white.opacity(0.92)).shadow(color: Theme.violetFonce.opacity(0.15), radius: 3, y: 1))
    }

    /// La maison et, devant, la famille de part et d'autre de la porte.
    private func scene(_ etat: Etat, maison: CGFloat, perso: CGFloat, nombre: Int) -> some View {
        let gens = Array(etat.membres.prefix(nombre))
        let gauche = Array(gens.enumerated().filter { $0.offset % 2 == 0 }.map(\.element))
        let droite = Array(gens.enumerated().filter { $0.offset % 2 == 1 }.map(\.element))
        return HStack(alignment: .bottom, spacing: -perso * 0.12) {
            HStack(alignment: .bottom, spacing: -perso * 0.16) {
                ForEach(Array(gauche.reversed())) { m in Habitant(e: e, m: m, moi: etat.moi, hauteur: perso) }
            }
            Art("maison-\(etat.famille.m)")
                .frame(width: maison, height: maison)
                .padding(.bottom, -maison * 0.07)
            HStack(alignment: .bottom, spacing: -perso * 0.16) {
                ForEach(droite) { m in Habitant(e: e, m: m, moi: etat.moi, hauteur: perso) }
            }
        }
    }

    private func petit(_ etat: Etat) -> some View {
        VStack(spacing: 4) {
            Text(etat.famille.n)
                .font(rond(12.5))
                .foregroundStyle(Theme.encre)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.horizontal, 9)
                .padding(.vertical, 3)
                .background(Capsule().fill(Color.white.opacity(0.9)))
            Spacer(minLength: 0)
            ZStack(alignment: .bottom) {
                Art("maison-\(etat.famille.m)").frame(width: 112, height: 112)
                HStack(alignment: .bottom, spacing: -10) {
                    ForEach(Array(etat.membres.prefix(3))) { m in Habitant(e: e, m: m, moi: etat.moi, hauteur: 50) }
                }
                .offset(y: 6)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func moyen(_ etat: Etat) -> some View {
        VStack(spacing: 2) {
            HStack {
                nom(etat, taille: 13)
                Spacer(minLength: 0)
            }
            Spacer(minLength: 0)
            scene(etat, maison: 112, perso: 66, nombre: 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func grand(_ etat: Etat) -> some View {
        VStack(spacing: 8) {
            HStack {
                nom(etat, taille: 15)
                Spacer(minLength: 0)
            }
            Spacer(minLength: 0)
            scene(etat, maison: 178, perso: 92, nombre: 6)
            Spacer(minLength: 0)
            ligne(etat)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// En bas du grand widget : la dernière attention reçue, sinon la prochaine date, sinon un petit mot.
    @ViewBuilder
    private func ligne(_ etat: Etat) -> some View {
        let contenu: (art: String, texte: String) = {
            if let r = etat.recues.first, let de = etat.membre(r.de) { return ("geste-\(r.k)", "\(de.n) \(Mots.dit(r.k))") }
            if let d = etat.dates.first { return (Mots.art(date: d.k), "\(d.t) · \(Temps.dansTexte(max(0, Temps.dans(d.j, depuis: e.date))))") }
            return ("geste-coeur", "Touche un proche : « je pense à toi »")
        }()
        HStack(spacing: 8) {
            Art(contenu.art).frame(width: 24, height: 24)
            Text(contenu.texte).font(rond(13, .semibold)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 7)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.9)))
    }
}
