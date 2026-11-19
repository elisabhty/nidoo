import { coupDuPanda, type Piece } from './tour'

self.onmessage = ({ data }: MessageEvent<{ pieces: Piece[]; prochaine: number }>) => {
  self.postMessage(coupDuPanda(data.pieces, data.prochaine))
}
