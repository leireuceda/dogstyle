import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import './index.css'
import SearchForm from './components/SearchForm'

function App() {
  const [activeSection, setActiveSection] = useState('inicio')
  const [showSearchForm, setShowSearchForm] = useState(false)

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <img src={reactLogo} alt="DOGSTYLE logo" className="logo-icon" />
          </div>
          <nav className="main-nav">
            <button
              className={`nav-link ${activeSection === 'inicio' ? 'active' : ''}`}
              onClick={() => { setActiveSection('inicio'); scrollToSection('inicio') }}
            >
              Inicio
            </button>
            <button
              className={`nav-link ${activeSection === 'como-funciona' ? 'active' : ''}`}
              onClick={() => { setActiveSection('como-funciona'); scrollToSection('como-funciona') }}
            >
              Cómo funciona
            </button>
            <button
              className={`nav-link ${activeSection === 'ventajas' ? 'active' : ''}`}
              onClick={() => { setActiveSection('ventajas'); scrollToSection('ventajas') }}
            >
              Nuestras ventajas
            </button>
            <button
              className={`nav-link ${activeSection === 'sobre-nosotros' ? 'active' : ''}`}
              onClick={() => { setActiveSection('sobre-nosotros'); scrollToSection('sobre-nosotros') }}
            >
              Sobre nosotros
            </button>
          </nav>
          <button className="btn-primary" onClick={() => setShowSearchForm(true)}>
            Encontrar su residencia
          </button>
        </div>
      </header>
    </>
  )
}

export default App