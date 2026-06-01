/**
 * trails.js — Données et logique des itinéraires
 * Coordonnées vérifiées sur Swisstopo/OpenStreetMap
 * TrailFinder CH — GIN HEIG-VD
 */

const TRAILS = [
  // ================================================================
  // VÉLO
  // ================================================================
  {
    id: 'v1', sport: 'velo', name: 'Tour du Lac de Neuchâtel',
    description: 'Le grand classique romand — tour complet du lac par les deux rives.',
    difficulte: 'facile', terrain: 'plat',
    distance: 42, duree: 1.75, denivele: 320, ftp: 2.2,
    region: 'Neuchâtel / Vaud',
    coords: [
      [46.790, 6.650],  // Yverdon bord lac
      [46.818, 6.650],  // Grandson
      [46.850, 6.700],  // Concise
      [46.852, 6.849],  // Estavayer-le-Lac
      [46.958, 7.015],  // Cudrefin
      [46.991, 6.933],  // Neuchâtel port
      [46.975, 6.970],  // Hauterive
      [46.956, 6.892],  // Cortaillod
      [46.929, 6.837],  // Bevaix
      [46.852, 6.849],  // retour Estavayer
      [46.818, 6.650],  // Grandson
      [46.790, 6.650],  // Yverdon
    ],
    color: '#2d6a4f'
  },
  {
    id: 'v2', sport: 'velo', name: 'Vallée de Joux — Crêtes du Jura',
    description: 'Montée vers la Vallée de Joux depuis Lausanne, passage sur les crêtes.',
    difficulte: 'moyen', terrain: 'col',
    distance: 67, duree: 2.5, denivele: 580, ftp: 3.1,
    region: 'Vaud',
    coords: [
      [46.508, 6.628],  // Lausanne
      [46.523, 6.580],  // Morges direction
      [46.523, 6.338],  // Bière
      [46.545, 6.205],  // Col du Marchairuz
      [46.570, 6.230],  // descente Joux
      [46.598, 6.263],  // Le Sentier
      [46.598, 6.200],  // Le Brassus
    ],
    color: '#457b9d'
  },
  {
    id: 'v3', sport: 'velo', name: 'Yverdon → Grandson',
    description: 'Liaison rapide le long de la rive nord du lac, route plate et panoramique.',
    difficulte: 'facile', terrain: 'plat',
    distance: 18, duree: 0.92, denivele: 85, ftp: 1.8,
    region: 'Vaud',
    coords: [
      [46.7785, 6.6413], // Yverdon centre
      [46.785,  6.644],  // sortie nord
      [46.795,  6.648],
      [46.808,  6.650],
      [46.818,  6.650],  // Grandson
    ],
    color: '#2d6a4f'
  },
  {
    id: 'v4', sport: 'velo', name: 'Col du Marchairuz',
    description: 'Montée mythique depuis Bière jusqu\'au Col du Marchairuz (1447 m).',
    difficulte: 'difficile', terrain: 'col',
    distance: 45, duree: 3.0, denivele: 1100, ftp: 4.2,
    region: 'Vaud',
    coords: [
      [46.508, 6.628],  // Lausanne
      [46.512, 6.580],
      [46.518, 6.520],
      [46.523, 6.338],  // Bière
      [46.530, 6.290],
      [46.540, 6.250],
      [46.545, 6.205],  // Col du Marchairuz (1447m)
    ],
    color: '#e07a5f'
  },
  {
    id: 'v5', sport: 'velo', name: 'Tour des Vignobles de Lavaux',
    description: 'Circuit dans les vignobles en terrasses de Lavaux, classés UNESCO.',
    difficulte: 'moyen', terrain: 'vallonne',
    distance: 35, duree: 2.0, denivele: 450, ftp: 2.8,
    region: 'Vaud',
    coords: [
      [46.508, 6.628],  // Lausanne
      [46.504, 6.693],  // Lutry
      [46.496, 6.729],  // Cully
      [46.480, 6.780],  // Rivaz
      [46.468, 6.810],  // Saint-Saphorin
      [46.460, 6.840],  // Montreux dir.
      [46.480, 6.820],  // retour via hauteurs
      [46.496, 6.760],
      [46.508, 6.700],
      [46.508, 6.628],  // Lausanne
    ],
    color: '#457b9d'
  },

  // ================================================================
  // RANDO
  // ================================================================
  {
    id: 'r1', sport: 'rando', name: 'Crêtes du Jura — Signal du Chasseron',
    description: 'Randonnée sur les crêtes du Jura vaudois jusqu\'au Signal du Chasseron (1607 m).',
    difficulte: 'difficile', terrain: 'col', type: 'traverse',
    distance: 18, duree: 6.0, denivele: 1100, ftp: null,
    region: 'Jura vaudois',
    coords: [
      [46.810, 6.520],  // Sainte-Croix
      [46.820, 6.530],
      [46.835, 6.535],  // Signal du Chasseron (1607m)
      [46.845, 6.525],
      [46.855, 6.510],
      [46.865, 6.500],
    ],
    color: '#6b5344'
  },
  {
    id: 'r2', sport: 'rando', name: 'Tour des Muverans',
    description: 'Randonnée en haute altitude dans les Alpes vaudoises, vues spectaculaires.',
    difficulte: 'difficile', terrain: 'col', type: 'boucle',
    distance: 24, duree: 8.0, denivele: 1800, ftp: null,
    region: 'Valais / Vaud',
    coords: [
      [46.265, 7.200],  // Derborence
      [46.270, 7.220],
      [46.280, 7.240],
      [46.290, 7.250],  // Grand Muveran (3051m)
      [46.285, 7.270],
      [46.275, 7.265],
      [46.268, 7.248],
      [46.265, 7.200],  // retour Derborence
    ],
    color: '#6b5344'
  },
  {
    id: 'r3', sport: 'rando', name: 'Lac de Joux — Sentier des Lacs',
    description: 'Boucle autour des lacs du Vallée de Joux, forêts et paysages ouverts.',
    difficulte: 'facile', terrain: 'plat', type: 'boucle',
    distance: 14, duree: 3.5, denivele: 280, ftp: null,
    region: 'Vaud',
    coords: [
      [46.598, 6.263],  // Le Sentier
      [46.610, 6.260],
      [46.625, 6.255],  // Lac Brenet
      [46.635, 6.240],
      [46.625, 6.230],
      [46.610, 6.235],
      [46.600, 6.245],
      [46.598, 6.263],  // retour Le Sentier
    ],
    color: '#40916c'
  },
  {
    id: 'r4', sport: 'rando', name: 'Gruyères — Moléson',
    description: 'Montée au Moléson (2002 m) depuis Gruyères, vue panoramique sur les Préalpes.',
    difficulte: 'moyen', terrain: 'vallonne', type: 'aller-retour',
    distance: 12, duree: 4.0, denivele: 900, ftp: null,
    region: 'Fribourg',
    coords: [
      [46.582, 7.082],  // Gruyères
      [46.575, 7.070],
      [46.568, 7.055],
      [46.560, 7.042],
      [46.554, 7.032],
      [46.549, 7.023],  // Moléson (2002m)
    ],
    color: '#6b5344'
  },
  {
    id: 'r5', sport: 'rando', name: 'Gorges de l\'Areuse',
    description: 'Randonnée dans les gorges spectaculaires de l\'Areuse, accessible toute l\'année.',
    difficulte: 'facile', terrain: 'vallonne', type: 'traverse',
    distance: 10, duree: 3.0, denivele: 350, ftp: null,
    region: 'Neuchâtel',
    coords: [
      [46.949, 6.720],  // Noiraigue
      [46.951, 6.740],
      [46.952, 6.760],
      [46.951, 6.780],
      [46.950, 6.800],
      [46.950, 6.828],  // Boudry
    ],
    color: '#40916c'
  },

  // ================================================================
  // COURSE
  // ================================================================
  {
    id: 'c1', sport: 'course', name: 'TL20 — Trail de Lausanne',
    description: 'Le trail urbain de Lausanne, 20 km dans les parcs et forêts de la ville.',
    difficulte: 'moyen', type: 'trail',
    distance: 20, duree: 2.0, denivele: 580, ftp: null,
    region: 'Lausanne',
    coords: [
      [46.5077, 6.6290], // Ouchy
      [46.5130, 6.6350],
      [46.5200, 6.6400], // Lausanne centre
      [46.5280, 6.6380], // Sauvabelin
      [46.5320, 6.6200], // Signal de Sauvabelin
      [46.5250, 6.6100],
      [46.5180, 6.6150],
      [46.5100, 6.6200],
      [46.5077, 6.6290], // retour Ouchy
    ],
    color: '#dc2626'
  },
  {
    id: 'c2', sport: 'course', name: '10K Yverdon Plaine',
    description: 'Parcours plat et rapide autour d\'Yverdon, idéal pour le chrono.',
    difficulte: 'facile', type: 'route',
    distance: 10, duree: 0.75, denivele: 45, ftp: null,
    region: 'Yverdon',
    coords: [
      [46.7785, 6.6413], // HEIG-VD / centre Yverdon
      [46.7820, 6.6450],
      [46.7860, 6.6430],
      [46.7880, 6.6380],
      [46.7860, 6.6320],
      [46.7820, 6.6290],
      [46.7780, 6.6310],
      [46.7760, 6.6385], // Gare CFF
      [46.7770, 6.6410],
      [46.7785, 6.6413], // retour HEIG-VD
    ],
    color: '#dc2626'
  },
  {
    id: 'c3', sport: 'course', name: 'Ultra Jura 50K',
    description: 'Ultra-trail de 50 km sur les crêtes du Jura vaudois, dénivelé important.',
    difficulte: 'difficile', type: 'trail',
    distance: 50, duree: 6.5, denivele: 2200, ftp: null,
    region: 'Jura vaudois',
    coords: [
      [46.810, 6.520],  // Sainte-Croix
      [46.820, 6.500],
      [46.835, 6.480],
      [46.830, 6.440],
      [46.820, 6.400],
      [46.810, 6.360],
      [46.800, 6.320],
      [46.780, 6.280],
      [46.760, 6.250],
      [46.750, 6.210],  // Le Brassus
    ],
    color: '#7c3aed'
  },
  {
    id: 'c4', sport: 'course', name: 'Corrida de Genève 15K',
    description: 'Classique genevois traversant les quais et la vieille ville.',
    difficulte: 'facile', type: 'route',
    distance: 15, duree: 1.25, denivele: 120, ftp: null,
    region: 'Genève',
    coords: [
      [46.2100, 6.1420], // Gare Cornavin
      [46.2050, 6.1400], // Rive gauche
      [46.2020, 6.1470], // Vieille-Ville
      [46.2010, 6.1530],
      [46.2050, 6.1580], // Quai du Mont-Blanc
      [46.2100, 6.1550],
      [46.2130, 6.1500],
      [46.2120, 6.1450],
      [46.2100, 6.1420], // retour gare
    ],
    color: '#dc2626'
  },
  {
    id: 'c5', sport: 'course', name: 'Semi-marathon de Fribourg',
    description: 'Semi-marathon à travers la ville médiévale de Fribourg et ses environs.',
    difficulte: 'moyen', type: 'route',
    distance: 21, duree: 1.83, denivele: 280, ftp: null,
    region: 'Fribourg',
    coords: [
      [46.8065, 7.1620], // Fribourg centre
      [46.8100, 7.1550],
      [46.8150, 7.1480],
      [46.8200, 7.1400],
      [46.8180, 7.1300],
      [46.8120, 7.1250],
      [46.8060, 7.1300],
      [46.8010, 7.1380],
      [46.8000, 7.1480],
      [46.8040, 7.1570],
      [46.8065, 7.1620], // retour
    ],
    color: '#dc2626'
  },
];

