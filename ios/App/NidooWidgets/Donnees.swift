import AppIntents
import Foundation
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
        requete.setValue(apikey, forHTTPHeaderField: "apikey")
        requete.setValue("Bearer " + apikey, forHTTPHeaderField: "Authorization")
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
            sondage: Sondage(id: "s1", q: "Ce soir, on mange quoi ?", de: "papa", choix: ["Pizza", "Raclette", "Crêpes"], voix: [1, 3, 1], moi: 1)
        )
    }
}
