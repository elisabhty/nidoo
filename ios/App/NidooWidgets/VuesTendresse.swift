import AppIntents
import SwiftUI
import WidgetKit

// Les widgets de tendresse : un bisou d'un geste, les attentions reçues, la famille, l'humeur du jour.

/// Bisou express : un proche, un bouton.
struct VueBisou: View {
    let e: Entree
    let f: WidgetFamily

    var body: some View {
        if let etat = e.etat, let p = etat.proche(e.proche) {
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
                VStack(spacing: 0) {
                    Image(systemName: envoye ? "checkmark" : "heart.fill").font(.system(size: 17, weight: .bold))
                    Text(p.n).font(.system(size: 10, weight: .semibold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
                }
                .padding(.horizontal, 5)
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
            let cible = etat.proche(e.proche)
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
        if m.id == etat.moi {
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
                ForEach(Array(etat.recues.prefix(rangees.count > 1 ? 2 : 3))) { r in
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
