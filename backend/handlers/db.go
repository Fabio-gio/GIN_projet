package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

// InitDB initialise la connexion PostgreSQL
func InitDB() (*sql.DB, error) {
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

	dsn := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=disable",
		host, port, name, user, pass)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}

	if err := db.Ping(); err != nil {
		log.Printf("⚠️  PostgreSQL non disponible (%s) — mode sans base de données", err)
		return nil, nil // retourner nil sans erreur = mode démo
	}

	log.Printf("✅ PostgreSQL connecté sur %s:%s/%s", host, port, name)
	return db, nil
}
