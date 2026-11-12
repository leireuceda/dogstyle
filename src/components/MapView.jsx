import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Importar CSS de Leaflet (se añade en index.html)
// Personalizar icono del marcador con estilo DOGSTYLE
const dogMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Componente auxiliar para centrar el mapa desde fuera
export const MapCenterSetter = ({ center }) => {
  const map = useMap()
  useEffect(() => {
    if (center && map) {
      map.setView([center.lat, center.lon], 13)
    }
  }, [center, map])
  return null
}

export default function MapView({ results, centerPoint, radiusKm, onSelectResult, selectedResult }) {
  const mapRef = useRef(null)

  const defaultCenter = centerPoint || { lat: 40.4167, lon: -3.7033 }
  const focusPoint = selectedResult?.hasCoordinates
    ? { lat: selectedResult.lat, lon: selectedResult.lon }
    : centerPoint

  return (
    <div className="map-view-container">
      <MapContainer
        ref={mapRef}
        center={[defaultCenter.lat, defaultCenter.lon]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        {focusPoint && <MapCenterSetter center={focusPoint} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Círculo de radio de búsqueda */}
        {centerPoint && radiusKm && (
          <Circle
            center={[centerPoint.lat, centerPoint.lon]}
            radius={radiusKm * 1000}
            color="#2d4a31"
            fillColor="#9cbb7a"
            fillOpacity={0.15}
            weight={2}
          />
        )}

        {/* Marcador del punto de búsqueda */}
        {centerPoint && (
          <Marker position={[centerPoint.lat, centerPoint.lon]}>
            <Popup>
              <div className="map-popup">
                <strong>Punto de búsqueda</strong>
                <br />
                {centerPoint.lat.toFixed(4)}, {centerPoint.lon.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marcadores de establecimientos */}
        {results && results.map((result) => (
          result.hasCoordinates && (
            <Marker
              key={result.id}
              position={[result.lat, result.lon]}
              icon={dogMarkerIcon}
              eventHandlers={{
                click: () => onSelectResult && onSelectResult(result),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{result.name}</strong>
                  <br />
                  {result.address}
                  <br />
                  {result.phone ? (
                    <a href={`tel:${result.phoneHref || result.phone}`}>{result.phone}</a>
                  ) : (
                    'Teléfono no disponible'
                  )}
                  <br />
                  {result.price ? `Precio: ${result.price}` : 'Consultar precio'}
                  <br />
                  {result.openingHours ? `Horario: ${result.openingHours}` : 'Horario no disponible'}
                  <br />
                  {result.stayOpening?.label}
                  <br />
                  <small>ID OSM: {result.osmType}/{result.osmId}</small>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  )
}