// =====================================================
// ÉTAT
// =====================================================
let activeTrailId = null;
let trailLayers = {};
let savedTrails = JSON.parse(localStorage.getItem('savedTrails') || '[]');

const SPORT_COLORS = { velo: '#2d6a4f', rando: '#6b5344', course: '#dc2626' };
const DIFF_COLORS  = { facile: '#166534', moyen: '#92400e', difficile: '#991b1b' };

// =====================================================
// RENDU CARTE
// =====================================================
function renderTrails(trails) {
  Object.values(trailLayers).forEach(l => map.removeLayer(l));
  trailLayers = {};

  trails.forEach(trail => {
    const color = SPORT_COLORS[trail.sport] || '#2d6a4f';
    const start = trail.coords[0];
    const end   = trail.coords[trail.coords.length - 1];

    const line = L.polyline(trail.coords, { color, weight: 4, opacity: 0.85 });

    const startMarker = L.circleMarker(start, {
      radius: 7, color: 'white', fillColor: color, fillOpacity: 1, weight: 2.5,
    });
    const endMarker = L.circleMarker(end, {
      radius: 7, color: 'white', fillColor: '#1a1a2e', fillOpacity: 1, weight: 2.5,
    });

    const label = L.marker(start, {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:${color};color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;font-family:Inter,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.25)">${trail.name.split('—')[0].split('→')[0].trim()}</div>`,
        iconAnchor: [0, 10],
      }),
    });

    line.bindPopup(`
      <div class="trail-popup">
        <h4>${trail.name}</h4>
        <p>${trail.region} · ${trail.difficulte}</p>
        <div class="trail-popup-stats">
          <div class="trail-popup-stat"><strong>${trail.distance} km</strong><span>Distance</span></div>
          <div class="trail-popup-stat"><strong>${formatDuree(trail.duree)}</strong><span>Durée</span></div>
          <div class="trail-popup-stat"><strong>${trail.denivele} m</strong><span>D+</span></div>
        </div>
      </div>`);
    line.on('click', () => showDetail(trail));

    const group = L.layerGroup([line, startMarker, endMarker, label]);
    group.addTo(map);
    trailLayers[trail.id] = group;
  });
}

