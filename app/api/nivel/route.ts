import { FORMOSA } from '@/lib/formosa'

const INA = 'https://alerta.ina.gob.ar/a5/obs/puntual/observaciones'
const SERIE_DIARIA_PREFECTURA = 57
const SERIE_HORARIA_INA = 6951

interface Lectura {
  fecha: string
  altura: number
}

const isoDia = (d: Date) => d.toISOString().slice(0, 10)

async function serie(id: number, dias: number): Promise<Lectura[]> {
  const hasta = new Date(Date.now() + 86400000)
  const desde = new Date(Date.now() - dias * 86400000)
  const url = `${INA}?series_id=${id}&timestart=${isoDia(desde)}&timeend=${isoDia(hasta)}&format=json`
  const res = await fetch(url, { next: { revalidate: 900 } })
  if (!res.ok) throw new Error(`INA respondió ${res.status} para la serie ${id}`)
  const rows = (await res.json()) as { timestart: string; valor: number }[]
  return rows
    .filter((r) => Number.isFinite(r.valor))
    .map((r) => ({ fecha: r.timestart, altura: r.valor }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function agruparPorDia(lecturas: Lectura[]): Lectura[] {
  const porDia = new Map<string, Lectura>()
  for (const l of lecturas) porDia.set(l.fecha.slice(0, 10), l)
  return [...porDia.values()]
}

export async function GET() {
  const [diaria, horaria] = await Promise.allSettled([
    serie(SERIE_DIARIA_PREFECTURA, 45),
    serie(SERIE_HORARIA_INA, 3),
  ])
  const d = diaria.status === 'fulfilled' ? diaria.value : []
  const h = horaria.status === 'fulfilled' ? horaria.value : []

  const ultimaDiaria = d.at(-1)
  const ultimaHoraria = h.at(-1)
  const ultima =
    ultimaHoraria && (!ultimaDiaria || ultimaHoraria.fecha > ultimaDiaria.fecha) ? ultimaHoraria : ultimaDiaria

  if (!ultima) {
    return Response.json({ error: 'No se pudo obtener la altura del río desde el INA.' }, { status: 502 })
  }

  const fuente = ultima === ultimaHoraria ? 'INA · telemetría horaria' : 'Prefectura Naval · lectura diaria'
  const serieRef = ultima === ultimaHoraria ? h : d
  const objetivo = new Date(ultima.fecha).getTime() - 86400000
  const previa = serieRef.reduce<Lectura | undefined>((best, l) => {
    const t = new Date(l.fecha).getTime()
    if (t > objetivo + 3 * 3600000) return best
    if (!best) return l
    return Math.abs(t - objetivo) < Math.abs(new Date(best.fecha).getTime() - objetivo) ? l : best
  }, undefined)

  const historico = (d.length ? d : agruparPorDia(h)).slice(-30)

  return Response.json(
    {
      estacion: FORMOSA.hidrometro.nombre,
      altura_m: ultima.altura,
      fecha: ultima.fecha,
      fuente,
      variacion_24h: previa ? Number((ultima.altura - previa.altura).toFixed(2)) : null,
      alerta_m: FORMOSA.umbrales.alerta,
      evacuacion_m: FORMOSA.umbrales.evacuacion,
      historico,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' } },
  )
}
