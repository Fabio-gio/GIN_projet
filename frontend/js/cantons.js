/**
 * cantons.js — Cantons romands + Routes OSM dynamiques
 * Source : CANTONS_Romands.gpkg (SwissBoundaries3D — Swisstopo)
 *
 * Gère deux couches cartographiques :
 *   1. Cantons romands : polygones GeoJSON colorés par canton (KANTONSNUM),
 *      chargés depuis data/cantons_romands.geojson (fichier local).
 *   2. Routes OSM : tronçons depuis /api/osm-ways filtrés par bounding box,
 *      rechargés automatiquement à chaque déplacement de la carte (moveend).
 *
 * Fonctions exposées : loadCantons, loadRoutesSwisstopo
 */

// Couleur par numéro de canton (KANTONSNUM Swisstopo SwissBoundaries3D).
const CANTON_COLORS = {
  2:  '#4361ee', // Berne
  10: '#2ec4b6', // Fribourg
  22: '#e63946', // Vaud
  23: '#ff9f1c', // Valais
  24: '#8338ec', // Neuchâtel
  25: '#3a86ff', // Genève
  26: '#06d6a0', // Jura
};

// Référence à la couche GeoJSON — conservée pour réafficher sans recharger.
let cantonsGeoLayer = null;

// Charge le GeoJSON local, crée les polygones Leaflet avec styles,
// tooltips, popups et interactions de survol.
async function loadCantons() {
  try {
    let geojson;
    // Toujours utiliser le GeoJSON local pré-converti
    // Chargement du fichier GeoJSON servi par Go via r.Static("/data", ...).
const res = await fetch('data/cantons_romands.geojson');
    if (!res.ok) throw new Error('cantons_romands.geojson introuvable');
    geojson = await res.json();
    console.log('âœ… Cantons chargés depuis GeoJSON local');

    layers.cantons.clearLayers();

    cantonsGeoLayer = L.geoJSON(geojson, {
      // Style : couleur selon le numéro de canton, remplissage semi-transparent.
      style: f => {
        const color = CANTON_COLORS[f.properties.KANTONSNUM] || '#adb5bd';
        return { color, weight: 2, opacity: 0.85, fillColor: color, fillOpacity: 0.13 };
      },
      // Tooltip (nom), popup (infos canton), survol (opacité) et clic (panneau).
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const color = CANTON_COLORS[p.KANTONSNUM] || '#adb5bd';
        const pop = p.EINWOHNERZ ? Number(p.EINWOHNERZ).toLocaleString('fr-CH') : '"”';

        layer.bindTooltip(p.NAME, { permanent: false, direction: 'center', className: 'canton-tooltip' });

        layer.bindPopup(`
          <div class="popup-content">
            <h4>🏛 ${p.NAME}</h4>
            <p>Canton n° ${p.KANTONSNUM} · SwissBoundaries3D</p>
            <div style="margin-top:8px">
              <div style="font-size:10px;color:#8892a4;text-transform:uppercase;letter-spacing:.05em">Population</div>
              <div style="font-size:15px;font-weight:600;color:${color};font-family:'DM Mono',monospace">${pop}</div>
            </div>
          </div>`, { maxWidth: 220 }
        );

        layer.on({
          mouseover: e => { e.target.setStyle({ fillOpacity: 0.35, weight: 3 }); e.target.bringToFront(); },
          mouseout:  e => cantonsGeoLayer.resetStyle(e.target),
          click: () => {
            document.getElementById('panel-canton-info').style.display = 'block';
            document.getElementById('canton-name').textContent = p.NAME;
            document.getElementById('canton-pop').textContent = pop + ' hab.';
            document.getElementById('canton-num').textContent = 'n° ' + p.KANTONSNUM;
          },
        });
      },
    });

    cantonsGeoLayer.addTo(layers.cantons);
    showToast(`${geojson.features.length} cantons romands chargés âœ“`, 'success');
  } catch (err) {
    console.error('Erreur cantons:', err);
    showToast('Cantons : erreur de chargement', 'error');
  }
}

