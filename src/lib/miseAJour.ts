// Toujours la dernière version : Safari (et l'appli posée sur l'écran d'accueil) garde parfois l'ancienne page
// en mémoire. Au lancement, puis chaque fois qu'on revient dans l'appli, on regarde quelle version est en ligne ;
// si elle a changé, on recharge (une seule fois par version, jamais en boucle).

const fichier = (s: string) => s.match(/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? null

export function surveillerMiseAJour() {
  // dans l'appli iPhone (Capacitor), la page est dans l'appli elle-même : rien à faire
  if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return
  const actuel = fichier([...document.scripts].map((s) => s.src).find((s) => fichier(s)) ?? '')
  if (!actuel) return

  // l'adresse de rechargement (…?maj=…) ne reste pas dans la barre d'adresse
  const u = new URL(location.href)
  if (u.searchParams.has('maj')) {
    u.searchParams.delete('maj')
    history.replaceState(history.state, '', u.pathname + u.search + u.hash)
  }

  let enCours = false
  const verifier = async () => {
    if (enCours || document.visibilityState !== 'visible') return
    // on ne coupe jamais quelqu'un en train d'écrire
    if (document.activeElement?.matches('input, textarea, [contenteditable="true"]')) return
    enCours = true
    try {
      const r = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) return
      const enLigne = fichier(await r.text())
      if (!enLigne || enLigne === actuel) return
      const cle = 'nidoo.maj'
      if (sessionStorage.getItem(cle) === enLigne) return // déjà rechargé pour cette version
      sessionStorage.setItem(cle, enLigne)
      const neuf = new URL(location.href)
      neuf.searchParams.set('maj', enLigne.slice(6, 14))
      // pas de page blanche : l'écran d'attente (le même que celui d'index.html) recouvre l'appli en fondu,
      // puis la nouvelle version démarre dessus
      const voile = document.createElement('div')
      voile.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#f8f7fc;opacity:0;transition:opacity .18s ease-out'
      voile.innerHTML = '<img src="./panda.webp" alt="" width="120" height="120" style="border-radius:28px;box-shadow:0 24px 50px -18px rgba(102,70,204,.55)">'
      document.body.appendChild(voile)
      requestAnimationFrame(() => (voile.style.opacity = '1'))
      window.setTimeout(() => location.replace(neuf.toString()), 220)
    } catch {
      /* hors ligne : on réessaiera au prochain retour */
    } finally {
      enCours = false
    }
  }
  window.setTimeout(verifier, 1200)
  document.addEventListener('visibilitychange', () => void verifier())
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) void verifier()
  })
}
