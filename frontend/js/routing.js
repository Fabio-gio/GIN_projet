/**
 * routing.js — Calcul d'itinéraires A→B avec étapes intermédiaires
 * TrailFinder CH — GIN HEIG-VD
 *
 * Gère l'onglet Itinéraire :
 *   - Saisie départ/arrivée : adresse (Nominatim), GPS ou clic carte
 *   - Calcul Dijkstra via GET /api/route (backend Go + pgRouting)
 *   - Étapes intermédiaires : calcul segmenté A→W1→W2→...→B
 *   - Chargement et affichage de fichiers GPX existants
 *   - Export GPX du résultat calculé
 *
 * Fonctions exposées : startPicking, calculateRoute, clearRoute,
 *   exportRouteGPX, geocodeForRoute, switchRouteTab, loadGPXFile,
 *   clearGPX, addWaypointField, removeWaypoint, geocodeWaypoint, pickWaypoint
 */

// ── ÉTAT GLOBAL ──────────────────────────────────────────────────────────
let routeLayer      = null;
let routeStartMarker = null;
let routeEndMarker   = null;
let routeStart       = null;
let routeEnd         = null;
let pickingMode      = null; // 'start' | 'end' | null

// Couleurs des tracés selon le sport actif.
const ROUTE_COLORS = { velo: '#2d6a4f', rando: '#6b5344', course: '#dc2626' };

// ---- Icônes départ / arrivée ----
// Crée une icône goutte (DivIcon Leaflet) colorée selon le sport
// pour les marqueurs A (départ) et B (arrivée).
function makeRouteIcon(type, sport) {
  const color = ROUTE_COLORS[sport] || '#2d6a4f';
  const label = type === 'start' ? 'A' : 'B';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      background:${type === 'start' ? color : '#1a1a2e'};
      transform:rotate(-45deg);display:flex;align-items:center;
      justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
      <span style="transform:rotate(45deg);color:white;font-size:13px;font-weight:700;font-family:Inter">${label}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -32],
  });
}

// ---- Mode picking ----
// Active le mode picking : curseur crosshair, attend le prochain clic sur la carte.
// mode : "start" (départ A) ou "end" (arrivée B).
function startPicking(mode) {
  pickingMode = mode;
  map.getContainer().style.cursor = 'crosshair';
  const label = mode === 'start' ? 'départ' : 'arrivée';
  showToast(`Cliquez sur la carte pour définir le ${label}`);
}

