package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func CalculateRoute(c *gin.Context) {
	fromLon, err1 := strconv.ParseFloat(c.Query("fromLon"), 64)
	fromLat, err2 := strconv.ParseFloat(c.Query("fromLat"), 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fromLon et fromLat requis"})
		return
	}
	sport := c.DefaultQuery("sport", "velo")
	mode := c.DefaultQuery("mode", "destination")
	distKm, _ := strconv.ParseFloat(c.DefaultQuery("distance_km", "20"), 64)
	speedKmh := speedForSport(sport)

	db, ok := getDB(c)
	if !ok {
		c.JSON(http.StatusOK, buildDemoRoute(fromLon, fromLat, fromLon, fromLat, sport, speedKmh, mode, distKm))
		return
	}

	sourceNode, err := findNearestNode(db, fromLon, fromLat)
	if err != nil {
		c.JSON(http.StatusOK, buildDemoRoute(fromLon, fromLat, fromLon, fromLat, sport, speedKmh, mode, distKm))
		return
	}

	costExpr := costExpression(sport)

	if mode == "boucle" {
		offsetLon := fromLon + (distKm/4)/111.0
		offsetLat := fromLat + (distKm/4)/111.0
		midNode, err := findNearestNode(db, offsetLon, offsetLat)
		if err != nil {
			c.JSON(http.StatusOK, buildDemoRoute(fromLon, fromLat, fromLon, fromLat, sport, speedKmh, mode, distKm))
			return
		}
		geo1, dist1 := dijkstra(db, costExpr, sourceNode, midNode)
		geo2, dist2 := dijkstra(db, costExpr, midNode, sourceNode)
		totalDist := dist1 + dist2
		durationMin := (totalDist / 1000.0) / speedKmh * 60.0
		geojsonStr := mergeGeometries(geo1, geo2)
		if geojsonStr == "" {
			c.JSON(http.StatusOK, buildDemoRoute(fromLon, fromLat, fromLon, fromLat, sport, speedKmh, mode, distKm))
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"distance_m": math.Round(totalDist), "distance_km": math.Round(totalDist/100) / 10,
			"duration_min": math.Round(durationMin), "sport": sport, "mode": mode,
			"source": "pgRouting + OSM", "demo": false,
			"geojson": buildFeature(geojsonStr, totalDist/1000, durationMin, sport),
		})
		return
	}

	toLon, err3 := strconv.ParseFloat(c.Query("toLon"), 64)
	toLat, err4 := strconv.ParseFloat(c.Query("toLat"), 64)
	if err3 != nil || err4 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "toLon et toLat requis"})
		return
	}
	targetNode, err := findNearestNode(db, toLon, toLat)
	if err != nil {
		c.JSON(http.StatusOK, buildDemoRoute(fromLon, fromLat, toLon, toLat, sport, speedKmh, mode, distKm))
		return
	}
	geojsonStr, distM := dijkstra(db, costExpr, sourceNode, targetNode)
	if geojsonStr == "" {
		c.JSON(http.StatusOK, buildDemoRoute(fromLon, fromLat, toLon, toLat, sport, speedKmh, mode, distKm))
		return
	}
	durationMin := (distM / 1000.0) / speedKmh * 60.0
	c.JSON(http.StatusOK, gin.H{
		"distance_m": math.Round(distM), "distance_km": math.Round(distM/100) / 10,
		"duration_min": math.Round(durationMin), "sport": sport, "mode": mode,
		"source": "pgRouting + OSM", "demo": false,
		"geojson": buildFeature(geojsonStr, distM/1000, durationMin, sport),
	})
}

