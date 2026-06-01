package handlers

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

func WMSProxy(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paramètre url manquant"})
		return
	}

	resp, err := http.Get(targetURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Service WMS inaccessible"})
		return
	}
	defer resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	if ct != "" {
		c.Header("Content-Type", ct)
	}
	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}
