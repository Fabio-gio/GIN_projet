package handlers

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// POI représente un point d'intérêt géolocalisé.
// Les tags JSON correspondent au format attendu par api.js côté frontend.
type POI struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Category    string  `json:"category"` // education, patrimoine, nature, loisirs, transport
	Lat         float64 `json:"lat"`       // Latitude WGS84
	Lon         float64 `json:"lon"`       // Longitude WGS84
}

// poisMu protège la slice pois contre les accès concurrents.
// sync.RWMutex permet plusieurs lectures simultanées (RLock)
// mais un seul écrivain exclusif (Lock).
// Nécessaire car Gin gère chaque requête dans une goroutine séparée.
var (
	poisMu sync.RWMutex
	// Données de démonstration chargées au démarrage.
	// Note : ces POIs sont en mémoire uniquement, non persistés en base.
	pois   = []POI{
		{ID: "1", Name: "HEIG-VD Yverdon", Description: "École d'ingénieurs HES-SO", Category: "education", Lat: 46.7785, Lon: 6.6413},
		{ID: "2", Name: "Château d'Yverdon", Description: "Château médiéval XIIIe siècle", Category: "patrimoine", Lat: 46.7784, Lon: 6.6411},
		{ID: "3", Name: "Thermal Yverdon", Description: "Centre thermal et spa", Category: "loisirs", Lat: 46.7760, Lon: 6.6430},
		{ID: "4", Name: "Gare CFF Yverdon", Description: "Gare principale CFF", Category: "transport", Lat: 46.7783, Lon: 6.6391},
		{ID: "5", Name: "Lac de Neuchâtel", Description: "Grand lac de Suisse romande", Category: "nature", Lat: 46.8800, Lon: 6.8700},
		{ID: "6", Name: "EPFL Lausanne", Description: "École Polytechnique Fédérale", Category: "education", Lat: 46.5197, Lon: 6.5657},
		{ID: "7", Name: "Cathédrale de Lausanne", Description: "Cathédrale gothique, XIIe siècle", Category: "patrimoine", Lat: 46.5228, Lon: 6.6335},
	}
)

// Health — GET /api/health
// Vérifie que le serveur Go est démarré et répond.
// Utilisé pour diagnostiquer les problèmes de connexion.
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "GIN Webmapping API"})
}

// GetPOIs — GET /api/pois
// Retourne tous les POIs en mémoire au format GeoJSON FeatureCollection.
// Chaque POI est converti en Feature avec géométrie Point [lon, lat].
// Appelé par loadPOIs() dans api.js au chargement de l'application.
func GetPOIs(c *gin.Context) {
	poisMu.RLock()         // Verrou lecture : plusieurs goroutines peuvent lire en parallèle
	defer poisMu.RUnlock() // Déverouillage automatique à la fin de la fonction

	// Conversion de chaque POI en Feature GeoJSON standard.
	features := make([]map[string]interface{}, len(pois))
	for i, p := range pois {
		features[i] = map[string]interface{}{
			"type": "Feature",
			"id":   p.ID,
			"geometry": map[string]interface{}{
				"type":        "Point",
				"coordinates": []float64{p.Lon, p.Lat}, // GeoJSON : longitude en premier
			},
			"properties": map[string]interface{}{
				"id":          p.ID,
				"name":        p.Name,
				"description": p.Description,
				"category":    p.Category, // Utilisé par api.js pour choisir l'icône
			},
		}
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"type":     "FeatureCollection",
		"features": features,
	})
}

// CreatePOI — POST /api/pois
// Ajoute un nouveau POI en mémoire.
// L'ID est généré par horodatage Unix en nanosecondes (garanti unique).
func CreatePOI(c *gin.Context) {
	var p POI
	// ShouldBindJSON décode le body JSON de la requête dans la struct POI.
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.ID = fmt.Sprintf("%d", time.Now().UnixNano())

	poisMu.Lock() // Verrou écriture exclusif
	pois = append(pois, p)
	poisMu.Unlock()

	c.JSON(http.StatusCreated, p) // 201 Created
}

// DeletePOI — DELETE /api/pois/:id
// Supprime un POI par son ID.
// Appelé par deletePOI() dans api.js lors du clic sur "Supprimer" dans un popup.
func DeletePOI(c *gin.Context) {
	id := c.Param("id") // Extraction du paramètre :id depuis l'URL
	poisMu.Lock()
	defer poisMu.Unlock()

	// Recherche linéaire du POI et suppression par reconstruction de la slice.
	for i, p := range pois {
		if p.ID == id {
			pois = append(pois[:i], pois[i+1:]...)
			c.JSON(http.StatusOK, gin.H{"deleted": id})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "POI non trouvé"})
}
