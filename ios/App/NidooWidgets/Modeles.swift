import Foundation

/// L'état de la maison tel que le serveur le donne aux widgets (fonction widget_etat de la base).
struct Etat: Codable {
    struct Famille: Codable {
        var id: String
        var n: String
        /// maison, appartement ou chalet
        var m: String
        /// les étoiles de la maison
        var e: Int
    }

    struct Membre: Codable, Identifiable {
        var id: String
        var n: String
        /// son personnage (« exemple:ex-1 » pour les proches d'exemple)
        var a: String
        var c: String
        /// son humeur du jour
        var h: String?
        /// a un téléphone (on peut jouer contre lui)
        var tel: Bool
    }

    struct Recue: Codable, Identifiable {
        var id: String
        var de: String
        var k: String
        var m: String?
        var q: String
        var vu: Bool
    }

    struct Envoyee: Codable {
        var a: String
        var k: String
        var q: String
    }

    struct Jour: Codable, Identifiable {
        var id: String
        var t: String
        var k: String
        var s: String?
        /// le jour (AAAA-MM-JJ) de la prochaine fois, et son dernier jour
        var j: String
        var f: String
        var h: String?
        var l: String?
        var an: Bool
    }

    struct Chose: Codable, Identifiable {
        var id: String
        /// course ou tache
        var k: String
        var t: String
        var p: String?
    }

    struct Partie: Codable, Identifiable {
        var id: String
        var k: String
        var p1: String
        var p2: String
        var tour: String?
        var fini: Bool
        var gagne: String?
        /// la grille : 0 vide, 1 celui qui a invité, 2 l'autre
        var g: [Int]
        var der: Int?
        var ligne: [Int]?
        var q: String

        func adversaire(de moi: String) -> String { p1 == moi ? p2 : p1 }
        func camp(de qui: String) -> Int { p1 == qui ? 1 : 2 }
    }

    struct Compagnon: Codable {
        var e: String
        var n: String
        var a: Int
        var tenue: String?
        var friandises: Int
    }

    struct Sondage: Codable {
        var id: String
        var q: String?
        var de: String
        var choix: [String]
        var voix: [Int]
        var moi: Int?
    }

    /// « Où est la famille » : la dernière position de ceux qui la partagent.
    struct Position: Codable, Identifiable {
        var id: String
        var la: Double
        var lo: Double
        var p: Int?
        /// la rue (ou le lieu), la ville, la batterie du téléphone
        var l: String?
        var v: String?
        var b: Int?
        var q: String

        /// « Rue Sainte-Claire, Annecy » ; sans rue : la ville.
        var libelle: String {
            if let l, let v, !l.localizedCaseInsensitiveContains(v) { return "\(l), \(v)" }
            return l ?? v ?? "Position partagée"
        }
    }

    var v: Int
    var maintenant: String
    var jour: String
    var moi: String
    var famille: Famille
    var membres: [Membre]
    var recues: [Recue]
    var envoyees: [Envoyee]
    var recues_jour: Int
    var dates: [Jour]
    var liste: [Chose]
    var parties: [Partie]
    var compagnon: Compagnon?
    var sondage: Sondage?
    /// absent des états gardés avant « Où est la famille »
    var positions: [Position]?

    func membre(_ id: String?) -> Membre? {
        guard let id else { return nil }
        return membres.first { $0.id == id }
    }

    var moiMeme: Membre? { membre(moi) }
    var autres: [Membre] { membres.filter { $0.id != moi } }

    /// Le proche d'un widget : celui qu'on a choisi, sinon le dernier à avoir pensé à moi, sinon le premier de la famille.
    func proche(_ choisi: String?, avecTelephone: Bool = false) -> Membre? {
        let possibles = avecTelephone ? autres.filter { $0.tel } : autres
        if let choisi, let m = possibles.first(where: { $0.id == choisi }) { return m }
        if let r = recues.first, let m = possibles.first(where: { $0.id == r.de }) { return m }
        return possibles.first(where: { $0.tel }) ?? possibles.first
    }

    /// La partie à montrer : celle en cours contre ce proche, sinon la dernière finie contre lui.
    func partie(_ jeu: String, contre adversaire: String?) -> Partie? {
        let miennes = parties.filter { $0.k == jeu && (adversaire == nil || $0.adversaire(de: moi) == adversaire) }
        return miennes.first(where: { !$0.fini }) ?? miennes.first
    }

    func choses(_ liste: String) -> [Chose] {
        switch liste {
        case "courses": return self.liste.filter { $0.k == "course" }
        case "tout": return self.liste
        default: return self.liste.filter { $0.k == "tache" }
        }
    }
}

/// Ce que les widgets gardent pour eux sur le téléphone : la confirmation d'un envoi, la dernière erreur, le memory.
struct Local: Codable {
    struct Envoi: Codable {
        var a: String
        var k: String
        var le: Double
    }