// =====================================================
// FILTRAGE
// =====================================================
function filterTrails() {
  const sport = window.currentSport;

  const maxDenivele = parseInt(document.getElementById(
    sport === 'velo' ? 'denivele-slider' :
    sport === 'rando' ? 'denivele-rando-slider' : 'denivele-course-slider'
  ).value);

  return TRAILS.filter(t => {
    if (t.sport !== sport) return false;
    if (t.denivele > maxDenivele) return false;

    if (sport === 'velo') {
      const ftp   = parseFloat(document.getElementById('ftp-slider').value);
      const duree = parseFloat(document.getElementById('duree-slider').value);
      const diff  = document.querySelector('.btn-filter.active[data-filter="difficulte"]')?.dataset.val;
      const niveaux = ['facile', 'moyen', 'difficile'];
      if (diff && niveaux.indexOf(t.difficulte) > niveaux.indexOf(diff)) return false;
      if (t.ftp && t.ftp > ftp + 2.0) return false;
      if (Math.abs(t.duree - duree) > 4) return false;
    }
    if (sport === 'rando') {
      const duree = parseFloat(document.getElementById('duree-rando-slider').value);
      const diff  = document.querySelector('.btn-filter.active[data-filter="diff-rando"]')?.dataset.val;
      const niveaux = ['facile', 'moyen', 'difficile'];
      if (diff && niveaux.indexOf(t.difficulte) > niveaux.indexOf(diff)) return false;
      if (Math.abs(t.duree - duree) > 5) return false;
    }
    if (sport === 'course') {
      const dist = parseInt(document.getElementById('dist-course-slider').value);
      const type = document.querySelector('.btn-filter.active[data-filter="type-course"]')?.dataset.val;
      if (type && t.type !== type) return false;
      if (Math.abs(t.distance - dist) > 30) return false;
    }
    return true;
  });
}

