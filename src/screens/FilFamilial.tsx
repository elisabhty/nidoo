import { Screen } from '../components/ui'
import Fil from './Moments'

/** L'onglet Fil : la discussion de toute la famille (messages, photos, vocaux, stickers). */
export default function FilFamilial() {
  return (
    <Screen title="Fil familial">
      <p className="-mt-1 mb-2 px-5 text-sous text-brume">Écris, envoie une photo, un vocal ou un sticker à toute la famille.</p>
      <Fil />
    </Screen>
  )
}
