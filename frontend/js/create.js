/**
 * create.js — Onglet Créer + Onglet Sauvegardés
 * GIN HEIG-VD
 *
 * Onglet CRÉER :
 *   - Mode tracer : clics sur la carte → points → calcul pgRouting par segment
 *   - GET /api/route pour chaque paire de points consécutifs
 *   - Sauvegarde dans localStorage (clé : 'chronopath-saved')
 *
 * Onglet SAUVEGARDÉS :
 *   - Import GPX : extraction coords + dénivelé positif depuis les balises <ele>
 *   - Voir, Modifier (rechargement dans Créer), Temps (calculateur),
 *     Export GPX, Supprimer
 *
 * Calculateur de temps (computeTime) — mêmes formules que routing.go :
 *   Vélo  : v = 8 + FTP × 6.5 km/h, ajustement niveau ×0.75/1.0/1.15
 *   Course: v = VAP × facteur niveau + pénalité D+ (+0.5 min/100m)
 *   Rando : Naismith 3.0/4.5/6.0 km/h + 1h par 300m D+
 *
 * Fonctions exposées : renderSavedItems (appelée par app.js et sub-tabs)
 */

// ── ÉTAT — Onglet Créer ──────────────────────────────────────────────────
let createWaypoints = [];
let createMarkers = [];
let createSegments = [];
let isDrawing = false;
let savedItems = JSON.parse(localStorage.getItem('chronopath-saved') || '[]');

