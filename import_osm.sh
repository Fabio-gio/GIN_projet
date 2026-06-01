#!/bin/bash
# ============================================
# import_osm.sh — Import données OSM dans pgRouting
# À exécuter UNE FOIS après docker-compose up
# GIN Webmapping — HEIG-VD
# ============================================

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-webmapping}"
DB_USER="${DB_USER:-gin}"
DB_PASS="${DB_PASS:-ginpass}"

OSM_FILE="Donnees_finales/suisse_romande.osm.pbf"
OSM_URL="https://download.geofabrik.de/europe/switzerland-latest.osm.pbf"

echo "============================================"
echo "  Import OSM → pgRouting"
echo "  GIN Webmapping — HEIG-VD"
echo "============================================"
echo ""

# 1. Télécharger les données OSM si pas présentes
if [ ! -f "$OSM_FILE" ]; then
  echo "📥 Téléchargement des données OSM Suisse..."
  echo "   (fichier ~400 MB, patience)"
  mkdir -p Donnees_finales
  curl -L "$OSM_URL" -o "Donnees_finales/switzerland.osm.pbf"

  echo "✂️  Découpage sur la Suisse romande..."
  # Utilise osmium si disponible, sinon garde tout
  if command -v osmium &> /dev/null; then
    osmium extract \
      --bbox 5.9,45.8,7.7,47.5 \
      Donnees_finales/switzerland.osm.pbf \
      -o "$OSM_FILE" --overwrite
    echo "✅ Découpage OK"
  else
    cp Donnees_finales/switzerland.osm.pbf "$OSM_FILE"
    echo "⚠️  osmium non installé — utilisation de toute la Suisse"
  fi
else
  echo "✅ Fichier OSM déjà présent : $OSM_FILE"
fi

# 2. Importer avec osm2pgrouting (via Docker)
echo ""
echo "🔄 Import dans PostgreSQL via osm2pgrouting..."
echo "   (peut prendre 5-10 minutes)"

export PGPASSWORD="$DB_PASS"

docker run --rm \
  --network gin_projet_default \
  -v "$(pwd)/$OSM_FILE:/data/osm.pbf:ro" \
  pgrouting/osm2pgrouting:latest \
  osm2pgrouting \
    --file /data/osm.pbf \
    --host "$DB_HOST" \
    --port "$DB_PORT" \
    --dbname "$DB_NAME" \
    --username "$DB_USER" \
    --password "$DB_PASS" \
    --addnodes \
    --attributes \
    --clean

echo ""
echo "✅ Import OSM terminé !"
echo ""
echo "🗺  Vérification :"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT COUNT(*) as nb_segments FROM ways;" \
  -c "SELECT COUNT(*) as nb_noeuds FROM ways_vertices_pgr;"

echo ""
echo "🚀 Le routage pgRouting est maintenant opérationnel !"
echo "   Relancez le backend : docker-compose restart backend"
