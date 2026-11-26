import AppIntents
import SwiftUI
import UIKit
import WidgetKit

// Les widgets de tendresse : un bisou d'un geste, les attentions reçues, la famille, l'humeur du jour.

/// Bisou express : un proche, un bouton.
struct VueBisou: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat, let p = etat.proche(e.proche, avecTelephone: true) {
            Group {
                if f == .accessoryCircular { cercle(p) } else { carre(etat, p) }
            }
            .fond(f) { Theme.degrade(proche: p) }
        } else {
            VueVide(e: e, f: f, titre: "Bisou express")
        }
    }

    private func carre(_ etat: Etat, _ p: Etat.Membre) -> some View {
        let envoye = e.local.vientDEnvoyer(a: p.id, date: e.date)
        return VStack(spacing: 5) {
            Pastille(m: p, taille: 60)
            Text(p.n)
                .font(rond(15))
                .foregroundStyle(Theme.encre)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if envoye {
                Pilule(teinte: Theme.rose) {
                    Label("Envoyé", systemImage: "heart.fill")
                        .font(rond(13.5))
                        .foregroundStyle(.white)
                }
                .transition(.scale.combined(with: .opacity))
            } else {
                Button(intent: EnvoyerAttention(a: p.id, k: "bisou")) {
                    Pilule {
                        HStack(spacing: 5) {
                            Art("geste-bisou").frame(width: 22, height: 18)
                            Text("Bisou").font(rond(14)).foregroundStyle(Theme.encre)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .bandeau(e)
    }

    /// Sur l'écran verrouillé : le bisou d'un seul toucher.
    private func cercle(_ p: Etat.Membre) -> some View {
        let envoye = e.local.vientDEnvoyer(a: p.id, date: e.date)
        return Button(intent: EnvoyerAttention(a: p.id, k: "bisou")) {
            ZStack {
                AccessoryWidgetBackground()
                // « Bisou » écrit dessus (Elisa, 21 novembre : « ça veut dire quoi ? »), puis « Envoyé »
                VStack(spacing: 0) {
                    Image(systemName: envoye ? "checkmark" : "heart.fill").font(.system(size: 15, weight: .bold))
                    Text(envoye ? "Envoyé" : "Bisou").font(.system(size: 9, weight: .heavy, design: .rounded)).textCase(.uppercase).lineLimit(1).minimumScaleFactor(0.6)
                    Text(p.n).font(.system(size: 10, weight: .semibold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
                }
                .padding(.horizontal, 6)
            }
        }
        .buttonStyle(.plain)
    }
}

/// Attentions : la dernière reçue, et de quoi répondre.
struct VueAttentions: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            let cible = etat.proche(e.proche, avecTelephone: true)
            HStack(spacing: 12) {
                recue(etat)
                if let cible { reponse(cible) }
            }
            .bandeau(e)
            .fond(f) { Theme.aurore }
            .widgetURL(Partage.lien("recus"))
        } else {
            VueVide(e: e, f: f, titre: "Attentions")
        }
    }

    @ViewBuilder
    private func recue(_ etat: Etat) -> some View {
        if let r = etat.recues.first, let de = etat.membre(r.de) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Pastille(m: de, taille: 46)
                    Art("geste-\(r.k)").frame(width: 38, height: 38)
                }
                Spacer(minLength: 0)
                Text(de.n).font(rond(15)).foregroundStyle(Theme.encre).lineLimit(1)
                Text(Mots.dit(r.k)).font(rond(12, .medium)).foregroundStyle(Theme.brume).lineLimit(1).minimumScaleFactor(0.8)
                Text(Temps.ilYA(r.q, depuis: e.date)).font(rond(11, .semibold)).foregroundStyle(Theme.violetFonce)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Art("geste-coeur").frame(width: 40, height: 40)
                Spacer(minLength: 0)
                Text("Pas encore d’attention").font(rond(14)).foregroundStyle(Theme.encre).lineLimit(2)
                Text("Envoie la première !").font(rond(12, .medium)).foregroundStyle(Theme.brume)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    private func reponse(_ cible: Etat.Membre) -> some View {
        VStack(spacing: 5) {
            ForEach(0..<2, id: \.self) { ligne in
                HStack(spacing: 5) {
                    ForEach(0..<2, id: \.self) { colonne in
                        geste(Mots.gestes[ligne * 2 + colonne], cible)
                    }
                }
            }
            Text("pour \(cible.n)").font(rond(10.5, .semibold)).foregroundStyle(Theme.brume).lineLimit(1)
        }
        .frame(width: 124)
    }

    private func geste(_ k: String, _ cible: Etat.Membre) -> some View {
        let envoye = e.local.vientDEnvoyer(a: cible.id, k: k, date: e.date)
        return Button(intent: EnvoyerAttention(a: cible.id, k: k)) {
            ZStack {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .fill(envoye ? Theme.rose.opacity(0.9) : Color.white.opacity(0.92))
                if envoye {
                    Image(systemName: "checkmark").font(.system(size: 20, weight: .heavy)).foregroundStyle(.white)
                } else {
                    Art("geste-\(k)").padding(8)
                }
            }
            .frame(width: 59.5, height: 50)
        }
        .buttonStyle(.plain)
    }
}

/// Ma famille : tout le monde, avec son humeur ; toucher quelqu'un lui dit « je pense à toi ».
struct VueFamille: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            Group {
                if f == .systemLarge { grand(etat) } else { moyen(etat) }
            }
            .bandeau(e)
            .fond(f) { Theme.lavande }
        } else {
            VueVide(e: e, f: f, titre: "Ma famille")
        }
    }

    private func entete(_ etat: Etat) -> some View {
        HStack(spacing: 5) {
            Text(etat.famille.n).font(rond(15)).foregroundStyle(Theme.encre).lineLimit(1)
            Spacer(minLength: 4)
            Art("picto-etoile").frame(width: 15, height: 15)
            Text("\(etat.famille.e)").font(rond(13)).foregroundStyle(Theme.violetFonce)
        }
    }

    private func pied(_ etat: Etat) -> some View {
        let envoi = e.local.envoi.flatMap { e.local.vientDEnvoyer(a: $0.a, date: e.date) ? etat.membre($0.a) : nil }
        return Group {
            if let envoi {
                Label("Envoyé à \(envoi.n)", systemImage: "heart.fill").foregroundStyle(Theme.rose)
            } else {
                Text("Touche un proche : « je pense à toi »").foregroundStyle(Theme.brume)
            }
        }
        .font(rond(11, .semibold))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    @ViewBuilder
    private func personne(_ etat: Etat, _ m: Etat.Membre, taille: CGFloat) -> some View {
        let dessin = VStack(spacing: 3) {
            Pastille(m: m, taille: taille)
                .overlay(alignment: .topTrailing) {
                    if e.local.vientDEnvoyer(a: m.id, date: e.date) {
                        Art("geste-coeur").frame(width: taille * 0.42, height: taille * 0.42).offset(x: 4, y: -4)
                    }
                }
            Text(m.id == etat.moi ? "Moi" : m.n)
                .font(rond(11, .semibold))
                .foregroundStyle(Theme.encre)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity)
        // soi-même, ou un proche sans téléphone (il ne verrait pas le « je pense à toi ») : juste sa tête
        if m.id == etat.moi || !m.tel {
            dessin
        } else {
            Button(intent: EnvoyerAttention(a: m.id, k: "coeur")) { dessin }.buttonStyle(.plain)
        }
    }

    private func moyen(_ etat: Etat) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            entete(etat)
            HStack(alignment: .top, spacing: 2) {
                ForEach(Array(etat.membres.prefix(5))) { m in personne(etat, m, taille: 48) }
            }
            .frame(maxHeight: .infinity)
            pied(etat)
        }
    }

    private func grand(_ etat: Etat) -> some View {
        let membres = Array(etat.membres.prefix(8))
        let rangees = stride(from: 0, to: membres.count, by: 4).map { Array(membres[$0..<min($0 + 4, membres.count)]) }
        return VStack(alignment: .leading, spacing: 9) {
            entete(etat)
            ForEach(rangees.indices, id: \.self) { i in
                HStack(alignment: .top, spacing: 2) {
                    ForEach(rangees[i]) { m in personne(etat, m, taille: 54) }
                    if rangees[i].count < 4 {
                        ForEach(0..<(4 - rangees[i].count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity, maxHeight: 1) }
                    }
                }
            }
            pied(etat)
            Spacer(minLength: 0)
            VStack(spacing: 6) {
                ForEach(Array(etat.recues.prefix(rangees.count > 1 ? 3 : 4))) { r in
                    HStack(spacing: 8) {
                        Pastille(m: etat.membre(r.de), taille: 28, humeur: false)
                        Text("\(etat.membre(r.de)?.n ?? "Un proche") \(Mots.dit(r.k))")
                            .font(rond(12.5, .semibold))
                            .foregroundStyle(Theme.encre)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Spacer(minLength: 2)
                        Art("geste-\(r.k)").frame(width: 20, height: 20)
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.85)))
                }
            }
        }
    }
}