// =====================================================
// INIT — attendre que map soit disponible
// =====================================================
// window.load garantit que map.js est chargé et que `map` est disponible
// avant d'attacher les listeners sur la carte.
window.addEventListener('load', () => {

  // ── MODE TRACER ───────────────────────────────────────────────────────
  // Chaque clic (isDrawing=true) ajoute un point dans createWaypoints[]
  // et place un marqueur circulaire orange.
  // MODE TRACER
  document.getElementById('btn-draw-trail')?.addEventListener('click', () => {
    isDrawing = !isDrawing;
    const btn = document.getElementById('btn-draw-trail');
    if (isDrawing) {
      btn.textContent = '⏹ Stop';
      btn.classList.add('active');
      map.getContainer().style.cursor = 'crosshair';
      showToast('Cliquez sur la carte pour ajouter des points');
    } else {
      btn.textContent = '✏️ Tracer';
      btn.classList.remove('active');
      map.getContainer().style.cursor = '';
    }
  });

  // Clic carte mode tracer
  map.on('click', e => {
    if (!isDrawing) return;
    const { lat, lng } = e.latlng;
    const idx = createWaypoints.length;
    createWaypoints.push({ lat, lon: lng });
    const marker = L.circleMarker([lat, lng], {
      radius: 7, color: 'white', fillColor: '#e07a5f', fillOpacity: 1, weight: 2,
    }).addTo(map).bindPopup(`Point ${idx + 1}`);
    createMarkers.push(marker);
    document.getElementById('cs-pts').textContent = createWaypoints.length;
    if (createWaypoints.length >= 2) {
      document.getElementById('btn-calc-create').disabled = false;
    }
  });

  // ── CALCUL PGROUTING ──────────────────────────────────────────────────
  // Pour chaque paire consécutive : GET /api/route.
  // Les segments GeoJSON sont affichés en orange sur la carte.
  // CALCULER VIA PGROUTING
  document.getElementById('btn-calc-create')?.addEventListener('click', async () => {
    if (createWaypoints.length < 2) { showToast('Ajoutez au moins 2 points', 'error'); return; }
    const btn = document.getElementById('btn-calc-create');
    btn.textContent = 'Calcul en cours…';
    btn.disabled = true;
    createSegments.forEach(s => map.removeLayer(s));
    createSegments = [];
    const sport = document.getElementById('trail-sport')?.value || 'velo';
    let totalDist = 0, totalDur = 0;
    for (let i = 0; i < createWaypoints.length - 1; i++) {
      const from = createWaypoints[i], to = createWaypoints[i + 1];
      try {
        const res = await fetch(`${API_BASE}/route?fromLon=${from.lon}&fromLat=${from.lat}&toLon=${to.lon}&toLat=${to.lat}&sport=${sport}`);
        const data = await res.json();
        if (data.geojson) {
          const seg = L.geoJSON(data.geojson, { style: { color: '#e07a5f', weight: 4, opacity: 0.9 } }).addTo(map);
          createSegments.push(seg);
          totalDist += data.distance_km || 0;
          totalDur  += data.duration_min || 0;
        }
      } catch (err) { console.error(err); }
    }
    document.getElementById('cs-dist').textContent = totalDist.toFixed(1) + ' km';
    const csdur = document.getElementById('cs-dur');
    if (csdur) {
      const h = Math.floor(totalDur/60), m = Math.round(totalDur%60);
      csdur.textContent = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${Math.round(totalDur)} min`;
    }
    document.getElementById('btn-save-trail').disabled = false;
    btn.textContent = '🗺 Calculer via pgRouting';
    btn.disabled = false;
    if (createSegments.length > 0) {
      const group = L.featureGroup(createSegments);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
      showToast(`Itinéraire calculé — ${totalDist.toFixed(1)} km ✓`, 'success');
    } else {
      showToast('Erreur calcul pgRouting', 'error');
    }
  });

  // ── EFFACER ───────────────────────────────────────────────────────────
  // EFFACER
  document.getElementById('btn-clear-trail')?.addEventListener('click', () => {
    createWaypoints = [];
    createMarkers.forEach(m => map.removeLayer(m));
    createMarkers = [];
    createSegments.forEach(s => map.removeLayer(s));
    createSegments = [];
    isDrawing = false;
    const btn = document.getElementById('btn-draw-trail');
    if (btn) { btn.textContent = '✏️ Tracer'; btn.classList.remove('active'); }
    document.getElementById('btn-calc-create').disabled = true;
    document.getElementById('btn-save-trail').disabled = true;
    document.getElementById('cs-pts').textContent = '0';
    document.getElementById('cs-dist').textContent = '0 km';
    const csdur = document.getElementById('cs-dur');
    if (csdur) csdur.textContent = '—';
    map.getContainer().style.cursor = '';
  });

  // ── SAUVEGARDER ───────────────────────────────────────────────────────
  // Crée un objet item et l'ajoute dans savedItems persisté dans localStorage.
  // SAUVEGARDER
  document.getElementById('create-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('trail-name').value.trim();
    if (!name) { showToast('Donnez un nom à l\'itinéraire', 'error'); return; }
    if (createWaypoints.length < 2) { showToast('Tracez d\'abord un itinéraire', 'error'); return; }
    const sport = document.getElementById('trail-sport')?.value || 'velo';
    const dist  = document.getElementById('cs-dist').textContent;
    const dur   = document.getElementById('cs-dur')?.textContent || '—';
    const geojsonSegments = createSegments.map(s => s.toGeoJSON());
    const item = {
      id: 'custom-' + Date.now(), name, sport,
      distance: dist, duration: dur,
      waypoints: [...createWaypoints],
      geojson: geojsonSegments,
      type: 'custom',
      date: new Date().toLocaleDateString('fr-CH'),
    };
    savedItems.push(item);
    localStorage.setItem('chronopath-saved', JSON.stringify(savedItems));
    showToast(`"${name}" sauvegardé ✓`, 'success');
    document.getElementById('btn-clear-trail').click();
    document.getElementById('create-form').reset();
    document.querySelector('.sub-tab[data-tab="sauvegardes"]').click();
  });

  // ── IMPORT GPX ────────────────────────────────────────────────────────
  // FileReader API → parse XML → extrait <trkpt lat lon> et <ele>.
  // Dénivelé positif = somme des différences d'altitude croissantes.
  // IMPORT GPX
  document.getElementById('gpx-import-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const xml = new DOMParser().parseFromString(ev.target.result, 'text/xml');
        const trkpts = Array.from(xml.querySelectorAll('trkpt'));
        const name = xml.querySelector('name')?.textContent || file.name.replace('.gpx','');
        if (!trkpts.length) { showToast('Aucun point trouvé', 'error'); return; }
        const coords = trkpts.map(pt => [parseFloat(pt.getAttribute('lat')), parseFloat(pt.getAttribute('lon'))]);
		// Calcul dénivelé positif depuis les élévations
		let denivele = 0;
		const eles = trkpts.map(pt => parseFloat(pt.querySelector('ele')?.textContent || 0));
		for (let i = 1; i < eles.length; i++) {
		const diff = eles[i] - eles[i-1];
		if (diff > 0) denivele += diff;
		}
		denivele = Math.round(denivele);
        let dist = 0;
        for (let i = 1; i < coords.length; i++) dist += map.distance(coords[i-1], coords[i]);
        const item = {
          id: 'gpx-' + Date.now(), name, sport: 'velo',
          distance: (dist/1000).toFixed(1) + ' km', duration: '—', denivele,
          coords, type: 'gpx',
          date: new Date().toLocaleDateString('fr-CH'),
        };
        savedItems.push(item);
        localStorage.setItem('chronopath-saved', JSON.stringify(savedItems));
        renderSavedItems();
        showToast(`GPX "${name}" importé ✓`, 'success');
      } catch(err) { showToast('Erreur lecture GPX', 'error'); console.error(err); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  renderSavedItems();

}); // end window.addEventListener('load')

// =====================================================
// AFFICHER SAUVEGARDÉS
// =====================================================
// ── AFFICHAGE DES SAUVEGARDÉS ─────────────────────────────────────────
// Génère le HTML de la liste avec boutons Voir/Modifier/Temps/GPX/Supprimer.
function renderSavedItems() {
  const list = document.getElementById('saved-list');
  if (!list) return;
  if (savedItems.length === 0) {
    list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg><p>Aucun itinéraire sauvegardé</p></div>';
    return;
  }
  const icons = { velo: '🚴', rando: '🥾', course: '🏃' };
  list.innerHTML = savedItems.map(item => `
    <div class="saved-card" style="flex-direction:column;gap:6px;align-items:stretch;padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1">
          <div class="saved-card-name">${icons[item.sport] || '📍'} ${item.name}</div>
          <div class="saved-card-meta" style="margin-top:4px">
            📏 ${item.distance} · ⏱ ${item.duration || '—'} · ${item.date}
            <span style="margin-left:4px;background:${item.type==='gpx'?'#dbeafe':'#dcfce7'};color:${item.type==='gpx'?'#1d4ed8':'#166534'};padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600">${item.type==='gpx'?'GPX':'Tracé'}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn-sm btn-sm-green" onclick="showSavedItem('${item.id}')">👁 Voir</button>
        <button class="btn-sm btn-sm-outline" onclick="editSavedItem('${item.id}')">✏️ Modifier</button>
        <button class="btn-sm btn-sm-outline" onclick="calcTimeSaved('${item.id}')">⏱ Temps</button>
        <button class="btn-sm btn-sm-outline" onclick="exportSavedGPX('${item.id}')">⬇ GPX</button>
        <button class="btn-sm btn-sm-outline" style="color:#dc2626;border-color:#dc2626" onclick="deleteSavedItem('${item.id}')">🗑</button>
      </div>
    </div>`).join('');
}

// =====================================================
// VOIR
// =====================================================
let shownLayers = [];
// Affiche le tracé d'un itinéraire sauvegardé sur la carte.
function showSavedItem(id) {
  const item = savedItems.find(x => x.id === id);
  if (!item) return;
  shownLayers.forEach(l => map.removeLayer(l));
  shownLayers = [];
  if (item.type === 'gpx' && item.coords) {
    const layer = L.polyline(item.coords, { color: '#e07a5f', weight: 4, opacity: 0.9 }).addTo(map);
    shownLayers.push(layer);
    map.fitBounds(layer.getBounds(), { padding: [40, 40] });
  } else if (item.geojson) {
    item.geojson.forEach(gj => {
      const layer = L.geoJSON(gj, { style: { color: '#e07a5f', weight: 4, opacity: 0.9 } }).addTo(map);
      shownLayers.push(layer);
    });
    if (shownLayers.length > 0) {
      const group = L.featureGroup(shownLayers);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    }
  }
  showToast(`Affichage : ${item.name}`, 'success');
}

// =====================================================
// CALCULATEUR DE TEMPS
// =====================================================
// Ouvre le popup calculateur de temps pour un itinéraire sauvegardé.
function calcTimeSaved(id) {
  const item = savedItems.find(x => x.id === id);
  if (!item) return;
  const distKm = parseFloat(item.distance) || 0;
  const denivItem = item.denivele || 0;
  const existing = document.getElementById('time-calc-popup');
  if (existing) existing.remove();
  const popup = document.createElement('div');
  popup.id = 'time-calc-popup';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:20px;width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9999;font-family:Inter,sans-serif;';
  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:700;color:#1a1a2e">⏱ Calculateur de temps</h3>
      <button onclick="document.getElementById('time-calc-popup').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#6b7280">✕</button>
    </div>
    <div style="font-size:13px;color:#6b7280;margin-bottom:12px">📏 Distance : <strong>${distKm.toFixed(1)} km</strong></div>
    <div style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280">Sport</label>
      <select id="tc-sport" onchange="updateTcExtra()" style="width:100%;padding:7px;margin-top:4px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px">
        <option value="velo">🚴 Vélo</option>
        <option value="rando">🥾 Rando</option>
        <option value="course">🏃 Course</option>
      </select>
    <div id="tc-extra" style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280">FTP (W/kg)</label>
      <input type="number" id="tc-param" value="3.0" min="1" max="6" step="0.1" style="width:100%;padding:7px;margin-top:4px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px" />
    </div>
    <input type="hidden" id="tc-deniv" value="${denivItem}" />
    <button onclick="computeTime(${distKm})" style="width:100%;padding:10px;background:#2d6a4f;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px">Calculer</button>
    <div id="tc-result" style="display:none;background:#f0faf2;border:1px solid #b7e4c7;border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:24px;font-weight:700;color:#2d6a4f" id="tc-time">—</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px" id="tc-speed">—</div>
    </div>`;
  document.body.appendChild(popup);
}

function updateTcExtra() {
  const sport = document.getElementById('tc-sport')?.value;
  const extra = document.getElementById('tc-extra');
  if (!extra) return;
  if (sport === 'velo') {
    extra.innerHTML = '<label style="font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280">FTP (W/kg)</label><input type="number" id="tc-param" value="3.0" min="1" max="6" step="0.1" style="width:100%;padding:7px;margin-top:4px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px" />';
  } else if (sport === 'course') {
    extra.innerHTML = '<label style="font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280">VAP (min/km)</label><input type="number" id="tc-param" value="5.07" min="3" max="10" step="0.01" style="width:100%;padding:7px;margin-top:4px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px" />';
  } else {
    extra.innerHTML = '';
  }
}

// Calcule la durée estimée (mêmes algorithmes que routing.go).
// Vélo: FTP, Course: VAP + pénalité D+, Rando: Naismith.
function computeTime(distKm) {
  const sport   = document.getElementById('tc-sport').value;
  const niveau  = 'moyen';
  const param   = parseFloat(document.getElementById('tc-param')?.value || 0);
  const deniv   = parseFloat(document.getElementById('tc-deniv')?.value || 0);
  let speedKmh  = 15;

  if (sport === 'velo') {
    // FTP en W/kg → vitesse
    speedKmh = 8 + param * 6.5;
    if (niveau === 'debutant') speedKmh *= 0.75;
    else if (niveau === 'expert') speedKmh *= 1.15;
    speedKmh = Math.min(Math.max(speedKmh, 12), 45);
    // Pénalité dénivelé vélo : -1 km/h par 100m D+/10km
    if (deniv > 0) speedKmh *= Math.max(0.6, 1 - (deniv / distKm) * 0.008);
  } else if (sport === 'course') {
    // VAP en min/km → km/h
    speedKmh = 60 / param;
    // Coefficients réalistes : 10km ≈ 90% VAP, semi ≈ 85%, marathon ≈ 80%
    const distFactor = distKm <= 5 ? 0.95 : distKm <= 10 ? 0.90 : distKm <= 21 ? 0.85 : 0.78;
    if (niveau === 'debutant') speedKmh *= distFactor * 0.85;
    else if (niveau === 'moyen') speedKmh *= distFactor;
    else speedKmh *= distFactor * 1.05;
    // Pénalité dénivelé course : Naismith +1 min/10m D+
    const denivPenaltyMin = (deniv / 100) * 0.5;
    speedKmh = Math.min(Math.max(speedKmh, 6), 22);
    const durMin = (distKm / speedKmh) * 60 + denivPenaltyMin;
    const h = Math.floor(durMin / 60), m = Math.round(durMin % 60);
    const durStr = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${Math.round(durMin)} min`;
    const allureSec = (durMin * 60) / distKm;
    const allureMin = Math.floor(allureSec / 60);
    const allureSecs = Math.round(allureSec % 60);
    document.getElementById('tc-result').style.display = 'block';
    document.getElementById('tc-time').textContent = durStr;
    document.getElementById('tc-speed').textContent = `${allureMin}'${String(allureSecs).padStart(2,'0')}" /km`;
    return;
  } else {
    // Rando — vitesse Naismith
    const baseSpeed = niveau === 'debutant' ? 3.0 : niveau === 'expert' ? 5.5 : 4.0;
    speedKmh = baseSpeed;
    // Naismith : +1h par 300m D+
    const denivPenaltyMin = (deniv / 300) * 60;
    const durMin = (distKm / speedKmh) * 60 + denivPenaltyMin;
    const h = Math.floor(durMin / 60), m = Math.round(durMin % 60);
    document.getElementById('tc-result').style.display = 'block';
    document.getElementById('tc-time').textContent = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${Math.round(durMin)} min`;
    document.getElementById('tc-speed').textContent = `${speedKmh.toFixed(1)} km/h · ${deniv}m D+`;
    return;
  }

  const durMin = (distKm / speedKmh) * 60;
  const h = Math.floor(durMin / 60), m = Math.round(durMin % 60);
  document.getElementById('tc-result').style.display = 'block';
  document.getElementById('tc-time').textContent = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${Math.round(durMin)} min`;
  document.getElementById('tc-speed').textContent = `${speedKmh.toFixed(1)} km/h`;
}

// =====================================================
// EXPORT GPX
// =====================================================
// Génère et télécharge un fichier .gpx depuis les coordonnées sauvegardées.
function exportSavedGPX(id) {
  const item = savedItems.find(x => x.id === id);
  if (!item) return;
  let pts = '';
  if (item.coords) {
    pts = item.coords.map(([lat, lon]) => `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`).join('\n');
  } else if (item.waypoints) {
    pts = item.waypoints.map(wp => `    <trkpt lat="${wp.lat.toFixed(6)}" lon="${wp.lon.toFixed(6)}"></trkpt>`).join('\n');
  }
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="ChronoPath" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>${item.name}</name><type>${item.sport}</type><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  a.download = `${item.name.replace(/[^a-z0-9]/gi,'_')}.gpx`;
  a.click();
  showToast('GPX exporté ✓', 'success');
}

// =====================================================
// ÉDITER
// =====================================================
// Recharge les points dans l'onglet Créer pour les modifier.
// Sous-échantillonnage si trop de points (max 20, step = floor(n/20)).
function editSavedItem(id) {
  const item = savedItems.find(x => x.id === id);
  if (!item) return;
  document.querySelector('.sub-tab[data-tab="creer"]').click();
  setTimeout(() => {
    document.getElementById('btn-clear-trail').click();
    document.getElementById('trail-name').value = item.name;
    const points = item.waypoints || (item.coords ? item.coords.map(([lat,lon]) => ({lat,lon})) : []);
    if (points.length === 0) { showToast('Aucun point à recharger', 'error'); return; }
    const maxPts = 20;
    const step = Math.max(1, Math.floor(points.length / maxPts));
    const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    createWaypoints = sampled;
    sampled.forEach((wp, i) => {
      const marker = L.circleMarker([wp.lat, wp.lon], {
        radius: 7, color: 'white', fillColor: '#e07a5f', fillOpacity: 1, weight: 2,
      }).addTo(map).bindPopup(`Point ${i + 1}`);
      createMarkers.push(marker);
    });
    document.getElementById('cs-pts').textContent = sampled.length;
    document.getElementById('btn-calc-create').disabled = false;
    const bounds = L.latLngBounds(sampled.map(wp => [wp.lat, wp.lon]));
    map.fitBounds(bounds, { padding: [40, 40] });
    showToast(`${sampled.length} points rechargés ✓`, 'success');
  }, 300);
}

// =====================================================
// SUPPRIMER
// =====================================================
// Supprime l'itinéraire de savedItems et met à jour localStorage.
function deleteSavedItem(id) {
  if (!confirm('Supprimer cet itinéraire ?')) return;
  savedItems = savedItems.filter(x => x.id !== id);
  localStorage.setItem('chronopath-saved', JSON.stringify(savedItems));
  renderSavedItems();
  showToast('Supprimé ✓');
}

window.showSavedItem    = showSavedItem;
window.editSavedItem    = editSavedItem;
window.deleteSavedItem  = deleteSavedItem;
window.renderSavedItems = renderSavedItems;
window.calcTimeSaved    = calcTimeSaved;
window.computeTime      = computeTime;
window.updateTcExtra    = updateTcExtra;
window.exportSavedGPX   = exportSavedGPX;