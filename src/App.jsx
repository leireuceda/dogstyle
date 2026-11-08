import { useState } from 'react'
import './index.css'
import SearchForm from './components/SearchForm'

import heroDog from './assets/images/hero-dog.webp'
import heroInset from './assets/images/hero-inset.webp'
import stepLocation from './assets/images/step-location.webp'
import stepDog from './assets/images/step-dog.webp'
import stepResidence from './assets/images/step-residence.webp'
import benefitPlay from './assets/images/benefit-play.webp'
import benefitWalk from './assets/images/benefit-walk.webp'
import benefitRest from './assets/images/benefit-rest.webp'
import benefitCare from './assets/images/benefit-care.webp'
import aboutMain from './assets/images/about-main.webp'
import aboutSmall1 from './assets/images/about-small-1.webp'
import aboutSmall2 from './assets/images/about-small-2.webp'
import ctaDog from './assets/images/cta-dog.webp'

const SECTIONS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'ventajas', label: 'Nuestras ventajas' },
  { id: 'sobre-nosotros', label: 'Sobre nosotros' },
]

const STEPS = [
  {
    image: stepLocation,
    alt: 'Perro al aire libre',
    title: 'Selecciona tu zona',
    text: 'Indica la localidad o el código postal donde buscas y el radio de distancia. Nuestro mapa te muestra todas las opciones cercanas.',
  },
  {
    image: stepDog,
    alt: 'Retrato de un perro',
    title: 'Cuéntanos sobre tu perro',
    text: 'Describe su raza, edad, tamaño, carácter y necesidades especiales, así como las fechas y el presupuesto de la estancia.',
  },
  {
    image: stepResidence,
    alt: 'Perro descansando en un espacio acogedor',
    title: 'Encuentra la residencia ideal',
    text: 'Consultamos OpenStreetMap y te mostramos residencias reales con su dirección, contacto, ubicación y servicios disponibles.',
  },
]

const BENEFITS = [
  {
    image: benefitPlay,
    alt: 'Perros jugando juntos',
    title: 'Recomendaciones personalizadas',
    text: 'DOGSTYLE tiene en cuenta las características y necesidades de tu perro para ayudarte a elegir la residencia más adecuada.',
  },
  {
    image: benefitWalk,
    alt: 'Perro durante un paseo',
    title: 'Residencias reales',
    text: 'Los resultados proceden de OpenStreetMap, con establecimientos localizados en un radio real alrededor de la zona que elijas.',
  },
  {
    image: benefitCare,
    alt: 'Perro recibiendo cuidado',
    title: 'Comparación de servicios',
    text: 'Consulta la dirección, el teléfono, la web y los animales admitidos de cada residencia antes de tomar una decisión.',
  },
  {
    image: benefitRest,
    alt: 'Perro descansando',
    title: 'Mapa y búsqueda inteligente',
    text: 'Visualiza cada residencia en el mapa, ajusta el radio de búsqueda y localiza las opciones que están más cerca de ti.',
  },
]

function PawIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="17" cy="26" rx="6" ry="7.6" transform="rotate(-28 17 26)" />
      <ellipse cx="27" cy="18" rx="6" ry="7.8" transform="rotate(-8 27 18)" />
      <ellipse cx="37" cy="18" rx="6" ry="7.8" transform="rotate(8 37 18)" />
      <ellipse cx="47" cy="26" rx="6" ry="7.6" transform="rotate(28 47 26)" />
      <path d="M32 30c8.4 0 14.5 5.9 14.5 12.9 0 6.1-5.5 10.4-14.5 10.4s-14.5-4.3-14.5-10.4C17.5 35.9 23.6 30 32 30Z" />
    </svg>
  )
}

