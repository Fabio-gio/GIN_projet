-- ================================================================
-- init.sql — Initialisation de la base de données PostgreSQL
--
-- Ce script crée la structure complète de la base de données
-- nécessaire au fonctionnement de ChronoPath.
--
-- Extensions requises :
--   PostGIS   → types géométriques (POINT, LINESTRING) et fonctions
--               spatiales (ST_Distance, ST_MakePoint, ST_Union...)
--   pgRouting → algorithmes de routage sur graphe (Dijkstra, A*)
--               appliqués au réseau routier OSM
--
-- Tables principales :
--   ways               → réseau routier OSM (rempli par osm2pgrouting)
--   ways_vertices_pgr  → nœuds du graphe routier (rempli par osm2pgrouting)
--   pois               → points d'intérêt
--   itineraires        → itinéraires sauvegardés par les utilisateurs
--
-- Vues :
--   ways_velo   → réseau routier filtré et pondéré pour le vélo
--   ways_pieton → réseau routier filtré et pondéré pour la rando/course
--
-- Fonctions :
--   nearest_node(lon, lat) → nœud pgRouting le plus proche d'un point
--
-- Ordre d'exécution :
--   1. Exécuter ce script (init.sql) pour créer la structure
--   2. Lancer osm2pgrouting pour importer les données OSM
--      → remplit automatiquement ways et ways_vertices_pgr
--   3. Lancer le backend Go (go build && server.exe)
--
-- Connexion : DB=webmapping, USER=gin, PASS=ginpass, PORT=5432
-- Conteneur Docker : gin_pgrouting (pgrouting/pgrouting:15-3.5-3.4.2)
--
-- GIN HEIG-VD — 2025-2026
-- ================================================================

-- ================================================================
-- EXTENSIONS
-- Extensions PostgreSQL nécessaires au projet.
-- IF NOT EXISTS évite les erreurs si elles sont déjà installées.
-- ================================================================

-- PostGIS : support des types géométriques et fonctions spatiales
-- Ajoute les types GEOMETRY, GEOGRAPHY et les fonctions ST_*
CREATE EXTENSION IF NOT EXISTS postgis;

-- pgRouting : algorithmes de routage sur graphe
-- Ajoute pgr_dijkstra(), pgr_aStar(), pgr_nearestCost()...
-- Dépend de PostGIS (doit être installé après)
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- ================================================================
-- TABLE WAYS — Réseau routier OSM
-- ================================================================
-- Cette table est le cœur du système de routage.
-- Elle est créée vide ici, puis remplie automatiquement par
-- osm2pgrouting lors de l'import des données OpenStreetMap.
--
-- Chaque ligne représente un tronçon de route (way OSM).
-- Le graphe de routage est formé par les colonnes source/target
-- qui référencent les nœuds dans ways_vertices_pgr.
--
-- Colonnes clés pour pgRouting :
--   source, target     → IDs des nœuds de départ/arrivée du tronçon
--   cost_s             → coût de traversée en secondes (aller)
--   reverse_cost_s     → coût de traversée en secondes (retour)
--   the_geom           → géométrie LineString en WGS84 (EPSG:4326)
--
-- Colonnes de classification OSM :
--   tag_id  → type de route OSM
--             101-102 : autoroutes
--             106-107 : routes principales
--             108-109 : routes secondaires/tertiaires
--             118     : pistes cyclables
--             113     : chemins
--   one_way → sens de circulation (0=bidirectionnel, 1=sens unique)
-- ================================================================
CREATE TABLE IF NOT EXISTS ways (
    gid          BIGSERIAL PRIMARY KEY,      -- Identifiant interne pgRouting
    osm_id       BIGINT,                     -- Identifiant OpenStreetMap original
    tag_id       INTEGER,                    -- Type de route (classification OSM)
    length       DOUBLE PRECISION,           -- Longueur en degrés (non utilisé)
    length_m     DOUBLE PRECISION,           -- Longueur en mètres
    name         TEXT,                       -- Nom de la rue/route (depuis OSM)
    source       BIGINT,                     -- Nœud de départ (FK → ways_vertices_pgr.id)
    target       BIGINT,                     -- Nœud d'arrivée (FK → ways_vertices_pgr.id)
    source_osm   BIGINT,                     -- ID OSM du nœud source
    target_osm   BIGINT,                     -- ID OSM du nœud cible
    cost         DOUBLE PRECISION,           -- Coût en unités arbitraires (aller)
    reverse_cost DOUBLE PRECISION,           -- Coût en unités arbitraires (retour)
    cost_s       DOUBLE PRECISION,           -- Coût en secondes (aller) — utilisé par Dijkstra
    reverse_cost_s DOUBLE PRECISION,         -- Coût en secondes (retour) — utilisé par Dijkstra
    rule         TEXT,                       -- Règles de circulation
    one_way      INTEGER,                    -- Sens unique : 0=non, 1=oui, -1=sens inverse
    oneway       TEXT,                       -- Valeur texte OSM du sens unique
    x1           DOUBLE PRECISION,           -- Longitude du nœud source
    y1           DOUBLE PRECISION,           -- Latitude du nœud source
    x2           DOUBLE PRECISION,           -- Longitude du nœud cible
    y2           DOUBLE PRECISION,           -- Latitude du nœud cible
    maxspeed_forward  INTEGER,               -- Vitesse max aller (km/h)
    maxspeed_backward INTEGER,               -- Vitesse max retour (km/h)
    priority     DOUBLE PRECISION DEFAULT 1, -- Priorité de la route (pondération)
    the_geom     GEOMETRY(LineString, 4326)  -- Géométrie du tronçon (WGS84)
);

