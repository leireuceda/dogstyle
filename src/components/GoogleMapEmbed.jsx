// ========== MAPA DE GOOGLE EMBEBIDO — DOGSTYLE ==========
// Muestra Google Maps dentro de la propia página, sin abrir pestañas nuevas.
// Usa el mismo formato de iframe que genera Google al pulsar "Compartir >
// Insertar un mapa", por lo que no necesita API key. Si algún día dejara de
// funcionar, siempre queda el enlace "Abrir en Google Maps".

const ZOOM_BY_RADIUS = [
  { maxKm: 5, zoom: 12 },
  { maxKm: 10, zoom: 11 },
  { maxKm: 20, zoom: 10 },
  { maxKm: 30, zoom: 9 },
  { maxKm: 50, zoom: 8 },
  { maxKm: 100, zoom: 7 },
]

function zoomForRadius(radiusKm) {
  const match = ZOOM_BY_RADIUS.find((entry) => radiusKm <= entry.maxKm)
  return match ? match.zoom : 7
}

function buildEmbedUrl(query, zoom) {
  const pb = `!1m3!2m1!1s${encodeURIComponent(query)}!6i${zoom}!3m1!1ses!5m1!1ses`
  return `https://www.google.com/maps/embed?origin=mfe&pb=${pb}`
}

export default function GoogleMapEmbed({ centerPoint, city, radiusKm, selectedResult }) {
  const hasSelectedCoords = selectedResult?.lat != null && selectedResult?.lon != null

  const query = hasSelectedCoords
    ? `${selectedResult.lat},${selectedResult.lon}`
    : `residencias caninas ${city || ''}`.trim()

  const zoom = hasSelectedCoords ? 16 : zoomForRadius(radiusKm || 10)
  const src = buildEmbedUrl(query, zoom)
  const externalUrl = hasSelectedCoords
    ? `https://www.google.com/maps/search/?api=1&query=${selectedResult.lat},${selectedResult.lon}`
    : `https://www.google.com/maps/search/${encodeURIComponent(query)}`

  return (
    <div className="google-map-embed">
      <iframe
        src={src}
        title={hasSelectedCoords ? `Google Maps: ${selectedResult.name}` : 'Google Maps: residencias caninas'}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div className="google-map-footer">
        <span>
          {hasSelectedCoords ? selectedResult.name : 'Residencias caninas en Google Maps'}
        </span>
        <a href={externalUrl} target="_blank" rel="noreferrer">
          Abrir en Google Maps ↗
        </a>
      </div>
      {!hasSelectedCoords && centerPoint && (
        <p className="google-map-note">
          Este mapa muestra también negocios que aún no están registrados en OpenStreetMap.
        </p>
      )}
    </div>
  )
}
