package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GET /api/osm-ways — Retourne les routes OSM depuis pgRouting
func GetOSMWays(c *gin.Context) {
	minLon, _ := strconv.ParseFloat(c.DefaultQuery("minLon", "6.5"), 64)
	minLat, _ := strconv.ParseFloat(c.DefaultQuery("minLat", "46.6"), 64)
	maxLon, _ := strconv.ParseFloat(c.DefaultQuery("maxLon", "6.9"), 64)
	maxLat, _ := strconv.ParseFloat(c.DefaultQuery("maxLat", "47.0"), 64)

	dbInterface, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "DB non disponible"})
		return
	}
	db := dbInterface.(*sql.DB)

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

	type Feature struct {
		Type       string                 `json:"type"`
		Geometry   json.RawMessage        `json:"geometry"`
		Properties map[string]interface{} `json:"properties"`
	}

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
				"tag_id": tagID,
				"name":   name,
			},
		})
	}

	if features == nil { features = []Feature{} }

	c.JSON(http.StatusOK, gin.H{
		"type":     "FeatureCollection",
		"features": features,
	})
}

// Stubs pour les autres endpoints géographiques
func GetCantons(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Utilisez le GeoJSON local"})
}
func GetRoutesSwisstopo(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Utilisez /api/osm-ways"})
}
func GetElevation(c *gin.Context)  { c.JSON(http.StatusNotImplemented, gin.H{"error": "Non implémenté"}) }
func GetMNTInfo(c *gin.Context)    { c.JSON(http.StatusNotImplemented, gin.H{"error": "Non implémenté"}) }
