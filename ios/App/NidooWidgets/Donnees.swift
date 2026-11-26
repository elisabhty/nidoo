import AppIntents
import Foundation
import MapKit
import UIKit
import WidgetKit

/// Le serveur, vu des widgets : deux fonctions de la base, appelées avec la clé widget (jamais avec la session du compte).
enum API {
    enum Erreur: Error {
        case pasBranche
        case reseau
        case serveur(String)
    }

    static func appeler(_ fonction: String, _ corps: [String: Any] = [:]) async throws -> Etat {
        guard Partage.branche, let base = Partage.url, let apikey = Partage.apikey, let cle = Partage.cle,
              let url = URL(string: base + "/rest/v1/rpc/" + fonction)
        else { throw Erreur.pasBranche }
        var requete = URLRequest(url: url, timeoutInterval: 12)
        requete.httpMethod = "POST"
        requete.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // la clé publique du projet, dans l'en-tête « apikey » seulement (ce n'est pas un jeton de session)
        requete.setValue(apikey, forHTTPHeaderField: "apikey")
        var c = corps
        c["p_key"] = cle
        requete.httpBody = try? JSONSerialization.data(withJSONObject: c)
        let data: Data
        let reponse: URLResponse
        do {
            (data, reponse) = try await URLSession.shared.data(for: requete)
        } catch {
            throw Erreur.reseau
        }
        guard let http = reponse as? HTTPURLResponse else { throw Erreur.reseau }
        guard http.statusCode < 300 else {
            let objet = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let code = (objet?["message"] as? String) ?? "ERREUR_\(http.statusCode)"
            if code == "CLE_INCONNUE" {
                // la clé n'existe plus (proche retiré de la maison, trop d'appareils) : l'appli en demandera une autre
                Partage.reglages.set(cle, forKey: "cle_refusee")
            }
            throw Erreur.serveur(code)
        }
        do {
            return try JSONDecoder().decode(Etat.self, from: data)
        } catch {
            throw Erreur.serveur("REPONSE_ILLISIBLE")
        }
    }
}

/// Ce qu'un widget dessine à un instant donné.
struct Entree: TimelineEntry {
    var date: Date
    var etat: Etat?
    var local = Local()
    /// le proche choisi dans les réglages du widget
    var proche: String?
    /// taches, courses ou tout
    var liste = "taches"
    /// l'appli a-t-elle donné sa clé ?
    var branche = true
    /// la famille d'exemple (galerie des widgets)
    var apercu = false
    /// « Où sont mes proches ? » : la carte, dessinée pour la taille de ce widget
    var carte: CarteRendue?

    /// Dans la galerie des widgets (et tant que rien n'est chargé) : une famille d'exemple.
    static func exemple(_ date: Date = Date()) -> Entree { Entree(date: date, etat: .exemple, apercu: true) }
}

enum Source {
    static func entree() async -> Entree {
        guard Partage.branche else { return Entree(date: Date(), etat: nil, local: Memoire.local, branche: false) }
        return Entree(date: Date(), etat: await etat(), local: Memoire.local)
    }

    static func etat() async -> Etat? {
        // un bouton vient de ramener l'état à jour : inutile de le redemander
        if let frais = Memoire.etat(moinsDe: 20) { return frais }
        return await Demande.commune.etat()
    }

    /// La suite des instants où le widget change tout seul, sans rien redemander au serveur.
    static func chronologie(_ base: Entree) -> Timeline<Entree> {
        let maintenant = base.date
        var instants: [Date] = []
        // la confirmation « envoyé » et le message d'erreur s'effacent
        if let envoi = base.local.envoi { instants.append(Date(timeIntervalSince1970: envoi.le + Local.dureeConfirmation)) }
        if let le = base.local.erreurLe { instants.append(Date(timeIntervalSince1970: le + Local.dureeErreur)) }
        // une paire ratée au memory se referme
        for m in base.local.memory.values where m.ouvertes.count == 2 {
            instants.append(Date(timeIntervalSince1970: m.ouvertLe + Memory.pause))
        }
        // à minuit, « demain » devient « aujourd'hui »
        if let demain = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: maintenant)) {
            instants.append(demain.addingTimeInterval(2))
        }
        let suite = maintenant.addingTimeInterval(15 * 60)
        var entrees = [base]
        for i in instants.sorted() where i > maintenant {
            var e = base
            e.date = i
            entrees.append(e)
        }
        return Timeline(entries: entrees, policy: .after(suite))
    }
}