function App() {
  const [activeSection, setActiveSection] = useState('inicio')
  const [showSearchForm, setShowSearchForm] = useState(false)

  const scrollToSection = (id) => {
    setActiveSection(id)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      {/* ========== HEADER ========== */}
      <header className="header">
        <div className="header-inner">
          <a
            className="logo"
            href="#inicio"
            aria-label="DOGSTYLE, volver al inicio"
            onClick={(event) => {
              event.preventDefault()
              scrollToSection('inicio')
            }}
          >
            <span className="logo-mark">
              <PawIcon />
            </span>
            <span className="logo-text">
              DOGSTYLE
              <small>Residencias caninas</small>
            </span>
          </a>

          <nav className="main-nav" aria-label="Navegación principal">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`nav-link ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => scrollToSection(section.id)}
                aria-current={activeSection === section.id ? 'page' : undefined}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <button
            className="btn-primary header-cta"
            onClick={() => setShowSearchForm(true)}
          >
            Encontrar su residencia
          </button>
        </div>
      </header>

      <main>
        {/* ========== HERO / INICIO ========== */}
        <section id="inicio" className="hero">
          <div className="hero-blob" aria-hidden="true" />

          <div className="hero-inner">
            <div className="hero-text">
              <span className="eyebrow">Residencias caninas de confianza</span>
              <h1>
                El lugar perfecto para <em>tu mejor amigo</em>
              </h1>
              <p>
                DOGSTYLE te ayuda a encontrar hoteles y residencias caninas que se adapten
                a las necesidades de tu perro. Espacios acogedores, seguros y pensados para
                mascotas, con datos reales de OpenStreetMap.
              </p>

              <div className="hero-actions">
                <button
                  className="btn-primary"
                  onClick={() => setShowSearchForm(true)}
                >
                  Encuentra su residencia
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => scrollToSection('como-funciona')}
                >
                  Cómo funciona
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              <ul className="hero-trust">
                <li>
                  <strong>Datos reales</strong>
                  <span>OpenStreetMap</span>
                </li>
                <li>
                  <strong>Búsqueda por radio</strong>
                  <span>Hasta 100 km</span>
                </li>
                <li>
                  <strong>6 pasos</strong>
                  <span>100 % personalizado</span>
                </li>
              </ul>
            </div>

            <div className="hero-visual">
              <div className="hero-photo-main">
                <img
                  src={heroDog}
                  alt="Perro mirando a cámara en un entorno cálido"
                  className="hero-image"
                />
              </div>

              <div className="hero-photo-inset">
                <img src={heroInset} alt="Perro junto a una persona" loading="lazy" />
              </div>

              <div className="hero-badge">
                <span className="hero-badge-icon">
                  <PawIcon />
                </span>
                <div>
                  <strong>Residencias reales en el mapa</strong>
                  <span>Datos abiertos de OpenStreetMap</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== CÓMO FUNCIONA ========== */}
        <section id="como-funciona" className="section section--steps">
          <div className="section-inner">
            <div className="section-head">
              <span className="eyebrow">Así de fácil</span>
              <h2>Cómo funciona DOGSTYLE</h2>
              <p>
                Encontrar la residencia canina ideal es tan sencillo como responder unas
                preguntas sobre tu perro.
              </p>
            </div>

            <div className="steps-grid">
              {STEPS.map((step, index) => (
                <article className="step" key={step.title}>
                  <div className="step-media">
                    <img src={step.image} alt={step.alt} loading="lazy" />
                  </div>
                  <div className="step-body">
                    <span className="step-number">{index + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ========== NUESTRAS VENTAJAS ========== */}
        <section id="ventajas" className="section section--benefits">
          <div className="section-inner">
            <div className="section-head">
              <span className="eyebrow">Pensado para ti</span>
              <h2>Nuestras ventajas</h2>
              <p>
                Una búsqueda pensada para que aciertes con el lugar donde dejarás a tu
                mejor amigo.
              </p>
            </div>

            <div className="features-grid">
              {BENEFITS.map((benefit) => (
                <article className="feature-card" key={benefit.title}>
                  <div className="feature-media">
                    <img src={benefit.image} alt={benefit.alt} loading="lazy" />
                  </div>
                  <div className="feature-body">
                    <h3>{benefit.title}</h3>
                    <p>{benefit.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ========== SOBRE NOSOTROS ========== */}
        <section id="sobre-nosotros" className="section section--about">
          <div className="section-inner about-content">
            <div className="about-visual">
              <img
                className="about-main"
                src={aboutMain}
                alt="Perro acompañado por una persona"
                loading="lazy"
              />
              <img
                className="about-small"
                src={aboutSmall1}
                alt="Perro al aire libre"
                loading="lazy"
              />
              <img
                className="about-small"
                src={aboutSmall2}
                alt="Retrato de un perro"
                loading="lazy"
              />
            </div>

            <div className="about-text">
              <span className="eyebrow">Sobre nosotros</span>
              <h2>Un lugar para cada perro</h2>
              <p className="about-lead">
                DOGSTYLE nace con un objetivo claro: facilitar a los dueños la búsqueda de
                residencias caninas de confianza para sus perros.
              </p>

              <div className="about-values">
                <div className="about-value">
                  <span className="about-value-icon">
                    <PawIcon />
                  </span>
                  <div>
                    <h3>Pasión por el bienestar canino</h3>
                    <p>
                      Sabemos lo importante que es encontrar un lugar seguro, cómodo y
                      adaptado a cada animal.
                    </p>
                  </div>
                </div>

                <div className="about-value">
                  <span className="about-value-icon">
                    <PawIcon />
                  </span>
                  <div>
                    <h3>Información abierta y transparente</h3>
                    <p>
                      Mostramos establecimientos reales y su ubicación a partir de los
                      datos geográficos de OpenStreetMap, sin inventar resultados ni
                      valoraciones.
                    </p>
                  </div>
                </div>

                <div className="about-value">
                  <span className="about-value-icon">
                    <PawIcon />
                  </span>
                  <div>
                    <h3>Pensado para cada perro</h3>
                    <p>
                      El formulario recoge su tamaño, carácter, necesidades y las fechas
                      de la estancia para que encuentres la opción que mejor encaje.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== CTA ========== */}
        <section id="cta" className="cta">
          <div className="cta-inner">
            <div className="cta-copy">
              <span className="eyebrow eyebrow--light">Empieza hoy</span>
              <h2>¿Listo para encontrar su residencia?</h2>
              <p>
                Explora las residencias caninas disponibles y encuentra el lugar perfecto
                para tu mejor amigo.
              </p>
              <button
                className="btn-primary btn-primary--light"
                onClick={() => setShowSearchForm(true)}
              >
                Comenzar búsqueda
              </button>
              <span className="cta-note">Gratis · Sin registro · Datos reales</span>
            </div>

            <div className="cta-media">
              <img
                src={ctaDog}
                alt="Perro al aire libre"
                loading="lazy"
              />
            </div>
          </div>
        </section>
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="logo">
              <span className="logo-mark">
                <PawIcon />
              </span>
              <span className="logo-text">
                DOGSTYLE
                <small>Residencias caninas</small>
              </span>
            </div>
            <p>
              La forma más sencilla de encontrar un lugar de confianza para tu perro,
              con información real y transparente.
            </p>
          </div>

          <div className="footer-nav">
            <h3>Navegación</h3>
            <div className="footer-links">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(event) => {
                    event.preventDefault()
                    scrollToSection(section.id)
                  }}
                >
                  {section.label}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-info">
            <h3>Datos abiertos</h3>
            <p>
              Las residencias mostradas proceden de OpenStreetMap y se localizan en un
              radio real alrededor de la zona que elijas. No inventamos establecimientos
              ni valoraciones.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-attribution">
            Datos de residencias: ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>{' '}
            contributors (ODbL).
          </p>
          <p className="footer-credit">
            Fotografías de perros:{' '}
            <a
              href="https://unsplash.com/license"
              target="_blank"
              rel="noreferrer"
            >
              Unsplash
            </a>
            .
          </p>
        </div>
      </footer>

      {showSearchForm && <SearchForm onClose={() => setShowSearchForm(false)} />}
    </>
  )
}

export default App
