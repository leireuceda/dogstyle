// ========== HORARIOS OSM — DOGSTYLE ==========
// Interpreta el tag `opening_hours` de OpenStreetMap para comprobar si un
// establecimiento está abierto en las fechas de la estancia.
// No pretende cubrir todo el estándar (es muy amplio), solo los formatos
// habituales: "24/7", "Mo-Fr 09:00-18:00", "Sa 10:00-14:00; Su off", etc.

const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const DAY_INDEX = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 }

const TIME_RANGE_RE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g

function parseDayName(token) {
  const normalized = token.slice(0, 2)
  const key = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
  return DAY_INDEX[key] ?? null
}

function expandDayPart(part) {
  const days = new Set()
  const rangeMatch = part.match(/^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/)

  if (rangeMatch) {
    const from = DAY_ORDER.indexOf(
      rangeMatch[1].charAt(0).toUpperCase() + rangeMatch[1].slice(1).toLowerCase(),
    )
    const to = DAY_ORDER.indexOf(
      rangeMatch[2].charAt(0).toUpperCase() + rangeMatch[2].slice(1).toLowerCase(),
    )
    if (from === -1 || to === -1) return days

    let index = from
    // Rango circular: "Sa-Mo" incluye sábado, domingo y lunes.
    for (let guard = 0; guard < 7; guard += 1) {
      days.add(DAY_INDEX[DAY_ORDER[index]])
      if (index === to) break
      index = (index + 1) % 7
    }
    return days
  }

  const day = parseDayName(part)
  if (day != null) days.add(day)
  return days
}

function expandDays(daysText) {
  const days = new Set()
  daysText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      expandDayPart(part).forEach((day) => days.add(day))
    })
  return days
}

function parseTimeRanges(text) {
  const ranges = []
  TIME_RANGE_RE.lastIndex = 0
  let match = TIME_RANGE_RE.exec(text)

  while (match) {
    const open = Number(match[1]) * 60 + Number(match[2])
    const close = Number(match[3]) * 60 + Number(match[4])
    ranges.push([open, close])
    match = TIME_RANGE_RE.exec(text)
  }

  return ranges
}

/**
 * Convierte el tag opening_hours en un mapa de días con sus intervalos.
 * @param {string|null|undefined} value
 * @returns {{allDay: boolean, byDay: Record<number, Array<[number, number]>>}|null}
 */
export function parseOpeningHours(value) {
  if (!value || typeof value !== 'string') return null

  const cleaned = value.replace(/"[^"]*"/g, '').trim()
  if (!cleaned) return null

  if (/^24\s*\/\s*7$/.test(cleaned)) {
    return { allDay: true, byDay: {} }
  }

  const byDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  let parsedSomething = false

  cleaned.split(';').forEach((rawRule) => {
    const rule = rawRule.trim()
    if (!rule) return

    // Excepciones por fecha concreta ("2026 Dec 24 off"): no las aplicamos.
    if (/^\d{4}\b/.test(rule)) return

    const parts = rule.match(/^([A-Za-z,\s-]*?)\s*((?:\d{1,2}:\d{2}.*)|off|closed)?$/i)
    if (!parts) return

    const daysText = (parts[1] || '').trim()
    const timeText = (parts[2] || '').trim()

    // Si no hay días ni horas reconocibles, ignoramos la regla.
    if (!timeText) return

    const targetDays = daysText ? [...expandDays(daysText)] : [0, 1, 2, 3, 4, 5, 6]
    // "PH" (festivos) no se puede evaluar con fechas genéricas: la ignoramos.
    const usableDays = targetDays.filter((day) => daysText === '' || !Number.isNaN(day))
    if (usableDays.length === 0) return

    const isClosed = /^(off|closed)$/i.test(timeText)
    const ranges = isClosed ? [] : parseTimeRanges(timeText)

    if (!isClosed && ranges.length === 0) return

    usableDays.forEach((day) => {
      if (isClosed) {
        byDay[day] = []
      } else {
        byDay[day] = [...byDay[day], ...ranges]
      }
    })
    parsedSomething = true
  })

  return parsedSomething ? { allDay: false, byDay } : null
}

/** Convierte "YYYY-MM-DD" en una fecha local a mediodía (evita problemas de zona horaria). */
function parseIsoDate(value) {
  if (!value || typeof value !== 'string') return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date) {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isOpenOn(schedule, date) {
  if (schedule.allDay) return true
  return (schedule.byDay[date.getDay()] || []).length > 0
}

/**
 * Comprueba si un establecimiento está abierto los días de entrada y salida.
 * @param {string|null|undefined} openingHours - Valor del tag opening_hours
 * @param {string} entry - Fecha de entrada "YYYY-MM-DD"
 * @param {string} exit - Fecha de salida "YYYY-MM-DD"
 * @returns {{status: 'open'|'closed'|'unknown', label: string, closedDates: string[], parsed: boolean}}
 */
export function evaluateStayOpeningHours(openingHours, entry, exit) {
  const schedule = parseOpeningHours(openingHours)
  const entryDate = parseIsoDate(entry)
  const exitDate = parseIsoDate(exit)

  if (!schedule) {
    return {
      status: 'unknown',
      label: openingHours
        ? 'Horario no interpretable en OpenStreetMap'
        : 'Horario no disponible en OpenStreetMap',
      closedDates: [],
      parsed: false,
    }
  }

  if (!entryDate || !exitDate) {
    return {
      status: 'unknown',
      label: 'Indica las fechas para comprobar el horario',
      closedDates: [],
      parsed: true,
    }
  }

  const datesToCheck =
    entryDate.getTime() === exitDate.getTime() ? [entryDate] : [entryDate, exitDate]

  const closedDates = datesToCheck.filter((date) => !isOpenOn(schedule, date)).map(formatDate)

  if (closedDates.length > 0) {
    return {
      status: 'closed',
      label: `Cerrado el ${closedDates.join(' y el ')} según su horario`,
      closedDates,
      parsed: true,
    }
  }

  const openDates = datesToCheck.map(formatDate)
  return {
    status: 'open',
    label:
      openDates.length === 1
        ? `Abierto el ${openDates[0]} según su horario`
        : `Abierto el ${openDates[0]} y el ${openDates[1]} según su horario`,
    closedDates: [],
    parsed: true,
  }
}
