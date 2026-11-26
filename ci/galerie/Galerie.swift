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
    /// « Où sont mes proches ? » : les cartes de Plans, faites au lancement (pages 10, 12 et 13)
    @State private var cartes: [String: CarteRendue] = [:]

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

    /// À une heure donnée (le décor de la maison suit l'heure)
    private func vers(_ heure: Int) -> Entree {
        Entree.exemple(Calendar.current.date(bySettingHour: heure, minute: 0, second: 0, of: Date()) ?? Date())
    }
    private var soir: Entree { vers(19) }
    private var nuit: Entree { vers(22) }

    private var pasBranche: Entree { Entree(date: Date(), etat: nil, branche: false) }

    /// La carte de cette taille posée sur l'état (« petit », « moyen », « grand », « grand-discret »).
    private func avecCarte(_ x: Entree, _ cle: String) -> Entree {
        var y = x
        y.carte = cartes[cle]
        return y
    }

    /// Léa partage une position approximative, Papa pour une heure.
    private var discret: Entree {
        var x = Entree.exemple()
        if var ps = x.etat?.positions {
            ps[0].a = true
            ps[0].l = nil
            ps[0].v = "Annecy"
            ps[0].la = 45.91
            ps[0].lo = 6.15
            ps[0].p = 1000
            ps[1].j = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
            x.etat?.positions = ps
        }
        return x
    }

    /// Personne d'autre ne partage sa position.
    private var seul: Entree {
        var x = Entree.exemple()
        x.etat?.positions = x.etat?.positions?.filter { $0.id == "moi" }
        return x
    }

    private func chargerCartes() async {
        guard [10, 12, 13].contains(page) else { return }
        var c: [String: CarteRendue] = [:]
        let tailles: [(String, WidgetFamily, CGSize, Entree)] = [
            ("petit", .systemSmall, CGSize(width: 170, height: 170), Entree.exemple()),
            ("moyen", .systemMedium, CGSize(width: 364, height: 170), Entree.exemple()),
            ("grand", .systemLarge, CGSize(width: 364, height: 382), Entree.exemple()),
            ("grand-discret", .systemLarge, CGSize(width: 364, height: 382), discret),
        ]
        for (cle, f, taille, x) in tailles {
            c[cle] = await CarteProches.pour(x.etat, f: f, widget: taille)
        }
        cartes = c
    }

    /// Le rendez-vous d'exemple de l'activité en direct : dans 42 minutes.
    private var rdv: RendezVous.ContentState {
        RendezVous.ContentState(titre: "Dentiste de Léa", debut: Date().addingTimeInterval(42 * 60 + 10), lieu: "Cabinet du Dr Martin", avec: "Avec Léa")
    }
    private var diner: RendezVous.ContentState {
        RendezVous.ContentState(titre: "Dîner tous ensemble chez Papa", debut: Date().addingTimeInterval(3 * 3600 + 12 * 60), lieu: "3 rue des Lilas", avec: "Toute la famille")
    }
    private var anniv: RendezVous.ContentState {
        RendezVous.ContentState(titre: "Anniversaire de Mamie Jo", debut: Date().addingTimeInterval(-60), lieu: "Chez Mamie", avec: "Toute la famille")
    }

    private var sixChoix: Entree {
        var x = Entree.exemple()
        x.etat?.sondage = Etat.Sondage(id: "s2", q: "On part où cet été ?", de: "lea", choix: ["La mer", "La montagne", "Chez Mamie", "L’Italie", "On reste là"], voix: [2, 1, 0, 1, 0], moi: nil)
        return x
    }

    /// Deux dans la maison, trois cartes (le widget d'Elisa, 21 novembre : un grand vide au milieu).
    private var aDeux: Entree {
        var x = Entree.exemple()
        if let m = x.etat?.membres { x.etat?.membres = Array(m.prefix(2)) }
        x.etat?.recues = []
        x.etat?.parties = []
        x.etat?.sondage = nil
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
        .task { await chargerCartes() }
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
            Cadre(f: .systemLarge) { VueMur(e: aDeux, f: .systemLarge) }
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
        case 9:
            HStack(spacing: 24) {
                Cadre(f: .systemSmall) { VueMaison(e: e, f: .systemSmall) }
                Cadre(f: .systemSmall) { VueMaison(e: soir, f: .systemSmall) }
            }
            Cadre(f: .systemMedium) { VueMaison(e: e, f: .systemMedium) }
            Cadre(f: .systemLarge) { VueMaison(e: nuit, f: .systemLarge) }
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
        case 10:
            // Où sont mes proches ? : la carte, en petit, en moyen et en grand
            HStack(spacing: 24) {
                Cadre(f: .systemSmall) { VueOu(e: avecCarte(e, "petit"), f: .systemSmall) }
                Cadre(f: .systemSmall) { VueOu(e: pasBranche, f: .systemSmall) }
            }
            Cadre(f: .systemMedium) { VueOu(e: avecCarte(e, "moyen"), f: .systemMedium) }
            Cadre(f: .systemLarge) { VueOu(e: avecCarte(e, "grand"), f: .systemLarge) }
        case 12:
            // Où sont mes proches ? : « Je suis en route » envoyé ; sans carte (pas de réseau) ; personne d'autre
            Cadre(f: .systemMedium) { VueOu(e: avecCarte(envoye(a: "tous", k: "en_route"), "moyen"), f: .systemMedium) }
            Cadre(f: .systemMedium) { VueOu(e: e, f: .systemMedium) }
            HStack(spacing: 24) {
                Cadre(f: .systemSmall) { VueOu(e: e, f: .systemSmall) }
                Cadre(f: .systemSmall) { VueOu(e: seul, f: .systemSmall) }
            }
        case 13:
            // Où sont mes proches ? : une position approximative (le halo), un partage pour une heure ; sans carte
            Cadre(f: .systemLarge) { VueOu(e: avecCarte(discret, "grand-discret"), f: .systemLarge) }
            Cadre(f: .systemLarge) { VueOu(e: discret, f: .systemLarge) }
        case 11:
            // L'activité en direct du prochain rendez-vous : écran verrouillé, île dynamique réduite puis ouverte
            VueRdvVerrou(genre: "rdv", s: rdv)
                .frame(width: 364)
                .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Rdv.nuit))
            VueRdvVerrou(genre: "evenement", s: diner)
                .frame(width: 364)
                .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Rdv.nuit))
            VueRdvVerrou(genre: "anniversaire", s: anniv, passe: true)
                .frame(width: 364)
                .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Rdv.nuit))
            HStack(spacing: 0) {
                IleRdvIllustration(genre: "rdv", taille: 22)
                Spacer().frame(width: 132)
                RdvCompte(debut: rdv.debut, taille: 14).foregroundStyle(Rdv.lilas)
            }
            .padding(.horizontal, 12)
            .frame(height: 37)
            .background(Capsule().fill(Color.black))
            VStack(spacing: 8) {
                HStack {
                    IleRdvIllustration(genre: "rdv")
                    Spacer()
                    Text(rdv.titre).font(rond(16)).foregroundStyle(.white).lineLimit(1)
                    Spacer()
                    RdvCompte(debut: rdv.debut, taille: 22).foregroundStyle(Rdv.lilas)
                }
                IleRdvBas(s: rdv)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .frame(width: 370)
            .background(RoundedRectangle(cornerRadius: 42, style: .continuous).fill(Color.black))
        default:
            Cadre(f: .systemMedium) { VueSondage(e: sixChoix, f: .systemMedium) }
            Cadre(f: .systemLarge) { VueMur(e: toutCalme, f: .systemLarge) }
            Cadre(f: .systemMedium) { VueMorpion(e: pasBranche, f: .systemMedium) }
        }
    }
}