/// Mon humeur : la dire à la famille d'un toucher.
struct VueHumeur: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat {
            let mienne = etat.moiMeme?.h
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Comment tu te sens ?").font(rond(14)).foregroundStyle(Theme.encre)
                    Spacer(minLength: 0)
                    if mienne != nil {
                        Label("La famille le voit", systemImage: "checkmark.circle.fill")
                            .font(rond(10.5, .semibold))
                            .foregroundStyle(Theme.vert)
                    }
                }
                ForEach(0..<2, id: \.self) { ligne in
                    HStack(spacing: 5) {
                        ForEach(0..<4, id: \.self) { colonne in
                            bouton(Mots.humeurs[ligne * 4 + colonne], choisie: mienne)
                        }
                    }
                }
            }
            .bandeau(e)
            .fond(f) { Theme.miel }
        } else {
            VueVide(e: e, f: f, titre: "Mon humeur")
        }
    }

    private func bouton(_ h: (cle: String, nom: String, couleur: UInt32), choisie: String?) -> some View {
        let active = choisie == h.cle
        return Button(intent: ChoisirHumeur(h: h.cle)) {
            VStack(spacing: 1) {
                Art("humeur-\(h.cle)").frame(height: 29)
                Text(h.nom).font(rond(9.5, .bold)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(active ? Color(hex: h.couleur, opacite: 0.24) : Color.white.opacity(0.82))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .strokeBorder(Color(hex: h.couleur), lineWidth: active ? 2 : 0)
            )
        }
        .buttonStyle(.plain)
    }
}

