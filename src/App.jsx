import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import './index.css'
import SearchForm from './components/SearchForm'

function App() {
  const [activeSection, setActiveSection] = useState('hero')
  const [showSearchForm, setShowSearchForm] = useState(false)

  return (
    <>
      {/* ========== HEADER ========== */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <img src={reactLogo} alt="DOGSTYLE logo" className="logo-icon" />
          </div>
          <nav className="main-nav">
            <button
              className={`nav-link ${activeSection === 'hero' ? 'active' : ''}`}
              onClick={() => setActiveSection('hero')}
            >
              Inicio
            </button>
            <button
              className={`nav-link ${activeSection === 'how-it-works' ? 'active' : ''}`}
              onClick={() => setActiveSection('how-it-works')}
            >
              Cómo funciona
            </button>
            <button
              className={`nav-link ${activeSection === 'features' ? 'active' : ''}`}
              onClick={() => setActiveSection('features')}
            >
              Nuestras ventajas
            </button>
            <button
              className={`nav-link ${activeSection === 'about' ? 'active' : ''}`}
              onClick={() => setActiveSection('about')}
            >
              Sobre nosotros
            </button>
          </nav>
          <button className="btn-primary" onClick={() => setShowSearchForm(true)}>Encontrar su residencia</button>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section id="hero" className="hero">
        <div className="hero-content">
          <img
            src={heroImg}
            alt="Perro feliz en hotel canino"
            className="hero-image"
          />
          <div className="hero-text">
            <h1>El lugar perfecto para tu mejor amigo</h1>
            <p>
              DOGSTYLE es la plataforma definitiva para encontrar hoteles y residencias caninas
              que se adapten a las necesidades de tu perro. Descubre espacios acogedores,
              seguros y diseñados especialmente para mascotas.
            </p>
            <button className="btn-primary" onClick={() => setShowSearchForm(true)}>Encuentra su residencia</button>
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how-it-works" className="how-it-works">
        <h2 className="section-title">¿Cómo funciona DOGSTYLE?</h2>
        <div className="steps-grid">
          <div className="step">
            <h3>1. Selecciona tu zona</h3>
            <p>Elige la ciudad o región donde tu perro querría estar. Nuestro mapa te muestra todas las opciones cercanas.</p>
          </div>
          <div className="step">
            <h3>2. Cuéntanos sobre tu perro</h3>
            <p>Describe la raza, edad, necesidades especiales y tipo de alojamiento que buscas.</p>
          </div>
          <div className="step">
            <h3>3. Encuentra la residencia ideal</h3>
            <p>Recibe recomendaciones personalizadas basadas en tus preferencias y las características de tu mascota.</p>
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section id="features" className="features">
        <h2 className="section-title">Nuestras ventajas</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Recomendaciones personalizadas</h3>
            <p>El algoritmo de DOGSTYLE te sugiere residencias que se ajustan perfectamente a las necesidades de tu perro.</p>
          </div>
          <div className="feature-card">
            <h3>Residencias reales</h3>
            <p>Accede a hoteles y apartamentos caninos verificados y con reseñas de otros dueños.</p>
          </div>
          <div className="feature-card">
            <h3>Comparación de servicios</h3>
            <p>Analiza las opciones disponibles y compara precios, ubicación y servicios antes de decidir.</p>
          </div>
          <div className="feature-card">
            <h3>Búsqueda inteligente</h3>
            <p>Filtra por distancia, tipo de alojamiento y características especiales para tu mascota.</p>
          </div>
        </div>
      </section>

      {/* ========== CALL TO ACTION ========== */}
      <section id="cta" className="cta">
        <h2 className="section-title">Listo para comenzar?</h2>
        <p>Explora nuestras residencias caninas y encuentra el lugar perfecto para tu mejor amigo.</p>
        <button className="btn-primary" onClick={() => setShowSearchForm(true)}>Comenzar búsqueda</button>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="logo">
            <img src={reactLogo} alt="DOGSTYLE logo" className="logo-icon" />
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Inicio</a>
            <a href="#" className="footer-link">Cómo funciona</a>
            <a href="#" className="footer-link">Nuestras ventajas</a>
            <a href="#" className="footer-link">Sobre nosotros</a>
          </div>
        </div>
      </footer>
{showSearchForm && <SearchForm onClose={() => setShowSearchForm(false)} />}
    </>
  )
}

export default App