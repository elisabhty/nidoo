import AppIntents
import SwiftUI
import WidgetKit

/// Dans le Centre de contrôle, sur le bouton Action ou sur l'écran verrouillé (iOS 18) : un bisou d'un seul geste.
@available(iOS 18.0, *)
struct BisouControle: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "NidooBisouControle") {
            ControlWidgetButton(action: BisouAuProche()) {
                Label("Bisou", systemImage: "heart.fill")
            }
        }
        .displayName("Bisou NIDOO")
        .description("Un bisou au dernier proche qui a pensé à toi.")
    }
}

/// Dans le Centre de contrôle (iOS 18) : « Je suis en route », d'un seul geste.
@available(iOS 18.0, *)
struct EnRouteControle: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "NidooEnRouteControle") {
            ControlWidgetButton(action: PrevenirEnRoute()) {
                Label("Je suis en route", systemImage: "car.fill")
            }
        }
        .displayName("Je suis en route")
        .description("Un petit mot à tes proches : tu es en route.")
    }
}
