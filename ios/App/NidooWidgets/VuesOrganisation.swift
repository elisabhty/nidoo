import AppIntents
import SwiftUI
import WidgetKit

// Les widgets pour s'organiser : les prochaines dates, ce qu'il reste à faire, le sondage du moment, le mur de la famille.

/// Prochaines dates : le compte à rebours, sur l'écran d'accueil comme sur l'écran verrouillé.
struct VueDates: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            Group {
                if let d = etat.dates.first {
                    switch f {
                    case .accessoryInline: Text("\(d.t) · \(Temps.dansTexte(jours(d), court: true))")
                    case .accessoryCircular: cercle(d)
                    case .accessoryRectangular: rectangle(d)
                    case .systemMedium: moyen(etat, d)
                    default: petit(d)
                    }
                } else {
                    rien
                }
            }
            .fond(f) { Theme.azur }
            // toucher : la fiche de cet événement dans l'agenda (Elisa, 21 novembre : « ça nous emmène que rien »)
            .widgetURL(Partage.lien(etat.dates.first.map { "agenda/\($0.id)" } ?? "agenda"))
        } else {
            VueVide(e: e, f: f, titre: "Prochaines dates")
        }
    }

    private func jours(_ d: Etat.Jour) -> Int { max(0, Temps.dans(d.j, depuis: e.date)) }

    private func quand(_ d: Etat.Jour) -> String {
        var texte = Temps.jourCourt(jours(d) == 0 && d.j != d.f ? d.f : d.j)
        if jours(d) == 0, d.j != d.f { texte = "jusqu’au " + texte }
        if let h = d.h { texte += " · " + h.replacingOccurrences(of: ":", with: " h ") }
        return texte
    }

    @ViewBuilder
    private var rien: some View {
        switch f {
        case .accessoryInline: Text("Rien de prévu")
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "calendar").font(.system(size: 22, weight: .semibold))
            }
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("Rien de prévu").font(.headline)
                Text("Ajoute une date dans NIDOO").font(.caption)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            VStack(spacing: 6) {
                Art("picto-agenda").frame(width: 52, height: 52)
                Text("Rien de prévu").font(rond(15)).foregroundStyle(Theme.encre)
                Text("Ajoute une date dans NIDOO").font(rond(11.5, .medium)).foregroundStyle(Theme.brume).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    /// Le compte à rebours : un grand chiffre, ou « Auj. » le jour même.
    private func compte(_ d: Etat.Jour, taille: CGFloat) -> some View {
        let n = jours(d)
        return VStack(alignment: .trailing, spacing: -3) {
            if n == 0 {
                Text("C’est").font(rond(10.5, .semibold)).foregroundStyle(Theme.brume)
                Text("auj.").font(rond(taille * 0.72)).foregroundStyle(Theme.violetFonce)
            } else {
                Text("\(n)").font(rond(taille)).foregroundStyle(Theme.violetFonce).contentTransition(.numericText())
                Text(n == 1 ? "jour" : "jours").font(rond(10.5, .semibold)).foregroundStyle(Theme.brume)
            }
        }
    }

    private func petit(_ d: Etat.Jour) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .top) {
                Art(Mots.art(date: d.k)).frame(width: 44, height: 44)
                Spacer(minLength: 0)
                compte(d, taille: 34)
            }
            Spacer(minLength: 0)
            Text(d.t).font(rond(15)).foregroundStyle(Theme.encre).lineLimit(2).minimumScaleFactor(0.8)
            Text(quand(d)).font(rond(11.5, .semibold)).foregroundStyle(Theme.brume).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func moyen(_ etat: Etat, _ d: Etat.Jour) -> some View {
        HStack(spacing: 12) {
            petit(d).frame(width: 126)
            VStack(spacing: 6) {
                let suite = Array(etat.dates.dropFirst().prefix(3))
                if suite.isEmpty {
                    Text("Rien d’autre de prévu").font(rond(12, .medium)).foregroundStyle(Theme.brume)
                }
                ForEach(suite) { s in
                    HStack(spacing: 8) {
                        VStack(spacing: -2) {
                            Text(Temps.numero(s.j)).font(rond(15)).foregroundStyle(Theme.violetFonce)
                            Text(Temps.mois(s.j)).font(rond(9, .semibold)).foregroundStyle(Theme.brume)
                        }
                        .frame(width: 30)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(s.t).font(rond(12.5, .semibold)).foregroundStyle(Theme.encre).lineLimit(1)
                            Text(Temps.dansTexte(max(0, Temps.dans(s.j, depuis: e.date)))).font(rond(10.5, .medium)).foregroundStyle(Theme.brume)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.85)))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    /// Le rond de l'écran verrouillé : de quoi il s'agit (l'icône et le nom), et quand (« Demain », « J-5 »).
    private func cercle(_ d: Etat.Jour) -> some View {
        let n = jours(d)
        return ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: Self.icone(d.k)).font(.system(size: 12, weight: .bold))
                Text(n == 0 ? "Auj." : n == 1 ? "Demain" : "J-\(n)")
                    .font(.system(size: n == 1 ? 13 : 17, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(Self.nomCourt(d))
                    .font(.system(size: 8.5, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .opacity(0.85)
            }
            .padding(.horizontal, 7)
        }
    }

    /// Un anniversaire : le prénom suffit (le gâteau dit déjà que c'est un anniversaire).
    static func nomCourt(_ d: Etat.Jour) -> String {
        guard d.k == "anniversaire" else { return d.t }
        for p in ["Anniversaire de ", "Anniversaire d’", "Anniversaire d'"] where d.t.hasPrefix(p) {
            return String(d.t.dropFirst(p.count))
        }
        return d.t
    }

    static func icone(_ k: String) -> String {
        switch k {
        case "anniversaire": return "birthday.cake.fill"
        case "rdv": return "mappin.and.ellipse"
        default: return "party.popper.fill"
        }
    }

    private func rectangle(_ d: Etat.Jour) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Label(d.t, systemImage: Self.icone(d.k))
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .lineLimit(1)
            Text(Temps.dansTexte(jours(d))).font(.system(size: 13, weight: .semibold, design: .rounded))
            Text(quand(d)).font(.system(size: 12, weight: .regular, design: .rounded)).opacity(0.75).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Une case à cocher ronde ; cochée, la ligne se raye tout de suite (avant même la réponse du serveur).
struct CaseACocher: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(configuration.isOn ? Theme.vert : Theme.violet.opacity(0.6))
            configuration.label
                .strikethrough(configuration.isOn)
                .opacity(configuration.isOn ? 0.45 : 1)
        }
    }
}