/// Plusieurs widgets se redessinent souvent en même temps : une seule question au serveur pour tous.
actor Demande {
    static let commune = Demande()
    private var enCours: Task<Etat?, Never>?

    func etat() async -> Etat? {
        if let enCours { return await enCours.value }
        let tache = Task<Etat?, Never> {
            if let e = try? await API.appeler("widget_etat") {
                Memoire.garder(e)
                return e
            }
            return Memoire.etat()
        }
        enCours = tache
        let e = await tache.value
        enCours = nil
        return e
    }
}

/// Les widgets sans réglage.
struct Fournisseur: TimelineProvider {
    func placeholder(in context: Context) -> Entree { .exemple() }

    func getSnapshot(in context: Context, completion: @escaping (Entree) -> Void) {
        if context.isPreview {
            completion(.exemple())
            return
        }
        Task { completion(await Source.entree()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entree>) -> Void) {
        Task { completion(Source.chronologie(await Source.entree())) }
    }
}

/// Le memory : tout est sur le téléphone, on ne demande rien au serveur.
struct FournisseurLocal: TimelineProvider {
    func placeholder(in context: Context) -> Entree { .exemple() }

    func getSnapshot(in context: Context, completion: @escaping (Entree) -> Void) {
        completion(context.isPreview ? .exemple() : Entree(date: Date(), etat: nil, local: Memoire.local))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entree>) -> Void) {
        completion(Source.chronologie(Entree(date: Date(), etat: nil, local: Memoire.local)))
    }
}

/// Les widgets où l'on choisit un proche.
struct FournisseurProche: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> Entree { .exemple() }

    func snapshot(for configuration: ChoixProche, in context: Context) async -> Entree {
        if context.isPreview { return .exemple() }
        var e = await Source.entree()
        e.proche = configuration.proche?.id
        return e
    }

    func timeline(for configuration: ChoixProche, in context: Context) async -> Timeline<Entree> {
        var e = await Source.entree()
        e.proche = configuration.proche?.id
        return Source.chronologie(e)
    }
}

/// « Où sont mes proches ? » : l'état de la maison, puis la carte à la taille du widget.
struct FournisseurOu: TimelineProvider {
    func placeholder(in context: Context) -> Entree { .exemple() }

    func getSnapshot(in context: Context, completion: @escaping (Entree) -> Void) {
        Task {
            var e: Entree
            if context.isPreview {
                e = .exemple()
            } else {
                e = await Source.entree()
            }
            e.carte = await CarteProches.pour(e.etat, f: context.family, widget: context.displaySize, date: e.date)
            completion(e)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entree>) -> Void) {
        Task {
            var e = await Source.entree()
            e.carte = await CarteProches.pour(e.etat, f: context.family, widget: context.displaySize, date: e.date)
            completion(Source.chronologie(e))
        }
    }
}

/// La carte d'un widget « Où sont mes proches ? » : un instantané de Plans, et l'endroit où tombe chacun dessus
/// (les têtes se dessinent par-dessus, voir CarteTetes).
struct CarteRendue: @unchecked Sendable {
    var image: UIImage
    /// où tombe chacun sur l'image, en points (l'origine en haut à gauche)
    var points: [String: CGPoint]
    var taille: CGSize
    /// combien de mètres fait un point de la carte (le halo d'une position approximative)
    var metresParPoint: Double
}

enum CarteProches {
    /// La place de la carte dans le widget : tout le petit, la gauche du moyen, le haut du grand.
    static func taille(_ f: WidgetFamily, widget: CGSize) -> CGSize {
        switch f {
        case .systemSmall: return widget
        case .systemMedium: return CGSize(width: (widget.width * 0.46).rounded(), height: widget.height)
        default: return CGSize(width: widget.width, height: (widget.height * 0.46).rounded())
        }
    }

    /// De la place autour des points : au-dessus pour les têtes (accrochées par leur pointe), dessous pour l'étiquette
    /// du petit, et sur les côtés.
    static func marges(_ f: WidgetFamily) -> (haut: Double, bas: Double, cote: Double) {
        f == .systemSmall ? (50, 36, 26) : (50, 16, 26)
    }

    /// Les positions à mettre sur la carte : celles qui sont partagées en ce moment, la mienne comprise.
    static func aMontrer(_ etat: Etat, date: Date) -> [Etat.Position] {
        (etat.positions ?? []).filter { !$0.finie(date) && etat.membre($0.id) != nil }
    }

