import { useState } from 'react'

const STEPS = [
  { id: 1, title: 'Ubicación' },
  { id: 2, title: 'Información del perro' },
  { id: 3, title: 'Necesidades' },
  { id: 4, title: 'Estancia' },
  { id: 5, title: 'Preferencias' },
  { id: 6, title: 'Resumen' },
]

const RADIOS = [5, 10, 20, 30, 50, 100]
const TAMAÑOS = ['Pequeño', 'Mediano', 'Grande', 'Muy grande']
const CARACTERES = ['Tranquilo', 'Juguetón', 'Nervioso', 'Sociable', 'Independiente']
const SERVICIOS = ['Paseos diarios', 'Juegos y estimulación', 'Veterinario 24h', 'Adiestramiento', 'Pelucanería / Baño', 'Cámaras de vigilancia', 'Transporte recogida', 'Alimentación especial']

export default function SearchForm({ onClose }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    location: { ciudad: '', codigoPostal: '', radio: 10 },
    dog: { nombre: '', raza: '', edad: '', peso: '', tamano: '', caracter: '' },
    needs: { sociabilidad: '', actividad: '', necesidadesEspeciales: '', cuidados: '' },
    stay: { fechaEntrada: '', fechaSalida: '', presupuesto: '' },
    preferences: [],
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const isLastStep = currentStep === STEPS.length
  const isFirstStep = currentStep === 1
  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100

  const updateField = (section, field, value) => {
    setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  const togglePreference = (service) => {
    setFormData(prev => {
      const next = [...prev.preferences]
      const idx = next.indexOf(service)
      if (idx === -1) next.push(service); else next.splice(idx, 1)
      return { ...prev, preferences: next }
    })
  }

  const validateStep = (step) => {
    const nextErrors = {}
    const required = {
      1: ['location.ciudad'],
      2: ['dog.raza', 'dog.edad', 'dog.peso', 'dog.tamano', 'dog.caracter'],
      3: ['needs.sociabilidad', 'needs.actividad'],
      4: ['stay.fechaEntrada', 'stay.fechaSalida', 'stay.presupuesto'],
    }
    ;(required[step] || []).forEach((path) => {
      const [section, field] = path.split('.')
      if (!formData[section][field]) nextErrors[field] = 'Campo obligatorio'
    })
    if (step === 4 && formData.stay.fechaSalida && formData.stay.fechaEntrada && new Date(formData.stay.fechaSalida) < new Date(formData.stay.fechaEntrada)) {
      nextErrors.fechaSalida = 'La salida no puede ser antes de la entrada'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => { if (validateStep(currentStep)) setCurrentStep(p => p + 1) }
  const goBack = () => { setCurrentStep(p => p - 1) }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateStep(currentStep)) setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="search-form-success">
        <div className="success-card">
          <h2>¡Búsqueda enviada!</h2>
          <p>Hemos recibido tus datos. En breve te mostraremos las residencias caninas más compatibles.</p>
          <button className="btn-primary" onClick={() => { setSubmitted(false); setCurrentStep(1); onClose() }}>Volver al inicio</button>
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
          {currentStep === 1 && <StepLocation updateField={updateField} formData={formData} />}
          {currentStep === 2 && <StepDog updateField={updateField} formData={formData} />}
          {currentStep === 3 && <StepNeeds updateField={updateField} formData={formData} />}
          {currentStep === 4 && <StepStay updateField={updateField} formData={formData} />}
          {currentStep === 5 && <StepPreferences togglePreference={togglePreference} formData={formData} />}
          {currentStep === 6 && <StepSummary formData={formData} />}
        </div>

        <div className="search-form-actions">
          {!isFirstStep && <button className="btn-secondary" onClick={goBack}>← Atrás</button>}
          {!isLastStep ? <button className="btn-primary" onClick={goNext}>Siguiente →</button> : <button className="btn-primary" onClick={handleSubmit}>Ver resultados →</button>}
        </div>
      </div>
    </section>
  )
}
function StepLocation({ updateField, formData }) {
  return (
    <div className="form-step">
      <h3>1. ¿Dónde buscas?</h3>
      <div className="form-group">
        <label>Localidad o código postal</label>
        <input type="text" placeholder="Ej. Madrid o 28001" value={formData.location.ciudad} onChange={e => updateField('location', 'ciudad', e.target.value)} />
      </div>
      <div className="form-group"><label>Radio de búsqueda</label>
        <div className="radio-group">
          {RADIOS.map(r => <button key={r} className={`radio-btn ${formData.location.radio === r ? 'active' : ''}`} onClick={() => updateField('location', 'radio', r)}>{r} km</button>)}
        </div>
      </div>
    </div>
  )
}

function StepDog({ updateField, formData }) {
  return (
    <div className="form-step">
      <h3>2. Cuéntanos sobre tu perro</h3>
      <div className="form-grid">
        <div className="form-group"><label>Nombre (opcional)</label><input type="text" placeholder="Nombre" value={formData.dog.nombre} onChange={e => updateField('dog', 'nombre', e.target.value)} /></div>
        <div className="form-group"><label>Raza</label><input type="text" placeholder="Labrador, Golden..." value={formData.dog.raza} onChange={e => updateField('dog', 'raza', e.target.value)} /></div>
        <div className="form-group"><label>Edad (años)</label><input type="number" min="0" max="30" value={formData.dog.edad} onChange={e => updateField('dog', 'edad', e.target.value)} /></div>
        <div className="form-group"><label>Peso (kg)</label><input type="number" min="0" max="100" value={formData.dog.peso} onChange={e => updateField('dog', 'peso', e.target.value)} /></div>
        <div className="form-group"><label>Tamaño</label><select value={formData.dog.tamano} onChange={e => updateField('dog', 'tamano', e.target.value)}><option value="">Seleccionar</option>{TAMAÑOS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="form-group"><label>Carácter</label><select value={formData.dog.caracter} onChange={e => updateField('dog', 'caracter', e.target.value)}><option value="">Seleccionar</option>{CARACTERES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
    </div>
  )
}
function StepNeeds({ updateField, formData }) {
  return (
    <div className="form-step">
      <h3>3. Necesidades de tu perro</h3>
      <div className="form-grid">
        <div className="form-group"><label>Sociabilidad</label><select value={formData.needs.sociabilidad} onChange={e => updateField('needs', 'sociabilidad', e.target.value)}><option value="">Seleccionar</option><option>Muy sociable</option><option>Sociable</option><option>Tímido</option><option>Prefiere estar solo</option></select></div>
        <div className="form-group"><label>Actividad</label><select value={formData.needs.actividad} onChange={e => updateField('needs', 'actividad', e.target.value)}><option value="">Seleccionar</option><option>Bajo</option><option>Medio</option><option>Alto</option></select></div>
        <div className="form-group"><label>Necesidades especiales</label><textarea value={formData.needs.necesidadesEspeciales} onChange={e => updateField('needs', 'necesidadesEspeciales', e.target.value)} placeholder="Medicamentos, alergias..." /></div>
        <div className="form-group"><label>Cuidados específicos</label><textarea value={formData.needs.cuidados} onChange={e => updateField('needs', 'cuidados', e.target.value)} placeholder="Dietas, cepillado..." /></div>
      </div>
    </div>
  )
}

function StepStay({ updateField, formData }) {
  return (
    <div className="form-step">
      <h3>4. Detalles de la estancia</h3>
      <div className="form-grid">
        <div className="form-group"><label>Fecha entrada</label><input type="date" value={formData.stay.fechaEntrada} onChange={e => updateField('stay', 'fechaEntrada', e.target.value)} /></div>
        <div className="form-group"><label>Fecha salida</label><input type="date" value={formData.stay.fechaSalida} onChange={e => updateField('stay', 'fechaSalida', e.target.value)} /></div>
        <div className="form-group"><label>Presupuesto máximo/día (€)</label><input type="number" min="0" value={formData.stay.presupuesto} onChange={e => updateField('stay', 'presupuesto', e.target.value)} /></div>
      </div>
    </div>
  )
}
function StepPreferences({ togglePreference, formData }) {
  return (
    <div className="form-step">
      <h3>5. Servicios que te interesan</h3>
      <p className="step-hint">Opcional - selecciona todos los que desees</p>
      <div className="checkbox-grid">
        {SERVICIOS.map(s => <label key={s} className="checkbox-label"><input type="checkbox" checked={formData.preferences.includes(s)} onChange={() => togglePreference(s)} /> {s}</label>)}
      </div>
    </div>
  )
}

function StepSummary({ formData }) {
  return (
    <div className="form-step summary-step">
      <h3>6. Revisa tus datos</h3>
      <div className="summary-grid">
        <div className="summary-card"><h4>Ubicación</h4><p><strong>Localidad:</strong> {formData.location.ciudad || '—'}</p><p><strong>Radio:</strong> {formData.location.radio} km</p></div>
        <div className="summary-card"><h4>Tu perro</h4><p><strong>Nombre:</strong> {formData.dog.nombre || '—'}</p><p><strong>Raza:</strong> {formData.dog.raza || '—'}</p><p><strong>Edad:</strong> {formData.dog.edad} años</p><p><strong>Peso:</strong> {formData.dog.peso} kg</p><p><strong>Tamaño:</strong> {formData.dog.tamano || '—'}</p><p><strong>Carácter:</strong> {formData.dog.caracter || '—'}</p></div>
        <div className="summary-card"><h4>Necesidades</h4><p><strong>Sociabilidad:</strong> {formData.needs.sociabilidad || '—'}</p><p><strong>Actividad:</strong> {formData.needs.actividad || '—'}</p><p><strong>Especiales:</strong> {formData.needs.necesidadesEspeciales || '—'}</p><p><strong>Cuidados:</strong> {formData.needs.cuidados || '—'}</p></div>
        <div className="summary-card"><h4>Estancia</h4><p><strong>Entrada:</strong> {formData.stay.fechaEntrada || '—'}</p><p><strong>Salida:</strong> {formData.stay.fechaSalida || '—'}</p><p><strong>Presupuesto:</strong> {formData.stay.presupuesto} €/día</p></div>
        <div className="summary-card"><h4>Preferencias</h4><p>{formData.preferences.length > 0 ? formData.preferences.join(', ') : 'Ninguna'}</p></div>
      </div>
    </div>
  )
}