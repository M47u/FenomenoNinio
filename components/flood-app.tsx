'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { guardarGridCache, leerGridCache, type FloodGrid, type WorkerMessage, areaAnegadaKm2 } from '@/lib/flood'
import { ETIQUETA_ESTADO, FORMOSA, cotaAgua, estadoPorAltura } from '@/lib/formosa'
import { cn } from '@/lib/utils'
import type { Base, TemaMapa, Vista } from './flood-map'
import { GaugeStaff } from './gauge-staff'
import { LevelChart } from './level-chart'
import { COLOR_ESTADO, LiveReading, type Nivel } from './live-reading'
import { ComputeStatus, DepthLegend, MapToolbar } from './map-overlays'
import { Methodology } from './methodology'

const FloodMap = dynamic(() => import('./flood-map'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-card" />,
})

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo obtener el nivel')
  return res.json() as Promise<Nivel>
}

export function FloodApp() {
  const { data: nivel, error } = useSWR('/api/nivel', fetcher, { refreshInterval: 24 * 60 * 60 * 1000 })
  const [simulada, setSimulada] = useState<number | null>(null)
  const [escenario, setEscenario] = useState<'rio' | 'lluvia'>('rio')
  const [lluviaMm, setLluviaMm] = useState(60)
  const [duracionHoras, setDuracionHoras] = useState(1)
  const [vista, setVista] = useState<Vista>('2d')
  const [base, setBase] = useState<Base>('calles')
  const [tema, setTema] = useState<TemaMapa>('nocturno')
  const [grid, setGrid] = useState<FloodGrid | null>(null)
  const [progreso, setProgreso] = useState({ etapa: 'Preparando modelo de relieve', valor: 0 })
  const [errorModelo, setErrorModelo] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    const clave = `formosa:${FORMOSA.bbox.join(',')}:z${FORMOSA.demZoom}`
    const worker = new Worker('/flood-worker.js')
    const iniciar = async () => {
      const cacheada = await leerGridCache(clave)
      if (!activo) return
      if (cacheada) {
        setProgreso({ etapa: 'Relieve cargado desde caché', valor: 100 })
        setGrid(cacheada)
        worker.terminate()
        return
      }
      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const msg = e.data
        if (msg.type === 'progress') setProgreso({ etapa: msg.etapa, valor: msg.valor })
        else if (msg.type === 'done') {
          setGrid(msg.grid)
          void guardarGridCache(clave, msg.grid)
        } else setErrorModelo(msg.mensaje)
      }
      worker.postMessage({
        bbox: FORMOSA.bbox,
        z: FORMOSA.demZoom,
        seeds: FORMOSA.semillasRio,
        snapRadius: FORMOSA.radioAjusteSemillaPx,
      })
    }
    void iniciar()
    return () => {
      activo = false
      worker.terminate()
    }
  }, [])

  const actual = nivel?.altura_m ?? null
  const altura = simulada ?? actual ?? 5
  const cota = cotaAgua(altura)
  const cotaCauce = cotaAgua(FORMOSA.nivelCauce)
  const area = useMemo(() => (grid ? areaAnegadaKm2(grid, cota, cotaCauce) : null), [grid, cota, cotaCauce])
  const estado = estadoPorAltura(altura)

  const presets = [
    ...(actual !== null ? [{ id: 'hoy', etiqueta: 'Hoy', altura: actual, nota: 'Lectura más reciente' }] : []),
    { id: 'alerta', etiqueta: 'Alerta', altura: FORMOSA.umbrales.alerta, nota: 'Nivel de alerta (Prefectura)' },
    {
      id: 'evac',
      etiqueta: 'Evacuación',
      altura: FORMOSA.umbrales.evacuacion,
      nota: 'Nivel de evacuación (Prefectura)',
    },
    ...FORMOSA.crecidas.map((c) => ({ id: String(c.anio), etiqueta: String(c.anio), altura: c.altura, nota: c.nota })),
  ]

  return (
    <main className={cn('flex min-h-dvh flex-col md:h-dvh md:flex-row-reverse', tema === 'claro' && 'theme-light')}>
      <section className="relative h-[58dvh] shrink-0 md:h-full md:flex-1" aria-label="Mapa de inundación">
        <FloodMap key={tema} grid={grid} cota={cota} cotaCauce={cotaCauce} vista={vista} base={base} tema={tema} escenario={escenario} lluviaMm={lluviaMm} duracionHoras={duracionHoras} />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col items-start gap-2">
          <MapToolbar vista={vista} base={base} onVista={setVista} onBase={setBase} tema={tema} onTema={setTema} />
          {!grid && <ComputeStatus etapa={progreso.etapa} valor={progreso.valor} error={errorModelo} />}
        </div>
        <div className="pointer-events-none absolute bottom-8 left-3 hidden sm:block">
          <DepthLegend />
        </div>
      </section>

      <aside className="flex flex-col gap-6 border-border p-5 md:w-[380px] md:shrink-0 md:overflow-y-auto md:border-r">
        <header className="flex flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Río Paraguay · Formosa</p>
          <h1 className="text-balance text-2xl font-semibold leading-tight">Simulador de crecida</h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Arrastrá la escala para ver hasta dónde llegaría el agua en la ciudad según la altura del hidrómetro del
            puerto.
          </p>
        </header>

        <LiveReading nivel={nivel} error={Boolean(error)} />

        <section aria-labelledby="titulo-escenario" className="flex flex-col gap-3">
          <h2 id="titulo-escenario" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Escenario
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={escenario === 'rio'} onClick={() => setEscenario('rio')} className={cn('rounded-sm border px-3 py-2 text-sm', escenario === 'rio' ? 'border-primary bg-secondary text-foreground' : 'border-border text-muted-foreground')}>
              Crecida del río
            </button>
            <button type="button" aria-pressed={escenario === 'lluvia'} onClick={() => setEscenario('lluvia')} className={cn('rounded-sm border px-3 py-2 text-sm', escenario === 'lluvia' ? 'border-primary bg-secondary text-foreground' : 'border-border text-muted-foreground')}>
              Anegamiento por lluvia
            </button>
          </div>
          {escenario === 'lluvia' && (
            <div className="grid grid-cols-2 gap-3 rounded-sm border border-border p-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Lluvia caída (mm)
                <input aria-label="Lluvia caída en milímetros" type="number" min="0" max="400" step="10" value={lluviaMm} onChange={(event) => setLluviaMm(Math.min(400, Math.max(0, Number(event.target.value))))} className="rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Duración (h)
                <input aria-label="Duración de la lluvia en horas" type="number" min="0.25" max="2" step="0.25" value={duracionHoras} onChange={(event) => setDuracionHoras(Math.min(2, Math.max(0.25, Number(event.target.value))))} className="rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground" />
              </label>
              <p className="col-span-2 text-xs leading-relaxed text-muted-foreground">Modelo de cribado: combina elevación, zonas bajas y concentración por intensidad. El registro extremo de 400 mm en 2 h queda disponible como escenario de prueba.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="titulo-sim" className="flex flex-col gap-4">
          <h2 id="titulo-sim" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Altura simulada
          </h2>
          <div className="flex gap-5">
            <GaugeStaff value={altura} actual={actual} onChange={setSimulada} />
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="font-mono text-4xl font-semibold leading-none tabular-nums">
                  {altura.toFixed(2)}
                  <span className="ml-1 text-lg font-normal text-muted-foreground">m</span>
                </p>
                <span
                  className={cn(
                    'w-fit rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase',
                    COLOR_ESTADO[estado],
                  )}
                >
                  {ETIQUETA_ESTADO[estado]}
                </span>
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">Cota del agua</dt>
                  <dd className="font-mono tabular-nums">{cota.toFixed(2)} m s.n.m.</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">Superficie anegada fuera del cauce</dt>
                  <dd className="font-mono tabular-nums">{area === null ? '—' : `${area.toFixed(2)} km²`}</dd>
                </div>
              </dl>
              <ul className="flex flex-col gap-1" aria-label="Niveles de referencia">
                {presets.map((p) => {
                  const activo = Math.abs(p.altura - altura) < 0.001
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSimulada(p.altura)}
                        aria-pressed={activo}
                        title={p.nota}
                        className={cn(
                          'flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-sm transition-colors',
                          activo ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                        )}
                      >
                        <span>{p.etiqueta}</span>
                        <span className="font-mono tabular-nums">{p.altura.toFixed(2)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </section>

        {nivel && nivel.historico.length > 1 && (
          <section aria-labelledby="titulo-hist" className="flex flex-col gap-2">
            <h2 id="titulo-hist" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Últimos 30 días
            </h2>
            <LevelChart data={nivel.historico} />
          </section>
        )}

        <Methodology />
      </aside>
    </main>
  )
}
