// Fabrique, sur le téléphone, le fichier .ics demandé par calendrier.html (adresse ./ics/evenement.ics?d=…).
// Safari reçoit ainsi un vrai fichier calendrier et propose « Ajouter au calendrier ». Rien ne part sur le réseau.
self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()) })
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url)
  if (u.pathname.indexOf('/ics/') < 0) return
  var d = u.searchParams.get('d')
  if (!d) return
  try {
    var b = atob(d.replace(/-/g, '+').replace(/_/g, '/'))
    var o = new Uint8Array(b.length)
    for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i)
    e.respondWith(new Response(o, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } }))
  } catch (err) {}
})
