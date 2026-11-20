import SwiftUI
import UIKit
import WidgetKit

extension Color {
    init(hex: UInt32, opacite: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: opacite)
    }
}

/// Les couleurs et les formes de NIDOO, les mêmes que dans l'appli.
enum Theme {
    static let encre = Color(hex: 0x1D1A2B)
    static let brume = Color(hex: 0x6F6A85)
    static let violet = Color(hex: 0x8E6FF0)
    static let violetFonce = Color(hex: 0x6646CC)
    static let rose = Color(hex: 0xE77BA0)
    static let peche = Color(hex: 0xF58B5C)
    static let vert = Color(hex: 0x3FAE6A)
    static let or = Color(hex: 0xF5B700)
    static let rouge = Color(hex: 0xE5484D)

    /// La couleur d'un proche : (clair, soutenu, vif).
    static func teinte(_ cle: String?) -> (clair: Color, soutenu: Color, vif: Color) {
        switch cle {
        case "peche": return (Color(hex: 0xFFEEE2), Color(hex: 0xFFD0B3), Color(hex: 0xF58B5C))
        case "mousse": return (Color(hex: 0xE6F5E9), Color(hex: 0xC3E6CB), Color(hex: 0x62B67A))
        case "ciel": return (Color(hex: 0xE3F1FC), Color(hex: 0xBDDDF7), Color(hex: 0x5AA3E0))
        case "rose": return (Color(hex: 0xFDE6EE), Color(hex: 0xF9C4D5), Color(hex: 0xE77BA0))
        case "soleil": return (Color(hex: 0xFDF3D2), Color(hex: 0xF9E19B), Color(hex: 0xE0B02F))
        default: return (Color(hex: 0xEFE8FD), Color(hex: 0xD5C6F7), Color(hex: 0x9B7FEA))
        }
    }

    static func degrade(_ haut: UInt32, _ bas: UInt32) -> LinearGradient {
        LinearGradient(colors: [Color(hex: haut), Color(hex: bas)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    static func degrade(proche m: Etat.Membre?) -> LinearGradient {
        let t = teinte(m?.c)
        return LinearGradient(colors: [t.clair, t.soutenu], startPoint: .top, endPoint: .bottom)
    }

    static let lavande = degrade(0xFBF8FF, 0xE9DFFC)
    static let aurore = degrade(0xFFF3EA, 0xFBD9E6)
    static let menthe = degrade(0xF2FBF4, 0xD3EEDB)
    static let azur = degrade(0xF1F8FF, 0xCFE4F8)
    static let miel = degrade(0xFFF9E6, 0xFBE7B0)
}

/// La police ronde de NIDOO.
func rond(_ taille: CGFloat, _ poids: Font.Weight = .bold) -> Font {
    .system(size: taille, weight: poids, design: .rounded)
}

/// Où l'on dessine : dans un vrai widget, ou dans la galerie d'aperçus (qui n'a ni marges ni fond de widget).
enum Contexte {
    static var galerie = false
}

extension WidgetFamily {
    var surEcranVerrouille: Bool {
        switch self {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline: return true
        default: return false
        }
    }
}

extension View {
    /// Le fond du widget (rien sur l'écran verrouillé, où iOS dessine le sien).
    @ViewBuilder
    func fond<F: View>(_ famille: WidgetFamily, @ViewBuilder _ dessin: () -> F) -> some View {
        if Contexte.galerie {
            if famille.surEcranVerrouille {
                self
            } else {
                self.padding(16).frame(maxWidth: .infinity, maxHeight: .infinity).background(dessin())
            }
        } else if famille.surEcranVerrouille {
            self.containerBackground(for: .widget) { Color.clear }
        } else {
            self.containerBackground(for: .widget) { dessin() }
        }
    }

    /// Le message d'erreur d'un bouton, quelques secondes, en bas du widget.
    func bandeau(_ e: Entree) -> some View {
        overlay(alignment: .bottom) {
            if let texte = e.local.erreurVisible(e.date) {
                Text(texte)
                    .font(rond(10.5, .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Theme.rouge))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }
}

extension Image {
    /// Sur un écran d'accueil teinté (iOS 18), l'illustration garde ses couleurs.
    @ViewBuilder
    func couleurs() -> some View {
        if #available(iOS 18.0, *) {
            self.widgetAccentedRenderingMode(.fullColor)
        } else {
            self
        }
    }
}

/// Une illustration de l'appli.
struct Art: View {
    let nom: String
    init(_ nom: String) { self.nom = nom }
    var body: some View {
        Image(nom).resizable().couleurs().scaledToFit()
    }
}

enum Persos {
    /// Le buste d'un proche : dessiné par l'appli (groupe d'apps), ou d'exemple (catalogue d'images).
    static func image(_ m: Etat.Membre) -> Image? {
        if m.a.hasPrefix("exemple:") { return Image(String(m.a.dropFirst(8))) }
        if let ui = UIImage(contentsOfFile: Partage.fichierPerso(m.id).path) { return Image(uiImage: ui) }
        return nil
    }
}

/// La pastille ronde d'un proche, avec son humeur du jour.
struct Pastille: View {
    let m: Etat.Membre?
    var taille: CGFloat = 44
    var humeur = true

    var body: some View {
        let t = Theme.teinte(m?.c)
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(LinearGradient(colors: [t.clair, t.soutenu], startPoint: .topLeading, endPoint: .bottomTrailing))
                if let m, let image = Persos.image(m) {
                    image.resizable().couleurs().scaledToFill()
                } else {
                    Text(String((m?.n ?? "?").prefix(1)).uppercased())
                        .font(rond(taille * 0.44))
                        .foregroundStyle(t.vif)
                }
            }
            .frame(width: taille, height: taille)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Color.white.opacity(0.95), lineWidth: taille >= 40 ? 2 : 1.2))
            if humeur, taille >= 34, let h = m?.h {
                Art("humeur-\(h)")
                    .frame(width: taille * 0.4, height: taille * 0.4)
                    .background(Circle().fill(Color.white).padding(-1.5))
                    .offset(x: taille * 0.06, y: taille * 0.06)
            }
        }
        .frame(width: taille, height: taille)
    }
}