/// À faire : la liste de la maison, à cocher sans ouvrir l'appli.
struct VueAFaire: View {
    let e: Entree
    let f: WidgetFamily

    private var titre: String { e.liste == "courses" ? "Courses" : e.liste == "tout" ? "À faire et à acheter" : "À faire" }

    var body: some View {
        if let etat = e.etat {
            let choses = etat.choses(e.liste)
            let place = f == .systemLarge ? 10 : 4
            let trop = f == .systemLarge && choses.count > place
            VStack(alignment: .leading, spacing: f == .systemLarge ? 7 : 4) {
                HStack(spacing: 6) {
                    Art(e.liste == "courses" ? "picto-courses" : "picto-missions").frame(width: 20, height: 20)
                    Text(titre).font(rond(14.5)).foregroundStyle(Theme.encre).lineLimit(1)
                    Spacer(minLength: 0)
                    if !choses.isEmpty {
                        Text("\(choses.count)")
                            .font(rond(12))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 1.5)
                            .background(Capsule().fill(Theme.violet))
                            .contentTransition(.numericText())
                    }
                }
                if choses.isEmpty {
                    VStack(spacing: 3) {
                        Image(systemName: "checkmark.seal.fill").font(.system(size: 30)).foregroundStyle(Theme.vert)
                        Text("Tout est fait !").font(rond(14)).foregroundStyle(Theme.encre)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ForEach(Array(choses.prefix(trop ? place - 1 : place))) { c in ligne(etat, c) }
                    if trop {
                        Text("+ \(choses.count - place + 1) autres dans NIDOO").font(rond(11, .semibold)).foregroundStyle(Theme.brume)
                    }
                    Spacer(minLength: 0)
                }
            }
            .bandeau(e)
            .fond(f) { Theme.menthe }
            .widgetURL(Partage.lien(e.liste == "courses" ? "courses" : e.liste == "tout" ? "organiser" : "afaire"))
        } else {
            VueVide(e: e, f: f, titre: "À faire")
        }
    }