func SearchRoutes(c *gin.Context) {
	fromLon, err1 := strconv.ParseFloat(c.Query("fromLon"), 64)
	fromLat, err2 := strconv.ParseFloat(c.Query("fromLat"), 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fromLon et fromLat requis"})
		return
	}

	sport    := c.DefaultQuery("sport", "velo")
	mode     := c.DefaultQuery("mode", "boucle")
	dureeH,_ := strconv.ParseFloat(c.DefaultQuery("duree_h", "2"), 64)
	niveau   := c.DefaultQuery("niveau", "moyen")
	ftp,_    := strconv.ParseFloat(c.DefaultQuery("ftp", "3.0"), 64)
	vap,_    := strconv.ParseFloat(c.DefaultQuery("vap", "10.0"), 64)

	speedKmh := computeSpeed(sport, niveau, ftp, vap)
	targetDist := dureeH * speedKmh
	if targetDist < 2.0 { targetDist = 2.0 }

	// Pour une boucle: distance totale ≈ 2.6 * rayon (facteur sinuosité routes)
	// Pour destination: distance ≈ 1.3 * rayon
	var radius float64
	if mode == "boucle" {
		radius = targetDist / 2.6
	} else {
		radius = targetDist / 1.3
	}
	if radius > 20.0 { radius = 20.0 }
	if radius < 1.5  { radius = 1.5 }

	db, ok := getDB(c)
	if !ok {
		c.JSON(http.StatusOK, buildDemoSearchResults(fromLon, fromLat, sport, targetDist, speedKmh))
		return
	}

	sourceNode, err := findNearestNode(db, fromLon, fromLat)
	if err != nil {
		c.JSON(http.StatusOK, buildDemoSearchResults(fromLon, fromLat, sport, targetDist, speedKmh))
		return
	}
	log.Printf("sourceNode: %d radius: %.1f targetDist: %.1f", sourceNode, radius, targetDist)

	costExpr := costExpression(sport)

	directions := [][2]float64{
		{fromLon + radius/111.0, fromLat + radius/111.0},
		{fromLon - radius/111.0, fromLat + radius/111.0*0.8},
		{fromLon + radius/111.0*0.7, fromLat - radius/111.0},
	}

	modeLabel := "Boucle"
	if mode == "destination" { modeLabel = "Itinéraire" }

	dirLabels := []string{"Nord-Est", "Nord-Ouest", "Sud-Est"}

	type RouteResult struct {
		Name     string      `json:"name"`
		Distance float64     `json:"distance_km"`
		Duration string      `json:"duration"`
		Sport    string      `json:"sport"`
		GeoJSON  interface{} `json:"geojson"`
		Demo     bool        `json:"demo"`
	}

	var results []RouteResult

	for i, dir := range directions {
		midNode, err := findNearestNode(db, dir[0], dir[1])
		if err != nil || midNode == sourceNode { continue }

		var geojsonStr string
		var totalDist float64

		if mode == "boucle" {
			// Vraie boucle en triangle: source → mid1 → mid2 → source
			// mid2 est perpendiculaire à mid1 pour éviter de repasser par le même chemin
			angle := float64(i) * 2.0 * math.Pi / 3.0 // 120° entre chaque boucle
			offsetX := math.Cos(angle+math.Pi/2) * radius * 0.6 / 111.0
			offsetY := math.Sin(angle+math.Pi/2) * radius * 0.6 / 111.0
			mid2Lon := fromLon + offsetX
			mid2Lat := fromLat + offsetY
			mid2Node, err2 := findNearestNode(db, mid2Lon, mid2Lat)
			if err2 != nil || mid2Node == sourceNode || mid2Node == midNode {
				// Fallback: boucle simple aller-retour
				geo1, dist1 := dijkstra(db, costExpr, sourceNode, midNode)
				geo2, dist2 := dijkstra(db, costExpr, midNode, sourceNode)
				if geo1 == "" && geo2 == "" { continue }
				totalDist = (dist1 + dist2) / 1000.0
				geojsonStr = mergeGeometries(geo1, geo2)
			} else {
				// Boucle triangulaire: source → mid1 → mid2 → source
				geo1, dist1 := dijkstra(db, costExpr, sourceNode, midNode)
				geo2, dist2 := dijkstra(db, costExpr, midNode, mid2Node)
				geo3, dist3 := dijkstra(db, costExpr, mid2Node, sourceNode)
				log.Printf("triangle %d: %.0f + %.0f + %.0f", i, dist1, dist2, dist3)
				if geo1 == "" || geo2 == "" || geo3 == "" {
					// Fallback aller-retour
					geo1, dist1 = dijkstra(db, costExpr, sourceNode, midNode)
					geo2, dist2 = dijkstra(db, costExpr, midNode, sourceNode)
					if geo1 == "" && geo2 == "" { continue }
					totalDist = (dist1 + dist2) / 1000.0
					geojsonStr = mergeGeometries(geo1, geo2)
				} else {
					totalDist = (dist1 + dist2 + dist3) / 1000.0
					geojsonStr = mergeThree(geo1, geo2, geo3)
				}
			}
		} else {
			geo1, dist1 := dijkstra(db, costExpr, sourceNode, midNode)
			if geo1 == "" { continue }
			totalDist = dist1 / 1000.0
			geojsonStr = geo1
		}

		if totalDist < 0.5 || geojsonStr == "" { continue }

		dh := totalDist / speedKmh
		h  := int(dh)
		m  := int((dh - float64(h)) * 60)

		realDist := math.Round(totalDist*10) / 10
		results = append(results, RouteResult{
			Name:     fmt.Sprintf("%s %s", modeLabel, dirLabels[i]),
			Distance: realDist,
			Duration: fmt.Sprintf("%dh%02d", h, m),
			Sport:    sport,
			GeoJSON:  buildFeature(geojsonStr, totalDist, dh*60, sport),
			Demo:     false,
		})
	}

	if len(results) == 0 {
		c.JSON(http.StatusOK, buildDemoSearchResults(fromLon, fromLat, sport, targetDist, speedKmh))
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results, "source": "pgRouting + OSM", "demo": false})
}