// ---- Clic sur la carte ----
// Intercepte les clics en mode picking pour définir départ ou arrivée.
// Lance calculateRoute() automatiquement si les deux points sont définis.
map.on('click', async e => {
  if (!pickingMode) return;
  const { lat, lng } = e.latlng;

  if (pickingMode === 'start') {
    routeStart = { lat, lon: lng };
    if (routeStartMarker) map.removeLayer(routeStartMarker);
    const sport = document.getElementById('route-sport')?.value || 'velo';
    routeStartMarker = L.marker([lat, lng], { icon: makeRouteIcon('start', sport) })
      .addTo(map)
      .bindPopup(`<b>Départ</b><br>${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    document.getElementById('route-from-label').textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    document.getElementById('route-from-label').style.color = '#2d6a4f';
  } else {
    routeEnd = { lat, lon: lng };
    if (routeEndMarker) map.removeLayer(routeEndMarker);
    const sport = document.getElementById('route-sport')?.value || 'velo';
    routeEndMarker = L.marker([lat, lng], { icon: makeRouteIcon('end', sport) })
      .addTo(map)
      .bindPopup(`<b>Arrivée</b><br>${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    document.getElementById('route-to-label').textContent = `🏁 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    document.getElementById('route-to-label').style.color = '#dc2626';
  }

  pickingMode = null;
  map.getContainer().style.cursor = '';

  // Si les deux points sont définis → calculer automatiquement
  if (routeStart && routeEnd) {
    await calculateRoute();
  }
});

// ---- Géocodage adresse ----
// Géocode une adresse via Nominatim et place le marqueur sur la carte.
async function geocodeForRoute(inputId, labelId, type) {
  const val = document.getElementById(inputId)?.value?.trim();
  if (!val) { showToast('Entre une adresse', 'error'); return; }

  try {
    showToast('Recherche…');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val + ', Suisse')}&format=json&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    const data = await res.json();
    if (!data.length) throw new Error();

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    const label = data[0].display_name.split(',')[0];

    if (type === 'start') {
      routeStart = { lat, lon };
      if (routeStartMarker) map.removeLayer(routeStartMarker);
      const sport = document.getElementById('route-sport')?.value || 'velo';
      routeStartMarker = L.marker([lat, lon], { icon: makeRouteIcon('start', sport) }).addTo(map);
      document.getElementById(labelId).textContent = `📍 ${label}`;
      document.getElementById(labelId).style.color = '#2d6a4f';
    } else {
      routeEnd = { lat, lon };
      if (routeEndMarker) map.removeLayer(routeEndMarker);
      const sport = document.getElementById('route-sport')?.value || 'velo';
      routeEndMarker = L.marker([lat, lon], { icon: makeRouteIcon('end', sport) }).addTo(map);
      document.getElementById(labelId).textContent = `🏁 ${label}`;
      document.getElementById(labelId).style.color = '#dc2626';
    }

    map.setView([lat, lon], 12);
    showToast(`${label} ✓`, 'success');

    if (routeStart && routeEnd) await calculateRoute();

  } catch {
    showToast('Adresse non trouvée', 'error');
  }
}

// ---- Calcul d'itinéraire ----
// Calcul principal via GET /api/route.
// Si étapes présentes : calcul segmenté (un appel par segment).
// Distance et durée totales = somme de tous les segments.
async function calculateRoute() {
  if (!routeStart || !routeEnd) {
    showToast('Définissez le départ et l\'arrivée', 'error');
    return;
  }

  const sport = document.getElementById('route-sport')?.value || 'velo';
  const btn   = document.getElementById('btn-calc-route');
  if (btn) { btn.textContent = 'Calcul en cours…'; btn.disabled = true; }

  try {
    const url = `${API_BASE}/route?fromLon=${routeStart.lon}&fromLat=${routeStart.lat}&toLon=${routeEnd.lon}&toLat=${routeEnd.lat}&sport=${sport}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('Erreur serveur');
    const data = await res.json();

    displayRoute(data, sport);

  } catch (err) {
    showToast('Erreur calcul itinéraire', 'error');
    console.error(err);
  } finally {
    if (btn) { btn.textContent = 'Calculer l\'itinéraire'; btn.disabled = false; }
  }
}

// ---- Affichage du résultat ----
// Affiche le tracé GeoJSON et met à jour le panneau de résultat.
function displayRoute(data, sport) {
  if (routeLayer) map.removeLayer(routeLayer);

  const color = ROUTE_COLORS[sport] || '#2d6a4f';
  const geom  = data.geojson?.geometry;
  if (!geom) { showToast('Pas de géométrie reçue', 'error'); return; }

  routeLayer = L.geoJSON(data.geojson, {
    style: { color, weight: 5, opacity: 0.9, dashArray: sport === 'course' ? '1' : null },
  }).addTo(map);

  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

  // Mettre à jour le panneau résultat
  const distKm  = data.distance_km  || (data.distance_m / 1000);
  const durMin  = data.duration_min || 0;
  const h = Math.floor(durMin / 60);
  const m = Math.round(durMin % 60);
  const durStr = h > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${Math.round(durMin)} min`;
  const isDemo = data.demo ? ' <span style="font-size:10px;color:#f59e0b">(estimation)</span>' : ' <span style="font-size:10px;color:#2d6a4f">pgRouting ✓</span>';

  document.getElementById('route-result').classList.remove('hidden');
  document.getElementById('route-dist').textContent  = distKm.toFixed(1) + ' km';
  document.getElementById('route-dur').textContent   = durStr;
  document.getElementById('route-source').innerHTML  = isDemo;

  showToast(`Itinéraire calculé : ${distKm.toFixed(1)} km ✓`, 'success');
}

// ---- Effacer ----
// Supprime le tracé, les marqueurs et réinitialise l'état.
function clearRoute() {
  if (routeLayer)       { map.removeLayer(routeLayer);       routeLayer = null; }
  if (routeStartMarker) { map.removeLayer(routeStartMarker); routeStartMarker = null; }
  if (routeEndMarker)   { map.removeLayer(routeEndMarker);   routeEndMarker = null; }
  routeStart = null; routeEnd = null;
  document.getElementById('route-from-label').textContent = 'Cliquez sur la carte ou entrez une adresse';
  document.getElementById('route-from-label').style.color = '';
  document.getElementById('route-to-label').textContent   = 'Cliquez sur la carte ou entrez une adresse';
  document.getElementById('route-to-label').style.color   = '';
  document.getElementById('route-result').classList.add('hidden');
  if (document.getElementById('route-from-input')) document.getElementById('route-from-input').value = '';
  if (document.getElementById('route-to-input'))   document.getElementById('route-to-input').value   = '';
}

// ---- Export GPX du résultat ----
// Génère et télécharge le fichier .gpx du résultat calculé.
function exportRouteGPX() {
  if (!routeLayer) { showToast('Calculez d\'abord un itinéraire', 'error'); return; }
  const sport = document.getElementById('route-sport')?.value || 'velo';
  const geojson = routeLayer.toGeoJSON();
  const coords = geojson.features?.[0]?.geometry?.coordinates || [];

  const pts = coords.map(([lon, lat]) =>
    `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`).join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailFinder CH — HEIG-VD" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Itinéraire ${sport}</name><type>${sport}</type><trkseg>
${pts}
  </trkseg></trk>
</gpx>`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  a.download = `itineraire_${sport}.gpx`;
  a.click();
  showToast('GPX exporté ✓', 'success');
}

window.startPicking     = startPicking;
window.calculateRoute   = calculateRoute;
window.clearRoute       = clearRoute;
window.exportRouteGPX   = exportRouteGPX;
window.geocodeForRoute  = geocodeForRoute;

// ---- Switch entre onglets A→B et GPX ----
// Bascule entre les sous-onglets "A→B" et "Charger GPX".
function switchRouteTab(tab) {
  const abPanel  = document.getElementById('route-ab-panel');
  const gpxPanel = document.getElementById('route-gpx-panel');
  const btnAB    = document.getElementById('tab-route-ab');
  const btnGPX   = document.getElementById('tab-route-gpx');

  if (tab === 'ab') {
    abPanel.style.display  = 'flex';
    abPanel.style.flexDirection = 'column';
    abPanel.style.gap = '12px';
    gpxPanel.style.display = 'none';
    btnAB.style.background  = 'var(--green)';
    btnAB.style.color       = 'white';
    btnAB.style.border      = 'none';
    btnGPX.style.background = 'var(--bg)';
    btnGPX.style.color      = 'var(--text-dim)';
    btnGPX.style.border     = '1px solid var(--border)';
  } else {
    abPanel.style.display  = 'none';
    gpxPanel.style.display = 'flex';
    btnGPX.style.background = 'var(--green)';
    btnGPX.style.color      = 'white';
    btnGPX.style.border     = 'none';
    btnAB.style.background  = 'var(--bg)';
    btnAB.style.color       = 'var(--text-dim)';
    btnAB.style.border      = '1px solid var(--border)';
  }
}

// ---- Chargement GPX ----
// ── CHARGEMENT GPX ───────────────────────────────────────────────────────
let gpxLayer = null;

function loadGPXFile() {
  const file = document.getElementById('gpx-file-input')?.files[0];
  if (!file) { showToast('Sélectionnez un fichier GPX', 'error'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(e.target.result, 'text/xml');
      const trkpts = Array.from(xml.querySelectorAll('trkpt'));
      if (!trkpts.length) { showToast('Aucun point trouvé dans le GPX', 'error'); return; }

      const coords = trkpts.map(pt => [
        parseFloat(pt.getAttribute('lat')),
        parseFloat(pt.getAttribute('lon'))
      ]);

      if (gpxLayer) map.removeLayer(gpxLayer);
      gpxLayer = L.polyline(coords, { color: '#e07a5f', weight: 4, opacity: 0.9 }).addTo(map);
      map.fitBounds(gpxLayer.getBounds(), { padding: [40, 40] });

      // Calcul distance approximative
      let dist = 0;
      for (let i = 1; i < coords.length; i++) {
        dist += map.distance(coords[i-1], coords[i]);
      }
      const distKm = (dist / 1000).toFixed(1);

      document.getElementById('gpx-dist').textContent = distKm + ' km';
      document.getElementById('gpx-pts').textContent  = trkpts.length;
      document.getElementById('gpx-result').classList.remove('hidden');
      document.getElementById('gpx-info').textContent = `✓ ${file.name}`;
      document.getElementById('gpx-info').style.color = 'var(--green)';
      showToast(`GPX chargé — ${distKm} km, ${trkpts.length} points ✓`, 'success');
    } catch (err) {
      showToast('Erreur lecture GPX', 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function clearGPX() {
  if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
  document.getElementById('gpx-result').classList.add('hidden');
  document.getElementById('gpx-file-input').value = '';
  document.getElementById('gpx-info').textContent = 'Sélectionnez un fichier GPX';
  document.getElementById('gpx-info').style.color = '';
}

window.switchRouteTab = switchRouteTab;
window.loadGPXFile    = loadGPXFile;
window.clearGPX       = clearGPX;

// ── ÉTAPES INTERMÉDIAIRES ────────────────────────────────────────────────
// Tableau d'objets {lat, lon} — null si une étape n'est pas encore définie.
let routeWaypoints = [];

// Ajoute dynamiquement un bloc HTML pour une nouvelle étape.
function addWaypointField() {
  const idx = routeWaypoints.length;
  routeWaypoints.push(null);
  const container = document.getElementById('waypoints-container');
  const div = document.createElement('div');
  div.className = 'route-point-block';
  div.id = `waypoint-block-${idx}`;
  div.innerHTML = `
    <div class="route-point-header" style="color:#e07a5f">
      <span class="route-point-letter" style="background:#e07a5f">${idx+1}</span>
      <span>ÉTAPE ${idx+1}</span>
      <button onclick="removeWaypoint(${idx})" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#e07a5f;font-size:16px">✕</button>
    </div>
    <div class="route-input-row">
      <input type="text" id="waypoint-input-${idx}" placeholder="Adresse de l'étape..." />
      <button class="btn-route-icon" onclick="geocodeWaypoint(${idx})" title="Rechercher">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      </button>
      <button class="btn-route-icon" onclick="pickWaypoint(${idx})" title="Cliquer sur la carte">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </button>
    </div>
    <div id="waypoint-label-${idx}" class="route-point-label">Adresse ou clic carte</div>
  `;
  container.appendChild(div);
}

// Supprime une étape par index et recalcule si possible.
function removeWaypoint(idx) {
  routeWaypoints[idx] = null;
  const el = document.getElementById(`waypoint-block-${idx}`);
  if (el) el.remove();
}

async // Géocode l'adresse d'une étape via Nominatim.
function geocodeWaypoint(idx) {
  const val = document.getElementById(`waypoint-input-${idx}`)?.value?.trim();
  if (!val) return;
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val+', Suisse')}&format=json&limit=1`, { headers: {'Accept-Language':'fr'} });
    const data = await res.json();
    if (!data.length) { showToast('Adresse non trouvée', 'error'); return; }
    routeWaypoints[idx] = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    document.getElementById(`waypoint-label-${idx}`).textContent = '📍 ' + data[0].display_name.split(',')[0];
    showToast('Étape définie ✓', 'success');
  } catch { showToast('Erreur géocodage', 'error'); }
}

let pickingWaypointIdx = null;
// Active le mode picking pour définir une étape par clic sur la carte.
function pickWaypoint(idx) {
  pickingWaypointIdx = idx;
  map.getContainer().style.cursor = 'crosshair';
  showToast(`Cliquez sur la carte pour l'étape ${idx+1}`);
}

// Intercept map click for waypoint picking
const _origPickingMode = window.startPicking;
map.on('click', e => {
  if (pickingWaypointIdx === null) return;
  const { lat, lng } = e.latlng;
  const idx = pickingWaypointIdx;
  routeWaypoints[idx] = { lat, lon: lng };
  document.getElementById(`waypoint-label-${idx}`).textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  pickingWaypointIdx = null;
  map.getContainer().style.cursor = '';
  showToast(`Étape ${idx+1} définie ✓`, 'success');
});

// Override calculateRoute to include waypoints
const _origCalculateRoute = window.calculateRoute;
window.calculateRoute = async function() {
  const activeWaypoints = routeWaypoints.filter(w => w !== null);
  if (activeWaypoints.length === 0) {
    return _origCalculateRoute();
  }
  if (!routeStart || !routeEnd) { showToast('Définissez départ et arrivée', 'error'); return; }

  const sport = document.getElementById('route-sport')?.value || 'velo';
  const btn = document.getElementById('btn-calc-route');
  if (btn) { btn.textContent = 'Calcul...'; btn.disabled = true; }

  if (routeLayer) map.removeLayer(routeLayer);

  const allPoints = [routeStart, ...activeWaypoints, routeEnd];
  const segments = [];
  let totalDist = 0, totalDur = 0;

  for (let i = 0; i < allPoints.length - 1; i++) {
    const from = allPoints[i], to = allPoints[i+1];
    try {
      const res = await fetch(`${API_BASE}/route?fromLon=${from.lon}&fromLat=${from.lat}&toLon=${to.lon}&toLat=${to.lat}&sport=${sport}`);
      const data = await res.json();
      if (data.geojson) {
        segments.push(data.geojson);
        totalDist += data.distance_km || 0;
        totalDur  += data.duration_min || 0;
      }
    } catch(err) { console.error(err); }
  }

  if (segments.length > 0) {
    const color = { velo:'#2d6a4f', rando:'#6b5344', course:'#dc2626' }[sport] || '#2d6a4f';
    routeLayer = L.geoJSON({ type:'FeatureCollection', features: segments }, {
      style: { color, weight: 5, opacity: 0.9 }
    }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding:[40,40] });

    const h = Math.floor(totalDur/60), m = Math.round(totalDur%60);
    document.getElementById('route-result').classList.remove('hidden');
    document.getElementById('route-dist').textContent = totalDist.toFixed(1) + ' km';
    document.getElementById('route-dur').textContent  = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${Math.round(totalDur)} min`;
    document.getElementById('route-source').innerHTML = '<span style="font-size:10px;color:#2d6a4f">pgRouting ✓</span>';
    showToast(`Itinéraire avec ${activeWaypoints.length} étape(s) — ${totalDist.toFixed(1)} km ✓`, 'success');
  }

  if (btn) { btn.textContent = "Calculer l'itinéraire"; btn.disabled = false; }
};

window.addWaypointField = addWaypointField;
window.removeWaypoint   = removeWaypoint;
window.geocodeWaypoint  = geocodeWaypoint;
window.pickWaypoint     = pickWaypoint;