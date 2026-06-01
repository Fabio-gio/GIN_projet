package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"gin_projet/backend/handlers"
)

func loadEnv() {
	f, err := os.Open(".env")
	if err != nil { return }
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") { continue }
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			os.Setenv(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
		}
	}
}

func main() {
	loadEnv()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, _ := handlers.InitDB()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type"},
	}))

	r.Use(func(c *gin.Context) {
		if db != nil {
			c.Set("db", db)
		}
		c.Next()
	})

	// Frontend — tous les fichiers statiques
	r.StaticFile("/", "../frontend/index.html")
	r.Static("/css", "../frontend/css")
	r.Static("/js", "../frontend/js")
	r.Static("/data", "../frontend/data")
	r.Static("/assets", "../frontend/assets")
	r.Static("/images", "../frontend/images")

	api := r.Group("/api")
	{
		api.GET("/health", func(c *gin.Context) {
			dbStatus := "non connectée"
			if db != nil {
				dbStatus = "connectée"
			}
			c.JSON(http.StatusOK, gin.H{
				"status":   "ok",
				"service":  "TrailFinder CH — GIN HEIG-VD",
				"database": dbStatus,
			})
		})

		api.GET("/pois", handlers.GetPOIs)
		api.POST("/pois", handlers.CreatePOI)
		api.DELETE("/pois/:id", handlers.DeletePOI)

		api.GET("/cantons", handlers.GetCantons)
		api.GET("/routes-swisstopo", handlers.GetRoutesSwisstopo)
		api.GET("/mnt/elevation", handlers.GetElevation)
		api.GET("/mnt/info", handlers.GetMNTInfo)

		api.GET("/osm-ways", handlers.GetOSMWays)
		api.GET("/route", handlers.CalculateRoute)
		api.GET("/search-routes", handlers.SearchRoutes)

		api.GET("/wms-proxy", handlers.WMSProxy)
	}

	log.Printf("🚀 TrailFinder CH — http://localhost:%s", port)
	r.Run(":" + port)
}