    var envoi: Envoi?
    var erreur: String?
    var erreurLe: Double?
    /// les parties de memory, par nombre de paires
    var memory: [String: Memory] = [:]

    /// Vient-on d'envoyer ce geste à ce proche ? (la confirmation reste quelques secondes)
    func vientDEnvoyer(a: String, k: String? = nil, date: Date) -> Bool {
        guard let envoi, envoi.a == a, k == nil || envoi.k == k else { return false }
        let depuis = date.timeIntervalSince1970 - envoi.le
        return depuis >= -2 && depuis < Local.dureeConfirmation
    }

    func erreurVisible(_ date: Date) -> String? {
        guard let erreur, let erreurLe else { return nil }
        let depuis = date.timeIntervalSince1970 - erreurLe
        return depuis >= -2 && depuis < Local.dureeErreur ? erreur : nil
    }

    static let dureeConfirmation: Double = 6
    static let dureeErreur: Double = 8
}

/// Le memory des animaux : il se joue tout seul dans le widget, sans serveur.
struct Memory: Codable {
    /// l'animal de chaque carte
    var cartes: [Int]
    var trouvees: [Int] = []
    /// les cartes retournées en ce moment (0 à 2)
    var ouvertes: [Int] = []
    var ouvertLe: Double = 0
    var coups = 0
    var record: Int?

    static let animaux = ["panda", "renard", "ours", "lapin", "chat", "chien", "hibou", "koala", "lion", "pingouin", "grenouille", "licorne"]
    /// Une paire ratée reste visible ce temps-là, puis se referme toute seule.
    static let pause: Double = 2.2

    static func nouveau(paires: Int, record: Int? = nil) -> Memory {
        let choisis = Array(animaux.indices.shuffled().prefix(paires))
        return Memory(cartes: (choisis + choisis).shuffled(), record: record)
    }

    var gagne: Bool { !cartes.isEmpty && trouvees.count == cartes.count }

    /// Les cartes à montrer face visible à cet instant.
    func visibles(_ date: Date) -> [Int] {
        if ouvertes.count == 2, date.timeIntervalSince1970 - ouvertLe >= Memory.pause { return trouvees }
        return trouvees + ouvertes
    }

    mutating func retourner(_ i: Int, date: Date = Date()) {
        guard i >= 0, i < cartes.count, !trouvees.contains(i) else { return }
        if ouvertes.count == 2 { ouvertes = [] }
        guard !ouvertes.contains(i) else { return }
        ouvertes.append(i)
        ouvertLe = date.timeIntervalSince1970
        guard ouvertes.count == 2 else { return }
        coups += 1
        if cartes[ouvertes[0]] == cartes[ouvertes[1]] {
            trouvees += ouvertes
            ouvertes = []
            if gagne, coups < (record ?? Int.max) { record = coups }
        }
    }
}

/// La mémoire des widgets, dans le groupe d'apps.
enum Memoire {
    static func garder(_ e: Etat) {
        guard let d = try? JSONEncoder().encode(e) else { return }
        Partage.reglages.set(d, forKey: "etat")
        Partage.reglages.set(Date().timeIntervalSince1970, forKey: "etat_le")
    }

    /// Le dernier état connu ; `moinsDe` : seulement s'il a été reçu depuis moins de tant de secondes.
    static func etat(moinsDe age: Double = .infinity) -> Etat? {
        let le = Partage.reglages.double(forKey: "etat_le")
        guard Date().timeIntervalSince1970 - le < age, let d = Partage.reglages.data(forKey: "etat") else { return nil }
        return try? JSONDecoder().decode(Etat.self, from: d)
    }

    static var local: Local {
        get {
            guard let d = Partage.reglages.data(forKey: "local"), let l = try? JSONDecoder().decode(Local.self, from: d) else { return Local() }
            return l
        }
        set {
            if let d = try? JSONEncoder().encode(newValue) { Partage.reglages.set(d, forKey: "local") }
        }
    }
}

/// Les dates et les durées, dites simplement.
enum Temps {
    static let fr = Locale(identifier: "fr_FR")

    static func date(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: iso) { return d }
        guard let r = iso.range(of: #"\.\d+"#, options: .regularExpression) else { return nil }
        var sans = iso
        sans.removeSubrange(r)
        return f.date(from: sans)
    }

    /// « à l’instant », « il y a 5 min », « il y a 2 h », « hier », « le 12 nov. »
    static func ilYA(_ iso: String, maintenant: Date) -> String {
        guard let d = date(iso) else { return "" }
        let min = max(0, Int((maintenant.timeIntervalSince(d) / 60).rounded()))
        if min < 2 { return "à l’instant" }
        if min < 60 { return "il y a \(min) min" }
        let cal = Calendar.current
        if min < 6 * 60 || cal.isDate(d, inSameDayAs: maintenant) { return "il y a \(Int((Double(min) / 60).rounded())) h" }
        if let hier = cal.date(byAdding: .day, value: -1, to: maintenant), cal.isDate(d, inSameDayAs: hier) { return "hier" }
        let f = DateFormatter()
        f.locale = fr
        f.dateFormat = "d MMM"
        return "le \(f.string(from: d))"
    }

