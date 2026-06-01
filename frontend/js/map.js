/**
 * map.js — Carte Leaflet + fonds de carte Swisstopo
 * TrailFinder CH — GIN HEIG-VD
 */

const basemaps = {
  topo: L.tileLayer(
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    { attribution: '© <a href="https://www.swisstopo.admin.ch">swisstopo</a>', maxZoom: 18 }
  ),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 19,
  }),
  swissimage: L.tileLayer(
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
    { attribution: '© swisstopo SWISSIMAGE', maxZoom: 20 }
  ),
  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '© Esri', maxZoom: 19 }
  ),
};

const layers = {
  cantons: L.layerGroup(),
  routes:  L.layerGroup(),
};

const map = L.map('map', {
  center: [46.65, 6.85],
  zoom: 9,
  layers: [basemaps.topo],
  zoomControl: true,
});

Object.values(layers).forEach(l => l.addTo(map));
L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

// Basemap switcher
document.querySelectorAll('.layer-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    const key = opt.dataset.basemap;
    if (!key) return;
    Object.values(basemaps).forEach(b => map.removeLayer(b));
    map.addLayer(basemaps[key]);
    document.querySelectorAll('.layer-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });
});

// Layers popup toggle
document.getElementById('ctrl-layers').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('layers-popup').classList.toggle('hidden');
});
document.addEventListener('click', () => document.getElementById('layers-popup').classList.add('hidden'));
document.getElementById('layers-popup').addEventListener('click', e => e.stopPropagation());

// Localisation
document.getElementById('ctrl-locate').addEventListener('click', () => {
  map.locate({ setView: true, maxZoom: 14 });
  showToast('Localisation en cours…');
});
map.on('locationfound', e => {
  L.circleMarker(e.latlng, { radius:10, color:'#2d6a4f', fillColor:'#2d6a4f', fillOpacity:0.3, weight:2 })
    .addTo(map).bindPopup('📍 Ma position').openPopup();
  showToast('Position trouvée ✓', 'success');
});
map.on('locationerror', () => showToast('Localisation impossible', 'error'));

// Toast
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.className = `toast ${type}`, 3000);
}

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8080/api' : '/api';

window.map = map;
window.layers = layers;
window.basemaps = basemaps;
window.showToast = showToast;
window.API_BASE = API_BASE;
