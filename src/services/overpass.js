// ========== CONSULTAS A OVERPASS — DOGSTYLE ==========
// Overpass es un servicio público y a veces uno de sus espejos está saturado.
// Para no depender de uno solo, se consultan varios en paralelo y se usa la
// primera respuesta válida. Si todos fallan, se lanza un error identificable.

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.monicz.dev/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const OVERPASS_TIMEOUT_MS = 10000

// El último espejo que respondió bien se intenta primero en la siguiente consulta.
let preferredIndex = 0

class EmptyResultError extends Error {
  constructor(endpoint) {
    super(`Overpass ${endpoint} devolvió 0 resultados`)
    this.name = 'EmptyResultError'
  }
}

/**
 * Construye una consulta Overpass QL para buscar residencias caninas
 * (amenity=animal_boarding) dentro de un radio.
 */
export function buildAnimalBoardingQuery(lat, lon, radiusKm) {
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

async function fetchFromEndpoint(endpoint, query, controller) {
  const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DOGSTYLE/1.0 (contacto@dogstyle.es)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`Overpass ${endpoint} respondió ${response.status}`)

    const data = await response.json()
    if (!Array.isArray(data?.elements)) {
      throw new Error(`Overpass ${endpoint} devolvió una respuesta no válida`)
    }

    return data.elements
  } finally {
    clearTimeout(timeout)
  }
}

function overpassUnavailable(cause) {
  const error = new Error('Los servidores de OpenStreetMap no responden en este momento.')
  error.code = 'OVERPASS_UNAVAILABLE'
  error.cause = cause
  return error
}

/**
 * Consulta los espejos de Overpass en paralelo y devuelve el primero que
 * contenga resultados. Si todos fallan o devuelven listas vacías, lanza error
 * (o devuelve [] si al menos uno respondió correctamente sin resultados).
 * @param {string} query - Consulta Overpass QL
 * @returns {Promise<Array>} Elementos de OpenStreetMap
 */
export async function fetchOverpassElements(query) {
  const orderedEndpoints = OVERPASS_ENDPOINTS.map(
    (_, offset) => OVERPASS_ENDPOINTS[(preferredIndex + offset) % OVERPASS_ENDPOINTS.length],
  )

  const controllers = []
  const attempts = orderedEndpoints.map((endpoint) => {
    const controller = new AbortController()
    controllers.push(controller)

    return fetchFromEndpoint(endpoint, query, controller).then((elements) => {
      if (elements.length === 0) throw new EmptyResultError(endpoint)
      return { endpoint, elements }
    })
  })

  try {
    const { endpoint, elements } = await Promise.any(attempts)
    // Cancelamos el resto de consultas en cuanto tenemos una respuesta válida.
    controllers.forEach((controller) => controller.abort())
    preferredIndex = OVERPASS_ENDPOINTS.indexOf(endpoint)
    return elements
  } catch (error) {
    const reasons = error?.errors || []
    if (reasons.some((reason) => reason instanceof EmptyResultError)) return []

    console.error('Ningún espejo de Overpass respondió:', reasons)
    throw overpassUnavailable(error)
  }
}
