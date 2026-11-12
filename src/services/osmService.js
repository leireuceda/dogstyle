// ========== SERVICIO OSM — DOGSTYLE ==========
// Servicios gratuitos: Nominatim (geocodificación) y Overpass API (búsqueda de establecimientos)
// Licencia: OpenStreetMap ODbL — se requiere atribución visible

import { extractOsmPhone, extractPrice } from './phoneService'

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

    const results = elements
      // Solo mostramos ubicaciones con nombre: las que no tienen `name` en OSM
      // no son útiles para el usuario y se descartan.
      .filter((el) => (el.tags?.name || '').trim().length > 0)
      .map((el) => {
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
        const phoneData = extractOsmPhone(tags)
        const priceData = extractPrice(tags)

        return {
          id: `${el.type}/${el.id}`,
          type: el.type,
          name: tags.name.trim(),
          address: addressParts.length > 0 ? addressParts.join(', ') : 'No disponible',
          ...phoneData,
          website: tags['contact:website'] || tags.website || 'No disponible',
          wikidata: tags.wikidata || null,
          openingHours: tags.opening_hours || null,
          ...priceData,
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
 * Distancia aproximada en km entre dos coordenadas (fórmula de Haversine).
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Normaliza los resultados de Overpass para el futuro mapa y la UI de DOGSTYLE.
 * @param {Array} results - Resultados crudos de Overpass
 * @param {{lat: number, lon: number}|null} center - Punto de búsqueda para calcular distancia
 * @returns {Array} Resultados normalizados listos para mostrar, ordenados por cercanía
 */
export function normalizeResults(results, center = null) {
  return results
    // Refuerzo: nunca mostrar establecimientos sin nombre.
    .filter((r) => (r.name || '').trim().length > 0)
    .map((r) => ({
      id: r.id,
      name: r.name.trim(),
      address: r.address,
      phone: r.phone || null,
      phoneHref: r.phoneHref || null,
      phoneSource: r.phoneSource || null,
      phoneTag: r.phoneTag || null,
      website: r.website || 'No disponible',
      wikidata: r.wikidata || null,
      openingHours: r.openingHours || null,
      price: r.price || null,
      priceSource: r.priceSource || null,
      priceTag: r.priceTag || null,
      lat: r.lat,
      lon: r.lon,
      distanceKm:
        center && r.lat != null && r.lon != null
          ? haversineKm(center.lat, center.lon, r.lat, r.lon)
          : null,
      animals: r.animals,
      osmType: r.osmType,
      osmId: r.osmId,
      source: r.source,
      hasCoordinates: r.lat != null && r.lon != null,
      verified: true,
    }))
    .sort((a, b) => {
      const distanceA = a.distanceKm ?? Number.POSITIVE_INFINITY
      const distanceB = b.distanceKm ?? Number.POSITIVE_INFINITY
      return distanceA - distanceB
    })
}