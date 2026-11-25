import ActivityKit
import Foundation

/// Ce que l'appli et ses widgets se partagent, dans le groupe d'apps : la clé widget que l'appli a reçue du serveur,
/// le dernier état connu de la maison, et les images des personnages (dessinées par l'appli).
enum Partage {
    static let groupe = "group.com.getupworkspace.nidoo"
    /// nidoo://ouvrir/organiser : un widget ouvre l'appli au bon endroit
    static let schema = "nidoo"

    static var reglages: UserDefaults { UserDefaults(suiteName: groupe) ?? .standard }

    static var dossier: URL {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupe) ?? FileManager.default.temporaryDirectory
    }

    static var dossierPersos: URL {
        let u = dossier.appendingPathComponent("persos", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    /// Le buste d'un proche (PNG, fond transparent).
    static func fichierPerso(_ id: String) -> URL {
        let propre = id.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "..", with: "_")
        return dossierPersos.appendingPathComponent(propre + ".png")
    }

    static var url: String? { reglages.string(forKey: "url") }
    static var apikey: String? { reglages.string(forKey: "apikey") }
    static var cle: String? { reglages.string(forKey: "cle") }
    /// L'appli a-t-elle déjà donné sa clé aux widgets ?
    static var branche: Bool { !(cle ?? "").isEmpty && !(url ?? "").isEmpty && !(apikey ?? "").isEmpty }

    static func lien(_ ou: String) -> URL { URL(string: "\(schema)://ouvrir/\(ou)")! }
}

/// L'activité en direct « prochain rendez-vous » (Elisa, 25 novembre : « l'île dynamique, l'activité de l'écran ») :
/// l'écran verrouillé et l'île dynamique comptent le temps qu'il reste, sans serveur — c'est iOS qui fait défiler
/// le compte à rebours. L'appli la lance (NidooPlugin), l'extension des widgets la dessine (VuesOrganisation).
@available(iOS 16.2, *)
struct RendezVous: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var titre: String
        var debut: Date
        /// « Cabinet du Dr Martin, Annecy », « Avec Léa » : facultatifs
        var lieu: String?
        var avec: String?
    }

    /// l'événement de l'agenda, et son genre (evenement, rdv, anniversaire) pour l'illustration
    var id: String
    var genre: String
}