func getDB(c *gin.Context) (*sql.DB, bool) {
	dbInterface, exists := c.Get("db")
	if !exists { return nil, false }
	db, ok := dbInterface.(*sql.DB)
	if !ok || db == nil { return nil, false }
	log.Printf("getDB: OK")
	return db, true
}

func findNearestNode(db *sql.DB, lon, lat float64) (int64, error) {
	var node int64
	err := db.QueryRow(`SELECT id FROM ways_vertices_pgr ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($1,$2),4326) LIMIT 1`, lon, lat).Scan(&node)
	return node, err
}

func dijkstra(db *sql.DB, costExpr string, source, target int64) (string, float64) {
	if source == target { return "", 0 }
	var geojsonStr string
	var distM float64
	query := fmt.Sprintf("SELECT ST_AsGeoJSON(ST_Union(w.the_geom)), COALESCE(SUM(w.length_m), 0) FROM pgr_dijkstra('%s', $1::bigint, $2::bigint, true) r JOIN ways w ON r.edge = w.gid WHERE r.edge > 0", costExpr)
	err := db.QueryRow(query, source, target).Scan(&geojsonStr, &distM)
	if err != nil || geojsonStr == "" || geojsonStr == "null" { return "", 0 }
	return geojsonStr, distM
}

func mergeGeometries(geo1, geo2 string) string {
	if geo1 == "" && geo2 == "" { return "" }
	if geo1 == "" { return geo2 }
	if geo2 == "" { return geo1 }
	var g1, g2 map[string]interface{}
	json.Unmarshal([]byte(geo1), &g1)
	json.Unmarshal([]byte(geo2), &g2)
	b, _ := json.Marshal(map[string]interface{}{"type": "GeometryCollection", "geometries": []interface{}{g1, g2}})
	return string(b)
}

func mergeThree(geo1, geo2, geo3 string) string {
	var g1, g2, g3 map[string]interface{}
	json.Unmarshal([]byte(geo1), &g1)
	json.Unmarshal([]byte(geo2), &g2)
	json.Unmarshal([]byte(geo3), &g3)
	b, _ := json.Marshal(map[string]interface{}{"type": "GeometryCollection", "geometries": []interface{}{g1, g2, g3}})
	return string(b)
}

func buildFeature(geojsonStr string, distKm, durationMin float64, sport string) map[string]interface{} {
	return map[string]interface{}{
		"type": "Feature", "geometry": json.RawMessage(geojsonStr),
		"properties": map[string]interface{}{"distance_km": math.Round(distKm*10)/10, "duration_min": math.Round(durationMin), "sport": sport},
	}
}

func costExpression(sport string) string {
	// Utiliser toutes les routes pour garantir la connectivité du graphe
	// Les autoroutes ont un coût très élevé dans osm2pgrouting donc peu utilisées
	return "SELECT gid AS id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM ways WHERE cost_s > 0"
}

func speedForSport(sport string) float64 {
	switch sport {
	case "rando":  return 5.0
	case "course": return 10.0
	default:       return 20.0
	}
}

