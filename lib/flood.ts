export interface FloodGrid {
  W: number
  H: number
  elev: Float32Array
  umbral: Float32Array
  areaCeldaKm2: number
  /** [west, south, east, north] */
  bounds: [number, number, number, number]
}

const GRID_CACHE_DB = 'formosa-flood-cache'
const GRID_CACHE_STORE = 'relief-grids'
const GRID_CACHE_TTL = 6 * 60 * 60 * 1000

function abrirCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(GRID_CACHE_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(GRID_CACHE_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function leerGridCache(clave: string): Promise<FloodGrid | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await abrirCache()
    const registro = await new Promise<{ guardado: number; grid: FloodGrid } | undefined>((resolve, reject) => {
      const request = db.transaction(GRID_CACHE_STORE, 'readonly').objectStore(GRID_CACHE_STORE).get(clave)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    if (!registro || Date.now() - registro.guardado > GRID_CACHE_TTL) return null
    return registro.grid
  } catch {
    return null
  }
}

export async function guardarGridCache(clave: string, grid: FloodGrid) {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await abrirCache()
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(GRID_CACHE_STORE, 'readwrite').objectStore(GRID_CACHE_STORE).put({ guardado: Date.now(), grid }, clave)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    db.close()
  } catch {
    // El modelo sigue funcionando aunque el navegador no permita almacenamiento.
  }
}

export type WorkerMessage =
  | { type: 'progress'; etapa: string; valor: number }
  | { type: 'done'; grid: FloodGrid }
  | { type: 'error'; mensaje: string }

export const RAMPA_PROFUNDIDAD = [
  { hasta: 0.5, rgba: [150, 214, 234, 150], etiqueta: '< 0,5 m' },
  { hasta: 1.5, rgba: [79, 179, 217, 185], etiqueta: '0,5 – 1,5 m' },
  { hasta: 3, rgba: [33, 122, 178, 210], etiqueta: '1,5 – 3 m' },
  { hasta: Number.POSITIVE_INFINITY, rgba: [16, 70, 128, 230], etiqueta: '> 3 m' },
] as const

const CAUCE_RGBA = [79, 179, 217, 60] as const

export function areaAnegadaKm2(grid: FloodGrid, cota: number, cotaCauce: number) {
  const { umbral } = grid
  let n = 0
  for (let i = 0; i < umbral.length; i++) {
    const u = umbral[i]
    if (u <= cota && u > cotaCauce) n++
  }
  return n * grid.areaCeldaKm2
}

type AnilloCoordinates = number[][][] | number[][][][]

function puntoEnPoligono(lon: number, lat: number, coordinates: AnilloCoordinates) {
  const polygon = coordinates[0]
  const exterior = Array.isArray(polygon?.[0]?.[0]) ? polygon[0] : polygon
  if (!Array.isArray(exterior) || exterior.length < 3) return false

  let dentro = false
  for (let i = 0, j = exterior.length - 1; i < exterior.length; j = i++) {
    const actual = exterior[i]
    const anterior = exterior[j]
    if (!Array.isArray(actual) || !Array.isArray(anterior)) continue
    const [xi, yi] = actual
    const [xj, yj] = anterior
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue
    const intersecta = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersecta) dentro = !dentro
  }
  return dentro
}

export function construirMascaraAnillo(grid: FloodGrid, anillo?: AnilloCoordinates) {
  const mascara = new Uint8Array(grid.umbral.length)
  if (!anillo) return mascara

  const [west, south, east, north] = grid.bounds
  for (let i = 0; i < mascara.length; i++) {
    const col = i % grid.W
    const row = Math.floor(i / grid.W)
    const lon = west + ((col + 0.5) / grid.W) * (east - west)
    const lat = north - ((row + 0.5) / grid.H) * (north - south)
    mascara[i] = puntoEnPoligono(lon, lat, anillo) ? 1 : 0
  }
  return mascara
}

export function paintRain(
  image: ImageData,
  grid: FloodGrid,
  lluviaMm: number,
  duracionHoras: number,
) {
  const data = image.data
  const valid = Array.from(grid.elev).filter(Number.isFinite).sort((a, b) => a - b)
  const low = valid[Math.floor(valid.length * 0.08)] ?? 0
  const high = valid[Math.floor(valid.length * 0.55)] ?? low
  const intensidad = lluviaMm / Math.max(duracionHoras, 0.25)
  const umbral = low + (high - low) * Math.min(1, intensidad / 220)
  const profundidad = Math.max(0.08, (lluviaMm / 1000) * (0.72 + Math.min(1, intensidad / 200) * 0.18))

  for (let i = 0; i < grid.elev.length; i++) {
    const p = i * 4
    const elevacion = grid.elev[i]
    if (!Number.isFinite(elevacion) || elevacion > umbral) {
      data[p + 3] = 0
      continue
    }
    const profundidadLocal = Math.max(0, profundidad + (umbral - elevacion) * 0.55)
    const rgba = RAMPA_PROFUNDIDAD.find((r) => profundidadLocal < r.hasta)?.rgba ?? RAMPA_PROFUNDIDAD[3].rgba
    data[p] = rgba[0]
    data[p + 1] = rgba[1]
    data[p + 2] = rgba[2]
    data[p + 3] = rgba[3]
  }
}

export function paintFlood(
  image: ImageData,
  grid: FloodGrid,
  cota: number,
  cotaCauce: number,
  mascaraAnillo?: Uint8Array,
) {
  const { umbral, elev } = grid
  const data = image.data
  for (let i = 0; i < umbral.length; i++) {
    const p = i * 4
    const u = umbral[i]
    if (mascaraAnillo?.[i]) {
      data[p + 3] = 0
      continue
    }
    if (u > cota) {
      data[p + 3] = 0
      continue
    }
    let rgba: readonly number[] = CAUCE_RGBA
    if (u > cotaCauce) {
      const depth = cota - elev[i]
      rgba = RAMPA_PROFUNDIDAD.find((r) => depth < r.hasta)?.rgba ?? RAMPA_PROFUNDIDAD[3].rgba
    }
    data[p] = rgba[0]
    data[p + 1] = rgba[1]
    data[p + 2] = rgba[2]
    data[p + 3] = rgba[3]
  }
}