    /// L'instantané de Plans qui montre tout le monde (au plus près : une rue, pas une maison).
    static func fabriquer(_ positions: [Etat.Position], taille: CGSize, f: WidgetFamily) async -> CarteRendue? {
        guard !positions.isEmpty, taille.width > 40, taille.height > 40 else { return nil }
        let m = marges(f)
        let latMoyenne = positions.map(\.la).reduce(0, +) / Double(positions.count)
        let ky = 111_195.0
        let kx = ky * max(cos(latMoyenne * .pi / 180), 0.05)
        let xs = positions.map { $0.lo * kx }
        let ys = positions.map { $0.la * ky }
        let x0 = xs.min() ?? 0, x1 = xs.max() ?? 0, y0 = ys.min() ?? 0, y1 = ys.max() ?? 0
        let utileL = max(Double(taille.width) - 2 * m.cote, 30)
        let utileH = max(Double(taille.height) - m.haut - m.bas, 30)
        let parPoint = max((x1 - x0) / utileL, (y1 - y0) / utileH, 3)
        // plus de place en haut (les têtes) qu'en bas : le groupe descend un peu sous le milieu de la carte
        let decale = (m.haut - m.bas) / 2 * parPoint
        let centre = CLLocationCoordinate2D(latitude: ((y0 + y1) / 2 + decale) / ky, longitude: (x0 + x1) / 2 / kx)
        let o = MKMapSnapshotter.Options()
        o.region = MKCoordinateRegion(
            center: centre,
            span: MKCoordinateSpan(latitudeDelta: Double(taille.height) * parPoint / ky, longitudeDelta: Double(taille.width) * parPoint / kx)
        )
        o.size = taille
        o.scale = 3
        o.mapType = .mutedStandard
        o.pointOfInterestFilter = .excludingAll
        o.showsBuildings = false
        o.traitCollection = UITraitCollection(userInterfaceStyle: .light)
        let outil = MKMapSnapshotter(options: o)
        let instantane: MKMapSnapshotter.Snapshot? = await withCheckedContinuation { suite in
            outil.start(with: .global(qos: .userInitiated)) { s, _ in
                _ = outil
                suite.resume(returning: s)
            }
        }
        guard let s = instantane else { return nil }
        var points: [String: CGPoint] = [:]
        for p in positions { points[p.id] = s.point(for: CLLocationCoordinate2D(latitude: p.la, longitude: p.lo)) }
        // l'échelle vraie, mesurée sur l'image (Plans ajuste la région à sa façon)
        let a = s.point(for: centre)
        let b = s.point(for: CLLocationCoordinate2D(latitude: centre.latitude + 0.01, longitude: centre.longitude))
        let ecart = Double(abs(a.y - b.y))
        return CarteRendue(image: s.image, points: points, taille: taille, metresParPoint: ecart > 0.1 ? 0.01 * ky / ecart : parPoint)
    }

    /// La carte du widget, dès que quelqu'un d'autre que moi partage sa position ; sans réseau, on n'attend pas plus
    /// de 6 s (le widget montre alors la liste seule).
    static func pour(_ etat: Etat?, f: WidgetFamily, widget: CGSize, date: Date = Date()) async -> CarteRendue? {
        guard let etat, !f.surEcranVerrouille else { return nil }
        let ps = aMontrer(etat, date: date)
        guard ps.contains(where: { $0.id != etat.moi }) else { return nil }
        let t = taille(f, widget: widget)
        return await withTaskGroup(of: CarteRendue?.self) { groupe in
            groupe.addTask { await fabriquer(ps, taille: t, f: f) }
            groupe.addTask {
                try? await Task.sleep(nanoseconds: 6_000_000_000)
                return nil
            }
            let premiere = await groupe.next() ?? nil
            groupe.cancelAll()
            return premiere
        }
    }
}

/// Le widget où l'on choisit sa liste.
struct FournisseurListe: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> Entree { .exemple() }

    func snapshot(for configuration: ChoixListe, in context: Context) async -> Entree {
        if context.isPreview { return .exemple() }
        var e = await Source.entree()
        e.liste = configuration.liste.rawValue
        return e
    }

    func timeline(for configuration: ChoixListe, in context: Context) async -> Timeline<Entree> {
        var e = await Source.entree()
        e.liste = configuration.liste.rawValue
        return Source.chronologie(e)
    }
}

