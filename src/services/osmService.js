// ========== SERVICIO OSM — DOGSTYLE ==========
// Servicios gratuitos: Nominatim (geocodificación) y Overpass API (búsqueda de establecimientos)
// Licencia: OpenStreetMap ODbL — se requiere atribución visible

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter'

// Caché simple en memoria para evitar consultas innecesarias
const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutos

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function cacheSet(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Convierte una localidad o código postal en coordenadas (lat, lon) usando Nominatim.
 * @param {string} query - Localidad o código postal (ej: "Madrid" o "28001")
 * @returns {Promise<{lat: number, lon: number, display_name: string}|null>}
 */
export async function geocodeLocation(query) {
  if (!query || query.trim().length === 0) return null

  const cacheKey = `geocode:${query.trim()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const url = `${NOMINATIM_BASE}?format=json&q=${encodeURIComponent(query.trim())}&limit=5&countrycodes=es&addressdetails=1`
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'es',
        'User-Agent': 'DOGSTYLE/1.0 (contacto@dogstyle.es)',
      },
    })

    if (!response.ok) {
      console.warn(`Nominatim respondió ${response.status}`)
      return null
    }

    const data = await response.json()
    if (!data || data.length === 0) return null

    const result = data[0]
    const normalized = {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      display_name: result.display_name,
    }

    cacheSet(cacheKey, normalized)
    return normalized
  } catch (error) {
    console.error('Error en geocodificación:', error)
    return null
  }
}

/**
 * Construye una consulta Overpass QL para buscar residencias caninas (amenity=animal_boarding)
 * dentro de un radio dado alrededor de unas coordenadas.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {number} radiusKm - Radio en kilómetros
 * @returns {string} Consulta Overpass QL
 */
function buildOverpassQuery(lat, lon, radiusKm) {
  const radiusMeters = radiusKm * 1000
  return `
[out:json][timeout:25];
(
  node["amenity"="animal_boarding"](around:${radiusMeters},${lat},${lon});
  way["amenity"="animal_boarding"](around:${radiusMeters},${lat},${lon});
  relation["amenity"="animal_boarding"](around:${radiusMeters},${lat},${lon});
);
out center tags;
`
}

/**
 * Consulta Overpass API para obtener residencias caninas reales.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {number} radiusKm - Radio en kilómetros
 * @returns {Promise<Array<{id: string, type: string, name: string, address: string, phone: string, website: string, lat: number, lon: number, animals: string[], osmType: string, osmId: number, source: string}>>}
 */
export async function searchAnimalBoarding(lat, lon, radiusKm) {
  if (!lat || !lon || !radiusKm) return []

  const cacheKey = `overpass:${lat.toFixed(5)},${lon.toFixed(5)},${radiusKm}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const query = buildOverpassQuery(lat, lon, radiusKm)
    const response = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DOGSTYLE/1.0 (contacto@dogstyle.es)',
      },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!response.ok) {
      console.warn(`Overpass respondió ${response.status}`)
      return []
    }

    const data = await response.json()
    const elements = data.elements || []

    const results = elements.map((el) => {
      const tags = el.tags || {}
      const animals = tags['animal_boarding']
        ? tags['animal_boarding'].split(';').map((a) => a.trim())
        : []

      const addressParts = []
      if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber'])
      if (tags['addr:street']) addressParts.push(tags['addr:street'])
      if (tags['addr:postcode']) addressParts.push(tags['addr:postcode'])
      if (tags['addr:city']) addressParts.push(tags['addr:city'])

      const latCenter = el.lat || (el.center && el.center.lat)
      const lonCenter = el.lon || (el.center && el.center.lon)

      return {
        id: `${el.type}/${el.id}`,
        type: el.type,
        name: tags.name || 'Sin nombre',
        address: addressParts.length > 0 ? addressParts.join(', ') : 'No disponible',
        phone: tags['contact:phone'] || tags.phone || 'No disponible',
        website: tags['contact:website'] || tags.website || 'No disponible',
        lat: latCenter ? parseFloat(latCenter) : null,
        lon: lonCenter ? parseFloat(lonCenter) : null,
        animals: animals.filter(Boolean),
        osmType: el.type,
        osmId: el.id,
        source: 'OpenStreetMap (ODbL)',
      }
    })

    cacheSet(cacheKey, results)
    return results
  } catch (error) {
    console.error('Error en búsqueda Overpass:', error)
    return []
  }
}

/**
 * Normaliza los resultados de Overpass para el futuro mapa y la UI de DOGSTYLE.
 * @param {Array} results - Resultados crudos de Overpass
 * @returns {Array} Resultados normalizados listos para mostrar
 */
export function normalizeResults(results) {
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    phone: r.phone,
    website: r.website,
    lat: r.lat,
    lon: r.lon,
    animals: r.animals,
    osmType: r.osmType,
    osmId: r.osmId,
    source: r.source,
    hasCoordinates: r.lat != null && r.lon != null,
    verified: true,
  }))
}