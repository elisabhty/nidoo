import Foundation
import UIKit
import Capacitor
import WidgetKit
import EventKit
import EventKitUI
import CoreLocation

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
        CAPPluginMethod(name: "positionAutorisation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "positionMaintenant", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "positionSuivre", returnType: CAPPluginReturnPromise),
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
        // plus de maison : la position ne suit plus personne
        Suivi.partage.arreter()
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

extension NidooPlugin {
    /// « Où est la famille » : l'autorisation de l'iPhone (inconnue, refusee, active, toujours).
    @objc func positionAutorisation(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["etat": Suivi.partage.etat]) }
    }

    /// La position maintenant (demande l'autorisation la première fois), avec la rue, la ville et la batterie.
    @objc func positionMaintenant(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let s = Suivi.partage
            s.demander(toujours: false) {
                guard s.etat != "refusee" else { return call.reject("POSITION_REFUSEE") }
                s.maintenant { resultat in
                    switch resultat {
                    case .failure(let e):
                        call.reject((e as? Suivi.Erreur) == .delai ? "POSITION_DELAI" : "POSITION_INDISPONIBLE")
                    case .success(let l):
                        s.adresse(l) { lieu, ville in
                            var r: JSObject = ["lat": l.coordinate.latitude, "lon": l.coordinate.longitude, "precision": Int(l.horizontalAccuracy.rounded())]
                            if let lieu { r["lieu"] = lieu }
                            if let ville { r["ville"] = ville }
                            if let b = Suivi.batterie { r["batterie"] = b }
                            call.resolve(r)
                        }
                    }
                }
            }
        }
    }

    /// Suivre ses déplacements en arrière-plan (demande « Toujours »), ou arrêter.
    @objc func positionSuivre(_ call: CAPPluginCall) {
        let oui = call.getBool("oui") ?? false
        DispatchQueue.main.async {
            let s = Suivi.partage
            guard oui else {
                s.arreter()
                return call.resolve(["etat": s.etat])
            }
            s.suivre = true
            s.demander(toujours: true) {
                s.reprendre()
                call.resolve(["etat": s.etat])
            }
        }
    }
}

/// « Où est la famille » (Elisa, 21 novembre) : la position du téléphone, partagée avec la famille si on l'a choisi.
/// En arrière-plan, l'iPhone prévient quand on a bougé d'environ 500 m (« changements importants » : peu de batterie,
/// pas de flèche bleue) et relance l'appli si elle était fermée ; la position part alors à la maison avec la clé widget
/// (la session du compte reste dans l'appli). Appli ouverte : une position fraîche à chaque retour.
final class Suivi: NSObject, CLLocationManagerDelegate {
    static let partage = Suivi()

    enum Erreur: Error { case delai, indisponible }

    private let gestionnaire = CLLocationManager()
    private var attentes: [(Result<CLLocation, Error>) -> Void] = []
    private var apresAutorisation: [() -> Void] = []
    private var minuterie: Timer?

    /// Suivre en arrière-plan : réglé par l'appli, gardé dans le groupe (l'appli peut être relancée sans son écran).
    var suivre: Bool {
        get { Partage.reglages.bool(forKey: "position_suivre") }
        set { Partage.reglages.set(newValue, forKey: "position_suivre") }
    }