extension Etat {
    /// La famille d'exemple (galerie des widgets, aperçus) : les personnages sont dans le catalogue d'images.
    static var exemple: Etat {
        let cal = Calendar.current
        let auj = cal.startOfDay(for: Date())
        func jour(_ n: Int) -> String {
            let d = cal.date(byAdding: .day, value: n, to: auj) ?? auj
            let c = cal.dateComponents([.year, .month, .day], from: d)
            return String(format: "%04d-%02d-%02d", c.year ?? 2026, c.month ?? 1, c.day ?? 1)
        }
        func ilYA(_ minutes: Double) -> String {
            ISO8601DateFormatter().string(from: Date().addingTimeInterval(-minutes * 60))
        }
        return Etat(
            v: 1,
            maintenant: ilYA(0),
            jour: jour(0),
            moi: "moi",
            famille: Famille(id: "f", n: "Les Martin", m: "maison", e: 128),
            membres: [
                Membre(id: "moi", n: "Moi", a: "exemple:ex-1", c: "lavande", h: "heureux", tel: true),
                Membre(id: "mamie", n: "Mamie", a: "exemple:ex-2", c: "rose", h: "serein", tel: true),
                Membre(id: "papa", n: "Papa", a: "exemple:ex-3", c: "ciel", h: "motive", tel: true),
                Membre(id: "lea", n: "Léa", a: "exemple:ex-4", c: "peche", h: "fete", tel: true),
                Membre(id: "tom", n: "Tom", a: "exemple:ex-5", c: "mousse", h: nil, tel: false),
            ],
            recues: [
                Recue(id: "r1", de: "mamie", k: "bisou", m: nil, q: ilYA(4), vu: false),
                Recue(id: "r2", de: "lea", k: "calin", m: nil, q: ilYA(95), vu: true),
                Recue(id: "r3", de: "papa", k: "courage", m: nil, q: ilYA(60 * 26), vu: true),
            ],
            envoyees: [Envoyee(a: "mamie", k: "coeur", q: ilYA(200))],
            recues_jour: 2,
            dates: [
                Jour(id: "d1", t: "Anniversaire de Léa", k: "anniversaire", s: nil, j: jour(5), f: jour(5), h: nil, l: nil, an: true),
                Jour(id: "d2", t: "Repas chez Mamie", k: "evenement", s: nil, j: jour(8), f: jour(8), h: "12:30", l: "Chez Mamie", an: false),
                Jour(id: "d3", t: "Dentiste de Tom", k: "rdv", s: nil, j: jour(12), f: jour(12), h: "17:15", l: nil, an: false),
                Jour(id: "d4", t: "Vacances à la mer", k: "evenement", s: nil, j: jour(30), f: jour(37), h: nil, l: nil, an: false),
            ],
            liste: [
                Chose(id: "t1", k: "tache", t: "Sortir les poubelles", p: "papa"),
                Chose(id: "t2", k: "tache", t: "Ranger la chambre", p: "lea"),
                Chose(id: "t3", k: "tache", t: "Appeler Mamie", p: nil),
                Chose(id: "t4", k: "tache", t: "Arroser les plantes", p: "tom"),
                Chose(id: "t5", k: "tache", t: "Réserver le train", p: "moi"),
                Chose(id: "c1", k: "course", t: "Lait", p: nil),
                Chose(id: "c2", k: "course", t: "Pain", p: nil),
                Chose(id: "c3", k: "course", t: "Bougies d’anniversaire", p: nil),
                Chose(id: "c4", k: "course", t: "Farine", p: nil),
            ],
            parties: [
                Partie(id: "p1", k: "morpion", p1: "moi", p2: "mamie", tour: "moi", fini: false, gagne: nil,
                       g: [1, 0, 2, 0, 1, 0, 0, 0, 2], der: 8, ligne: nil, q: ilYA(3)),
                Partie(id: "p2", k: "puissance4", p1: "lea", p2: "moi", tour: "moi", fini: false, gagne: nil,
                       g: [0, 0, 0, 0, 0, 0, 0,
                           0, 0, 0, 0, 0, 0, 0,
                           0, 0, 0, 1, 0, 0, 0,
                           0, 0, 2, 2, 0, 0, 0,
                           0, 1, 1, 2, 1, 0, 0,
                           2, 1, 2, 1, 1, 2, 0], der: 17, ligne: nil, q: ilYA(12)),
            ],
            compagnon: Compagnon(e: "renard", n: "Cannelle", a: 34, tenue: nil, friandises: 3),
            sondage: Sondage(id: "s1", q: "Ce soir, on mange quoi ?", de: "papa", choix: ["Pizza", "Raclette", "Crêpes"], voix: [1, 3, 1], moi: 1),
            positions: [
                Position(id: "lea", la: 45.9061, lo: 6.1453, p: 20, l: "École", v: nil, b: 18, q: ilYA(4)),
                Position(id: "papa", la: 45.9135, lo: 6.13, p: 20, l: "Avenue de Brogny", v: "Annecy", b: 64, q: ilYA(12)),
                Position(id: "mamie", la: 45.8993, lo: 6.1244, p: 20, l: "Rue Sainte-Claire", v: "Annecy", b: 88, q: ilYA(130)),
                Position(id: "moi", la: 45.9029, lo: 6.1269, p: 12, l: "Place de l’Hôtel de Ville", v: "Annecy", b: 71, q: ilYA(1)),
            ],
            en_route: true
        )
    }
}