-- ================================================================
-- TABLE WAYS_VERTICES_PGR — Nœuds du graphe routier
-- ================================================================
-- Contient tous les intersections et extrémités de routes OSM.
-- Chaque nœud est un point géographique avec un ID unique.
-- pgRouting utilise ces IDs (source/target de ways) pour
-- construire le graphe et calculer les plus courts chemins.
--
-- Remplie automatiquement par osm2pgrouting.
-- Résultat typique pour la Suisse romande : ~291 381 nœuds.
-- ================================================================
CREATE TABLE IF NOT EXISTS ways_vertices_pgr (
    id       BIGSERIAL PRIMARY KEY,      -- ID du nœud (référencé par ways.source/target)
    osm_id   BIGINT,                     -- ID OpenStreetMap du nœud
    eout     INTEGER,                    -- Nombre d'arêtes sortantes
    lon      DOUBLE PRECISION,           -- Longitude WGS84
    lat      DOUBLE PRECISION,           -- Latitude WGS84
    cnt      INTEGER,                    -- Nombre de tronçons connectés
    chk      INTEGER,                    -- Flag de vérification topologique
    ein      INTEGER,                    -- Nombre d'arêtes entrantes
    the_geom GEOMETRY(Point, 4326)       -- Géométrie du nœud (WGS84)
);

-- ================================================================
-- INDEX SPATIAUX ET B-TREE
-- ================================================================
-- Les index GIST accélèrent les requêtes spatiales (ST_Distance,
-- opérateur <-> pour la distance, ST_Intersects...).
-- Les index B-tree sur source/target accélèrent les jointures
-- utilisées par pgr_dijkstra() dans routing.go.
-- ================================================================

-- Index spatial sur les géométries des tronçons (pour ST_Intersects, bbox queries)
CREATE INDEX IF NOT EXISTS ways_geom_idx    ON ways             USING GIST(the_geom);
-- Index spatial sur les géométries des nœuds (pour nearest_node, opérateur <->)
CREATE INDEX IF NOT EXISTS ways_vx_geom_idx ON ways_vertices_pgr USING GIST(the_geom);
-- Index B-tree sur source/target (jointures dans pgr_dijkstra)
CREATE INDEX IF NOT EXISTS ways_source_idx  ON ways(source);
CREATE INDEX IF NOT EXISTS ways_target_idx  ON ways(target);

-- ================================================================
-- TABLE POIS — Points d'intérêt
-- ================================================================
-- Stocke des points d'intérêt géolocalisés affichés sur la carte.
-- Gérés via l'endpoint /api/pois (GET et DELETE) dans pois.go.
-- Si le backend n'est pas disponible, api.js utilise DEMO_POIS
-- (données statiques côté frontend).
-- ================================================================
CREATE TABLE IF NOT EXISTS pois (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,              -- Nom du POI
    description TEXT,                       -- Description courte
    category    TEXT DEFAULT 'autre',       -- Catégorie (education, patrimoine, nature...)
    geom        GEOMETRY(Point, 4326),      -- Position géographique (WGS84)
    created_at  TIMESTAMP DEFAULT NOW()     -- Date d'ajout
);

-- Index spatial pour les requêtes de proximité (ex: POIs dans un rayon)
CREATE INDEX IF NOT EXISTS pois_geom_idx ON pois USING GIST(geom);

-- ----------------------------------------------------------------
-- Données de démonstration
-- ST_SetSRID(ST_MakePoint(lon, lat), 4326) : crée un point PostGIS
-- en WGS84 depuis des coordonnées longitude/latitude.
-- ON CONFLICT DO NOTHING : évite les doublons si le script est rejoué.
-- ----------------------------------------------------------------
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

