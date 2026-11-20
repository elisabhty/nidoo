import Foundation
import Capacitor
import WidgetKit

/// Le pont entre l'appli (web) et les widgets : l'appli y dépose la clé widget et les images des personnages,
/// et apprend à quel endroit un widget veut l'ouvrir.
@objc(NidooPlugin)
public class NidooPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NidooPlugin"
    public let jsName = "Nidoo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configurer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "personnages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "rafraichir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "oublier", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "depart", returnType: CAPPluginReturnPromise),
    ]

    private static weak var actif: NidooPlugin?
    /// L'endroit demandé par un widget avant que l'appli soit prête à l'entendre.
    private static var enAttente: String?

    override public func load() {
        NidooPlugin.actif = self
    }

    /// Un widget a ouvert l'appli (nidoo://ouvrir/organiser).
    static func ouvrir(_ url: URL) {
        guard url.scheme == Partage.schema, url.host == "ouvrir" else { return }
        let chemin = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !chemin.isEmpty else { return }
        enAttente = chemin
        actif?.notifyListeners("ouvrir", data: ["chemin": chemin])
    }

    /// La clé widget de ce téléphone, et où joindre le serveur.
    @objc func configurer(_ call: CAPPluginCall) {
        let d = Partage.reglages
        let cle = call.getString("cle") ?? ""
        // une clé que le serveur a refusée à un widget : l'appli doit en demander une autre
        if !cle.isEmpty, d.string(forKey: "cle_refusee") == cle {
            call.resolve(["refusee": true])
            return
        }
        let avant = "\(d.string(forKey: "cle") ?? "")|\(d.string(forKey: "url") ?? "")"
        for k in ["url", "apikey", "cle", "famille", "moi"] {
            if let v = call.getString(k) { d.set(v, forKey: k) }
        }
        if avant != "\(cle)|\(call.getString("url") ?? "")" {
            // une autre maison (ou un autre compte) : ce que les widgets avaient en mémoire n'est plus le bon
            for k in ["etat", "etat_le", "local", "cle_refusee"] { d.removeObject(forKey: k) }
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["refusee": false])
    }

    /// Les bustes des proches, dessinés par l'appli : { id: PNG en base64 } ; `garder` : ceux qui existent encore.
    @objc func personnages(_ call: CAPPluginCall) {
        let images = call.getObject("images") ?? [:]
        let garder = call.getArray("garder", String.self)
        DispatchQueue.global(qos: .utility).async {
            for (id, valeur) in images {
                guard var texte = valeur as? String else { continue }
                if let i = texte.range(of: "base64,") { texte = String(texte[i.upperBound...]) }
                if let data = Data(base64Encoded: texte) {
                    try? data.write(to: Partage.fichierPerso(id), options: .atomic)
                }
            }
            if let garder {
                let voulus = Set(garder.map { Partage.fichierPerso($0).lastPathComponent })
                let fichiers = (try? FileManager.default.contentsOfDirectory(atPath: Partage.dossierPersos.path)) ?? []
                for f in fichiers where !voulus.contains(f) {
                    try? FileManager.default.removeItem(at: Partage.dossierPersos.appendingPathComponent(f))
                }
            }
            DispatchQueue.main.async {
                WidgetCenter.shared.reloadAllTimelines()
                call.resolve()
            }
        }
    }

    /// L'appli vient de changer quelque chose (ou passe en arrière-plan) : les widgets se remettent à jour.
    @objc func rafraichir(_ call: CAPPluginCall) {
        // ce que les widgets avaient en mémoire depuis quelques secondes n'est peut-être plus vrai
        Partage.reglages.removeObject(forKey: "etat_le")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// On quitte la maison ou on efface le compte : les widgets n'ont plus rien à montrer.
    @objc func oublier(_ call: CAPPluginCall) {
        let d = Partage.reglages
        for k in ["url", "apikey", "cle", "famille", "moi", "etat", "etat_le", "local", "cle_refusee"] { d.removeObject(forKey: k) }
        try? FileManager.default.removeItem(at: Partage.dossierPersos)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Au lancement : l'endroit demandé par le widget qui a ouvert l'appli (une seule fois).
    @objc func depart(_ call: CAPPluginCall) {
        var r = JSObject()
        if let chemin = NidooPlugin.enAttente { r["chemin"] = chemin }
        NidooPlugin.enAttente = nil
        call.resolve(r)
    }
}