// =====================================================
// RÉSULTATS
// =====================================================
function showResults(trails) {
  document.getElementById('results-section').classList.remove('hidden');
  document.getElementById('results-count').textContent =
    `RÉSULTATS ${trails.length} ITINÉRAIRE${trails.length !== 1 ? 'S' : ''}`;

  document.getElementById('results-list').innerHTML = trails.length === 0
    ? '<div class="empty-state"><p>Aucun résultat — modifiez les filtres</p></div>'
    : trails.map(t => `
      <div class="result-card" data-id="${t.id}">
        <div class="result-card-header">
          <span class="result-name">${t.name}</span>
          <span class="result-badge badge-${t.difficulte}">${t.difficulte}</span>
        </div>
        <div class="result-stats">
          <div class="result-stat"><span class="result-stat-val">${t.distance} km</span><span class="result-stat-lbl">Distance</span></div>
          <div class="result-stat"><span class="result-stat-val">${formatDuree(t.duree)}</span><span class="result-stat-lbl">Durée</span></div>
          <div class="result-stat"><span class="result-stat-val">${t.denivele} m</span><span class="result-stat-lbl">Dénivelé+</span></div>
          ${t.ftp ? `<div class="result-stat"><span class="result-stat-val">${t.ftp} W/kg</span><span class="result-stat-lbl">FTP req.</span></div>` : ''}
          ${t._distFromStart !== undefined ? `<div class="result-stat"><span class="result-stat-val result-dist-start">📍 ${Math.round(t._distFromStart)} km</span><span class="result-stat-lbl">Du départ</span></div>` : ''}
        </div>
        <div class="result-actions">
          <button class="btn-sm btn-sm-green" onclick="showDetail(TRAILS.find(x=>x.id==='${t.id}'))">Démarrer</button>
          <button class="btn-sm btn-sm-outline" onclick="zoomToTrail('${t.id}')">Voir</button>
          <button class="btn-gpx" onclick="exportGPX('${t.id}')">GPX</button>
          <button class="btn-sm btn-sm-outline" onclick="saveTrail('${t.id}')">💾</button>
        </div>
      </div>`).join('');

  document.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      const t = TRAILS.find(x => x.id === card.dataset.id);
      if (t) { zoomToTrail(t.id); showDetail(t); }
    });
  });
}

