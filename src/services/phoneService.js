// ========== SERVICIO DE TELÉFONOS — DOGSTYLE ==========
// Fuentes gratuitas y legales:
// 1. OpenStreetMap (tags phone, contact:phone, contact:mobile y mobile) — ODbL.
// 2. Web oficial de la residencia — solo si el navegador permite la consulta (CORS).
// 3. Wikidata (propiedad P1329) — CC0, únicamente si la residencia tiene un ID Q vinculado en OSM.
//
// No se consultan Google Maps, Google Places ni directorios que prohíban la reutilización.
// No se hacen consultas masivas: la web oficial solo se consulta a petición del usuario.

const CACHE_TTL = 30 * 60 * 1000
const FETCH_TIMEOUT = 8000
const MAX_CONTACT_PAGES = 2
const cache = new Map()

const OSM_PHONE_TAGS = [
  { tag: 'phone', label: 'OpenStreetMap (phone)' },
  { tag: 'contact:phone', label: 'OpenStreetMap (contact:phone)' },
  { tag: 'contact:mobile', label: 'OpenStreetMap (contact:mobile)' },
  { tag: 'mobile', label: 'OpenStreetMap (mobile)' },
]

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function cacheSet(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

function groupDigits(digits) {
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ')
}

function makeSpanishPhone(nationalDigits) {
  return {
    e164: `+34${nationalDigits}`,
    display: `+34 ${groupDigits(nationalDigits)}`,
    href: `+34${nationalDigits}`,
  }
}

function isSpanishNationalNumber(digits) {
  return /^[6789]\d{8}$/.test(digits)
}

/**
 * Normaliza y valida un teléfono. Acepta formatos españoles e internacionales.
 * Devuelve null si el valor no parece un número real (por ejemplo, "yes").
 */
export function normalizePhone(raw) {
  if (raw == null) return null

  const text = String(raw).replace(/\u00a0/g, ' ')
  const candidates = text.split(/[;/,|]|(?:\s+y\s+)/i)

  for (const candidate of candidates) {
    let cleaned = candidate.replace(/[^\d+]/g, '')
    if (!cleaned) continue

    if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`

    if (cleaned.startsWith('+')) {
      const digits = cleaned.slice(1)
      if (!/^\d{8,15}$/.test(digits)) continue

      if (digits.startsWith('34') && digits.length === 11) {
        const national = digits.slice(2)
        if (isSpanishNationalNumber(national)) return makeSpanishPhone(national)
      }

      return {
        e164: `+${digits}`,
        display: `+${groupDigits(digits)}`,
        href: `+${digits}`,
      }
    }

    if (cleaned.startsWith('34') && cleaned.length === 11) {
      const national = cleaned.slice(2)
      if (isSpanishNationalNumber(national)) return makeSpanishPhone(national)
    }

    if (isSpanishNationalNumber(cleaned)) {
      return makeSpanishPhone(cleaned)
    }
  }

  return null
}

/**
 * Extrae el primer teléfono válido de los tags de OpenStreetMap,
 * respetando el orden de prioridad solicitado.
 */
export function extractOsmPhone(tags = {}) {
  for (const { tag, label } of OSM_PHONE_TAGS) {
    const normalized = normalizePhone(tags[tag])
    if (normalized) {
      return {
        phone: normalized.display,
        phoneHref: normalized.href,
        phoneSource: label,
        phoneTag: tag,
      }
    }
  }

  return { phone: null, phoneHref: null, phoneSource: null, phoneTag: null }
}

/**
 * Extrae una tarifa publicada en OSM si existe. No se inventan precios.
 * El tag "charge" es el estándar de facto para importes; "price" se acepta
 * como variante por si algún mapeador lo ha usado.
 */
export function extractPrice(tags = {}) {
  for (const tag of ['charge', 'price']) {
    const value = tags[tag]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed || /^(no|false|ninguno|gratis|0)$/i.test(trimmed)) continue
    return {
      price: trimmed.slice(0, 80),
      priceSource: 'OpenStreetMap',
      priceTag: tag,
    }
  }

  return { price: null, priceSource: null, priceTag: null }
}

function absoluteHttpUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

function normalizeWebsiteUrl(value) {
  if (!value || value === 'No disponible') return null
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return absoluteHttpUrl(withProtocol)
}

function normalizeTelHref(value) {
  if (!value) return null
  return normalizePhone(decodeURIComponent(value).replace(/^tel:/i, ''))
}

function findTelephoneInJsonLd(node) {
  if (node == null) return null

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findTelephoneInJsonLd(item)
      if (found) return found
    }
    return null
  }

  if (typeof node !== 'object') return null

  for (const [key, value] of Object.entries(node)) {
    if (key.toLowerCase() === 'telephone') {
      const normalized = normalizePhone(value)
      if (normalized) return normalized
    }
    const found = findTelephoneInJsonLd(value)
    if (found) return found
  }

  return null
}

function extractPhoneFromDocument(doc) {
  // 1. Enlaces tel: (la señal más fiable dentro de una web oficial).
  for (const anchor of doc.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href') || ''
    if (!/^tel:/i.test(href)) continue
    const normalized = normalizeTelHref(href)
    if (normalized) return normalized
  }

  // 2. Datos estructurados schema.org (JSON-LD).
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent || '')
      const normalized = findTelephoneInJsonLd(parsed)
      if (normalized) return normalized
    } catch {
      // JSON-LD inválido: se ignora.
    }
  }

  // 3. Texto visible, solo si el número aparece junto a términos de contacto.
  const text = doc.body?.textContent || ''
  const phonePattern = /(?:\+34[\s.-]?)?(?:6|7|8|9)\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/g
  let match

  while ((match = phonePattern.exec(text)) !== null) {
    const context = text
      .slice(Math.max(0, match.index - 90), Math.min(text.length, match.index + match[0].length + 90))
      .toLowerCase()

    if (!/tel[eé]fono|tel\.|contacto|ll[aá]ma|whatsapp/.test(context)) continue

    const normalized = normalizePhone(match[0])
    if (normalized) return normalized
  }

  return null
}

function findContactLinks(doc, baseUrl) {
  const base = new URL(baseUrl)
  const links = []
  const seen = new Set()

  for (const anchor of doc.querySelectorAll('a[href]')) {
    const href = absoluteHttpUrl(anchor.getAttribute('href'), baseUrl)
    if (!href) continue

    const url = new URL(href)
    if (url.hostname !== base.hostname) continue
    if (url.href === base.href) continue

    const label = `${anchor.textContent || ''} ${url.pathname}`.toLowerCase()
    if (!/contacto|contact|aviso-legal|legal/.test(label)) continue
    if (seen.has(url.href)) continue

    seen.add(url.href)
    links.push(url.href)
    if (links.length >= MAX_CONTACT_PAGES) break
  }

  return links
}

async function fetchPage(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
    })

    if (!response.ok) {
      return { status: 'http-error', httpStatus: response.status }
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return { status: 'not-html' }
    }

    const html = await response.text()
    return {
      status: 'ok',
      url: response.url || url,
      doc: new DOMParser().parseFromString(html, 'text/html'),
    }
  } catch (error) {
    if (error?.name === 'AbortError') return { status: 'timeout' }
    return { status: 'blocked' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Consulta la web oficial (página principal + enlaces de contacto).
 * Devuelve un resultado explícito para poder informar al usuario.
 * La mayoría de webs bloquean esta consulta por CORS: en ese caso no se inventa nada.
 */
export async function lookupWebsitePhone(website) {
  const url = normalizeWebsiteUrl(website)
  if (!url) return { status: 'invalid' }

  const cacheKey = `website:${url}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const home = await fetchPage(url)
  if (home.status !== 'ok') {
    const result = { status: home.status, httpStatus: home.httpStatus }
    cacheSet(cacheKey, result)
    return result
  }

  const directPhone = extractPhoneFromDocument(home.doc)
  if (directPhone) {
    const result = {
      status: 'found',
      phone: directPhone.display,
      phoneHref: directPhone.href,
      phoneSource: 'Web oficial',
      sourceUrl: home.url,
    }
    cacheSet(cacheKey, result)
    return result
  }

  for (const contactUrl of findContactLinks(home.doc, home.url)) {
    const page = await fetchPage(contactUrl)
    if (page.status !== 'ok') continue

    const contactPhone = extractPhoneFromDocument(page.doc)
    if (contactPhone) {
      const result = {
        status: 'found',
        phone: contactPhone.display,
        phoneHref: contactPhone.href,
        phoneSource: 'Web oficial (contacto)',
        sourceUrl: page.url,
      }
      cacheSet(cacheKey, result)
      return result
    }
  }

  const result = { status: 'not-found' }
  cacheSet(cacheKey, result)
  return result
}

/**
 * Consulta Wikidata por el ID Q vinculado explícitamente en OSM.
 * Solo se acepta el teléfono de esa misma entidad (propiedad P1329).
 */
export async function lookupWikidataPhone(wikidataId) {
  if (!/^Q\d+$/.test(String(wikidataId || ''))) return null

  const cacheKey = `wikidata:${wikidataId}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(wikidataId)}&props=claims&format=json&origin=*`
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return null

    const data = await response.json()
    const claims = data.entities?.[wikidataId]?.claims?.P1329 || []

    for (const claim of claims) {
      const normalized = normalizePhone(claim.mainsnak?.datavalue?.value)
      if (normalized) {
        const result = {
          status: 'found',
          phone: normalized.display,
          phoneHref: normalized.href,
          phoneSource: 'Wikidata (CC0)',
          sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
        }
        cacheSet(cacheKey, result)
        return result
      }
    }

    const result = { status: 'not-found' }
    cacheSet(cacheKey, result)
    return result
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Enriquecimiento automático y seguro: solo Wikidata cuando OSM aporta
 * un ID Q explícito. La web oficial se consulta aparte, a petición del usuario.
 */
export async function lookupAutomaticPhone(result) {
  if (!result || result.phone) return null
  if (!result.wikidata) return null
  return lookupWikidataPhone(result.wikidata)
}

/**
 * Búsqueda a petición del usuario: primero la web oficial y, si no se puede
 * consultar o no contiene teléfono, Wikidata como fuente abierta de respaldo.
 */
export async function lookupPhoneOnDemand(result) {
  if (!result) return { status: 'not-found' }
  if (result.phone) {
    return {
      status: 'found',
      phone: result.phone,
      phoneHref: result.phoneHref,
      phoneSource: result.phoneSource,
      sourceUrl: result.website !== 'No disponible' ? result.website : undefined,
    }
  }

  let websiteResult = null

  if (result.website && result.website !== 'No disponible') {
    websiteResult = await lookupWebsitePhone(result.website)
    if (websiteResult?.status === 'found') return websiteResult
  }

  if (result.wikidata) {
    const wikidataResult = await lookupWikidataPhone(result.wikidata)
    if (wikidataResult?.status === 'found') return wikidataResult
  }

  if (websiteResult?.status === 'blocked' || websiteResult?.status === 'timeout') {
    return { status: websiteResult.status }
  }

  return { status: 'not-found' }
}
