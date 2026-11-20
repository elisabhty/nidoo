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
