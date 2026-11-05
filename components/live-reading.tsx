import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { ETIQUETA_ESTADO, type EstadoRio, estadoPorAltura } from '@/lib/formosa'
import { cn } from '@/lib/utils'

export interface Nivel {
  estacion: string
  altura_m: number
  fecha: string
  fuente: string
  variacion_24h: number | null
  historico: { fecha: string; altura: number }[]
}

export const COLOR_ESTADO: Record<EstadoRio, string> = {
  'aguas-bajas': 'text-muted-foreground border-border',
  normal: 'text-primary border-primary/50',
  alerta: 'text-alerta border-alerta/60',
  evacuacion: 'text-destructive border-destructive/60',
}

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

export function LiveReading({ nivel, error }: { nivel?: Nivel; error?: boolean }) {
  if (error && !nivel) {
    return (
      <p className="rounded-md border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        No pudimos obtener la altura actual desde el INA. El simulador sigue funcionando con valores manuales.
      </p>
    )
  }
  if (!nivel) {
    return <div className="h-28 animate-pulse rounded-md bg-card" aria-label="Cargando altura actual" />
  }

  const estado = estadoPorAltura(nivel.altura_m)
  const v = nivel.variacion_24h
  const Tendencia = v === null || Math.abs(v) < 0.02 ? ArrowRight : v > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <section aria-labelledby="titulo-actual" className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-actual" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Altura actual · {nivel.estacion}
        </h2>
        <span
          className={cn(
            'rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase',
            COLOR_ESTADO[estado],
          )}
        >
          {ETIQUETA_ESTADO[estado]}
        </span>
      </div>
      <div className="flex items-end gap-4">
        <p className="font-mono text-5xl font-semibold leading-none tabular-nums">
          {nivel.altura_m.toFixed(2)}
          <span className="ml-1 text-xl font-normal text-muted-foreground">m</span>
        </p>
        {v !== null && (
          <p className="flex items-center gap-1 pb-1 font-mono text-sm text-muted-foreground">
            <Tendencia className="size-4" aria-hidden="true" />
            <span>
              {v > 0 ? '+' : ''}
              {v.toFixed(2)} m en 24 h
            </span>
          </p>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {fmtFecha(nivel.fecha)} · {nivel.fuente}
      </p>
    </section>
  )
}