    private func ligne(_ etat: Etat, _ c: Etat.Chose) -> some View {
        HStack(spacing: 6) {
            Toggle(isOn: false, intent: CocherTache(id: c.id)) {
                Text(c.t).font(rond(13.5, .semibold)).foregroundStyle(Theme.encre).lineLimit(1)
            }
            .toggleStyle(CaseACocher())
            Spacer(minLength: 0)
            if let p = etat.membre(c.p) {
                Pastille(m: p, taille: 20, humeur: false)
            }
        }
    }
}

/// Le sondage du moment : on vote d'un toucher, les barres bougent.
struct VueSondage: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            Group {
                if let s = etat.sondage { sondage(etat, s) } else { rien }
            }
            .bandeau(e)
            .fond(f) { Theme.lavande }
            .widgetURL(Partage.lien("fil"))
        } else {
            VueVide(e: e, f: f, titre: "Sondage")
        }
    }

    private var rien: some View {
        VStack(spacing: 5) {
            Art("picto-bulle").frame(width: 46, height: 46)
            Text("Pas de sondage en ce moment").font(rond(14)).foregroundStyle(Theme.encre)
            Text("Lance-en un dans le fil de la famille").font(rond(11.5, .medium)).foregroundStyle(Theme.brume)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func sondage(_ etat: Etat, _ s: Etat.Sondage) -> some View {
        // jusqu'à 4 choix tiennent ; au-delà, les 3 premiers et un renvoi vers l'appli
        let place = s.choix.count <= 4 ? s.choix.count : 3
        let serre = s.choix.count >= 4
        let total = max(1, s.voix.reduce(0, +))
        return VStack(alignment: .leading, spacing: serre ? 3.5 : 5) {
            HStack(spacing: 7) {
                Pastille(m: etat.membre(s.de), taille: serre ? 20 : 24, humeur: false)
                Text(s.q?.isEmpty == false ? s.q! : "Sondage").font(rond(14)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.8)
            }
            ForEach(Array(s.choix.prefix(place).enumerated()), id: \.offset) { i, choix in
                let voix = s.voix[sur: i] ?? 0
                let part = CGFloat(voix) / CGFloat(total)
                Button(intent: Voter(id: s.id, c: i)) {
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 11, style: .continuous).fill(Color.white.opacity(0.85))
                        GeometryReader { g in
                            RoundedRectangle(cornerRadius: 11, style: .continuous)
                                .fill((s.moi == i ? Theme.violet : Theme.violet.opacity(0.45)).opacity(0.38))
                                .frame(width: max(voix > 0 ? 22 : 0, g.size.width * part))
                        }
                        HStack(spacing: 5) {
                            if s.moi == i { Image(systemName: "checkmark.circle.fill").font(.system(size: 13)).foregroundStyle(Theme.violetFonce) }
                            Text(choix).font(rond(12.5, .semibold)).foregroundStyle(Theme.encre).lineLimit(1)
                            Spacer(minLength: 2)
                            Text("\(voix)").font(rond(12.5)).foregroundStyle(Theme.violetFonce).contentTransition(.numericText())
                        }
                        .padding(.horizontal, 9)
                    }
                    .frame(height: serre ? 22 : 26)
                }
                .buttonStyle(.plain)
            }
            if s.choix.count > place {
                Text("+ \(s.choix.count - place) autres choix dans NIDOO").font(rond(10.5, .semibold)).foregroundStyle(Theme.brume)
            }
            Spacer(minLength: 0)
        }
    }
}

