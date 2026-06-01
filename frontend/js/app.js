/**
 * app.js — Logique principale TrailFinder CH
 * GIN HEIG-VD
 *
 * Orchestre toute l'interface utilisateur :
 *   - Onglets sport (Vélo / Rando / Course) → affiche les bons filtres
 *   - Sous-onglets (Rechercher / Créer / Sauvegardés / Itinéraire)
 *   - Sliders : mise à jour temps réel des valeurs affichées (W/kg, min/km...)
 *   - Boutons filtres : un seul actif par groupe (data-filter)
 *   - Recherche pgRouting via btn-search
 *   - Onglet Créer : tracé manuel point par point sur la carte
 *   - Toggle couches cartographiques (cantons, routes OSM)
 *   - Point de départ : 3 modes (adresse Nominatim, GPS, clic carte)
 *
 * Dépendances : map.js, search.js (searchRoutesPgR, geocodeStart, setSearchStart),
 *               cantons.js (loadCantons, loadRoutesSwisstopo),
 *               trails.js (trailLayers, TRAILS), create.js (renderSaved)
 */

// Initialisation du sport actif
// Sport actif par défaut au chargement de la page.
window.currentSport = 'velo';

// =====================================================
// SPORT TABS
// =====================================================
// Onglets sport : au clic, met à jour currentSport, affiche les filtres
// correspondants et réinitialise la vue carte.
document.querySelectorAll('.sport-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sport-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    window.currentSport = tab.dataset.sport;

    // Masque tous les filtres puis affiche ceux du sport sélectionné.
    // Afficher les bons filtres
    document.querySelectorAll('.filters').forEach(f => f.classList.add('hidden'));
    document.getElementById(`filters-${window.currentSport}`).classList.remove('hidden');

    // Masque les résultats et le panneau de détail de la session précédente.
    // Cacher les résultats
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('detail-panel').classList.add('hidden');

    // Réinitialise la vue carte et vide les tracés d'itinéraires affichés.
    // Recentrer sur la Suisse romande
    map.setView([46.65, 6.85], 9);
    Object.values(trailLayers).forEach(l => map.removeLayer(l));
    trailLayers = {};
  });
});

// =====================================================
// SUB TABS
// =====================================================
// Sous-onglets : affiche le panneau correspondant (panel-{tab}).
// renderSaved() chargé depuis create.js est appelé à l'ouverture de Sauvegardés.
document.querySelectorAll('.sub-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`panel-${tab.dataset.tab}`).classList.remove('hidden');

    if (tab.dataset.tab === 'sauvegardes') renderSaved();
    if (tab.dataset.tab === 'itineraire') showToast('Définissez départ et arrivée sur la carte');
  });
});

// =====================================================
// SLIDERS
// =====================================================
// Sliders : lie chaque slider HTML à son affichage via fmt().
// Initialisé au chargement + écouteur "input" pour les changements en temps réel.
const sliders = [
  { id: 'ftp-slider',           valId: 'ftp-val',           fmt: v => `${parseFloat(v).toFixed(1)} W/kg` },
  { id: 'duree-slider',         valId: 'duree-val',         fmt: v => formatDuree(parseFloat(v)) },
  { id: 'denivele-slider',      valId: 'denivele-val',      fmt: v => `${v} m` },
  { id: 'duree-rando-slider',   valId: 'duree-rando-val',   fmt: v => formatDuree(parseFloat(v)) },
  { id: 'denivele-rando-slider',valId: 'denivele-rando-val',fmt: v => `${v} m` },
  { id: 'dist-course-slider',   valId: 'dist-course-val',   fmt: v => `${v} km` },
  { id: 'denivele-course-slider',valId:'denivele-course-val',fmt: v => `${v} m` },
  { id: 'vap-slider', valId: 'vap-val', fmt: v => { const minkm = 60/parseFloat(v); return `${Math.floor(minkm)}'${String(Math.round((minkm%1)*60)).padStart(2,'0')}" /km`; } },
];
sliders.forEach(({ id, valId, fmt }) => {
  const el = document.getElementById(id);
  if (!el) return;
  const valEl = document.getElementById(valId);
  if (valEl) valEl.textContent = fmt(el.value);
  el.addEventListener('input', () => {
    const valEl2 = document.getElementById(valId);
    if (valEl2) valEl2.textContent = fmt(el.value);
  });
});

