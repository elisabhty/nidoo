import UIKit
import Capacitor

/// L'écran de l'appli, avec le pont vers les widgets en plus des plugins habituels.
class NidooViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NidooPlugin())
    }
}
