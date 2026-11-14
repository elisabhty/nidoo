// Clés publiques Supabase (la clé « publishable » est faite pour être embarquée dans l'app).
// Tant qu'elles sont vides, NIDOO tourne en mode démo : tout reste sur l'appareil.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? ''

// Adresse publique utilisée dans les liens d'invitation (utile depuis l'app iOS).
export const PUBLIC_URL = 'https://elisabhty.github.io/nidoo/'
