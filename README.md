# ChronoPath — GIN Webmapping HEIG-VD

Application de planification d'itinéraires sportifs (vélo, randonnée, course à pied) pour la Suisse romande, développée dans le cadre du cours GIN (Géoinformatique) à la HEIG-VD.

---

## 🗂 Architecture du projet

```
GIN_projet/
├── backend/               # Serveur Go + Gin
│   ├── main.go            # Point d'entrée, routes API, fichiers statiques
│   ├── .env               # Variables de connexion PostgreSQL
│   └── handlers/
│       ├── routing.go     # Calcul d'itinéraires pgRouting (Dijkstra)
│       ├── geodata.go     # Endpoint routes OSM (/api/osm-ways)
│       ├── db.go          # Initialisation connexion PostgreSQL
│       ├── pois.go        # Points d'intérêt
│       └── proxy.go       # Proxy WMS
├── frontend/
│   ├── index.html         # Interface principale
│   ├── css/style.css      # Styles
│   ├── images/            # Logo HEIG-VD
│   └── js/
│       ├── map.js         # Carte Leaflet, fonds de carte Swisstopo
│       ├── cantons.js     # Couche cantons romands, routes OSM, légende
│       ├── search.js      # Recherche d'itinéraires via pgRouting
│       ├── routing.js     # Onglet Itinéraire A→B + chargement GPX
│       ├── trails.js      # Itinéraires prédéfinis
│       └── app.js         # Initialisation, onglets, mode Créer
├── Donnees_finales/
│   └── CANTONS_Romands.gpkg  # Données cantons (Swisstopo)
└── README.md
```

---

## ⚡ Démarrage rapide (à faire à chaque session)

