import { Screen } from '../components/ui'
import Fil from './Moments'

/** L'onglet Fil : la discussion de toute la famille (messages, photos, vocaux, stickers). */
export default function FilFamilial() {
  return (
    <Screen title="Fil familial" compact>
      <Fil />
    </Screen>
  )
}
