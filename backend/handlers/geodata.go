package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetOSMWays — GET /api/osm-ways
//
// Retourne les tronçons de routes OSM stockés dans la table `ways` de pgRouting,
// filtrés par un bounding box géographique (zone visible sur la carte Leaflet).
//
// Paramètres de requête (query string) :
//   minLon, minLat : coin bas-gauche du bounding box en WGS84 (défaut : 6.5, 46.6)
//   maxLon, maxLat : coin haut-droite du bounding box en WGS84 (défaut : 6.9, 47.0)
//
// Requête SQL :
//   ST_MakeEnvelope  → crée un rectangle géographique (bounding box) en PostGIS
//   &&               → opérateur d'intersection spatiale (utilise l'index GIST — rapide)
//   tag_id NOT IN    → exclut les autoroutes (non pertinentes pour vélo/rando)
//   LIMIT 2000       → limite le nombre de résultats pour les performances frontend
//
// Réponse : GeoJSON FeatureCollection avec propriétés tag_id et name.
// tag_id est utilisé par cantons.js pour colorier les routes selon leur type.
func GetOSMWays(c *gin.Context) {
	// Lecture des paramètres du bounding box avec valeurs par défaut.
	minLon, _ := strconv.ParseFloat(c.DefaultQuery("minLon", "6.5"), 64)
	minLat, _ := strconv.ParseFloat(c.DefaultQuery("minLat", "46.6"), 64)
	maxLon, _ := strconv.ParseFloat(c.DefaultQuery("maxLon", "6.9"), 64)
	maxLat, _ := strconv.ParseFloat(c.DefaultQuery("maxLat", "47.0"), 64)

	// Récupération de la connexion DB depuis le contexte Gin.
	// Injectée par le middleware dans main.go via c.Set("db", db).
	dbInterface, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "DB non disponible"})
		return
	}
	db := dbInterface.(*sql.DB)

	// Requête spatiale : sélection des tronçons dans le bounding box.
	rows, err := db.Query(fmt.Sprintf(`
		SELECT ST_AsGeoJSON(the_geom), tag_id, COALESCE(name,'') as name
		FROM ways
		WHERE the_geom && ST_MakeEnvelope(%f,%f,%f,%f,4326)
		AND tag_id NOT IN (101,102,104,105)
		LIMIT 2000`, minLon, minLat, maxLon, maxLat))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	// Structure GeoJSON Feature (standard RFC 7946).
	// Geometry est en json.RawMessage pour éviter une double sérialisation
	// du GeoJSON retourné directement par ST_AsGeoJSON().
	type Feature struct {
		Type       string                 `json:"type"`
		Geometry   json.RawMessage        `json:"geometry"`
		Properties map[string]interface{} `json:"properties"`
	}

	// Construction de la liste de features depuis les résultats SQL.
	var features []Feature
	for rows.Next() {
		var geomStr string
		var tagID int
		var name string
		if err := rows.Scan(&geomStr, &tagID, &name); err != nil { continue }
		features = append(features, Feature{
			Type:     "Feature",
			Geometry: json.RawMessage(geomStr),
			Properties: map[string]interface{}{
				"tag_id": tagID, // Utilisé par cantons.js pour la couleur
				"name":   name,  // Affiché dans le popup Leaflet
			},
		})
	}

	// Garantit un tableau vide plutôt que null JSON si aucun résultat.
	if features == nil { features = []Feature{} }

	c.JSON(http.StatusOK, gin.H{
		"type":     "FeatureCollection",
		"features": features,
	})
}

// GetCantons — stub non implémenté.
// Les cantons sont servis comme fichier GeoJSON statique via r.Static("/data", ...)
// dans main.go, sans passer par l'API.
func GetCantons(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Utilisez le GeoJSON local"})
}

// GetRoutesSwisstopo — stub non implémenté.
// Remplacé par /api/osm-ways qui utilise directement pgRouting.
func GetRoutesSwisstopo(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Utilisez /api/osm-ways"})
}

// GetElevation — stub non implémenté.
// Prévu pour interroger un MNT (Modèle Numérique de Terrain) Swisstopo.
// Le dénivelé est actuellement extrait des balises <ele> des fichiers GPX côté frontend.
func GetElevation(c *gin.Context)  { c.JSON(http.StatusNotImplemented, gin.H{"error": "Non implémenté"}) }

// GetMNTInfo — stub non implémenté.
func GetMNTInfo(c *gin.Context)    { c.JSON(http.StatusNotImplemented, gin.H{"error": "Non implémenté"}) }