### Prérequis installés une seule fois
- [Go 1.21+](https://go.dev/dl/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Étapes à chaque fois

**1. Démarrer Docker et la base de données**
```cmd
docker start gin_pgrouting
```
> Si le conteneur n'existe pas encore, voir section "Installation initiale" ci-dessous.

**2. Compiler et lancer le serveur Go**
```cmd
cd C:\Users\willi\Desktop\HEIG-VD\Cours\Semestre_4\GIN\GIN_projet\backend
go build -o server.exe . && server.exe
```
> Le serveur démarre sur http://localhost:8080
> Vous devez voir : `✅ PostgreSQL connecté`

**3. Ouvrir l'application**
```
http://localhost:8080
```

### Arrêter proprement
```cmd
Ctrl+C   ← arrête le serveur Go
docker stop gin_pgrouting
```

---

## 🔧 Installation initiale (une seule fois)

### 1. Créer le conteneur PostgreSQL + PostGIS + pgRouting
```cmd
docker run --name gin_pgrouting -e POSTGRES_USER=gin -e POSTGRES_PASSWORD=ginpass -e POSTGRES_DB=webmapping -p 5432:5432 -d pgrouting/pgrouting:15-3.5-3.4.2
```

### 2. Importer les données OSM (Suisse romande, ~10 min)
```cmd
docker exec -it gin_pgrouting bash
osm2pgrouting --file /path/to/switzerland.osm --conf /usr/share/osm2pgrouting/mapconfig.xml --dbname webmapping --username gin --password ginpass
exit
```
> Les données importées : 351 509 ways, 291 381 nœuds

### 3. Configurer le fichier .env
Le fichier `backend/.env` doit contenir :
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webmapping
DB_USER=gin
DB_PASS=ginpass
```

### 4. Installer les dépendances Go
```cmd
cd backend
go mod tidy
```

---

## 🗺 Fonds de carte

L'application utilise les APIs Swisstopo (gratuites, pas de clé requise) :

| Nom | Description |
|-----|-------------|
| **Carte Topographique** | Carte nationale suisse ch.swisstopo.pixelkarte-farbe |
| **Orthophoto** | Imagerie aérienne ch.swisstopo.swissimage |

---

## 📡 API endpoints

### Recherche d'itinéraires
```
GET /api/search-routes?fromLon=6.64&fromLat=46.77&sport=velo&mode=boucle&duree_h=3&niveau=moyen&ftp=3.0&vap=10.0
```
Retourne 3 itinéraires calculés via Dijkstra dans différentes directions.

**Paramètres :**
| Paramètre | Valeurs | Description |
|-----------|---------|-------------|
| `sport` | `velo`, `rando`, `course` | Type d'activité |
| `mode` | `boucle`, `destination` | Boucle ou point à point |
| `duree_h` | nombre décimal | Durée souhaitée en heures |
| `niveau` | `debutant`, `moyen`, `expert` | Niveau sportif |
| `ftp` | W/kg | Puissance seuil fonctionnel (vélo) |
| `vap` | min/km | Vitesse ajustée selon la pente (course) |

### Calcul d'itinéraire A→B
```
GET /api/route?fromLon=6.64&fromLat=46.77&toLon=6.87&toLat=46.99&sport=velo
```

### Routes OSM (couche carte)
```
GET /api/osm-ways?minLon=6.5&minLat=46.6&maxLon=6.9&maxLat=47.0
```
Retourne les routes OSM dans le bbox (GeoJSON, limite 2000 éléments).

### Santé de la base de données
```
GET /api/health
```

---

## 🏃 Fonctionnalités

### Rechercher
- Point de départ par adresse (géocodage Nominatim), GPS ou clic carte
- Mode **Boucle** : calcul triangulaire source→mid1→mid2→source (évite de repasser par les mêmes routes)
- Mode **Destination** : 3 options dans différentes directions
- Filtres par sport : FTP (vélo), VAP (course), durée, niveau, dénivelé
- Export GPX de chaque itinéraire
- Vitesse calculée selon FTP/VAP/niveau pour estimer la durée réelle

### Itinéraire A→B
- Saisie départ/arrivée par adresse, GPS ou clic carte
- Calcul Dijkstra sur le réseau OSM réel via pgRouting
- Mode estimation automatique si la base de données est indisponible
- Export GPX du résultat

### Charger GPX
- Chargement d'un fichier `.gpx` local
- Affichage sur la carte avec calcul de distance

### Créer
- Tracer un itinéraire point par point sur la carte
- Chaque segment est calculé via pgRouting en temps réel
- Sauvegarde locale de l'itinéraire

### Couches carte
- **Cantons romands** : polygones depuis CANTONS_Romands.gpkg (Swisstopo)
- **Routes OSM** : chargement dynamique selon la vue, rechargement automatique au zoom/déplacement, légende par type de route

---

## 🧮 Calcul de vitesse

Le backend calcule la vitesse moyenne selon le sport et le profil utilisateur :

| Sport | Formule | Limites |
|-------|---------|---------|
| **Vélo** | `10 + FTP × 4` km/h, ×0.75/1.0/1.15 selon niveau | 12–45 km/h |
| **Course** | `VAP × 0.65/0.80/0.90` selon niveau | 6–22 km/h |
| **Rando** | 3.0 / 4.5 / 6.0 km/h selon niveau | — |

La distance cible est : `vitesse × durée_souhaitée`
Le rayon du point intermédiaire est : `distance / 2.6` (boucle) ou `distance / 1.3` (destination)

---

## 🛠 Technologies utilisées

| Composant | Technologie |
|-----------|-------------|
| Backend | Go 1.21 + Gin |
| Base de données | PostgreSQL 15 + PostGIS + pgRouting 3.4 |
| Routage | pgRouting Dijkstra sur données OSM |
| Import OSM | osm2pgrouting |
| Frontend | HTML/CSS/JS vanilla + Leaflet.js 1.9 |
| Fonds de carte | Swisstopo WMTS (gratuit) |
| Géocodage | Nominatim (OpenStreetMap) |
| Données | OSM Suisse romande + CANTONS_Romands.gpkg |

---

## ⚠️ Dépannage

| Problème | Solution |
|----------|----------|
| `✅ PostgreSQL connecté` absent | Vérifier que Docker est démarré : `docker start gin_pgrouting` |
| `ERR_CONNECTION_REFUSED` | Relancer `go build -o server.exe . && server.exe` |
| Itinéraires en mode estimation | La DB n'est pas connectée, vérifier `.env` et Docker |
| Routes OSM ne s'affichent pas | Dézoomer, la limite est 2000 éléments par vue |
| Cantons s'affichent au démarrage | Décocher la case dans le panneau Couches |
| Cache navigateur | Ctrl+Shift+R pour forcer le rechargement |

---

*Projet GIN — HEIG-VD –2026*
