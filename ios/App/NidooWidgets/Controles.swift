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