    /// « AAAA-MM-JJ » : ce jour-là, à minuit, ici.
    static func jour(_ texte: String) -> Date? {
        let p = texte.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    /// Dans combien de jours (0 : aujourd'hui ; négatif : déjà commencé).
    static func dans(_ texte: String, depuis: Date) -> Int {
        guard let j = jour(texte) else { return 0 }
        let cal = Calendar.current
        return cal.dateComponents([.day], from: cal.startOfDay(for: depuis), to: j).day ?? 0
    }

    static func dansTexte(_ n: Int, court: Bool = false) -> String {
        if n <= 0 { return court ? "auj." : "Aujourd’hui" }
        if n == 1 { return court ? "demain" : "Demain" }
        return court ? "\(n) j" : "Dans \(n) jours"
    }

    /// « mer. 25 nov. »
    static func jourCourt(_ texte: String) -> String {
        guard let j = jour(texte) else { return texte }
        let f = DateFormatter()
        f.locale = fr
        f.dateFormat = "EEE d MMM"
        return f.string(from: j)
    }

    static func numero(_ texte: String) -> String {
        guard let j = jour(texte) else { return "" }
        return String(Calendar.current.component(.day, from: j))
    }

    /// « nov. »
    static func mois(_ texte: String) -> String {
        guard let j = jour(texte) else { return "" }
        let f = DateFormatter()
        f.locale = fr
        f.dateFormat = "MMM"
        return f.string(from: j)
    }

    /// « à l’instant », « il y a 5 min », « il y a 2 h », « hier », « lun. »
    static func ilYA(_ iso: String, depuis: Date) -> String {
        guard let d = date(iso) else { return "" }
        let s = max(0, depuis.timeIntervalSince(d))
        if s < 90 { return "à l’instant" }
        if s < 3600 { return "il y a \(Int(s / 60)) min" }
        if s < 86400 { return "il y a \(Int(s / 3600)) h" }
        if s < 172800 { return "hier" }
        let f = DateFormatter()
        f.locale = fr
        f.dateFormat = "EEE d MMM"
        return f.string(from: d)
    }
}

/// Les mots de l'appli.
enum Mots {
    static let gestes = ["coeur", "calin", "courage", "bisou"]

    /// « Mamie… t’envoie des bisous »
    static func dit(_ geste: String) -> String {
        switch geste {
        case "coeur": return "pense à toi"
        case "calin": return "t’envoie un gros câlin"
        case "courage": return "t’envoie du courage"
        case "bisou": return "t’envoie des bisous"
        default: return "t’a écrit un petit mot"
        }
    }

    static func gesteNom(_ geste: String) -> String {
        switch geste {
        case "coeur": return "Je pense à toi"
        case "calin": return "Câlin"
        case "courage": return "Courage"
        case "bisou": return "Bisou"
        default: return "Petit mot"
        }
    }

    static let humeurs: [(cle: String, nom: String, couleur: UInt32)] = [
        ("heureux", "Au top", 0xF5B700), ("serein", "Zen", 0x12A594), ("motive", "À fond", 0xF76B15), ("fete", "En fête", 0xD6409F),
        ("fatigue", "Fatigue", 0x8E8AA6), ("stresse", "Stress", 0xE5484D), ("nostalgique", "Nostalgie", 0x6E56CF), ("triste", "Coup de mou", 0x3E9BE9),
    ]

    static func art(date k: String) -> String {
        switch k {
        case "anniversaire": return "picto-gateau"
        case "rdv": return "picto-lieu"
        default: return "picto-fete"
        }
    }

    static func erreur(_ e: Error) -> String {
        guard let e = e as? API.Erreur else { return "Ça n’a pas marché" }
        switch e {
        case .pasBranche: return "Ouvre NIDOO d’abord"
        case .reseau: return "Pas de réseau"
        case .serveur(let code):
            switch code {
            case "CLE_INCONNUE": return "Ouvre NIDOO pour rebrancher"
            case "PAS_TON_TOUR": return "Pas encore ton tour"
            case "COUP_INTERDIT", "COLONNE_PLEINE": return "Case déjà prise"
            case "PARTIE_FINIE": return "La partie est finie"
            case "ADVERSAIRE_INCONNU": return "Ce proche n’a pas de téléphone"
            case "TROP_DE_PARTIES": return "Trop de parties en cours"
            case "DOUCEMENT": return "Doucement ! Réessaie dans un instant"
            case "PLUS_DE_FRIANDISES": return "Plus de friandises"
            case "PAS_DE_COMPAGNON": return "Pas encore de compagnon"
            default: return "Ça n’a pas marché"
            }
        }
    }
}

extension Array {
    subscript(sur i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