-- ================================================================
-- FONCTION nearest_node
-- ================================================================
-- Retourne l'ID du nœud pgRouting le plus proche d'un point donné.
-- Utilisée dans routing.go pour convertir des coordonnées GPS
-- (lat/lon de l'utilisateur) en ID de nœud du graphe routier.
--
-- Exemple d'utilisation dans routing.go :
--   SELECT nearest_node($1, $2) → retourne un BIGINT (ID du nœud)
--
-- L'opérateur <-> est l'opérateur de distance KNN (K-Nearest Neighbor)
-- de PostGIS, optimisé pour les index GIST (très performant).
-- ORDER BY ... LIMIT 1 retourne uniquement le nœud le plus proche.
--
-- LANGUAGE SQL STABLE : la fonction ne modifie pas la base,
-- PostgreSQL peut l'optimiser dans les requêtes.
-- ================================================================
CREATE OR REPLACE FUNCTION nearest_node(lon DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS BIGINT AS $$
  SELECT id FROM ways_vertices_pgr
  ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ================================================================
-- VUE ways_velo — Réseau optimisé pour le vélo
-- ================================================================
-- Vue filtrée et pondérée de la table ways pour les itinéraires vélo.
-- Les coûts sont modifiés selon le type de route (tag_id) :
--   ×0.5 pour les pistes cyclables → routes favorites
--   ×2.0 pour les autoroutes → routes à éviter
-- Les autoroutes (tag_id 200-202) sont complètement exclues.
--
-- Note : cette vue n'est pas encore utilisée par le backend actuel
-- (routing.go utilise la table ways directement avec cost_s),
-- mais elle est prête pour une version future plus sophistiquée.
-- ================================================================
CREATE OR REPLACE VIEW ways_velo AS
SELECT gid, source, target,
  CASE
    WHEN tag_id IN (100,101,102,103,104,105,106,107,108)
      THEN cost * 0.5       -- Pistes et routes cyclables : coût réduit (favorisées)
    WHEN tag_id IN (200,201,202)
      THEN cost * 2.0       -- Autoroutes : coût doublé (à éviter)
    ELSE cost               -- Autres routes : coût normal
  END AS cost,
  CASE
    WHEN tag_id IN (100,101,102,103,104,105,106,107,108) THEN reverse_cost * 0.5
    WHEN tag_id IN (200,201,202)                          THEN reverse_cost * 2.0
    ELSE reverse_cost
  END AS reverse_cost,
  the_geom
FROM ways
WHERE tag_id NOT IN (200, 201); -- Exclure autoroutes complètement

-- ================================================================
-- VUE ways_pieton — Réseau optimisé pour la rando et la course
-- ================================================================
-- Vue filtrée pour les itinéraires pédestres.
-- Les chemins et sentiers sont favorisés (×0.7).
-- Les autoroutes sont pratiquement interdites (×999).
-- ================================================================
CREATE OR REPLACE VIEW ways_pieton AS
SELECT gid, source, target,
  CASE
    WHEN tag_id IN (300,301,302,303)
      THEN cost * 0.7       -- Chemins pédestres : coût réduit (favorisés)
    WHEN tag_id IN (200,201,202)
      THEN cost * 999       -- Autoroutes : coût prohibitif (interdites)
    ELSE cost
  END AS cost,
  CASE
    WHEN tag_id IN (300,301,302,303) THEN reverse_cost * 0.7
    WHEN tag_id IN (200,201,202)     THEN reverse_cost * 999
    ELSE reverse_cost
  END AS reverse_cost,
  the_geom
FROM ways
WHERE tag_id NOT IN (200, 201, 202); -- Exclure toutes les autoroutes

-- ================================================================
-- TABLE ITINERAIRES — Itinéraires sauvegardés en base
-- ================================================================
-- Table prévue pour persister les itinéraires côté serveur.
-- Note : dans la version actuelle, les itinéraires sont stockés
-- dans le localStorage du navigateur (create.js).
-- Cette table est prête pour une future authentification utilisateur.
--
-- Contraintes CHECK :
--   sport      → valeurs autorisées : 'velo', 'rando', 'course'
--   difficulte → valeurs autorisées : 'facile', 'moyen', 'difficile'
-- ================================================================
CREATE TABLE IF NOT EXISTS itineraires (
    id          SERIAL PRIMARY KEY,
    name        TEXT,                       -- Nom donné par l'utilisateur
    sport       TEXT CHECK (sport IN ('velo','rando','course')),
    difficulte  TEXT CHECK (difficulte IN ('facile','moyen','difficile')),
    distance_m  DOUBLE PRECISION,           -- Distance totale en mètres
    duree_min   INTEGER,                    -- Durée estimée en minutes
    denivele_m  INTEGER,                    -- Dénivelé positif en mètres
    geom        GEOMETRY(LineString, 4326), -- Tracé complet de l'itinéraire (WGS84)
    created_at  TIMESTAMP DEFAULT NOW()     -- Date de création
);

-- ================================================================
-- MESSAGE DE CONFIRMATION
-- ================================================================
-- Bloc PL/pgSQL anonyme exécuté une seule fois à l'initialisation.
-- RAISE NOTICE affiche des messages dans les logs PostgreSQL.
-- ================================================================
DO $$ BEGIN
  RAISE NOTICE '✅ Base webmapping initialisée — PostGIS + pgRouting prêts';
  RAISE NOTICE '📌 Importer les données OSM avec osm2pgrouting pour activer le routage';
  RAISE NOTICE '    → osm2pgrouting --file switzerland.osm --dbname webmapping --username gin';
END $$;
