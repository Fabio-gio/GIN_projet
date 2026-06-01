/**
 * tools.js — Mesure, numérisation, altitude MNT
 * GIN Webmapping — HEIG-VD
 */

// ---- MESURE ----
let _measuring = false;
let _measurePts = [];
let _measureLine = null;
let _measureDots = [];

function startMeasure() {
  _measuring = true;
  _measurePts = [];
  _measureDots = [];
  if (_measureLine) { map.removeLayer(_measureLine); _measureLine = null; }
  document.getElementById('measure-result').classList.remove('hidden');
  document.getElementById('measure-value').textContent = 'Cliquez pour commencer…';
  map.getContainer().style.cursor = 'crosshair';
  showToast('Mesure : cliquez, double-clic pour terminer');
}

function stopMeasure() {
  _measuring = false;
  map.getContainer().style.cursor = '';
}

function haversine(a, b) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0]-a[0]), dLon = toRad(b[1]-a[1]);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function fmtDist(m) { return m >= 1000 ? (m/1000).toFixed(2)+' km' : Math.round(m)+' m'; }

map.on('click', async e => {
  if (!_measuring) return;
  const pt = [e.latlng.lat, e.latlng.lng];
  _measurePts.push(pt);

  const dot = L.circleMarker(pt, { radius:5, color:'#e63946', fillColor:'#e63946', fillOpacity:0.9, weight:2 }).addTo(map);
  _measureDots.push(dot);

  if (_measureLine) map.removeLayer(_measureLine);
  if (_measurePts.length >= 2) {
    _measureLine = L.polyline(_measurePts, { color:'#e63946', weight:2, dashArray:'6 3' }).addTo(map);
    let d = 0;
    for (let i = 1; i < _measurePts.length; i++) d += haversine(_measurePts[i-1], _measurePts[i]);
    document.getElementById('measure-value').textContent = fmtDist(d);
  }
});

map.on('dblclick', () => { if (_measuring) stopMeasure(); });

// ---- DESSIN ----
let _drawer = null;

function activateDraw(type) {
  if (_drawer) { _drawer.disable(); _drawer = null; }
  if (_measuring) stopMeasure();
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

  switch (type) {
    case 'point':   _drawer = new L.Draw.Marker(map, { icon: getCategoryIcon('autre') }); break;
    case 'line':    _drawer = new L.Draw.Polyline(map, { shapeOptions:{ color:'#4361ee', weight:3, dashArray:'8 4' }, metric:true }); break;
    case 'polygon': _drawer = new L.Draw.Polygon(map,  { shapeOptions:{ color:'#4361ee', fillColor:'#4361ee', fillOpacity:0.15, weight:2 }, showArea:true }); break;
  }
  if (_drawer) { _drawer.enable(); showToast(`Outil ${type} actif — double-clic pour terminer`); }
}

map.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;
  layers.drawn.addLayer(layer);

  if (e.layerType === 'polygon') {
    const lls = layer.getLatLngs()[0];
    let area = 0;
    for (let i = 0; i < lls.length; i++) {
      const j = (i+1) % lls.length;
      area += lls[i].lng * lls[j].lat - lls[j].lng * lls[i].lat;
    }
    area = Math.abs(area * 111319 * 111319 * Math.cos(lls[0].lat * Math.PI/180) / 2);
    const label = area > 10000 ? (area/10000).toFixed(2)+' ha' : Math.round(area)+' m²';
    layer.bindPopup(`<div class="popup-content"><h4>Polygone dessiné</h4><p>Surface ≈ ${label}</p></div>`).openPopup();

  } else if (e.layerType === 'polyline') {
    const lls = layer.getLatLngs();
    let d = 0;
    for (let i = 1; i < lls.length; i++) d += lls[i-1].distanceTo(lls[i]);
    layer.bindPopup(`<div class="popup-content"><h4>Ligne dessinée</h4><p>${fmtDist(d)}</p></div>`).openPopup();

  } else if (e.layerType === 'marker') {
    const ll = layer.getLatLng();
    layer.bindPopup(`<div class="popup-content"><h4>Point dessiné</h4><p>${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}</p></div>`).openPopup();
  }

  _drawer = null;
  showToast('Élément ajouté ✓', 'success');
});

// ---- AFFICHAGE ALTITUDE MNT au clic droit ----
map.on('contextmenu', async e => {
  const { lat, lng } = e.latlng;
  const elev = await getElevation(lat, lng);
  if (elev && elev.elevation_m !== null && elev.elevation_m !== undefined) {
    L.popup()
      .setLatLng(e.latlng)
      .setContent(`
        <div class="popup-content">
          <h4>📊 Altitude MNT</h4>
          <p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
          <div class="elev-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ec4b6" stroke-width="2">
              <polygon points="12 2 22 20 2 20"/>
            </svg>
            <span class="elev-value">${Math.round(elev.elevation_m)} m</span>
            <span style="font-size:10px;color:#8892a4">altitude</span>
          </div>
          <div style="font-size:10px;color:#8892a4;margin-top:6px">Source : MNT_Romandies.tif — Swisstopo</div>
        </div>`)
      .openOn(map);
  } else {
    L.popup()
      .setLatLng(e.latlng)
      .setContent(`<div class="popup-content"><h4>📍 Coordonnées</h4><p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p><p style="font-size:10px;color:#8892a4">Altitude: backend requis</p></div>`)
      .openOn(map);
  }
});

// ---- BOUTONS ----
document.getElementById('tool-measure-line').addEventListener('click', e => {
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  if (_measuring) { stopMeasure(); }
  else { if (_drawer) { _drawer.disable(); _drawer = null; } e.currentTarget.classList.add('active'); startMeasure(); }
});

document.getElementById('tool-draw-point').addEventListener('click', e => {
  e.currentTarget.classList.add('active'); activateDraw('point');
});
document.getElementById('tool-draw-line').addEventListener('click', e => {
  e.currentTarget.classList.add('active'); activateDraw('line');
});
document.getElementById('tool-draw-polygon').addEventListener('click', e => {
  e.currentTarget.classList.add('active'); activateDraw('polygon');
});

document.getElementById('tool-clear').addEventListener('click', () => {
  layers.drawn.clearLayers();
  _measurePts = [];
  if (_measureLine) { map.removeLayer(_measureLine); _measureLine = null; }
  _measureDots.forEach(d => map.removeLayer(d)); _measureDots = [];
  document.getElementById('measure-result').classList.add('hidden');
  stopMeasure();
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  showToast('Éléments effacés');
});

document.getElementById('tool-locate').addEventListener('click', e => {
  e.currentTarget.classList.add('active');
  map.locate({ setView: true, maxZoom: 15 });
  showToast('Localisation en cours…');
});

map.on('locationfound', e => {
  document.getElementById('tool-locate').classList.remove('active');
  L.marker(e.latlng, { icon: getCategoryIcon('transport') })
    .addTo(layers.drawn)
    .bindPopup(`<div class="popup-content"><h4>📍 Ma position</h4><p>±${Math.round(e.accuracy/2)} m</p></div>`)
    .openPopup();
  L.circle(e.latlng, { radius:e.accuracy/2, color:'#4361ee', fillOpacity:0.08, weight:1 }).addTo(layers.drawn);
  showToast('Position trouvée ✓', 'success');
});

map.on('locationerror', () => {
  document.getElementById('tool-locate').classList.remove('active');
  showToast('Localisation impossible', 'error');
});

// Exposer pour app.js
window._measuring = false;
window._drawer = null;
Object.defineProperty(window, 'measureActive', { get: () => _measuring });
Object.defineProperty(window, 'activeDrawer',  { get: () => _drawer });
