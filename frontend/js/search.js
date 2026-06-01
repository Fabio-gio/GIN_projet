/**
 * search.js — Recherche d'itinéraires via pgRouting
 * TrailFinder CH — GIN HEIG-VD
 */

window.searchStartCoords = null;
let searchStartCoords = null;
let searchStartMarker = null;
let searchResultLayers = [];

// ---- Géocodage pour le point de départ ----
async function geocodeStart(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Suisse')}&format=json&limit=1`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  const data = await res.json();
  if (!data.length) throw new Error('Adresse non trouvée');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name.split(',')[0] };
}

function setSearchStart(lat, lon, label) {
  searchStartCoords = { lat, lon };
  window.searchStartCoords = { lat, lon };
  if (searchStartMarker) map.removeLayer(searchStartMarker);
  searchStartMarker = L.circleMarker([lat, lon], {
    radius: 10, color: '#2d6a4f', fillColor: '#2d6a4f', fillOpacity: 0.8, weight: 3,
  }).addTo(map).bindPopup(`<b>Départ</b><br>${label}`);
  const lbl = document.getElementById('start-label');
  if (lbl) { lbl.textContent = `📍 ${label}`; lbl.style.color = '#2d6a4f'; }
  map.setView([lat, lon], 13);
  showToast(`Départ : ${label} ✓`, 'success');
}

// ---- Recherche principale via pgRouting ----
async function searchRoutesPgR() {
  const _coords = searchStartCoords || window.searchStartCoords;
  if (!_coords) {
    showToast('Définissez d\'abord un point de départ', 'error');
    return;
  }

  const sport    = document.querySelector('.sport-tab.active')?.dataset.sport || 'velo';
  const mode     = document.querySelector('.btn-filter.active[data-filter="mode"]')?.dataset.val || 'boucle';
  const denivele = document.getElementById(sport === 'velo' ? 'denivele-slider' : sport === 'rando' ? 'denivele-rando-slider' : 'denivele-course-slider')?.value || 500;

  let dureeH = 2;
  let distKm = 20;

  if (sport === 'velo') {
    dureeH = parseFloat(document.getElementById('duree-slider')?.value || 2);
    distKm = dureeH * 20;
  } else if (sport === 'rando') {
    dureeH = parseFloat(document.getElementById('duree-rando-slider')?.value || 3);
    distKm = dureeH * 5;
  } else {
    distKm = parseFloat(document.getElementById('dist-course-slider')?.value || 10);
    dureeH = distKm / 10;
  }

  const btn = document.getElementById('btn-search');
  btn.textContent = 'Calcul en cours…';
  btn.disabled = true;

  // Effacer les anciens résultats
  searchResultLayers.forEach(l => map.removeLayer(l));
  searchResultLayers = [];

  try {
    const niveau = document.querySelector('.btn-filter.active[data-filter="difficulte"]')?.dataset.val || 'moyen';
    const ftp    = parseFloat(document.getElementById('ftp-slider')?.value || 3.0);
    const vap    = parseFloat(document.getElementById('vap-slider')?.value || 10.0);
    const params = new URLSearchParams({
      fromLon: _coords.lon,
      fromLat: _coords.lat,
      sport,
      mode,
      duree_h: dureeH,
      niveau,
      ftp,
      vap,
    });

    const res  = await fetch(`${API_BASE}/search-routes?${params}`);
    const data = await res.json();

    displaySearchResults(data.results || [], data.demo);

  } catch (err) {
    showToast('Erreur de recherche', 'error');
    console.error(err);
  } finally {
    btn.textContent = 'Trouver des itinéraires';
    btn.disabled = false;
  }
}

// ---- Affichage des résultats ----
function displaySearchResults(results, isDemo) {
  const section = document.getElementById('results-section');
  const list    = document.getElementById('results-list');
  const count   = document.getElementById('results-count');

  section.classList.remove('hidden');
  count.textContent = `RÉSULTATS ${results.length} ITINÉRAIRE${results.length !== 1 ? 'S' : ''}${isDemo ? ' (estimation)' : ' — pgRouting ✓'}`;

  const COLORS = ['#2d6a4f', '#457b9d', '#e07a5f'];

  if (results.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Aucun itinéraire trouvé</p></div>';
    return;
  }

  list.innerHTML = results.map((r, i) => `
    <div class="result-card" data-idx="${i}" style="border-left: 3px solid ${COLORS[i % COLORS.length]}">
      <div class="result-card-header">
        <span class="result-name">${r.name}</span>
        ${isDemo ? '<span class="result-badge badge-moyen">estimation</span>' : '<span class="result-badge badge-facile">pgRouting</span>'}
      </div>
      <div class="result-stats">
        <div class="result-stat"><span class="result-stat-val">${r.distance_km || r.distance || '?'} km</span><span class="result-stat-lbl">Distance</span></div>
        <div class="result-stat"><span class="result-stat-val">${r.duration}</span><span class="result-stat-lbl">Durée</span></div>
      </div>
      <div class="result-actions">
        <button class="btn-sm btn-sm-green" onclick="zoomToSearchResult(${i})">Voir</button>
        <button class="btn-gpx" onclick="exportSearchGPX(${i})">GPX</button>
      </div>
    </div>`).join('');

  // Afficher sur la carte
  results.forEach((r, i) => {
    if (!r.geojson) return;
    const color = COLORS[i % COLORS.length];
    const layer = L.geoJSON(r.geojson, {
      style: () => ({ color, weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }),
    }).addTo(map);
    layer._routeData = r;
    searchResultLayers.push(layer);
  });

  // Zoomer sur tous les résultats
  if (searchResultLayers.length > 0) {
    const group = L.featureGroup(searchResultLayers);
    map.fitBounds(group.getBounds(), { padding: [40, 40] });
  }
}

function zoomToSearchResult(idx) {
  if (searchResultLayers[idx]) {
    map.fitBounds(searchResultLayers[idx].getBounds(), { padding: [40, 40] });
  }
}

function exportSearchGPX(idx) {
  const layer = searchResultLayers[idx];
  if (!layer) return;
  const data = layer._routeData;
  const geojson = layer.toGeoJSON();
  let coords = [];

  // Extraire les coordonnées selon le type de géométrie
  const extractCoords = (geom) => {
    if (!geom) return;
    if (geom.type === 'LineString') coords = coords.concat(geom.coordinates);
    else if (geom.type === 'GeometryCollection') geom.geometries?.forEach(g => extractCoords(g));
    else if (geom.type === 'Feature') extractCoords(geom.geometry);
    else if (geom.type === 'FeatureCollection') geom.features?.forEach(f => extractCoords(f));
  };

  geojson.features?.forEach(f => extractCoords(f.geometry));
  if (coords.length === 0) extractCoords(geojson);

  const pts = coords.map(([lon, lat]) =>
    `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`).join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailFinder CH — HEIG-VD" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>${data?.name || 'Itinéraire'}</name><trkseg>
${pts}
  </trkseg></trk>
</gpx>`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  a.download = `${(data?.name || 'itineraire').replace(/[^a-z0-9]/gi, '_')}.gpx`;
  a.click();
  showToast('GPX exporté ✓', 'success');
}

window.searchRoutesPgR = searchRoutesPgR;
window.setSearchStart  = setSearchStart;
window.geocodeStart    = geocodeStart;
window.zoomToSearchResult = zoomToSearchResult;
window.exportSearchGPX = exportSearchGPX;