/// « Où sont mes proches ? » (Elisa, 21 et 26 novembre) : la carte de Plans avec la tête de chacun, là où il a choisi
/// de partager sa position ; à côté (ou dessous), qui est où et depuis quand ; et « Je suis en route » d'un toucher.
/// Sans réseau pour la carte : la liste seule, comme avant.
struct VueOu: View {
    let e: Entree
    let f: WidgetFamily
    @Environment(\.widgetContentMargins) private var margesWidget

    var body: some View {
        if let etat = e.etat {
            let gens = lignes(etat)
            let autres = gens.filter { $0.m.id != etat.moi }
            Group {
                if autres.isEmpty {
                    vide
                } else if let carte = e.carte {
                    avecCarte(etat, autres: autres, tous: gens, carte: carte)
                } else {
                    liste(etat, autres: autres, tous: gens)
                }
            }
            .widgetURL(Partage.lien("ouest"))
        } else {
            VueVide(e: e, f: f, titre: "Où sont mes proches ?")
        }
    }

    private var grand: Bool { f == .systemLarge }
    /// la marge du widget (la galerie d'aperçus met la sienne : 16)
    private var marge: CGFloat { Contexte.galerie ? 16 : margesWidget.leading }
    /// le bouton « Je suis en route » : seulement si le serveur sait le faire, et pas sur le petit
    private func avecBouton(_ etat: Etat) -> Bool { etat.en_route == true && f != .systemSmall }

