-- ============================================
-- Initialisation PostGIS + pgRouting
-- GIN Webmapping — HEIG-VD
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- ============================================
-- Table réseau routier (remplie par osm2pgrouting)
-- ============================================
CREATE TABLE IF NOT EXISTS ways (
    gid          BIGSERIAL PRIMARY KEY,
    osm_id       BIGINT,
    tag_id       INTEGER,
    length       DOUBLE PRECISION,
    length_m     DOUBLE PRECISION,
    name         TEXT,
    source       BIGINT,
    target       BIGINT,
    source_osm   BIGINT,
    target_osm   BIGINT,
    cost         DOUBLE PRECISION,
    reverse_cost DOUBLE PRECISION,
    cost_s       DOUBLE PRECISION,
    reverse_cost_s DOUBLE PRECISION,
    rule         TEXT,
    one_way      INTEGER,
    oneway       TEXT,
    x1           DOUBLE PRECISION,
    y1           DOUBLE PRECISION,
    x2           DOUBLE PRECISION,
    y2           DOUBLE PRECISION,
    maxspeed_forward  INTEGER,
    maxspeed_backward INTEGER,
    priority     DOUBLE PRECISION DEFAULT 1,
    the_geom     GEOMETRY(LineString, 4326)
);

-- Table des noeuds du réseau
CREATE TABLE IF NOT EXISTS ways_vertices_pgr (
    id          BIGSERIAL PRIMARY KEY,
    osm_id      BIGINT,
    eout        INTEGER,
    lon         DOUBLE PRECISION,
    lat         DOUBLE PRECISION,
    cnt         INTEGER,
    chk         INTEGER,
    ein         INTEGER,
    the_geom    GEOMETRY(Point, 4326)
);

-- Index spatiaux
CREATE INDEX IF NOT EXISTS ways_geom_idx    ON ways             USING GIST(the_geom);
CREATE INDEX IF NOT EXISTS ways_vx_geom_idx ON ways_vertices_pgr USING GIST(the_geom);
CREATE INDEX IF NOT EXISTS ways_source_idx  ON ways(source);
CREATE INDEX IF NOT EXISTS ways_target_idx  ON ways(target);

-- ============================================
-- Table POIs (Points d'intérêt)
-- ============================================
CREATE TABLE IF NOT EXISTS pois (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT DEFAULT 'autre',
    geom        GEOMETRY(Point, 4326),
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pois_geom_idx ON pois USING GIST(geom);

-- POIs de démonstration
INSERT INTO pois (name, description, category, geom) VALUES
  ('HEIG-VD Yverdon',     'École d''ingénieurs HES-SO',      'education',  ST_SetSRID(ST_MakePoint(6.6413, 46.7785), 4326)),
  ('Château d''Yverdon',  'Château médiéval XIIIe siècle',   'patrimoine', ST_SetSRID(ST_MakePoint(6.6411, 46.7784), 4326)),
  ('Thermal Yverdon',     'Centre thermal et spa',            'loisirs',    ST_SetSRID(ST_MakePoint(6.6430, 46.7760), 4326)),
  ('Gare CFF Yverdon',    'Gare principale CFF',              'transport',  ST_SetSRID(ST_MakePoint(6.6385, 46.7760), 4326)),
  ('EPFL Lausanne',       'École Polytechnique Fédérale',     'education',  ST_SetSRID(ST_MakePoint(6.5657, 46.5197), 4326)),
  ('Cathédrale Lausanne', 'Cathédrale gothique XIIe siècle',  'patrimoine', ST_SetSRID(ST_MakePoint(6.6335, 46.5228), 4326)),
  ('Lac de Neuchâtel',    'Grand lac de Suisse romande',      'nature',     ST_SetSRID(ST_MakePoint(6.8700, 46.8800), 4326)),
  ('Gruyères',            'Village médiéval et château',      'patrimoine', ST_SetSRID(ST_MakePoint(7.0820, 46.5820), 4326))
ON CONFLICT DO NOTHING;

-- ============================================
-- Fonction : trouver le noeud le plus proche
-- ============================================
CREATE OR REPLACE FUNCTION nearest_node(lon DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS BIGINT AS $$
  SELECT id FROM ways_vertices_pgr
  ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================
-- Vue : réseau cyclable (vélo)
-- ============================================
CREATE OR REPLACE VIEW ways_velo AS
SELECT gid, source, target,
  CASE
    WHEN tag_id IN (100,101,102,103,104,105,106,107,108) THEN cost * 0.5   -- pistes cyclables favorisées
    WHEN tag_id IN (200,201,202) THEN cost * 2.0                            -- autoroutes évitées
    ELSE cost
  END AS cost,
  CASE
    WHEN tag_id IN (100,101,102,103,104,105,106,107,108) THEN reverse_cost * 0.5
    WHEN tag_id IN (200,201,202) THEN reverse_cost * 2.0
    ELSE reverse_cost
  END AS reverse_cost,
  the_geom
FROM ways
WHERE tag_id NOT IN (200, 201); -- exclure autoroutes

-- Vue : réseau pédestre (rando + course)
CREATE OR REPLACE VIEW ways_pieton AS
SELECT gid, source, target,
  CASE
    WHEN tag_id IN (300,301,302,303) THEN cost * 0.7   -- chemins pédestres favorisés
    WHEN tag_id IN (200,201,202) THEN cost * 999        -- autoroutes interdites
    ELSE cost
  END AS cost,
  CASE
    WHEN tag_id IN (300,301,302,303) THEN reverse_cost * 0.7
    WHEN tag_id IN (200,201,202) THEN reverse_cost * 999
    ELSE reverse_cost
  END AS reverse_cost,
  the_geom
FROM ways
WHERE tag_id NOT IN (200, 201, 202);

-- ============================================
-- Table itinéraires sauvegardés
-- ============================================
CREATE TABLE IF NOT EXISTS itineraires (
    id          SERIAL PRIMARY KEY,
    name        TEXT,
    sport       TEXT CHECK (sport IN ('velo','rando','course')),
    difficulte  TEXT CHECK (difficulte IN ('facile','moyen','difficile')),
    distance_m  DOUBLE PRECISION,
    duree_min   INTEGER,
    denivele_m  INTEGER,
    geom        GEOMETRY(LineString, 4326),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Message de confirmation
-- ============================================
DO $$ BEGIN
  RAISE NOTICE '✅ Base webmapping initialisée — PostGIS + pgRouting prêts';
  RAISE NOTICE '📌 Importer les données OSM avec osm2pgrouting pour activer le routage';
END $$;
