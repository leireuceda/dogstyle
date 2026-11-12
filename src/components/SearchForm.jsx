import { useEffect, useState } from 'react'
import { geocodeLocation, searchAnimalBoarding, normalizeResults } from '../services/osmService'
import { evaluateStayOpeningHours } from '../services/openingHours'
import { lookupAutomaticPhone, lookupPhoneOnDemand } from '../services/phoneService'
import GoogleMapEmbed from './GoogleMapEmbed'
import MapView from './MapView'

const STEPS = [
  { id: 1, title: 'Ubicación' },
  { id: 2, title: 'Información del perro' },
  { id: 3, title: 'Estancia' },
  { id: 4, title: 'Resumen' },
]

const RADIOS = [5, 10, 20, 30, 50, 100]

const withProtocol = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`)

// Enlaces universales de Google Maps: no necesitan API key ni cuenta de Google.
const googleMapsPlaceUrl = (result) => {
  if (result.lat != null && result.lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${result.lat.toFixed(6)},${result.lon.toFixed(6)}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${result.name} ${result.address}`)}`
}

const googleMapsDirectionsUrl = (result) => {
  if (result.lat != null && result.lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${result.lat.toFixed(6)},${result.lon.toFixed(6)}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${result.name} ${result.address}`)}`
}

// Búsqueda de residencias caninas en la zona, para cuando OSM no tiene datos.
const googleMapsAreaUrl = (center, ciudad) => {
  if (center?.lat != null && center?.lon != null) {
    return `https://www.google.com/maps/search/residencias+caninas/@${center.lat.toFixed(6)},${center.lon.toFixed(6)},13z`
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(`residencias caninas ${ciudad || ''}`.trim())}`
}

const TAMAÑOS = ['Pequeño', 'Mediano', 'Grande', 'Muy grande']
const CARACTERES = ['Tranquilo', 'Juguetón', 'Nervioso', 'Sociable', 'Independiente']

const formatDateEs = (value) => {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export default function SearchForm({ onClose }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    location: { ciudad: '', codigoPostal: '', radio: 10 },
    dog: { nombre: '', raza: '', edad: '', peso: '', tamano: '', caracter: '' },
    stay: { fechaEntrada: '', fechaSalida: '' },
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [hiddenClosedCount, setHiddenClosedCount] = useState(0)
  const [searchError, setSearchError] = useState(null)
  const [selectedResult, setSelectedResult] = useState(null)
  const [searchCenter, setSearchCenter] = useState(null)
  const [phoneLookups, setPhoneLookups] = useState({})
  const [phoneBatchLoading, setPhoneBatchLoading] = useState(false)
  const [mapMode, setMapMode] = useState('osm') // 'osm' (resultados verificados) | 'google' (búsqueda en Google Maps)

  const isLastStep = currentStep === STEPS.length
  const isFirstStep = currentStep === 1
  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100

  const updateField = (section, field, value) => {
    setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  // Enriquecimiento automático y prudente: solo Wikidata, y solo cuando OSM
  // aporta un ID Q que garantiza que el teléfono pertenece a esa misma entidad.
  useEffect(() => {
    let cancelled = false
    const pending = searchResults.filter((result) => !result.phone && result.wikidata)

    pending.forEach((result) => {
      lookupAutomaticPhone(result).then((lookup) => {
        if (cancelled || lookup?.status !== 'found') return
        setPhoneLookups((prev) => ({ ...prev, [result.id]: lookup }))
      })
    })

    return () => { cancelled = true }
  }, [searchResults])

  const getPhoneState = (result) => {
    if (result.phone) {
      return {
        status: 'found',
        phone: result.phone,
        phoneHref: result.phoneHref,
        phoneSource: result.phoneSource,
      }
    }
    return phoneLookups[result.id] || { status: 'idle' }
  }

  const handlePhoneLookup = async (result) => {
    if (phoneLookups[result.id]?.status === 'loading') return

    setPhoneLookups((prev) => ({ ...prev, [result.id]: { status: 'loading' } }))

    try {
      const lookup = await lookupPhoneOnDemand(result)
      setPhoneLookups((prev) => ({ ...prev, [result.id]: lookup }))
    } catch {
      setPhoneLookups((prev) => ({ ...prev, [result.id]: { status: 'error' } }))
    }
  }

  const handlePhoneBatch = async () => {
    const pending = searchResults
      .filter((result) => !result.phone && result.website !== 'No disponible')
      .filter((result) => phoneLookups[result.id]?.status !== 'found')
      .slice(0, 6)

    if (pending.length === 0) return

    setPhoneBatchLoading(true)
    try {
      for (let index = 0; index < pending.length; index += 2) {
        await Promise.all(pending.slice(index, index + 2).map(handlePhoneLookup))
      }
    } finally {
      setPhoneBatchLoading(false)
    }
  }

  const phoneLookupTargets = searchResults.filter(
    (result) => getPhoneState(result).status !== 'found' && result.website !== 'No disponible',
  )

  const validateStep = (step) => {
    const nextErrors = {}
    const required = {
      1: ['location.ciudad'],
      2: ['dog.raza', 'dog.edad', 'dog.peso', 'dog.tamano', 'dog.caracter'],
      3: ['stay.fechaEntrada', 'stay.fechaSalida'],
    }
    ;(required[step] || []).forEach((path) => {
      const [section, field] = path.split('.')
      if (!formData[section][field]) nextErrors[field] = 'Campo obligatorio'
    })
    if (step === 3 && formData.stay.fechaSalida && formData.stay.fechaEntrada && new Date(formData.stay.fechaSalida) < new Date(formData.stay.fechaEntrada)) {
      nextErrors.fechaSalida = 'La salida no puede ser antes de la entrada'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => { if (validateStep(currentStep)) setCurrentStep(p => p + 1) }
  const goBack = () => { setCurrentStep(p => p - 1) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep(currentStep)) return

    setSearchLoading(true)
    setSearchError(null)
    setSubmitted(true)

    try {
      const query = formData.location.ciudad || formData.location.codigoPostal
      if (!query) {
        setSearchError('Es necesario indicar una localidad o código postal')
        setSearchLoading(false)
        return
      }

      // 1. Geocodificar la localidad con Nominatim
      const coords = await geocodeLocation(query)
      if (!coords) {
        setSearchError('No se pudo encontrar la localidad indicada. Intenta con otro nombre o código postal.')
        setSearchLoading(false)
        return
      }

      setSearchCenter(coords)

      // 2. Buscar residencias caninas con Overpass API
      const rawResults = await searchAnimalBoarding(coords.lat, coords.lon, formData.location.radio)
      const normalized = normalizeResults(rawResults, coords)

      // 3. Comprobar el horario de cada residencia para las fechas elegidas.
      // Las que están cerradas en la entrada o la salida no se ofrecen.
      const evaluated = normalized.map((result) => ({
        ...result,
        stayOpening: evaluateStayOpeningHours(
          result.openingHours,
          formData.stay.fechaEntrada,
          formData.stay.fechaSalida,
        ),
      }))

      const visibleResults = evaluated.filter((result) => result.stayOpening.status !== 'closed')

      setSearchResults(visibleResults)
      setHiddenClosedCount(evaluated.length - visibleResults.length)
    } catch (error) {
      console.error('Error en búsqueda:', error)
      setSearchError(
        error?.code === 'OVERPASS_UNAVAILABLE'
          ? 'Los servidores de OpenStreetMap están saturados en este momento. Espera unos segundos y vuelve a intentarlo.'
          : 'Ocurrió un error al buscar residencias. Inténtalo de nuevo más tarde.',
      )
    } finally {
      setSearchLoading(false)
    }
  }

  if (submitted) {
    if (searchLoading) {
      return (
        <section className="search-form-success">
          <button className="search-form-close" onClick={onClose} aria-label="Cerrar">✕</button>
          <div className="success-card">
            <h2>Buscando residencias caninas...</h2>
            <p>Consultando OpenStreetMap para encontrar establecimientos reales cerca de ti.</p>
            <div className="search-loading">Cargando…</div>
          </div>
        </section>
      )
    }

    if (searchError) {
      return (
        <section className="search-form-success">
          <button className="search-form-close" onClick={onClose} aria-label="Cerrar">✕</button>
          <div className="success-card">
            <h2>No se pudieron encontrar resultados</h2>
            <p>{searchError}</p>
            <a
              className="btn-secondary"
              href={googleMapsAreaUrl(searchCenter, formData.location.ciudad)}
              target="_blank"
              rel="noreferrer"
            >
              🗺️ Buscar residencias en Google Maps
            </a>
            <button className="btn-primary" onClick={() => { setSubmitted(false); setSearchError(null); setCurrentStep(1) }}>Volver a intentar</button>
          </div>
        </section>
      )
    }

    if (searchResults.length === 0) {
      return (
        <section className="search-form-success">
          <button className="search-form-close" onClick={onClose} aria-label="Cerrar">✕</button>
          <div className="success-card">
            <h2>No se encontraron residencias disponibles</h2>
            {hiddenClosedCount > 0 ? (
              <>
                <p>
                  Se encontraron {hiddenClosedCount} residencia(s) en OpenStreetMap, pero su horario
                  indica que están cerradas el {formatDateEs(formData.stay.fechaEntrada)} o el{' '}
                  {formatDateEs(formData.stay.fechaSalida)}, las fechas de tu estancia.
                </p>
                <p>Prueba con otras fechas para ver más opciones.</p>
              </>
            ) : (
              <>
                <p>No se encontraron establecimientos de tipo <em>animal_boarding</em> en OpenStreetMap dentro del radio seleccionado para esta localidad.</p>
                <p>Esto puede deberse a que aún no hay residencias caninas mapeadas en OpenStreetMap para esa zona.</p>
              </>
            )}
            <a
              className="btn-secondary"
              href={googleMapsAreaUrl(searchCenter, formData.location.ciudad)}
              target="_blank"
              rel="noreferrer"
            >
              🗺️ Buscar residencias en Google Maps
            </a>
            <button className="btn-primary" onClick={() => { setSubmitted(false); setCurrentStep(1); setHiddenClosedCount(0) }}>Volver a intentar</button>
          </div>
        </section>
      )
    }

    return (
      <section className="search-form-success">
        <button className="search-form-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="success-card success-card--results">
          <h2>Residencias caninas encontradas</h2>
          <p>
            Se encontraron {searchResults.length} establecimiento(s) real(es) en OpenStreetMap dentro de{' '}
            {formData.location.radio} km para las fechas {formatDateEs(formData.stay.fechaEntrada)} –{' '}
            {formatDateEs(formData.stay.fechaSalida)}, ordenados por cercanía. Solo se muestran los que
            están abiertos esos días según su horario. Los teléfonos se muestran solo cuando proceden
            de una fuente verificable.
          </p>
          {hiddenClosedCount > 0 && (
            <p className="results-note">
              {hiddenClosedCount} residencia(s) no se muestran porque su horario indica que están
              cerradas en las fechas elegidas.
            </p>
          )}

          <div className="results-container">
            {/* Mapa */}
            <div className="map-panel">
              <div className="map-panel-header">
                <h3 className="map-title">Mapa de residencias</h3>
                <div className="map-toggle" role="group" aria-label="Tipo de mapa">
                  <button
                    type="button"
                    className={`map-toggle-btn ${mapMode === 'osm' ? 'active' : ''}`}
                    onClick={() => setMapMode('osm')}
                  >
                    Verificados (OSM)
                  </button>
                  <button
                    type="button"
                    className={`map-toggle-btn ${mapMode === 'google' ? 'active' : ''}`}
                    onClick={() => setMapMode('google')}
                  >
                    Google Maps
                  </button>
                </div>
              </div>

              {mapMode === 'osm' ? (
                <>
                  <MapView
                    results={searchResults}
                    centerPoint={searchCenter}
                    radiusKm={formData.location.radio}
                    onSelectResult={setSelectedResult}
                    selectedResult={selectedResult}
                  />
                  {selectedResult && (
                    <button
                      className="btn-secondary map-reset"
                      onClick={() => setSelectedResult(null)}
                    >
                      Ver todas en el mapa
                    </button>
                  )}
                </>
              ) : (
                <>
                  <GoogleMapEmbed
                    centerPoint={searchCenter}
                    city={formData.location.ciudad}
                    radiusKm={formData.location.radio}
                    selectedResult={selectedResult}
                  />
                  {selectedResult && (
                    <button
                      className="btn-secondary map-reset"
                      onClick={() => setSelectedResult(null)}
                    >
                      Ver zona completa
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Lista de resultados */}
            <div className="list-panel">
              <h3 className="list-title">Listado de establecimientos</h3>
              <div className="results-list">
                {searchResults.map((r) => {
                  const phoneState = getPhoneState(r)
                  const hasWebsite = r.website && r.website !== 'No disponible'
                  const websiteUrl = hasWebsite ? withProtocol(r.website) : null
                  const phoneSourceUrl = phoneState.phoneSource?.startsWith('OpenStreetMap')
                    ? `https://www.openstreetmap.org/${r.osmType}/${r.osmId}`
                    : phoneState.sourceUrl

                  return (
                    <div
                      key={r.id}
                      className={`result-card ${selectedResult?.id === r.id ? 'selected' : ''}`}
                      onClick={() => {
                        if (r.hasCoordinates) setSelectedResult(r)
                      }}
                    >
                      <div className="result-header">
                        <h3>{r.name}</h3>
                        <span className="result-source">{r.source}</span>
                      </div>
                      <p className="result-address">📍 {r.address}</p>

                      {phoneState.status === 'found' ? (
                        <div className="result-phone-block">
                          <p className="result-phone result-phone--found">
                            <a
                              className="result-phone-link"
                              href={`tel:${phoneState.phoneHref}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              📞 {phoneState.phone}
                            </a>
                          </p>
                          {phoneSourceUrl ? (
                            <a
                              className="phone-source"
                              href={phoneSourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Fuente: {phoneState.phoneSource}
                            </a>
                          ) : (
                            <span className="phone-source">Fuente: {phoneState.phoneSource}</span>
                          )}
                        </div>
                      ) : (
                        <div className="result-phone-block">
                          <p className="result-phone result-phone--missing">📞 Teléfono no disponible</p>
                          {phoneState.status === 'loading' && (
                            <span className="phone-lookup-note">Buscando teléfono…</span>
                          )}
                          {phoneState.status === 'blocked' && (
                            <span className="phone-lookup-note">La web oficial bloquea la consulta desde el navegador.</span>
                          )}
                          {phoneState.status === 'timeout' && (
                            <span className="phone-lookup-note">La web oficial no respondió a tiempo.</span>
                          )}
                          {phoneState.status === 'not-found' && (
                            <span className="phone-lookup-note">No se encontró un teléfono verificable.</span>
                          )}
                          {phoneState.status === 'http-error' && (
                            <span className="phone-lookup-note">No se pudo acceder a la web oficial.</span>
                          )}
                          {phoneState.status === 'not-html' && (
                            <span className="phone-lookup-note">La web oficial no devolvió una página consultable.</span>
                          )}
                          {phoneState.status === 'error' && (
                            <span className="phone-lookup-note">No se pudo completar la búsqueda del teléfono.</span>
                          )}
                          {hasWebsite && phoneState.status !== 'loading' && (
                            <button
                              className="phone-lookup-btn"
                              onClick={(event) => {
                                event.stopPropagation()
                                handlePhoneLookup(r)
                              }}
                            >
                              Buscar en su web
                            </button>
                          )}
                        </div>
                      )}

                      {hasWebsite ? (
                        <p className="result-website">
                          🌐{' '}
                          <a
                            href={websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {r.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                          </a>
                        </p>
                      ) : (
                        <p className="result-website">🌐 Web no disponible</p>
                      )}

                      <p className="result-animals">🐾 Animales: {r.animals.length > 0 ? r.animals.join(', ') : 'No especificado'}</p>

                      <div className="result-hours-block">
                        <p className="result-hours">
                          🕒 Horario: {r.openingHours || 'No disponible en OpenStreetMap'}
                        </p>
                        <p className={`stay-badge stay-badge--${r.stayOpening?.status || 'unknown'}`}>
                          {r.stayOpening?.status === 'open'
                            ? r.stayOpening.label
                            : 'Sin datos de horario: confirma con la residencia'}
                        </p>
                      </div>

                      <p className="result-price">
                        💶 {r.price ? (
                          <>
                            Precio: <strong>{r.price}</strong>{' '}
                            <span className="price-source">Fuente: {r.priceSource}</span>
                          </>
                        ) : (
                          'Consultar precio'
                        )}
                      </p>

                      {r.hasCoordinates ? (
                        <>
                          <p className="result-coords">🗺️ {r.lat.toFixed(4)}, {r.lon.toFixed(4)}</p>
                          <p className="result-distance">
                            📏 {r.distanceKm != null
                              ? `${r.distanceKm.toFixed(1)} km del centro de búsqueda`
                              : `Radio búsqueda: ${formData.location.radio} km`}
                          </p>
                        </>
                      ) : (
                        <p className="result-coords">🗺️ Coordenadas: No disponibles</p>
                      )}
                      <p className="result-osm">ID OSM: {r.osmType}/{r.osmId}</p>
                      <p className="result-maps-links">
                        <a
                          href={googleMapsPlaceUrl(r)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          🗺️ Ver en Google Maps
                        </a>
                        <span aria-hidden="true">·</span>
                        <a
                          href={googleMapsDirectionsUrl(r)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          🧭 Cómo llegar
                        </a>
                      </p>
                    </div>
                  )
                })}
              </div>

              {phoneLookupTargets.length > 0 && (
                <>
                  <button
                    className="btn-secondary phone-batch-btn"
                    onClick={handlePhoneBatch}
                    disabled={phoneBatchLoading}
                  >
                    {phoneBatchLoading
                      ? 'Consultando webs oficiales…'
                      : `Buscar teléfonos en webs oficiales (${phoneLookupTargets.length})`}
                  </button>
                  <p className="phone-disclaimer">
                    La consulta a webs oficiales solo se realiza cuando la pides. Muchas webs bloquean
                    el acceso desde el navegador; en ese caso no se muestra ningún número inventado.
                  </p>
                </>
              )}

              <a
                className="btn-secondary google-maps-btn"
                href={googleMapsAreaUrl(searchCenter, formData.location.ciudad)}
                target="_blank"
                rel="noreferrer"
              >
                🗺️ Buscar más residencias en Google Maps
              </a>

              <button className="btn-primary" onClick={() => { setSubmitted(false); setCurrentStep(1); setSearchResults([]); setSelectedResult(null); setSearchCenter(null); setPhoneLookups({}); setHiddenClosedCount(0); setMapMode('osm') }}>Volver al inicio</button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="search-form-overlay" role="dialog" aria-modal="true">
      <div className="search-form-container">
        <button className="search-form-close" onClick={onClose} aria-label="Cerrar">✕</button>

        <div className="search-form-header">
          <h2>Encuentra la residencia perfecta</h2>
          <p>Responde unas preguntas rápidas sobre tu perro y te mostraremos las mejores opciones.</p>
        </div>

        <div className="search-form-progress">
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="progress-steps">
            {STEPS.map(s => (
              <div key={s.id} className={`progress-step ${currentStep > s.id ? 'completed' : ''} ${currentStep === s.id ? 'active' : ''}`}>
                <span className="step-number">{s.id}</span><span className="step-label">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="search-form-content">
          {currentStep === 1 && <StepLocation updateField={updateField} formData={formData} errors={errors} />}
          {currentStep === 2 && <StepDog updateField={updateField} formData={formData} errors={errors} />}
          {currentStep === 3 && <StepStay updateField={updateField} formData={formData} errors={errors} />}
          {currentStep === 4 && <StepSummary formData={formData} />}
        </div>

        <div className="search-form-actions">
          {!isFirstStep && <button className="btn-secondary" onClick={goBack}>← Atrás</button>}
          {!isLastStep ? <button className="btn-primary" onClick={goNext}>Siguiente →</button> : <button className="btn-primary" onClick={handleSubmit}>Ver resultados →</button>}
        </div>
      </div>
    </section>
  )
}
function FieldError({ message }) {
  if (!message) return null
  return <p className="form-error" role="alert">{message}</p>
}

function StepLocation({ updateField, formData, errors }) {
  return (
    <div className="form-step">
      <h3>1. ¿Dónde buscas?</h3>
      <div className="form-group">
        <label>Localidad o código postal</label>
        <input
          type="text"
          placeholder="Ej. Madrid o 28001"
          value={formData.location.ciudad}
          onChange={e => updateField('location', 'ciudad', e.target.value)}
          aria-invalid={Boolean(errors.ciudad)}
        />
        <FieldError message={errors.ciudad} />
      </div>
      <div className="form-group"><label>Radio de búsqueda</label>
        <div className="radio-group">
          {RADIOS.map(r => <button key={r} className={`radio-btn ${formData.location.radio === r ? 'active' : ''}`} onClick={() => updateField('location', 'radio', r)}>{r} km</button>)}
        </div>
      </div>
    </div>
  )
}

function StepDog({ updateField, formData, errors }) {
  return (
    <div className="form-step">
      <h3>2. Cuéntanos sobre tu perro</h3>
      <div className="form-grid">
        <div className="form-group"><label>Nombre (opcional)</label><input type="text" placeholder="Nombre" value={formData.dog.nombre} onChange={e => updateField('dog', 'nombre', e.target.value)} /></div>
        <div className="form-group">
          <label>Raza</label>
          <input type="text" placeholder="Labrador, Golden..." value={formData.dog.raza} onChange={e => updateField('dog', 'raza', e.target.value)} aria-invalid={Boolean(errors.raza)} />
          <FieldError message={errors.raza} />
        </div>
        <div className="form-group">
          <label>Edad (años)</label>
          <input type="number" min="0" max="30" value={formData.dog.edad} onChange={e => updateField('dog', 'edad', e.target.value)} aria-invalid={Boolean(errors.edad)} />
          <FieldError message={errors.edad} />
        </div>
        <div className="form-group">
          <label>Peso (kg)</label>
          <input type="number" min="0" max="100" value={formData.dog.peso} onChange={e => updateField('dog', 'peso', e.target.value)} aria-invalid={Boolean(errors.peso)} />
          <FieldError message={errors.peso} />
        </div>
        <div className="form-group">
          <label>Tamaño</label>
          <select value={formData.dog.tamano} onChange={e => updateField('dog', 'tamano', e.target.value)} aria-invalid={Boolean(errors.tamano)}><option value="">Seleccionar</option>{TAMAÑOS.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <FieldError message={errors.tamano} />
        </div>
        <div className="form-group">
          <label>Carácter</label>
          <select value={formData.dog.caracter} onChange={e => updateField('dog', 'caracter', e.target.value)} aria-invalid={Boolean(errors.caracter)}><option value="">Seleccionar</option>{CARACTERES.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <FieldError message={errors.caracter} />
        </div>
      </div>
    </div>
  )
}
function StepStay({ updateField, formData, errors }) {
  return (
    <div className="form-step">
      <h3>3. Fechas de la estancia</h3>
      <p className="step-hint">
        Con estas fechas comprobaremos qué residencias están abiertas según su horario.
      </p>
      <div className="form-grid">
        <div className="form-group">
          <label>Fecha entrada</label>
          <input type="date" value={formData.stay.fechaEntrada} onChange={e => updateField('stay', 'fechaEntrada', e.target.value)} aria-invalid={Boolean(errors.fechaEntrada)} />
          <FieldError message={errors.fechaEntrada} />
        </div>
        <div className="form-group">
          <label>Fecha salida</label>
          <input type="date" value={formData.stay.fechaSalida} onChange={e => updateField('stay', 'fechaSalida', e.target.value)} aria-invalid={Boolean(errors.fechaSalida)} />
          <FieldError message={errors.fechaSalida} />
        </div>
      </div>
    </div>
  )
}

function StepSummary({ formData }) {
  const noches = (() => {
    if (!formData.stay.fechaEntrada || !formData.stay.fechaSalida) return null
    const entry = new Date(`${formData.stay.fechaEntrada}T12:00:00`)
    const exit = new Date(`${formData.stay.fechaSalida}T12:00:00`)
    const diff = Math.round((exit - entry) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  })()

  return (
    <div className="form-step summary-step">
      <h3>4. Revisa tus datos</h3>
      <div className="summary-grid">
        <div className="summary-card"><h4>Ubicación</h4><p><strong>Localidad:</strong> {formData.location.ciudad || '—'}</p><p><strong>Radio:</strong> {formData.location.radio} km</p></div>
        <div className="summary-card"><h4>Tu perro</h4><p><strong>Nombre:</strong> {formData.dog.nombre || '—'}</p><p><strong>Raza:</strong> {formData.dog.raza || '—'}</p><p><strong>Edad:</strong> {formData.dog.edad} años</p><p><strong>Peso:</strong> {formData.dog.peso} kg</p><p><strong>Tamaño:</strong> {formData.dog.tamano || '—'}</p><p><strong>Carácter:</strong> {formData.dog.caracter || '—'}</p></div>
        <div className="summary-card"><h4>Estancia</h4><p><strong>Entrada:</strong> {formatDateEs(formData.stay.fechaEntrada)}</p><p><strong>Salida:</strong> {formatDateEs(formData.stay.fechaSalida)}</p>{noches != null && <p><strong>Duración:</strong> {noches} noche(s)</p>}</div>
      </div>
    </div>
  )
}