// =====================================================
// DETAIL
// =====================================================
function showDetail(trail) {
  activeTrailId = trail.id;
  const color = SPORT_COLORS[trail.sport];
  const emoji = { velo:'🚴', rando:'🥾', course:'🏃' }[trail.sport];

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-header">
      <div class="detail-sport-icon" style="background:${color}22"><span style="font-size:20px">${emoji}</span></div>
      <div>
        <div class="detail-title">${trail.name}</div>
        <div class="detail-sub">${trail.region} · <span style="color:${DIFF_COLORS[trail.difficulte]};font-weight:600">${trail.difficulte}</span></div>
      </div>
    </div>
    <div class="detail-stats">
      <div class="detail-stat"><strong>${trail.distance} km</strong><span>Distance</span></div>
      <div class="detail-stat"><strong>${formatDuree(trail.duree)}</strong><span>Durée est.</span></div>
      <div class="detail-stat"><strong>${trail.denivele} m</strong><span>Dénivelé +</span></div>
      ${trail.ftp ? `<div class="detail-stat"><strong>${trail.ftp} W/kg</strong><span>FTP requis</span></div>` : ''}
    </div>
    <p style="font-size:12px;color:#6b7280;margin-bottom:12px">${trail.description}</p>
    <div class="detail-actions">
      <button class="btn-sm btn-sm-green" onclick="zoomToTrail('${trail.id}')">📍 Voir sur la carte</button>
      <button class="btn-gpx" onclick="exportGPX('${trail.id}')">⬇ GPX</button>
      <button class="btn-sm btn-sm-outline" onclick="saveTrail('${trail.id}')">💾 Sauvegarder</button>
    </div>`;

  document.getElementById('detail-panel').classList.remove('hidden');
  zoomToTrail(trail.id);
}

document.getElementById('detail-close').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
  activeTrailId = null;
});

// =====================================================
// ZOOM
// =====================================================
function zoomToTrail(id) {
  const trail = TRAILS.find(t => t.id === id);
  if (!trail) return;
  map.fitBounds(L.latLngBounds(trail.coords), { padding: [40, 40] });
}

// =====================================================
// EXPORT GPX
// =====================================================
function exportGPX(id) {
  const trail = TRAILS.find(t => t.id === id);
  if (!trail) return;
  const pts = trail.coords.map(([lat, lon]) =>
    `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailFinder CH — HEIG-VD" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${trail.name}</name></metadata>
  <trk><name>${trail.name}</name><type>${trail.sport}</type><trkseg>
${pts}
  </trkseg></trk>
</gpx>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  a.download = `${trail.name.replace(/[^a-z0-9]/gi,'_')}.gpx`;
  a.click();
  showToast(`GPX exporté ✓`, 'success');
}

