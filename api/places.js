// ========== PROXY APIFY (GOOGLE MAPS) — DOGSTYLE ==========
// Función serverless de Vercel. Usa un actor de Apify (Google Maps Scraper)
// para obtener residencias caninas desde Google Maps cuando OpenStreetMap no
// tiene datos suficientes. La clave se lee de variables de entorno y NUNCA se
// expone al navegador ni se guarda en el repositorio.
//
// Configuración en Vercel (Settings → Environment Variables):
//   APIFY_TOKEN = <tu token de Apify>
//
// Nota: ejecutar actores consume créditos/tiempo de Apify y puede tardar.

const APIFY_ACTOR = 'compass~crawler-google-places'
const APIFY_ENDPOINT = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`
const MAX_RESULTS = 20
// Mantener por debajo del timeout de funciones serverless en planes básicos.
const RUN_TIMEOUT_SECS = 60

function parseNumber(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function pickPhone(item) {
  return (
    item.phone ||
    item.phoneNumber ||
    item.phoneUnformatted ||
    item.internationalPhoneNumber ||
    item.phones?.[0] ||
    null
  )
}

function pickWebsite(item) {
  const url = item.website || item.url || item.placeUrl || item.googleMapsUrl || null
  if (!url || typeof url !== 'string') return 'No disponible'
  // Evitar devolver la ficha de Google como "web oficial".
  if (url.includes('google.com/maps')) return 'No disponible'
  return url
}

function pickOpeningHours(item) {
  const hours = item.openingHours
  if (!hours) return null
  if (typeof hours === 'string') return hours
  if (Array.isArray(hours)) {
    // ["Monday: 9:00-18:00", ...] o [{day,hours}, ...]
    const parts = hours
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry && typeof entry === 'object') {
          const day = entry.day || entry.name || ''
          const value = entry.hours || entry.openHours || entry.value || ''
          return day && value ? `${day}: ${value}` : value || day || ''
        }
        return ''
      })
      .filter(Boolean)
    return parts.length ? parts.join('; ') : null
  }
  if (typeof hours === 'object') {
    // { monday: "9-18", ... }
    const parts = Object.entries(hours)
      .map(([day, value]) => (value ? `${day}: ${value}` : ''))
      .filter(Boolean)
    return parts.length ? parts.join('; ') : null
  }
  return null
}

function normalizeItem(item, index) {
  const name = (item.title || item.name || '').trim()
  if (!name) return null

  const lat = parseNumber(item.location?.lat ?? item.lat ?? item.latitude)
  const lon = parseNumber(item.location?.lng ?? item.location?.lon ?? item.lng ?? item.lon ?? item.longitude)

  const address =
    item.address ||
    item.street ||
    [item.street, item.city, item.postalCode, item.countryCode].filter(Boolean).join(', ') ||
    'No disponible'

  const phone = pickPhone(item)
  const website = pickWebsite(item)
  const openingHours = pickOpeningHours(item)

  // IDs estables para deduplicación y keys de React.
  const externalId =
    item.placeId || item.cid || item.fid || item.id || `${lat ?? 'na'}-${lon ?? 'na'}-${index}`

  return {
    id: `apify/${externalId}`,
    type: 'node',
    name,
    address,
    phone: phone || null,
    phoneHref: phone ? String(phone).replace(/[^\d+]/g, '') : null,
    phoneSource: phone ? 'Google Maps (vía Apify)' : null,
    phoneTag: null,
    website,
    wikidata: null,
    openingHours,
    price: null,
    priceSource: null,
    priceTag: null,
    lat,
    lon,
    animals: [],
    osmType: 'node',
    osmId: String(externalId),
    source: 'Google Maps (vía Apify)',
  }
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Método no permitido' })
    return
  }

  const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN
  if (!token) {
    response.status(501).json({
      error: 'Apify no está configurado',
      code: 'APIFY_NOT_CONFIGURED',
    })
    return
  }

  const lat = parseNumber(request.query.lat)
  const lon = parseNumber(request.query.lon)
  const _radius = parseNumber(request.query.radius)
  const q = typeof request.query.q === 'string' ? request.query.q.trim() : ''

  if (!q) {
    response.status(400).json({ error: 'Falta el parámetro q (localidad o búsqueda)' })
    return
  }

  const searchQuery = `residencias caninas en ${q}`
  const body = {
    searchStringsArray: [searchQuery],
    maxCrawledPlacesPerSearch: MAX_RESULTS,
    language: 'es',
  }

  // Si hay coordenadas, algunos actores aceptan geolocalización; no es crítico.
  if (lat != null && lon != null) {
    body.lat = String(lat)
    body.lng = String(lon)
    body.zoom = 13
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), (RUN_TIMEOUT_SECS + 10) * 1000)

  try {
    const url = `${APIFY_ENDPOINT}?token=${encodeURIComponent(token)}&timeout=${RUN_TIMEOUT_SECS}&format=json`
    const apifyResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!apifyResponse.ok) {
      const text = await apifyResponse.text().catch(() => '')
      console.error('Apify respondió error:', apifyResponse.status, text.slice(0, 200))
      response.status(502).json({ error: 'No se pudo obtener datos de Apify', code: 'APIFY_ERROR' })
      return
    }

    const items = await apifyResponse.json()
    const elements = (Array.isArray(items) ? items : [])
      .map(normalizeItem)
      .filter(Boolean)

    // Los resultados de terceros pueden cambiar; cache breve en CDN.
    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
    response.status(200).json({ elements, source: 'apify' })
  } catch (error) {
    const aborted = error?.name === 'AbortError'
    console.error('Proxy Apify falló:', aborted ? 'timeout' : error?.message || error)
    response.status(aborted ? 504 : 502).json({
      error: aborted ? 'La consulta a Apify tardó demasiado' : 'No se pudo obtener datos de Apify',
      code: aborted ? 'APIFY_TIMEOUT' : 'APIFY_ERROR',
    })
  } finally {
    clearTimeout(timeout)
  }
}
