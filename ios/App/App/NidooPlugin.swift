import Foundation
import UIKit
import Capacitor
import WidgetKit
import EventKit
import EventKitUI

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
        CAPPluginMethod(name: "calendrier", returnType: CAPPluginReturnPromise),
    ]

    private static weak var actif: NidooPlugin?
    /// « Ajouter au calendrier » : l'appel en cours, et le calendrier de l'iPhone.
    private var appelCalendrier: CAPPluginCall?
    private lazy var magasin = EKEventStore()
    /// L'endroit demandé par un widget avant que l'appli soit prête à l'entendre.
    private static var enAttente: String?

    override public func load() {
        NidooPlugin.actif = self
        // l'appli passe derrière : les widgets reprennent la main, avec des données fraîches
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
            guard Partage.branche else { return }
            Partage.reglages.removeObject(forKey: "etat_le")
            WidgetCenter.shared.reloadAllTimelines()
        }
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

    /// L'appli vient de changer quelque chose : les widgets se remettent à jour.
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

    /// « Ajouter au calendrier » (Elisa, 21 novembre : « si ce n'est pas Safari ? ») : la fiche « Nouvel événement » du
    /// calendrier de l'iPhone, déjà remplie, par-dessus l'appli. Depuis iOS 17, elle s'affiche hors de l'appli (EventKitUI) :
    /// aucune autorisation à demander, l'appli ne lit jamais le calendrier. Avant iOS 17 : refusé, l'appli passe par la page.
    @objc func calendrier(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("La fiche du calendrier demande iOS 17")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, let vue = self.bridge?.viewController else {
                call.reject("Pas de vue")
                return
            }
            let ev = EKEvent(eventStore: self.magasin)
            ev.title = call.getString("titre") ?? "Événement"
            let maintenant = Date().timeIntervalSince1970 * 1000
            let debut = Date(timeIntervalSince1970: (call.getDouble("debut") ?? maintenant) / 1000)
            let fin = Date(timeIntervalSince1970: (call.getDouble("fin") ?? (maintenant + 3_600_000)) / 1000)
            ev.startDate = debut
            ev.endDate = max(fin, debut)
            ev.isAllDay = call.getBool("journee") ?? false
            if let lieu = call.getString("lieu"), !lieu.isEmpty { ev.location = lieu }
            if let notes = call.getString("notes"), !notes.isEmpty { ev.notes = notes }
            let regles: [String: (EKRecurrenceFrequency, Int)] = ["jour": (.daily, 1), "semaine": (.weekly, 1), "2semaines": (.weekly, 2), "mois": (.monthly, 1), "annee": (.yearly, 1)]
            if let r = call.getString("repete"), let regle = regles[r] {
                ev.addRecurrenceRule(EKRecurrenceRule(recurrenceWith: regle.0, interval: regle.1, end: nil))
            }
            if call.getBool("rappel") == true { ev.addAlarm(EKAlarm(relativeOffset: -3600)) }
            let fiche = EKEventEditViewController()
            fiche.eventStore = self.magasin
            fiche.event = ev
            fiche.editViewDelegate = self
            self.appelCalendrier?.resolve(["action": "annule"])
            self.appelCalendrier = call
            var dessus = vue
            while let p = dessus.presentedViewController { dessus = p }
            dessus.present(fiche, animated: true)
        }
    }
}

extension NidooPlugin: EKEventEditViewDelegate {
    public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
        controller.dismiss(animated: true)
        appelCalendrier?.resolve(["action": action == .saved ? "ajoute" : "annule"])
        appelCalendrier = nil
    }
}