    private override init() {
        super.init()
        gestionnaire.delegate = self
        gestionnaire.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        // l'appli revient au premier plan : une position fraîche pour la famille
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.rafraichir()
        }
    }

    var etat: String {
        switch gestionnaire.authorizationStatus {
        case .notDetermined: return "inconnue"
        case .denied, .restricted: return "refusee"
        case .authorizedAlways: return "toujours"
        default: return "active"
        }
    }

    /// Au lancement (même relancée en arrière-plan par iOS après un déplacement) : reprendre le suivi.
    func reprendre() {
        guard suivre, CLLocationManager.significantLocationChangeMonitoringAvailable() else { return }
        let s = gestionnaire.authorizationStatus
        guard s == .authorizedAlways || s == .authorizedWhenInUse else { return }
        gestionnaire.startMonitoringSignificantLocationChanges()
    }

    func arreter() {
        suivre = false
        gestionnaire.stopMonitoringSignificantLocationChanges()
    }

    /// Demande l'autorisation si besoin. « Toujours » : iOS ne la propose qu'une fois ; ensuite on continue sans attendre.
    func demander(toujours: Bool, puis: @escaping () -> Void) {
        let s = gestionnaire.authorizationStatus
        if s == .notDetermined {
            apresAutorisation.append(puis)
            if toujours { gestionnaire.requestAlwaysAuthorization() } else { gestionnaire.requestWhenInUseAuthorization() }
            return
        }
        if toujours && s == .authorizedWhenInUse {
            apresAutorisation.append(puis)
            gestionnaire.requestAlwaysAuthorization()
            // si iOS ne montre rien (déjà demandé une fois), on n'attend pas
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                if self?.gestionnaire.authorizationStatus == .authorizedWhenInUse { self?.vider() }
            }
            return
        }
        puis()
    }

    private func vider() {
        let a = apresAutorisation
        apresAutorisation = []
        a.forEach { $0() }
    }

    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        if m.authorizationStatus != .notDetermined { vider() }
        if m.authorizationStatus == .denied { m.stopMonitoringSignificantLocationChanges() }
    }

    /// Une seule position, tout de suite (20 s au plus).
    func maintenant(_ fini: @escaping (Result<CLLocation, Error>) -> Void) {
        attentes.append(fini)
        gestionnaire.requestLocation()
        minuterie?.invalidate()
        minuterie = Timer.scheduledTimer(withTimeInterval: 20, repeats: false) { [weak self] _ in
            guard let self, !self.attentes.isEmpty else { return }
            let a = self.attentes
            self.attentes = []
            a.forEach { $0(.failure(Erreur.delai)) }
        }
    }

    func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let l = locations.last else { return }
        if !attentes.isEmpty {
            minuterie?.invalidate()
            let a = attentes
            attentes = []
            a.forEach { $0(.success(l)) }
        } else {
            // un déplacement important, appli ouverte ou non
            envoyer(l)
        }
    }

    func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        guard !attentes.isEmpty else { return }
        minuterie?.invalidate()
        let a = attentes
        attentes = []
        a.forEach { $0(.failure(Erreur.indisponible)) }
    }

    /// Appli ouverte : une position fraîche si la dernière envoyée a plus de deux minutes.
    func rafraichir() {
        guard suivre, Partage.branche else { return }
        let s = gestionnaire.authorizationStatus
        guard s == .authorizedAlways || s == .authorizedWhenInUse else { return }
        reprendre()
        let le = Partage.reglages.double(forKey: "position_le")
        guard Date().timeIntervalSince1970 - le > 120 else { return }
        maintenant { [weak self] r in
            if case .success(let l) = r { self?.envoyer(l) }
        }
    }

    /// La rue et la ville, par le géocodage d'Apple (sur le téléphone).
    func adresse(_ l: CLLocation, _ fini: @escaping (String?, String?) -> Void) {
        CLGeocoder().reverseGeocodeLocation(l, preferredLocale: Locale(identifier: "fr_FR")) { marques, _ in
            let p = marques?.first
            // un lieu qui a un nom (une gare, une école) plutôt que « 12 Rue… » quand il y en a un
            let nom = p?.areasOfInterest?.first ?? p?.thoroughfare ?? p?.name
            fini(nom, p?.locality ?? p?.subAdministrativeArea)
        }
    }

    static var batterie: Int? {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let n = UIDevice.current.batteryLevel
        return n < 0 ? nil : Int((n * 100).rounded())
    }

    /// La position part à chaque maison où on la partage (clé widget) ; plus aucune : le suivi s'arrête.
    func envoyer(_ l: CLLocation) {
        guard suivre, Partage.branche else { return }
        // une vieille position gardée par iOS : inutile
        guard abs(l.timestamp.timeIntervalSinceNow) < 600 else { return }
        Partage.reglages.set(Date().timeIntervalSince1970, forKey: "position_le")
        let tache = Tache()
        tache.id = UIApplication.shared.beginBackgroundTask(withName: "position") { tache.finir() }
        adresse(l) { lieu, ville in
            Suivi.publier(l, lieu: lieu, ville: ville) { n in
                DispatchQueue.main.async {
                    if n == 0 { self.arreter() }
                    WidgetCenter.shared.reloadAllTimelines()
                    tache.finir()
                }
            }
        }
    }

    /// Le temps qu'iOS laisse en arrière-plan pour finir l'envoi.
    private final class Tache {
        var id = UIBackgroundTaskIdentifier.invalid
        func finir() {
            guard id != .invalid else { return }
            UIApplication.shared.endBackgroundTask(id)
            id = .invalid
        }
    }

    /// widget_position (supabase/migrations/20261121220000_positions.sql) : le nombre de maisons mises à jour (nil : erreur).
    static func publier(_ l: CLLocation, lieu: String?, ville: String?, fini: @escaping (Int?) -> Void) {
        guard let base = Partage.url, let apikey = Partage.apikey, let cle = Partage.cle,
              let url = URL(string: base + "/rest/v1/rpc/widget_position") else { return fini(nil) }
        var r = URLRequest(url: url, timeoutInterval: 20)
        r.httpMethod = "POST"
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue(apikey, forHTTPHeaderField: "apikey")
        var corps: [String: Any] = [
            "p_key": cle, "p_lat": l.coordinate.latitude, "p_lon": l.coordinate.longitude,
            "p_precision": Int(max(0, l.horizontalAccuracy).rounded()),
        ]
        if let lieu { corps["p_lieu"] = lieu }
        if let ville { corps["p_ville"] = ville }
        if let b = batterie { corps["p_batterie"] = b }
        r.httpBody = try? JSONSerialization.data(withJSONObject: corps)
        URLSession.shared.dataTask(with: r) { data, rep, _ in
            guard let data, let http = rep as? HTTPURLResponse, http.statusCode < 300 else { return fini(nil) }
            fini((try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)) as? Int)
        }.resume()
    }
}

extension NidooPlugin: EKEventEditViewDelegate {
    public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
        controller.dismiss(animated: true)
        appelCalendrier?.resolve(["action": action == .saved ? "ajoute" : "annule"])
        appelCalendrier = nil
    }
}