// Toggle couche routes Swisstopo (route_decoup.gpkg via backend)
// ── ROUTES OSM ───────────────────────────────────────────────────────────
let routesSwissLoaded = false;
let routesSwissLayer = null;

// Charge les routes OSM depuis /api/osm-ways avec le bounding box courant.
// Appelée au chargement initial et à chaque moveend de la carte.
async function loadRoutesSwisstopo(bbox) {
  try {
    layers.routes.clearLayers();

    // Charger les routes depuis pgRouting/OSM via l'API
    let url = `${API_BASE}/osm-ways`;
    if (bbox) url += `?minLon=${bbox.getWest()}&minLat=${bbox.getSouth()}&maxLon=${bbox.getEast()}&maxLat=${bbox.getNorth()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('API indisponible');
    const geojson = await res.json();

    if (!geojson.features || geojson.features.length === 0) {
      showToast('Aucune route dans cette zone', '');
      return;
    }

    routesSwissLayer = L.geoJSON(geojson, {
      style: f => {
        const tag = f.properties?.tag_id || 0;
        // Couleur selon le tag_id OSM : rouge=autoroute, orange=principale,
        // jaune=secondaire, vert=cyclable, bleu=autres.
        if (tag <= 102) return { color:'#e63946', weight:3, opacity:0.8 };       // motorway
        if (tag <= 107) return { color:'#ff9f1c', weight:2.5, opacity:0.8 };     // primary
        if (tag <= 109) return { color:'#ffd166', weight:2, opacity:0.75 };      // secondary/tertiary
        if (tag === 118) return { color:'#2d6a4f', weight:2, opacity:0.85 };     // cycleway
        return { color:'#4361ee', weight:1.5, opacity:0.6 };                     // autres
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const types = {101:'Autoroute',106:'Route principale',108:'Route secondaire',109:'Route tertiaire',110:'Route résidentielle',118:'Piste cyclable',113:'Chemin',119:'Sentier pédestre'};
        const type = types[p.tag_id] || 'Route';
        layer.bindPopup(`<div class="popup-content"><h4>🏛£ ${p.name || type}</h4><p>${type}</p><div style="font-size:10px;color:#8892a4">Source: OSM</div></div>`);
      },
    });

    routesSwissLayer.addTo(layers.routes);
    routesSwissLoaded = true;
    showToast(`${geojson.features.length} routes OSM chargées âœ“`, 'success');
  } catch (err) {
    console.warn('Routes OSM:', err.message);
    showToast('Erreur chargement routes OSM', 'error');
  }
}

// Toggle cantons
// Checkbox cantons : réutilise la couche existante si déjà chargée.
document.getElementById('layer-cantons').addEventListener('change', e => {
  if (e.target.checked) {
    cantonsGeoLayer ? cantonsGeoLayer.addTo(layers.cantons) : loadCantons();
  } else {
    layers.cantons.clearLayers();
  }
});

// Toggle routes (chargées par bbox de la vue courante)
// Checkbox routes : chargement initial + rechargement automatique au moveend.
// L'événement nommé "moveend.routes" permet de le désenregistrer proprement.
document.getElementById('layer-routes-sw').addEventListener('change', async e => {
  if (e.target.checked) {
    const bbox = map.getBounds();
    await loadRoutesSwisstopo(bbox);
    // Recharger quand on bouge la carte
    map.on('moveend.routes', async () => {
      if (document.getElementById('layer-routes-sw').checked) {
        await loadRoutesSwisstopo(map.getBounds());
      }
    });
  } else {
    layers.routes.clearLayers();
    map.off('moveend.routes');
  }
});

window.loadCantons = loadCantons;
window.loadRoutesSwisstopo = loadRoutesSwisstopo;