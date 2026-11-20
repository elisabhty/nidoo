import AppIntents
import Foundation
import WidgetKit

// Les boutons des widgets. Chacun agit sans ouvrir l'appli : il appelle le serveur avec la clé widget,
// garde l'état reçu en retour, puis les widgets se redessinent.

enum Action {
    /// Fait l'action sur le serveur ; `reussi` note ce qu'il faut montrer ensuite (« envoyé »…).
    static func faire(_ action: String, _ arguments: [String: Any] = [:], reussi: ((inout Local) -> Void)? = nil) async {
        var local = Memoire.local
        do {
            let etat = try await API.appeler("widget_agir", ["p_action": action, "p_args": arguments])
            Memoire.garder(etat)
            local.erreur = nil
            local.erreurLe = nil
            reussi?(&local)
        } catch {
            local.erreur = Mots.erreur(error)
            local.erreurLe = Date().timeIntervalSince1970
        }
        Memoire.local = local
        WidgetCenter.shared.reloadAllTimelines()
    }
}

// ───────── Choisir, dans les réglages d'un widget ─────────

struct ProcheEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Proche"
    static var defaultQuery = ProcheQuery()

    var id: String
    var nom: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(nom)") }
}

struct ProcheQuery: EntityQuery {
    private func tous() -> [ProcheEntity] {
        guard Partage.branche, let etat = Memoire.etat() else { return [] }
        return etat.autres.map { ProcheEntity(id: $0.id, nom: $0.n) }
    }

    func entities(for identifiers: [String]) async throws -> [ProcheEntity] {
        tous().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [ProcheEntity] { tous() }
}

struct ChoixProche: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choisir un proche"
    static var description = IntentDescription("Le proche de ce widget. Sans choix : le dernier à avoir pensé à toi.")

    @Parameter(title: "Proche")
    var proche: ProcheEntity?
}

enum QuelleListe: String, AppEnum {
    case taches
    case courses
    case tout

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Liste"
    static var caseDisplayRepresentations: [QuelleListe: DisplayRepresentation] = [
        .taches: "Les tâches",
        .courses: "Les courses",
        .tout: "Tout",
    ]
}

struct ChoixListe: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choisir la liste"
    static var description = IntentDescription("Ce que ce widget montre : les tâches, les courses, ou tout.")

    @Parameter(title: "Liste", default: .taches)
    var liste: QuelleListe
}

// ───────── Les attentions ─────────

struct EnvoyerAttention: AppIntent {
    static var title: LocalizedStringResource = "Envoyer une attention"
    static var isDiscoverable: Bool = false

    @Parameter(title: "À")
    var a: String
    @Parameter(title: "Geste")
    var k: String

    init() {}
    init(a: String, k: String) {
        self.a = a
        self.k = k
    }

    func perform() async throws -> some IntentResult {
        let a = self.a, k = self.k
        await Action.faire("attention", ["a": a, "k": k]) { local in
            local.envoi = Local.Envoi(a: a, k: k, le: Date().timeIntervalSince1970)
        }
        return .result()
    }
}

/// Le bouton du Centre de contrôle : un bisou au dernier proche à avoir pensé à moi.
struct BisouAuProche: AppIntent {
    static var title: LocalizedStringResource = "Envoyer un bisou"
    static var description = IntentDescription("Envoie un bisou au dernier proche qui a pensé à toi.")

    func perform() async throws -> some IntentResult {
        guard let etat = await Source.etat(), let proche = etat.proche(nil) else { return .result() }
        await Action.faire("attention", ["a": proche.id, "k": "bisou"]) { local in
            local.envoi = Local.Envoi(a: proche.id, k: "bisou", le: Date().timeIntervalSince1970)
        }
        return .result()
    }
}

struct ChoisirHumeur: AppIntent {
    static var title: LocalizedStringResource = "Dire mon humeur"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Humeur")
    var h: String

    init() {}
    init(h: String) { self.h = h }

    func perform() async throws -> some IntentResult {
        await Action.faire("humeur", ["h": h])
        return .result()
    }
}

// ───────── Organiser ─────────

struct CocherTache: AppIntent {
    static var title: LocalizedStringResource = "Cocher"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Tâche")
    var id: String

    init() {}
    init(id: String) { self.id = id }

    func perform() async throws -> some IntentResult {
        await Action.faire("tache", ["id": id, "fait": true])
        return .result()
    }
}

struct Voter: AppIntent {
    static var title: LocalizedStringResource = "Voter"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Sondage")
    var id: String
    @Parameter(title: "Choix")
    var c: Int

    init() {}
    init(id: String, c: Int) {
        self.id = id
        self.c = c
    }

    func perform() async throws -> some IntentResult {
        await Action.faire("vote", ["id": id, "c": c])
        return .result()
    }
}

// ───────── Jouer ─────────

struct LancerPartie: AppIntent {
    static var title: LocalizedStringResource = "Lancer une partie"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Jeu")
    var k: String
    @Parameter(title: "Contre")
    var a: String

    init() {}
    init(k: String, a: String) {
        self.k = k
        self.a = a
    }

    func perform() async throws -> some IntentResult {
        await Action.faire("jeu_lancer", ["k": k, "a": a])
        return .result()
    }
}

struct JouerCoup: AppIntent {
    static var title: LocalizedStringResource = "Jouer"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Partie")
    var id: String
    @Parameter(title: "Coup")
    var c: Int

    init() {}
    init(id: String, c: Int) {
        self.id = id
        self.c = c
    }

    func perform() async throws -> some IntentResult {
        await Action.faire("jeu_coup", ["id": id, "c": c])
        return .result()
    }
}

struct DonnerFriandise: AppIntent {
    static var title: LocalizedStringResource = "Donner une friandise"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await Action.faire("friandise")
        return .result()
    }
}

/// Le memory : tout se passe sur le téléphone.
struct RetournerCarte: AppIntent {
    static var title: LocalizedStringResource = "Retourner une carte"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Carte")
    var i: Int
    @Parameter(title: "Paires")
    var paires: Int

    init() {}
    init(i: Int, paires: Int) {
        self.i = i
        self.paires = paires
    }

    func perform() async throws -> some IntentResult {
        var local = Memoire.local
        var m = local.memory[String(paires)] ?? Memory.nouveau(paires: paires)
        if m.cartes.count != paires * 2 { m = Memory.nouveau(paires: paires, record: m.record) }
        m.retourner(i)
        local.memory[String(paires)] = m
        Memoire.local = local
        return .result()
    }
}

struct NouveauMemory: AppIntent {
    static var title: LocalizedStringResource = "Rejouer au memory"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Paires")
    var paires: Int

    init() {}
    init(paires: Int) { self.paires = paires }

    func perform() async throws -> some IntentResult {
        var local = Memoire.local
        local.memory[String(paires)] = Memory.nouveau(paires: paires, record: local.memory[String(paires)]?.record)
        Memoire.local = local
        return .result()
    }
}
