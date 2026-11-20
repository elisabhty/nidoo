import SwiftUI
import WidgetKit

// La galerie des widgets : chaque page montre quelques widgets à leur vraie taille, avec la famille d'exemple.
// Lancée avec « -page 3 », elle affiche la page 3 (voir .github/workflows/ios.yml).

@main
struct GalerieApp: App {
    init() { Contexte.galerie = true }

    var body: some Scene {
        WindowGroup {
            Planche(page: max(1, UserDefaults.standard.integer(forKey: "page")))
        }
    }
}

/// Un widget à sa taille d'iPhone, avec ses coins ronds.
struct Cadre<Vue: View>: View {
    let f: WidgetFamily
    @ViewBuilder var vue: () -> Vue

    private var taille: CGSize {
        switch f {
        case .systemSmall: return CGSize(width: 170, height: 170)
        case .systemMedium: return CGSize(width: 364, height: 170)
        case .systemLarge: return CGSize(width: 364, height: 382)
        case .accessoryCircular: return CGSize(width: 72, height: 72)
        case .accessoryRectangular: return CGSize(width: 164, height: 72)
        default: return CGSize(width: 260, height: 22)
        }
    }

    var body: some View {
        if f.surEcranVerrouille {
            vue()
                .frame(width: taille.width, height: taille.height)
                .foregroundStyle(.white)
                .tint(.white)
                .clipShape(RoundedRectangle(cornerRadius: f == .accessoryCircular ? 36 : 14, style: .continuous))
        } else {
            vue()
                .frame(width: taille.width, height: taille.height)
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 12, y: 6)
        }
    }
}

struct Planche: View {
    let page: Int

    private var e: Entree { .exemple() }

    /// Juste après un envoi : la confirmation est encore visible.
    private func envoye(a: String, k: String) -> Entree {
        var x = Entree.exemple()
        x.local.envoi = Local.Envoi(a: a, k: k, le: x.date.timeIntervalSince1970 - 1)
        return x
    }

    private var sansTache: Entree {
        var x = Entree.exemple()
        x.liste = "courses"
        return x
    }

    private var partieFinie: Entree {
        var x = Entree.exemple()
        if var etat = x.etat {
            etat.parties[0] = Etat.Partie(id: "p1", k: "morpion", p1: "moi", p2: "mamie", tour: nil, fini: true, gagne: "moi",
                                          g: [1, 2, 2, 0, 1, 0, 2, 0, 1], der: 8, ligne: [0, 4, 8], q: etat.parties[0].q)
            x.etat = etat
        }
        return x
    }

    private var erreur: Entree {
        var x = Entree.exemple()
        x.local.erreur = "Pas de réseau"
        x.local.erreurLe = x.date.timeIntervalSince1970 - 1
        return x
    }

    private var pasBranche: Entree { Entree(date: Date(), etat: nil, branche: false) }

    private var sixChoix: Entree {
        var x = Entree.exemple()
        x.etat?.sondage = Etat.Sondage(id: "s2", q: "On part où cet été ?", de: "lea", choix: ["La mer", "La montagne", "Chez Mamie", "L’Italie", "On reste là"], voix: [2, 1, 0, 1, 0], moi: nil)
        return x
    }

    /// Une maison toute neuve : pas d'attention, pas de date, rien à faire.
    private var toutCalme: Entree {
        var x = Entree.exemple()
        x.etat?.recues = []
        x.etat?.dates = []
        x.etat?.liste = []
        x.etat?.parties = []
        x.etat?.sondage = nil
        return x
    }

    var body: some View {
        ZStack {
            if page == 7 {
                LinearGradient(colors: [Color(hex: 0x2B2350), Color(hex: 0x6B4A8E), Color(hex: 0xD98CA6)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            } else {
                LinearGradient(colors: [Color(hex: 0xC9B8F5), Color(hex: 0xF6C9D8), Color(hex: 0xFCE3C4)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            }
            VStack(spacing: 16) {
                contenu
            }
        }
    }

    @ViewBuilder
    private var contenu: some View {
        switch page {
        case 1:
            HStack(spacing: 24) {
                Cadre(f: .systemSmall) { VueBisou(e: e, f: .systemSmall) }
                Cadre(f: .systemSmall) { VueBisou(e: envoye(a: "mamie", k: "bisou"), f: .systemSmall) }
            }
            Cadre(f: .systemMedium) { VueAttentions(e: e, f: .systemMedium) }
            Cadre(f: .systemMedium) { VueFamille(e: e, f: .systemMedium) }
            Cadre(f: .systemMedium) { VueHumeur(e: e, f: .systemMedium) }
        case 2:
            HStack(spacing: 24) {
                Cadre(f: .systemSmall) { VueDates(e: e, f: .systemSmall) }
                Cadre(f: .systemSmall) { VueCompagnon(e: e, f: .systemSmall) }
            }
            Cadre(f: .systemMedium) { VueDates(e: e, f: .systemMedium) }
            Cadre(f: .systemMedium) { VueAFaire(e: e, f: .systemMedium) }
            Cadre(f: .systemMedium) { VueSondage(e: e, f: .systemMedium) }
        case 3:
            Cadre(f: .systemLarge) { VueMur(e: e, f: .systemLarge) }
            Cadre(f: .systemLarge) { VueFamille(e: envoye(a: "lea", k: "coeur"), f: .systemLarge) }
        case 4:
            Cadre(f: .systemLarge) { VueMorpion(e: e, f: .systemLarge) }
            Cadre(f: .systemLarge) { VuePuissance4(e: e, f: .systemLarge) }
        case 5:
            Cadre(f: .systemMedium) { VueMorpion(e: e, f: .systemMedium) }
            Cadre(f: .systemMedium) { VueMorpion(e: partieFinie, f: .systemMedium) }
            Cadre(f: .systemMedium) { VueMemory(e: e, f: .systemMedium) }
            Cadre(f: .systemMedium) { VueAttentions(e: envoye(a: "mamie", k: "calin"), f: .systemMedium) }
        case 6:
            Cadre(f: .systemLarge) { VueMemory(e: e, f: .systemLarge) }
            Cadre(f: .systemLarge) { VueAFaire(e: sansTache, f: .systemLarge) }
        case 7:
            Text("9:41").font(.system(size: 86, weight: .semibold, design: .rounded)).foregroundStyle(.white)
            Cadre(f: .accessoryInline) { VueDates(e: e, f: .accessoryInline) }
            HStack(spacing: 14) {
                Cadre(f: .accessoryRectangular) { VueDates(e: e, f: .accessoryRectangular) }
                Cadre(f: .accessoryCircular) { VueDates(e: e, f: .accessoryCircular) }
                Cadre(f: .accessoryCircular) { VueBisou(e: e, f: .accessoryCircular) }
            }
            Spacer().frame(height: 30)
            HStack(spacing: 24) {
                Cadre(f: .systemSmall) { VueBisou(e: pasBranche, f: .systemSmall) }
                Cadre(f: .systemSmall) { VueCompagnon(e: erreur, f: .systemSmall) }
            }
            Cadre(f: .systemMedium) { VueSondage(e: pasBranche, f: .systemMedium) }
        default:
            Cadre(f: .systemMedium) { VueSondage(e: sixChoix, f: .systemMedium) }
            Cadre(f: .systemLarge) { VueMur(e: toutCalme, f: .systemLarge) }
            Cadre(f: .systemMedium) { VueMorpion(e: pasBranche, f: .systemMedium) }
        }
    }
}
