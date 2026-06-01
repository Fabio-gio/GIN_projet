/**
 * api.js — Communication avec le backend Go/Gin
 * GIN Webmapping — HEIG-VD
 *
 * Centralise les appels REST pour les POIs et l'altitude MNT.
 * Si le backend n'est pas démarré, utilise DEMO_POIS (données statiques)
 * pour que l'interface reste fonctionnelle sans PostgreSQL.
 *
 * Fonctions exposées : loadPOIs, getElevation
 */

// URL de base de l'API — dupliquée ici par sécurité si api.js charge avant map.js.
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8080/api'
  : '/api';

// POIs
// Charge les POIs depuis GET /api/pois.
// En cas d'erreur : fallback sur DEMO_POIS (données statiques).
async function loadPOIs() {
  try {
    const res = await fetch(`${API_BASE}/pois`);
    if (!res.ok) throw new Error();
    const fc = await res.json();
    renderPOIs(fc.features || []);
  } catch {
    console.warn('POIs: mode démo (backend non démarré)');
    renderPOIs(DEMO_POIS);
  }
}

// Crée les marqueurs Leaflet pour chaque POI avec icône par catégorie et popup.
function renderPOIs(features) {
  layers.pois.clearLayers();
  features.forEach(f => {
    const coords = f.geometry?.coordinates || [f.lon, f.lat];
    const p = f.properties || f;
    const [lon, lat] = coords;
    const color = categoryColors[p.category] || '#adb5bd';

    const marker = L.marker([lat, lon], { icon: getCategoryIcon(p.category) });
    marker.bindPopup(`
      <div class="popup-content">
        <h4>${p.name}</h4>
        <p>${p.description || '"”'}</p>
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;
          font-weight:600;text-transform:uppercase;background:${color}22;color:${color}">
          ${p.category}
        </span>
        <br/><br/>
        <button onclick="deletePOI('${p.id}')"
          style="padding:4px 10px;background:rgba(230,57,70,0.15);color:#e63946;
          border:1px solid rgba(230,57,70,0.3);border-radius:5px;cursor:pointer;font-size:11px">
          Supprimer
        </button>
      </div>`
    );
    layers.pois.addLayer(marker);
  });
}

// Supprime un POI via DELETE /api/pois/:id puis recharge la liste.
window.deletePOI = async function(id) {
  try {
    await fetch(`${API_BASE}/pois/${id}`, { method: 'DELETE' });
    await loadPOIs();
    showToast('POI supprimé âœ“', 'success');
  } catch {
    showToast('Erreur suppression', 'error');
  }
};

// POIs de démo si backend non démarré
// Données de démonstration utilisées si le backend n'est pas disponible.
const DEMO_POIS = [
  { geometry:{type:'Point',coordinates:[6.6413,46.7785]}, properties:{id:'d1',name:'HEIG-VD Yverdon',description:"École d'ingénieurs HES-SO",category:'education'} },
  { geometry:{type:'Point',coordinates:[6.6411,46.7784]}, properties:{id:'d2',name:"Château d'Yverdon",description:'Château médiéval XIIIe s.',category:'patrimoine'} },
  { geometry:{type:'Point',coordinates:[6.5657,46.5197]}, properties:{id:'d3',name:'EPFL Lausanne',description:'École Polytechnique Fédérale',category:'education'} },
  { geometry:{type:'Point',coordinates:[6.6335,46.5228]}, properties:{id:'d4',name:'Cathédrale Lausanne',description:'Gothique, XIIe siècle',category:'patrimoine'} },
  { geometry:{type:'Point',coordinates:[6.8700,46.8800]}, properties:{id:'d5',name:'Lac de Neuchâtel',description:'Grand lac romand',category:'nature'} },
  { geometry:{type:'Point',coordinates:[6.1432,46.2044]}, properties:{id:'d6',name:'Genève Vieille-Ville',description:'Centre historique',category:'patrimoine'} },
];

// Altitude MNT
// Récupère l'altitude d'un point via GET /api/mnt/elevation.
// Utilisé dans tools.js au clic droit. Retourne null si indisponible.
async function getElevation(lat, lon) {
  try {
    const res = await fetch(`${API_BASE}/mnt/elevation?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return null;
  }
}

// Export des fonctions globales.
window.API_BASE = API_BASE;
window.loadPOIs = loadPOIs;
window.getElevation = getElevation;