// =====================================================
// FILTRES BOUTONS
// =====================================================
// Boutons filtres : désactive tous les boutons du groupe (data-filter)
// puis active uniquement celui cliqué.
document.querySelectorAll('.btn-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.filter;
    document.querySelectorAll(`.btn-filter[data-filter="${group}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// =====================================================
// RECHERCHE (pgRouting)
// =====================================================
// Bouton "Trouver des itinéraires" : vérifie qu'un point de départ est défini
// puis appelle searchRoutesPgR() (défini dans search.js).
document.getElementById('btn-search').addEventListener('click', () => {
  const coords = window.searchStartCoords || (typeof searchStartCoords !== 'undefined' ? searchStartCoords : null);
  if (!coords) {
    showToast("Définissez d'abord un point de départ ", "error");
    return;
  }
  // S'assurer que les deux variables sont synchronisées
  window.searchStartCoords = coords;
  if (typeof searchStartCoords !== 'undefined') searchStartCoords = coords;
  searchRoutesPgR();
});

// =====================================================
// CRÉER UN ITINÉRAIRE
// =====================================================
// ── ONGLET CRÉER ─────────────────────────────────────────────────────────
// Variables d'état pour le tracé manuel.
let drawingTrail = false;
let trailPoints  = [];
let trailLine    = null;
let trailDots    = [];

// Bouton Tracer : bascule le mode dessin (curseur crosshair).
document.getElementById('btn-draw-trail').addEventListener('click', () => {
  drawingTrail = !drawingTrail;
  document.getElementById('btn-draw-trail').classList.toggle('active', drawingTrail);
  map.getContainer().style.cursor = drawingTrail ? 'crosshair' : '';
  if (drawingTrail) showToast('Cliquez sur la carte pour tracer "” double-clic pour terminer');
});

// Bouton Effacer : supprime tous les points et tracés du dessin.
document.getElementById('btn-clear-trail').addEventListener('click', () => {
  drawingTrail = false;
  trailPoints  = [];
  if (trailLine) { map.removeLayer(trailLine); trailLine = null; }
  trailDots.forEach(d => map.removeLayer(d)); trailDots = [];
  document.getElementById('btn-draw-trail').classList.remove('active');
  document.getElementById('btn-save-trail').disabled = true;
  document.getElementById('cs-dist').textContent = '0 km';
  document.getElementById('cs-pts').textContent  = '0';
  map.getContainer().style.cursor = '';
});

// Clic carte en mode dessin : ajoute un point, trace la polyline
// et calcule la distance cumulée via la formule de Haversine.
map.on('click', e => {
  if (!drawingTrail) return;
  trailPoints.push([e.latlng.lat, e.latlng.lng]);

  const dot = L.circleMarker([e.latlng.lat, e.latlng.lng], {
    radius:5, color:'#2d6a4f', fillColor:'#2d6a4f', fillOpacity:0.9, weight:2,
  }).addTo(map);
  trailDots.push(dot);

  if (trailLine) map.removeLayer(trailLine);
  if (trailPoints.length >= 2) {
    trailLine = L.polyline(trailPoints, { color:'#2d6a4f', weight:3, dashArray:'8 4' }).addTo(map);
    let d = 0;
    for (let i = 1; i < trailPoints.length; i++) {
      const a = trailPoints[i-1], b = trailPoints[i];
      const R = 6371000, toRad = x => x * Math.PI / 180;
      const dLat = toRad(b[0]-a[0]), dLon = toRad(b[1]-a[1]);
      const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
      d += R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
    }
    document.getElementById('cs-dist').textContent = (d/1000).toFixed(1) + ' km';
    document.getElementById('cs-pts').textContent  = trailPoints.length;
    document.getElementById('btn-save-trail').disabled = false;
  }
});

// Double-clic : termine le tracé et invite à sauvegarder.
map.on('dblclick', () => {
  if (drawingTrail) {
    drawingTrail = false;
    document.getElementById('btn-draw-trail').classList.remove('active');
    map.getContainer().style.cursor = '';
    showToast('Tracé terminé "” remplissez le formulaire et sauvegardez âœ“', 'success');
  }
});

// Formulaire de sauvegarde : valide puis redirige vers l'onglet Sauvegardés.
document.getElementById('create-form').addEventListener('submit', e => {
  e.preventDefault();
  if (trailPoints.length < 2) { showToast('Tracez d\'abord un itinéraire', 'error'); return; }

  const name = document.getElementById('trail-name').value;
  showToast(`Itinéraire "${name}" sauvegardé âœ“`, 'success');

  // Reset
  document.getElementById('create-form').reset();
  document.getElementById('btn-clear-trail').click();
  // Aller sur l'onglet sauvegardés
  document.querySelector('.sub-tab[data-tab="sauvegardes"]').click();
});

// =====================================================
// COUCHES
// =====================================================
// ── COUCHES CARTOGRAPHIQUES ──────────────────────────────────────────────
// Toggle cantons et routes OSM via les checkboxes du panneau Couches.
document.getElementById('layer-cantons').addEventListener('change', e => {
  e.target.checked ? loadCantons() : layers.cantons.clearLayers();
});
document.getElementById('layer-routes-sw').addEventListener('change', async e => {
  if (e.target.checked) {
    await loadRoutesSwisstopo(map.getBounds());
  } else {
    layers.routes.clearLayers();
  }
});

// =====================================================
// POINT DE DÉPART
// =====================================================

// =====================================================
// POINT DE DÉPART
// =====================================================

// ── POINT DE DÉPART ──────────────────────────────────────────────────────
// Mode 1 : adresse texte → géocodage Nominatim (geocodeStart dans search.js).
// Recherche par adresse
document.getElementById('btn-start-search').addEventListener('click', async () => {
  const val = document.getElementById('start-input').value.trim();
  if (!val) { showToast('Entre une adresse', 'error'); return; }
  try {
    showToast('Recherche en cours…');
    const result = await geocodeStart(val);
    setSearchStart(result.lat, result.lon, result.label);
  } catch {
    showToast('Adresse non trouvée "” essayez "Yverdon" ou "Lausanne"', 'error');
  }
});

// Touche Entrée dans le champ adresse déclenche la même action que le bouton.
document.getElementById('start-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-start-search').click();
});

// Mode 2 : GPS → navigator.geolocation.getCurrentPosition().

// GPS
document.getElementById('btn-start-gps').addEventListener('click', () => {
  showToast('Localisation GPS…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      // Mettre à jour searchStartCoords directement
      window.searchStartCoords = { lat, lon };
      if (typeof searchStartCoords !== 'undefined') searchStartCoords = { lat, lon };
      const lbl = document.getElementById('start-label');
      if (lbl) { lbl.textContent = 'Ma position GPS'; lbl.style.color = '#2d6a4f'; }
      // Marqueur sur la carte
      if (window.searchStartMarker) map.removeLayer(window.searchStartMarker);
      window.searchStartMarker = L.circleMarker([lat, lon], {
        radius: 10, color: '#2d6a4f', fillColor: '#2d6a4f', fillOpacity: 0.8, weight: 3,
      }).addTo(map).bindPopup('<b>Départ GPS</b>');
      map.setView([lat, lon], 13);
      showToast('Position GPS définie âœ“', 'success');
    },
    () => showToast('GPS impossible', 'error')
  );
});

// Mode 3 : clic carte → curseur crosshair, attend le prochain clic.

// Clic sur la carte
let pickingStart = false;
document.getElementById('btn-start-map').addEventListener('click', () => {
  pickingStart = true;
  map.getContainer().style.cursor = 'crosshair';
  showToast('Cliquez sur la carte pour définir le départ');
});

map.on('click', e => {
  if (!pickingStart) return;
  pickingStart = false;
  map.getContainer().style.cursor = '';
  setSearchStart(e.latlng.lat, e.latlng.lng, `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
});

// =====================================================
// INIT
// =====================================================
// ── INITIALISATION ───────────────────────────────────────────────────────
// Appelée une fois au chargement. loadCantons et renderTrails sont désactivés.
async function init() {
  console.log('TrailFinder CH "” HEIG-VD');
//  await loadCantons();// désactivé
  renderSaved();

  // Afficher tous les itinéraires du sport courant au démarrage
  const all = TRAILS.filter(t => t.sport === window.currentSport);
  //renderTrails(all);
}

init();