func computeSpeed(sport, niveau string, ftp, vap float64) float64 {
	switch sport {
	case "velo":
		speed := 10.0 + ftp*4.0
		switch niveau {
		case "debutant": speed *= 0.75
		case "expert":   speed *= 1.15
		}
		if speed < 12 { speed = 12 }
		if speed > 45 { speed = 45 }
		return speed
	case "course":
		speed := vap
		switch niveau {
		case "debutant": speed *= 0.65
		case "moyen":    speed *= 0.80
		case "expert":   speed *= 0.90
		}
		if speed < 6  { speed = 6 }
		if speed > 22 { speed = 22 }
		return speed
	case "rando":
		switch niveau {
		case "debutant": return 3.0
		case "expert":   return 6.0
		}
		return 4.5
	}
	return 15.0
}

func buildDemoSearchResults(fromLon, fromLat float64, sport string, distKm, speedKmh float64) gin.H {
	type R struct {
		Name string `json:"name"`; Distance float64 `json:"distance_km"`; Duration string `json:"duration"`
		Sport string `json:"sport"`; GeoJSON interface{} `json:"geojson"`; Demo bool `json:"demo"`
	}
	dirs  := [][2]float64{{0.02,0.02},{-0.02,0.015},{0.015,-0.02}}
	names := []string{"Boucle Nord-Est","Boucle Nord-Ouest","Boucle Sud-Est"}
	var results []R
	for i, d := range dirs {
		mid := [2]float64{fromLon+d[0], fromLat+d[1]}
		coords := [][2]float64{{fromLon,fromLat},{(fromLon+mid[0])/2,(fromLat+mid[1])/2+0.005},{mid[0],mid[1]},{(fromLon+mid[0])/2,(fromLat+mid[1])/2-0.005},{fromLon,fromLat}}
		dist := distKm*(0.8+float64(i)*0.15); dh := dist/speedKmh
		h,m := int(dh), int((dh-float64(int(dh)))*60)
		coordsJSON,_ := json.Marshal(coords)
		results = append(results, R{Name:names[i],Distance:math.Round(dist*10)/10,Duration:fmt.Sprintf("%dh%02d",h,m),Sport:sport,
			GeoJSON:map[string]interface{}{"type":"Feature","geometry":map[string]interface{}{"type":"LineString","coordinates":json.RawMessage(coordsJSON)},"properties":map[string]interface{}{}},Demo:true})
	}
	return gin.H{"results":results,"source":"Estimation directe","demo":true}
}

func buildDemoRoute(fromLon, fromLat, toLon, toLat float64, sport string, speedKmh float64, mode string, distKm float64) gin.H {
	var coords [][2]float64; var distM float64
	if mode == "boucle" {
		r := distKm/111.0/4.0
		coords = [][2]float64{{fromLon,fromLat},{fromLon+r,fromLat+r},{fromLon+r*1.5,fromLat},{fromLon+r,fromLat-r},{fromLon,fromLat}}
		distM = distKm*1000
	} else {
		coords = [][2]float64{{fromLon,fromLat},{fromLon+(toLon-fromLon)*0.33,fromLat+(toLat-fromLat)*0.33+0.005},{fromLon+(toLon-fromLon)*0.66,fromLat+(toLat-fromLat)*0.66-0.003},{toLon,toLat}}
		distM = haversineMeters(fromLat,fromLon,toLat,toLon)*1.25
	}
	durationMin := (distM/1000.0)/speedKmh*60.0
	coordsJSON,_ := json.Marshal(coords); h,m := int(durationMin/60),int(durationMin)%60
	return gin.H{"distance_m":math.Round(distM),"distance_km":math.Round(distM/100)/10,"duration_min":math.Round(durationMin),"duration":fmt.Sprintf("%dh%02d",h,m),"sport":sport,"mode":mode,"demo":true,"source":"Estimation directe",
		"geojson":map[string]interface{}{"type":"Feature","geometry":map[string]interface{}{"type":"LineString","coordinates":json.RawMessage(coordsJSON)},"properties":map[string]interface{}{}}}
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000.0
	phi1 := lat1*math.Pi/180; phi2 := lat2*math.Pi/180
	dphi := (lat2-lat1)*math.Pi/180; dlambda := (lon2-lon1)*math.Pi/180
	a := math.Sin(dphi/2)*math.Sin(dphi/2)+math.Cos(phi1)*math.Cos(phi2)*math.Sin(dlambda/2)*math.Sin(dlambda/2)
	return R*2*math.Atan2(math.Sqrt(a),math.Sqrt(1-a))
}