    // ───────── Avec la carte ─────────

    @ViewBuilder
    private func avecCarte(_ etat: Etat, autres: [ProchePlace], tous: [ProchePlace], carte: CarteRendue) -> some View {
        let bouton = avecBouton(etat)
        switch f {
        case .systemSmall:
            // en bas à droite : le logo de Plans, en bas à gauche, reste visible
            VStack(alignment: .trailing, spacing: 0) {
                Spacer(minLength: 0)
                etiquette
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .bandeau(e)
            .fond(f) { CarteTetes(carte: carte, gens: tous, moi: etat.moi, tete: 30) }
        case .systemMedium:
            HStack(spacing: 0) {
                Color.clear.frame(width: max(carte.taille.width - marge + 12, 0))
                VStack(alignment: .leading, spacing: 6) {
                    titre
                    ForEach(Array(autres.prefix(bouton ? 2 : 3))) { ligneCourte(etat, $0) }
                    Spacer(minLength: 0)
                    if bouton { boutonEnRoute }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .bandeau(e)
            .fond(f) {
                HStack(spacing: 0) {
                    CarteTetes(carte: carte, gens: tous, moi: etat.moi, tete: 30)
                    Theme.azur
                }
            }
        default:
            VStack(alignment: .leading, spacing: 7) {
                Color.clear.frame(height: max(carte.taille.height - marge + 4, 0))
                titre
                ForEach(Array(autres.prefix(bouton ? 3 : 4))) { ligne(etat, $0) }
                Spacer(minLength: 0)
                if bouton { boutonEnRoute }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .bandeau(e)
            .fond(f) {
                VStack(spacing: 0) {
                    CarteTetes(carte: carte, gens: tous, moi: etat.moi, tete: 36)
                    Theme.azur
                }
            }
        }
    }

    /// Sur le petit, en bas à droite de la carte.
    private var etiquette: some View {
        HStack(spacing: 4) {
            Image(systemName: "location.fill").font(.system(size: 9, weight: .bold)).foregroundStyle(Color(hex: 0x2F7FD0))
            Text("Mes proches").font(rond(11.5)).foregroundStyle(Theme.encre).lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Capsule().fill(Color.white.opacity(0.9)).shadow(color: Theme.encre.opacity(0.15), radius: 3, y: 1))
    }

    // ───────── Sans carte (pas de réseau pour elle) ─────────

    private func liste(_ etat: Etat, autres: [ProchePlace], tous: [ProchePlace]) -> some View {
        let bouton = avecBouton(etat)
        let combien = f == .systemSmall ? 2 : f == .systemMedium ? (bouton ? 2 : 3) : (bouton ? 5 : 6)
        return VStack(alignment: .leading, spacing: f == .systemSmall ? 6 : grand ? 11 : 6) {
            titre
            ForEach(Array(autres.prefix(combien))) { x in
                if f == .systemLarge { ligne(etat, x) } else { ligneCourte(etat, x) }
            }
            Spacer(minLength: 0)
            if bouton { boutonEnRoute }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .bandeau(e)
        .fond(f) { Theme.azur }
    }

    private var vide: some View {
        VStack(alignment: .leading, spacing: 6) {
            titre
            Spacer(minLength: 0)
            Text("Personne d’autre ne partage sa position pour l’instant.")
                .font(rond(12, .medium)).foregroundStyle(Theme.brume).lineLimit(4)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .bandeau(e)
        .fond(f) { Theme.azur }
    }

    private var titre: some View {
        HStack(spacing: 5) {
            Image(systemName: "location.fill").font(.system(size: grand ? 13 : 11, weight: .bold)).foregroundStyle(Color(hex: 0x2F7FD0))
            Text(f == .systemSmall ? "Mes proches" : "Où sont mes proches\u{00A0}?")
                .font(rond(grand ? 16 : 14)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.8)
        }
    }

    // ───────── Le bouton ─────────

    @ViewBuilder
    private var boutonEnRoute: some View {
        if e.local.vientDEnvoyer(a: "tous", k: "en_route", date: e.date) {
            Pilule(teinte: Theme.vert) {
                Label("C’est envoyé", systemImage: "checkmark")
                    .font(rond(grand ? 14 : 13)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.75)
            }
            .transition(.scale.combined(with: .opacity))
        } else {
            Button(intent: PrevenirEnRoute()) {
                Pilule {
                    HStack(spacing: 6) {
                        Image(systemName: "car.fill").font(.system(size: grand ? 13 : 12, weight: .bold)).foregroundStyle(Theme.peche)
                        Text("Je suis en route").font(rond(grand ? 14 : 13)).foregroundStyle(Theme.encre).lineLimit(1).minimumScaleFactor(0.75)
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }

    // ───────── Les lignes ─────────

    /// Les autres d'abord (du plus récent au plus ancien), moi à la fin ; jamais un partage pour un temps déjà fini.
    private func lignes(_ etat: Etat) -> [ProchePlace] {
        let tous = (etat.positions ?? []).filter { !$0.finie(e.date) }.compactMap { p in etat.membre(p.id).map { ProchePlace(m: $0, p: p) } }
        return tous.filter { $0.m.id != etat.moi } + tous.filter { $0.m.id == etat.moi }
    }

    /// « il y a 4 min », « il y a 4 min · jusqu’à 18 h 30 »
    private func quand(_ p: Etat.Position) -> String {
        let depuis = Temps.ilYA(p.q, maintenant: e.date)
        guard let j = p.j, let fin = Temps.date(j) else { return depuis }
        return "\(depuis) · jusqu’à \(Temps.heure(fin))"
    }

    /// Le grand : une tête, le nom, la batterie presque vide, depuis quand ; dessous, où.
    private func ligne(_ etat: Etat, _ x: ProchePlace) -> some View {
        HStack(spacing: 10) {
            Pastille(m: x.m, taille: 36, humeur: false)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(x.m.n).font(rond(14)).foregroundStyle(Theme.encre).lineLimit(1)
                    if let b = x.p.b, b <= 20 {
                        Image(systemName: "battery.25percent").font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.rouge)
                    }
                    Spacer(minLength: 2)
                    Text(quand(x.p)).font(rond(11, .medium)).foregroundStyle(Theme.brume).lineLimit(1).minimumScaleFactor(0.8)
                }
                Text(x.p.libelle).font(rond(12, .medium)).foregroundStyle(Theme.brume).lineLimit(1).minimumScaleFactor(0.85)
            }
        }
    }

    /// Le moyen et le petit : plus serré.
    private func ligneCourte(_ etat: Etat, _ x: ProchePlace) -> some View {
        HStack(spacing: 7) {
            Pastille(m: x.m, taille: f == .systemSmall ? 30 : 28, humeur: false)
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 3) {
                    Text(x.m.n).font(rond(12.5)).foregroundStyle(Theme.encre).lineLimit(1)
                    if let b = x.p.b, b <= 20 {
                        Image(systemName: "battery.25percent").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.rouge)
                    }
                    if f != .systemSmall {
                        Spacer(minLength: 2)
                        Text(Temps.ilYA(x.p.q, maintenant: e.date)).font(rond(10, .medium)).foregroundStyle(Theme.brume).lineLimit(1)
                    }
                }
                Text(f == .systemSmall && !x.p.approx ? (x.p.v ?? x.p.libelle) : x.p.libelle)
                    .font(rond(11, .medium)).foregroundStyle(Theme.brume).lineLimit(1).minimumScaleFactor(0.85)
            }
        }
    }
}

/// Un proche et sa position.
struct ProchePlace: Identifiable {
    let m: Etat.Membre
    let p: Etat.Position
    var id: String { m.id }
}

/// L'instantané de Plans, et la tête de chacun là où il est (accrochée par sa pointe) : moi avec un liseré violet, une
/// position approximative avec son halo, une position de plus de 12 h un peu pâle ; deux têtes au même endroit côte à côte.
struct CarteTetes: View {
    let carte: CarteRendue
    let gens: [ProchePlace]
    let moi: String
    var tete: CGFloat = 30

    private struct Place: Identifiable {
        let x: ProchePlace
        let point: CGPoint
        var id: String { x.id }
    }

    private var places: [Place] {
        var faites: [Place] = []
        let tries = gens.sorted { (carte.points[$0.id]?.y ?? 0) < (carte.points[$1.id]?.y ?? 0) }
        for x in tries {
            guard var pt = carte.points[x.id] else { continue }
            while faites.contains(where: { abs($0.point.x - pt.x) < tete * 0.8 && abs($0.point.y - pt.y) < tete * 0.8 }) {
                pt.x += tete * 0.75
            }
            faites.append(Place(x: x, point: pt))
        }
        return faites
    }

    var body: some View {
        let lesPlaces = places
        ZStack(alignment: .topLeading) {
            Image(uiImage: carte.image)
                .resizable()
                .frame(width: carte.taille.width, height: carte.taille.height)
            ForEach(lesPlaces.filter { $0.x.p.approx }) { pl in
                Circle()
                    .fill(Color(hex: 0x5AA3E0, opacite: 0.14))
                    .overlay(Circle().strokeBorder(Color(hex: 0x5AA3E0, opacite: 0.4), lineWidth: 1))
                    .frame(width: diametreHalo, height: diametreHalo)
                    .position(pl.point)
            }
            ForEach(lesPlaces) { pl in
                RepereTete(m: pl.x.m, moi: pl.x.m.id == moi, pale: Self.ancienne(pl.x.p), taille: tete)
                    .position(x: pl.point.x, y: pl.point.y - (tete + 6) / 2)
            }
        }
        .frame(width: carte.taille.width, height: carte.taille.height, alignment: .topLeading)
        .clipped()
    }

    /// Le halo d'une position approximative : 1 km autour du point (ni trop petit, ni plus grand que la carte).
    private var diametreHalo: CGFloat {
        let metres = max(carte.metresParPoint, 0.1)
        let d = CGFloat(2000 / metres)
        let plafond = max(carte.taille.width, carte.taille.height) * 1.5
        return min(max(d, tete * 1.6), plafond)
    }

    /// Plus de 12 h : peut-être plus vraie.
    static func ancienne(_ p: Etat.Position) -> Bool {
        guard let d = Temps.date(p.q) else { return false }
        return Date().timeIntervalSince(d) > 12 * 3600
    }
}

/// La tête d'un proche sur la carte, avec sa pointe en bas.
struct RepereTete: View {
    let m: Etat.Membre
    let moi: Bool
    let pale: Bool
    let taille: CGFloat

    var body: some View {
        VStack(spacing: -1) {
            Pastille(m: m, taille: taille, humeur: false)
                .overlay(Circle().strokeBorder(moi ? Theme.violet : Color.white, lineWidth: moi ? 2.5 : 2))
                .shadow(color: Theme.encre.opacity(0.28), radius: 3, y: 1.5)
            PointeRepere()
                .fill(moi ? Theme.violet : Color.white)
                .frame(width: 10, height: 7)
        }
        .opacity(pale ? 0.6 : 1)
    }
}

struct PointeRepere: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addLine(to: CGPoint(x: r.midX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}
