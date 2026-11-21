import SwiftUI
import WidgetKit

// Les widgets de NIDOO. Chacun lit l'état de la maison avec la clé widget (voir Donnees.swift)
// et ses boutons agissent sans ouvrir l'appli (voir Actions.swift).

@main
struct LotNidoo: WidgetBundle {
    var body: some Widget {
        Tendresse().body
        Organisation().body
        Jeux().body
        if #available(iOS 18.0, *) {
            BisouControle()
        }
    }
}

struct Tendresse: WidgetBundle {
    var body: some Widget {
        MaisonWidget()
        BisouWidget()
        AttentionsWidget()
        FamilleWidget()
        HumeurWidget()
    }
}

struct Organisation: WidgetBundle {
    var body: some Widget {
        DatesWidget()
        AFaireWidget()
        SondageWidget()
        MurWidget()
    }
}

struct Jeux: WidgetBundle {
    var body: some Widget {
        MorpionWidget()
        Puissance4Widget()
        MemoryWidget()
        CompagnonWidget()
    }
}

struct MaisonWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooMaison", provider: Fournisseur()) { e in
            Selon { f in VueMaison(e: e, f: f) }
        }
        .configurationDisplayName("Notre maison")
        .description("La maison de la famille et tout le monde devant, avec son humeur. Touche un proche : « je pense à toi ».")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct BisouWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "NidooBisou", intent: ChoixProche.self, provider: FournisseurProche()) { e in
            Selon { f in VueBisou(e: e, f: f) }
        }
        .configurationDisplayName("Bisou express")
        .description("Un bisou à ton proche préféré, d’un seul toucher. Marche aussi sur l’écran verrouillé.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

struct AttentionsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "NidooAttentions", intent: ChoixProche.self, provider: FournisseurProche()) { e in
            Selon { f in VueAttentions(e: e, f: f) }
        }
        .configurationDisplayName("Attentions")
        .description("La dernière attention reçue, et quatre gestes pour répondre.")
        .supportedFamilies([.systemMedium])
    }
}

struct FamilleWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooFamille", provider: Fournisseur()) { e in
            Selon { f in VueFamille(e: e, f: f) }
        }
        .configurationDisplayName("Ma famille")
        .description("Tout le monde et son humeur du jour. Touche un proche : « je pense à toi ».")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct HumeurWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooHumeur", provider: Fournisseur()) { e in
            Selon { f in VueHumeur(e: e, f: f) }
        }
        .configurationDisplayName("Mon humeur")
        .description("Dis à ta famille comment tu te sens, d’un toucher.")
        .supportedFamilies([.systemMedium])
    }
}

struct DatesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooDates", provider: Fournisseur()) { e in
            Selon { f in VueDates(e: e, f: f) }
        }
        .configurationDisplayName("Prochaines dates")
        .description("Le compte à rebours avant l’anniversaire, le repas, les vacances…")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct AFaireWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "NidooAFaire", intent: ChoixListe.self, provider: FournisseurListe()) { e in
            Selon { f in VueAFaire(e: e, f: f) }
        }
        .configurationDisplayName("À faire")
        .description("Les tâches ou les courses de la maison, à cocher sans ouvrir l’appli.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct SondageWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooSondage", provider: Fournisseur()) { e in
            Selon { f in VueSondage(e: e, f: f) }
        }
        .configurationDisplayName("Sondage")
        .description("Le sondage du moment : vote d’un toucher.")
        .supportedFamilies([.systemMedium])
    }
}

struct MurWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooMur", provider: Fournisseur()) { e in
            Selon { f in VueMur(e: e, f: f) }
        }
        .configurationDisplayName("Le mur de la famille")
        .description("Toute la maison d’un coup d’œil : les proches, la dernière attention, la prochaine date, ce qu’il reste à faire.")
        .supportedFamilies([.systemLarge])
    }
}

struct MorpionWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "NidooMorpion", intent: ChoixProche.self, provider: FournisseurProche()) { e in
            Selon { f in VueMorpion(e: e, f: f) }
        }
        .configurationDisplayName("Morpion")
        .description("Une partie contre un proche, chacun son tour, depuis l’écran d’accueil.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct Puissance4Widget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "NidooPuissance4", intent: ChoixProche.self, provider: FournisseurProche()) { e in
            Selon { f in VuePuissance4(e: e, f: f) }
        }
        .configurationDisplayName("Puissance 4")
        .description("Touche une colonne, le pion tombe. Contre un proche, chacun son tour.")
        .supportedFamilies([.systemLarge])
    }
}

struct MemoryWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooMemory", provider: FournisseurLocal()) { e in
            Selon { f in VueMemory(e: e, f: f) }
        }
        .configurationDisplayName("Memory des animaux")
        .description("Retrouve les paires. Un petit jeu pour toi, même sans réseau.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct CompagnonWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NidooCompagnon", provider: Fournisseur()) { e in
            Selon { f in VueCompagnon(e: e, f: f) }
        }
        .configurationDisplayName("Notre compagnon")
        .description("Une friandise pour le compagnon de la famille.")
        .supportedFamilies([.systemSmall])
    }
}
