/**
 * map.js — Carte Leaflet + fonds de carte Swisstopo
 * TrailFinder CH — GIN HEIG-VD
 *
 * PREMIER fichier chargé dans index.html.
 * Crée la carte Leaflet et expose les variables globales
 * utilisées par tous les autres scripts : map, layers, showToast, API_BASE.
 *
 * Fonds de carte Swisstopo (WMTS, gratuits, sans clé API) :
 *   topo       → carte nationale suisse (fond par défaut)
 *   swissimage → orthophoto aérienne haute résolution
 *   osm        → OpenStreetMap (fallback)
 *   satellite  → Esri World Imagery
 */

// Fonds de carte disponibles. Tous en EPSG:3857 (Web Mercator), compatible Leaflet.
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

// LayerGroups : permettent de vider/afficher des groupes de géométries en une commande.
const layers = {
  cantons: L.layerGroup(),
  routes:  L.layerGroup(),
};

// Initialisation de la carte : centre Suisse romande, zoom régional, fond topo.
const map = L.map('map', {
  center: [46.65, 6.85],
  zoom: 9,
  layers: [basemaps.topo],
  zoomControl: true,
});

// Ajout de tous les LayerGroups à la carte dès le démarrage.
Object.values(layers).forEach(l => l.addTo(map));
// Échelle graphique en bas à droite (métriques uniquement).
L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

// Basemap switcher
// Sélecteur de fond de carte : retire tous les fonds existants et ajoute celui cliqué.
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
// Bouton Couches : ouvre/ferme le popup. stopPropagation empêche la fermeture immédiate.
document.getElementById('ctrl-layers').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('layers-popup').classList.toggle('hidden');
});
document.addEventListener('click', () => document.getElementById('layers-popup').classList.add('hidden'));
document.getElementById('layers-popup').addEventListener('click', e => e.stopPropagation());

// Localisation
// Bouton GPS : déclenche map.locate() → navigator.geolocation.
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
// Notification temporaire 3 secondes. type : "" | "success" | "error"
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.className = `toast ${type}`, 3000);
}

// URL de base de l'API Go : http://localhost:8080/api en dev, /api en prod.
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8080/api' : '/api';

// Export des variables globales — accessibles depuis tous les autres scripts.
window.map = map;
window.layers = layers;
window.basemaps = basemaps;
window.showToast = showToast;
window.API_BASE = API_BASE;