/// Un bouton blanc arrondi, comme dans l'appli.
struct Pilule<Contenu: View>: View {
    var teinte: Color = .white
    @ViewBuilder var contenu: () -> Contenu
    var body: some View {
        contenu()
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background(Capsule().fill(teinte).shadow(color: Theme.violetFonce.opacity(0.12), radius: 3, y: 1.5))
    }
}

/// Le widget quand il n'a rien à montrer : l'appli n'a pas encore donné sa clé, ou pas de réseau au premier affichage.
struct VueVide: View {
    let e: Entree
    let f: WidgetFamily
    var titre = "NIDOO"

    var body: some View {
        Group {
            switch f {
            case .accessoryInline:
                Text("Ouvre NIDOO")
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: "house.fill").font(.system(size: 22, weight: .semibold))
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(titre).font(.headline)
                    Text(e.branche ? "Pas de réseau" : "Ouvre NIDOO pour commencer").font(.caption)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                VStack(spacing: 6) {
                    Image("panda").resizable().couleurs().scaledToFit()
                        .frame(width: f == .systemSmall ? 54 : 64, height: f == .systemSmall ? 54 : 64)
                        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                    Text(titre).font(rond(15)).foregroundStyle(Theme.encre)
                    Text(e.branche ? "Pas de réseau pour l’instant" : "Ouvre NIDOO pour brancher ce widget")
                        .font(rond(11.5, .medium))
                        .foregroundStyle(Theme.brume)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .fond(f) { Theme.lavande }
        .widgetURL(Partage.lien("maison"))
    }
}

/// Lit la taille du widget et la donne à la vue (les vues la reçoivent en clair : la galerie d'aperçus peut ainsi les dessiner).
struct Selon<Contenu: View>: View {
    @Environment(\.widgetFamily) private var famille
    private let contenu: (WidgetFamily) -> Contenu

    init(@ViewBuilder _ contenu: @escaping (WidgetFamily) -> Contenu) {
        self.contenu = contenu
    }

    var body: some View { contenu(famille) }
}
