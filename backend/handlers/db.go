// Package handlers — Gestionnaires de requêtes HTTP de l'API ChronoPath.
// Chaque fichier du package gère un groupe de fonctionnalités.
package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	// Driver PostgreSQL pour database/sql.
	// L'underscore signifie import uniquement pour ses effets de bord :
	// enregistrement du driver "postgres" dans database/sql.
	_ "github.com/lib/pq"
)

// DB est la connexion PostgreSQL globale.
// Initialisée par InitDB() dans main.go, puis injectée dans chaque requête
// via le middleware Gin (c.Set("db", DB)).
// Si DB est nil → le backend fonctionne en mode démo (estimations directes).
var DB *sql.DB

// InitDB initialise la connexion PostgreSQL.
//
// Lit les paramètres depuis les variables d'environnement (fichier backend/.env) :
//   DB_HOST : hôte PostgreSQL       (défaut : localhost)
//   DB_PORT : port PostgreSQL        (défaut : 5432)
//   DB_NAME : nom de la base         (défaut : webmapping)
//   DB_USER : utilisateur            (défaut : gin)
//   DB_PASS : mot de passe           (défaut : ginpass)
//
// Retourne :
//   (*sql.DB, nil)  → connexion établie, pgRouting disponible
//   (nil, nil)      → PostgreSQL inaccessible, mode démo activé
//   (nil, error)    → erreur de configuration sql.Open()
func InitDB() (*sql.DB, error) {
	// Lecture des variables d'environnement avec valeurs par défaut.
	host := os.Getenv("DB_HOST")
	if host == "" { host = "localhost" }
	port := os.Getenv("DB_PORT")
	if port == "" { port = "5432" }
	name := os.Getenv("DB_NAME")
	if name == "" { name = "webmapping" }
	user := os.Getenv("DB_USER")
	if user == "" { user = "gin" }
	pass := os.Getenv("DB_PASS")
	if pass == "" { pass = "ginpass" }

	// Construction du DSN (Data Source Name).
	// sslmode=disable : SSL non requis en développement local.
	dsn := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=disable",
		host, port, name, user, pass)

	// sql.Open() prépare le driver mais n'établit pas encore la connexion réelle.
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}

	// db.Ping() établit la connexion réelle et vérifie que PostgreSQL répond.
	// En cas d'échec : retour (nil, nil) pour activer le mode démo sans crasher.
	if err := db.Ping(); err != nil {
		log.Printf("⚠️  PostgreSQL non disponible (%s) — mode sans base de données", err)
		return nil, nil // retourner nil sans erreur = mode démo
	}

	log.Printf("✅ PostgreSQL connecté sur %s:%s/%s", host, port, name)
	return db, nil
}