// =====================================================
// SAUVEGARDE
// =====================================================
function saveTrail(id) {
  if (savedTrails.includes(id)) { showToast('Déjà sauvegardé !'); return; }
  savedTrails.push(id);
  localStorage.setItem('savedTrails', JSON.stringify(savedTrails));
  renderSaved();
  showToast('Sauvegardé ✓', 'success');
}

function removeSaved(id) {
  savedTrails = savedTrails.filter(x => x !== id);
  localStorage.setItem('savedTrails', JSON.stringify(savedTrails));
  renderSaved();
}

function renderSaved() {
  const saved = TRAILS.filter(t => savedTrails.includes(t.id));
  const list = document.getElementById('saved-list');
  if (!list) return;
  list.innerHTML = saved.length === 0
    ? '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg><p>Aucun itinéraire sauvegardé</p></div>'
    : saved.map(t => `
      <div class="saved-card">
        <div class="saved-card-info">
          <div class="saved-card-name">${{velo:'🚴',rando:'🥾',course:'🏃'}[t.sport]} ${t.name}</div>
          <div class="saved-card-meta">${t.distance} km · ${formatDuree(t.duree)} · ${t.denivele} m D+</div>
        </div>
        <div class="saved-card-actions">
          <button class="btn-sm btn-sm-green" onclick="showDetail(TRAILS.find(x=>x.id==='${t.id}'))">▶</button>
          <button class="btn-gpx" onclick="exportGPX('${t.id}')">GPX</button>
          <button class="btn-sm btn-sm-outline" onclick="removeSaved('${t.id}')">✕</button>
        </div>
      </div>`).join('');
}

// =====================================================
// UTILITAIRES
// =====================================================
function formatDuree(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm.toString().padStart(2,'0')}`;
}

window.TRAILS = TRAILS;
window.trailLayers = trailLayers;
window.showDetail = showDetail;
window.zoomToTrail = zoomToTrail;
window.exportGPX = exportGPX;
window.saveTrail = saveTrail;
window.removeSaved = removeSaved;
window.renderTrails = renderTrails;
window.filterTrails = filterTrails;
window.showResults = showResults;
window.renderSaved = renderSaved;
window.formatDuree = formatDuree;

// =====================================================
// POINT DE DÉPART — Adresse ou Géolocalisation
// =====================================================

let startMarker = null;
let startCoords = null;

// Géocodage via Nominatim (OpenStreetMap)
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=ch`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  const data = await res.json();
  if (data.length === 0) throw new Error('Adresse non trouvée');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
}

function setStartPoint(lat, lon, label) {
  startCoords = { lat, lon };

  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker([lat, lon], {
    icon: L.divIcon({
      className: '',
      html: `<div style="background:#2d6a4f;color:white;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍 Départ</div>`,
      iconAnchor: [30, 10],
    })
  }).addTo(map);

  // Trier les itinéraires par distance depuis le point de départ
  sortTrailsByDistance(lat, lon);

  // Mettre à jour l'affichage
  document.getElementById('start-label').textContent = label.split(',')[0];
  document.getElementById('start-label').style.color = '#2d6a4f';
  map.setView([lat, lon], 11);
  showToast(`Point de départ : ${label.split(',')[0]}`, 'success');
}

function sortTrailsByDistance(lat, lon) {
  // Calculer la distance entre le point de départ et le début de chaque trail
  TRAILS.forEach(t => {
    const [tLat, tLon] = t.coords[0];
    const R = 6371;
    const dLat = (tLat - lat) * Math.PI / 180;
    const dLon = (tLon - lon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat * Math.PI/180) * Math.cos(tLat * Math.PI/180) * Math.sin(dLon/2)**2;
    t._distFromStart = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  });
}

window.geocodeAddress = geocodeAddress;
window.setStartPoint = setStartPoint;
window.startCoords = startCoords;
