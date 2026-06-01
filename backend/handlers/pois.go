package handlers

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type POI struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
}

var (
	poisMu sync.RWMutex
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

func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "GIN Webmapping API"})
}

func GetPOIs(c *gin.Context) {
	poisMu.RLock()
	defer poisMu.RUnlock()

	features := make([]map[string]interface{}, len(pois))
	for i, p := range pois {
		features[i] = map[string]interface{}{
			"type": "Feature",
			"id":   p.ID,
			"geometry": map[string]interface{}{
				"type":        "Point",
				"coordinates": []float64{p.Lon, p.Lat},
			},
			"properties": map[string]interface{}{
				"id":          p.ID,
				"name":        p.Name,
				"description": p.Description,
				"category":    p.Category,
			},
		}
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"type":     "FeatureCollection",
		"features": features,
	})
}

func CreatePOI(c *gin.Context) {
	var p POI
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.ID = fmt.Sprintf("%d", time.Now().UnixNano())

	poisMu.Lock()
	pois = append(pois, p)
	poisMu.Unlock()

	c.JSON(http.StatusCreated, p)
}

func DeletePOI(c *gin.Context) {
	id := c.Param("id")
	poisMu.Lock()
	defer poisMu.Unlock()

	for i, p := range pois {
		if p.ID == id {
			pois = append(pois[:i], pois[i+1:]...)
			c.JSON(http.StatusOK, gin.H{"deleted": id})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "POI non trouvé"})
}