/// Le mur de la famille : toute la maison d'un coup d'œil.
struct VueMur: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            // peu de monde, peu de cartes : tout grandit un peu et l'espace qui reste se répartit, au lieu d'un grand
            // vide au milieu (Elisa, 21 novembre : « problème d'espace »)
            let liste = Array(cartes(etat).prefix(4))
            let gens = Array(etat.membres.prefix(5))
            let large = liste.count <= 3
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    Art("maison-\(etat.famille.m)").frame(width: 58, height: 58)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(etat.famille.n).font(rond(19)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.7)
                        HStack(spacing: 4) {
                            Art("picto-etoile").frame(width: 15, height: 15)
                            Text("\(etat.famille.e) étoiles").font(rond(12.5, .semibold)).foregroundStyle(Theme.violetFonce)
                        }
                    }
                    Spacer(minLength: 0)
                }
                Spacer(minLength: 0)
                HStack(alignment: .top, spacing: 2) {
                    ForEach(gens) { m in
                        VStack(spacing: 3) {
                            Pastille(m: m, taille: gens.count <= 3 ? 54 : 46)
                            Text(m.id == etat.moi ? "Moi" : m.n).font(rond(gens.count <= 3 ? 12 : 10.5, .semibold)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.75)
                        }
                        .frame(maxWidth: gens.count <= 3 ? 96 : .infinity)
                    }
                }
                .frame(maxWidth: .infinity)
                Spacer(minLength: 0)
                VStack(spacing: 8) {
                    ForEach(liste) { c in
                        Link(destination: Partage.lien(c.ou)) {
                            carte(titre: c.titre, sous: c.sous, large: large) { Art(c.art) }
                        }
                    }
                }
            }
            .fond(f) { Theme.lavande }
            .widgetURL(Partage.lien("maison"))
        } else {
            VueVide(e: e, f: f, titre: "Le mur de la famille")
        }
    }

    private struct Carte: Identifiable {
        let id: String
        let art: String
        let titre: String
        let sous: String
        let ou: String
    }

    /// Ce qui compte en ce moment, le plus pressant d'abord.
    private func cartes(_ etat: Etat) -> [Carte] {
        var c: [Carte] = []
        if let r = etat.recues.first, let de = etat.membre(r.de) {
            c.append(Carte(id: "attention", art: "geste-\(r.k)", titre: "\(de.n) \(Mots.dit(r.k))", sous: Temps.ilYA(r.q, depuis: e.date), ou: "recus"))
        }
        if let p = etat.parties.first(where: { !$0.fini && $0.tour == etat.moi }) {
            let nom = etat.membre(p.adversaire(de: etat.moi))?.n ?? "un proche"
            c.append(Carte(id: "jeu", art: p.k == "morpion" ? "jeu-morpion" : "jeu-puissance4", titre: "À toi de jouer", sous: (p.k == "morpion" ? "Morpion" : "Puissance 4") + " contre \(nom)", ou: "maison"))
        }
        if let d = etat.dates.first {
            c.append(Carte(id: "date", art: Mots.art(date: d.k), titre: d.t, sous: Temps.dansTexte(max(0, Temps.dans(d.j, depuis: e.date))) + " · " + Temps.jourCourt(d.j), ou: "organiser"))
        }
        let taches = etat.choses("taches")
        if let premiere = taches.first {
            c.append(Carte(id: "taches", art: "picto-missions", titre: taches.count == 1 ? "1 chose à faire" : "\(taches.count) choses à faire", sous: premiere.t, ou: "organiser"))
        }
        if let s = etat.sondage, s.moi == nil {
            c.append(Carte(id: "sondage", art: "picto-bulle", titre: s.q?.isEmpty == false ? s.q! : "Un sondage t’attend", sous: "Donne ton avis", ou: "fil"))
        }
        let courses = etat.choses("courses")
        if let premiere = courses.first {
            c.append(Carte(id: "courses", art: "picto-courses", titre: courses.count == 1 ? "1 course à faire" : "\(courses.count) courses à faire", sous: premiere.t, ou: "organiser"))
        }
        if c.isEmpty {
            c.append(Carte(id: "calme", art: "picto-etoile", titre: "Tout est calme à la maison", sous: "Envoie une attention à un proche", ou: "maison"))
        }
        return c
    }

    /// Une carte : elle s'étire (jusqu'à une hauteur raisonnable) pour occuper la place quand il y en a peu.
    private func carte<Icone: View>(titre: String, sous: String, large: Bool, @ViewBuilder icone: () -> Icone) -> some View {
        HStack(spacing: large ? 11 : 9) {
            icone().frame(width: large ? 36 : 30, height: large ? 36 : 30)
            VStack(alignment: .leading, spacing: large ? 1 : 0) {
                Text(titre).font(rond(large ? 14.5 : 13, .bold)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.8)
                Text(sous).font(rond(large ? 12 : 11, .medium)).foregroundStyle(Theme.brume).lineLimit(1)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: large ? 12 : 11, weight: .bold)).foregroundStyle(Theme.brume.opacity(0.6))
        }
        .padding(.horizontal, large ? 12 : 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, minHeight: 44, maxHeight: large ? 64 : 52)
        .background(RoundedRectangle(cornerRadius: large ? 18 : 16, style: .continuous).fill(Color.white.opacity(0.88)))
    }
}
