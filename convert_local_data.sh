#!/bin/bash
# =============================================================
# convert_local_data.sh
# Convertit les données locales lourdes (non versionnées)
# À exécuter une fois sur ta machine avant de lancer le backend
# =============================================================

set -e

DATA_DIR="$(dirname "$0")/Donnees_finales"
OUT_DIR="$(dirname "$0")/frontend/data"

mkdir -p "$OUT_DIR"

echo "📂 Dossier source : $DATA_DIR"
echo "📂 Dossier cible  : $OUT_DIR"
echo ""

# ---- 1. CANTONS ROMANDS ----
if [ -f "$DATA_DIR/CANTONS_Romands.gpkg" ]; then
  echo "🔄 Conversion CANTONS_Romands.gpkg → cantons_romands.geojson"
  ogr2ogr \
    -f GeoJSON \
    -t_srs EPSG:4326 \
    -select "NAME,KANTONSNUM,EINWOHNERZ,ICC" \
    -simplify 30 \
    "$OUT_DIR/cantons_romands.geojson" \
    "$DATA_DIR/CANTONS_Romands.gpkg" \
    swissboundaries3d_1_5_tlm_kantonsgebiet
  echo "   ✅ $(du -sh "$OUT_DIR/cantons_romands.geojson" | cut -f1) — OK"
else
  echo "   ⚠️  CANTONS_Romands.gpkg non trouvé"
fi

# ---- 2. ROUTES SWISSTOPO (trop lourd pour GitHub → servi par le backend) ----
if [ -f "$DATA_DIR/route_decoup.gpkg" ]; then
  echo ""
  echo "📊 route_decoup.gpkg détecté ($(du -sh "$DATA_DIR/route_decoup.gpkg" | cut -f1))"
  echo "   → Sera servi directement par le backend Go via /api/routes-swisstopo"
  echo "   → Filtrage par bbox pour limiter la taille des réponses"

  # Inspecter les couches disponibles
  echo ""
  echo "   Couches disponibles dans route_decoup.gpkg :"
  ogrinfo -q "$DATA_DIR/route_decoup.gpkg" 2>/dev/null | grep -v "^INFO" | head -20
else
  echo ""
  echo "   ⚠️  route_decoup.gpkg non trouvé dans $DATA_DIR"
fi

# ---- 3. MNT (tif → info) ----
if [ -f "$DATA_DIR/MNT_Romandies.tif" ]; then
  echo ""
  echo "📊 MNT_Romandies.tif détecté ($(du -sh "$DATA_DIR/MNT_Romandies.tif" | cut -f1))"
  echo "   Métadonnées :"
  gdalinfo "$DATA_DIR/MNT_Romandies.tif" | grep -E "Size|Pixel Size|Corner|PROJCRS|AUTHORITY" | head -10
  echo "   → Altitude disponible via /api/mnt/elevation?lat=46.5&lon=6.6"
  echo "   → Clic droit sur la carte pour voir l'altitude"
else
  echo ""
  echo "   ⚠️  MNT_Romandies.tif non trouvé dans $DATA_DIR"
fi

echo ""
echo "✅ Conversion terminée !"
echo ""
echo "Pour lancer le backend :"
echo "  cd backend && go mod tidy && go run main.go"
echo ""
echo "Variables d'environnement optionnelles :"
echo "  export DATA_DIR=/chemin/absolu/vers/Donnees_finales"
echo "  export PORT=8080"
