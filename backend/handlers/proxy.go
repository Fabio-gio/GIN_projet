package handlers

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// WMSProxy — GET /api/wms-proxy?url=...
//
// Proxy HTTP transparent pour les services WMS (Web Map Service) externes.
//
// Problème résolu : les navigateurs bloquent les requêtes cross-origin (CORS)
// vers des serveurs tiers qui n'envoient pas les headers Access-Control-Allow-Origin.
// En passant par ce proxy Go, la requête part du serveur backend (côté serveur)
// et contourne la politique Same-Origin du navigateur.
//
// Paramètre :
//   url : URL complète du service WMS à interroger (encodée en URL)
//
// Note : Swisstopo WMTS supporte CORS nativement, donc ce proxy n'est pas
// activement utilisé dans la version actuelle. Il reste disponible pour
// d'autres services WMS qui ne supporteraient pas CORS.
func WMSProxy(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paramètre url manquant"})
		return
	}

	// Requête HTTP vers le service WMS externe, effectuée côté serveur Go.
	resp, err := http.Get(targetURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Service WMS inaccessible"})
		return
	}
	defer resp.Body.Close()

	// Retransmettre le Content-Type de la réponse WMS au client
	// (ex: image/png pour les tuiles, application/xml pour GetCapabilities).
	ct := resp.Header.Get("Content-Type")
	if ct != "" {
		c.Header("Content-Type", ct)
	}

	// Retransmettre le status HTTP et streamer le body sans le charger en mémoire.
	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}
