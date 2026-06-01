// Package main — Point d'entrée du serveur backend ChronoPath
//
// Ce fichier initialise et lance le serveur HTTP Go avec le framework Gin.
// Il configure :
//   - Le chargement des variables d'environnement (.env)
//   - La connexion à la base de données PostgreSQL
//   - Le middleware CORS (Cross-Origin Resource Sharing)
//   - Le middleware d'injection de la DB dans le contexte Gin
//   - Le service des fichiers statiques du frontend (HTML, CSS, JS, images)
//   - Toutes les routes de l'API REST (/api/...)
//
// Architecture du serveur :
//
//   Requête HTTP
//       ↓
//   Middleware CORS       → autorise les requêtes cross-origin (dev frontend)
//       ↓
//   Middleware DB         → injecte la connexion PostgreSQL dans c.Get("db")
//       ↓
//   Router Gin
//     ├── GET /           → index.html (frontend)
//     ├── GET /js/*       → fichiers JavaScript
//     ├── GET /css/*      → feuilles de style
//     └── GET /api/*      → handlers (routing.go, geodata.go, pois.go...)
//
// Démarrage :
//
//	cd backend
//	go build -o server.exe . && server.exe
//	→ http://localhost:8080
//
// GIN HEIG-VD — 2025-2026
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
		// Ignorer lignes vides et commentaires
		if line == "" || strings.HasPrefix(line, "#") { continue }
		// Découper sur le premier = uniquement (les valeurs peuvent contenir =)
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			os.Setenv(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
		}
	}
}

func main() {
	loadEnv() // Charge backend/.env
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ── 2. CONNEXION À LA BASE DE DONNÉES ─────────────────────────────────
	// InitDB() lit les variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
	// et tente de se connecter à PostgreSQL.
	// Si la connexion échoue, db = nil → mode démo activé automatiquement.
	// L'erreur est ignorée ici (_, _) car InitDB() gère déjà le logging.
	db, _ := handlers.InitDB()
	
	// ── 3. INITIALISATION DU ROUTEUR GIN ──────────────────────────────────
	// gin.Default() inclut les middlewares Logger et Recovery :
	//   - Logger   : log de chaque requête HTTP (méthode, path, status, durée)
	//   - Recovery : récupère les panics et retourne 500 au lieu de crasher
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type"},
	}))

	// ── 5. MIDDLEWARE INJECTION DE LA BASE DE DONNÉES ─────────────────────
	// Ce middleware injecte la connexion PostgreSQL dans le contexte de chaque
	// requête via c.Set("db", db).
	// Les handlers récupèrent ensuite la DB avec c.Get("db") dans getDB() (routing.go).
	//
	// Si db == nil (PostgreSQL non disponible), aucune valeur n'est injectée
	// → getDB() retourne (nil, false) → mode démo dans les handlers.
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


	// ── 7. ROUTES API ─────────────────────────────────────────────────────
	// Toutes les routes API sont groupées sous le préfixe /api/.
	// Chaque route est associée à un handler dans le package handlers/.
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

		// ── Points d'intérêt (POIs) ────────────────────────────────────────
		// Gérés en mémoire dans pois.go (slice protégée par sync.RWMutex)
		api.GET("/pois", handlers.GetPOIs)
		api.POST("/pois", handlers.CreatePOI)
		api.DELETE("/pois/:id", handlers.DeletePOI)

		api.GET("/cantons", handlers.GetCantons)
		api.GET("/routes-swisstopo", handlers.GetRoutesSwisstopo)
		api.GET("/mnt/elevation", handlers.GetElevation)
		api.GET("/mnt/info", handlers.GetMNTInfo)

		// ── Routes OSM et routage pgRouting ───────────────────────────────
		// Route principale de l'application — interroge la DB PostgreSQL/pgRouting
		api.GET("/osm-ways",      handlers.GetOSMWays)      // Routes OSM dans un bounding box
		api.GET("/route",         handlers.CalculateRoute)   // Calcul itinéraire A→B (Dijkstra)
		api.GET("/search-routes", handlers.SearchRoutes)     // Génère 3 itinéraires selon profil

		api.GET("/wms-proxy", handlers.WMSProxy)
	}
	// ── 8. DÉMARRAGE DU SERVEUR ───────────────────────────────────────────
	// r.Run() démarre le serveur HTTP sur le port spécifié.
	// Bloque jusqu'à l'arrêt du processus (Ctrl+C).
	log.Printf("🚀 TrailFinder CH — http://localhost:%s", port)
	r.Run(":" + port)
}