// ========== PROXY OVERPASS — DOGSTYLE ==========
// Función serverless de Vercel. Consulta Overpass desde el servidor y devuelve
// los elementos de OpenStreetMap en JSON. Se usa como último respaldo cuando el
// navegador no consigue respuesta de ningún espejo.

import { buildAnimalBoardingQuery, fetchOverpassElements } from '../src/services/overpass.js'

const MAX_RADIUS_KM = 50

function parseNumber(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default async function handler(request, response) {
  // Solo se permiten peticiones GET desde el propio sitio o cualquier origen.
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

  const lat = parseNumber(request.query.lat)
  const lon = parseNumber(request.query.lon)
  const radius = parseNumber(request.query.radius)

  if (lat == null || lon == null || radius == null) {
    response.status(400).json({ error: 'Faltan los parámetros lat, lon y radius' })
    return
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    response.status(400).json({ error: 'Coordenadas fuera de rango' })
    return
  }

  if (radius <= 0 || radius > MAX_RADIUS_KM) {
    response.status(400).json({ error: `El radio debe estar entre 0 y ${MAX_RADIUS_KM} km` })
    return
  }

  try {
    const query = buildAnimalBoardingQuery(lat, lon, radius)
    const elements = await fetchOverpassElements(query)

    // Los datos de OSM cambian poco: se cachean 10 minutos en el CDN de Vercel.
    response.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    response.status(200).json({ elements })
  } catch (error) {
    console.error('Proxy Overpass falló:', error?.message || error)
    response.status(503).json({
      error: 'Los servidores de OpenStreetMap no responden en este momento.',
      code: 'OVERPASS_UNAVAILABLE',
    })
  }
}
