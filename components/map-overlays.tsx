import { RAMPA_PROFUNDIDAD } from '@/lib/flood'
import { cn } from '@/lib/utils'
import type { Base, TemaMapa, Vista } from './flood-map'

interface ToggleProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

function Toggle<T extends string>({ label, value, options, onChange }: ToggleProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-border bg-card/95 p-0.5 shadow-lg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-sm px-2.5 py-1 font-mono text-xs transition-colors',
            value === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MapToolbar({
  vista,
  base,
  onVista,
  onBase,
  tema,
  onTema,
}: {
  vista: Vista
  base: Base
  onVista: (v: Vista) => void
  onBase: (b: Base) => void
  tema: TemaMapa
  onTema: (v: TemaMapa) => void
}) {
  return (
    <div className="pointer-events-auto flex flex-wrap gap-2">
      <Toggle
        label="Vista"
        value={vista}
        onChange={onVista}
        options={[
          { value: '2d', label: '2D' },
          { value: '3d', label: '3D' },
        ]}
      />
      <Toggle
        label="Tema del mapa"
        value={tema}
        onChange={onTema}
        options={[
          { value: 'claro', label: 'Claro' },
          { value: 'nocturno', label: 'Nocturno' },
        ]}
      />
      <Toggle
        label="Mapa base"
        value={base}
        onChange={onBase}
        options={[
          { value: 'calles', label: 'Calles' },
          { value: 'satelite', label: 'Satélite' },
        ]}
      />
    </div>
  )
}

export function DepthLegend() {
  return (
    <div className="pointer-events-auto flex flex-col gap-1.5 rounded-md border border-border bg-card/95 p-3 shadow-lg">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Profundidad del agua</p>
      <ul className="flex gap-2">
        {RAMPA_PROFUNDIDAD.map((r) => (
          <li key={r.etiqueta} className="flex flex-col gap-1">
            <span
              className="h-2 w-14 rounded-sm"
              style={{ backgroundColor: `rgba(${r.rgba[0]},${r.rgba[1]},${r.rgba[2]},${r.rgba[3] / 255})` }}
              aria-hidden="true"
            />
            <span className="font-mono text-[10px] text-card-foreground">{r.etiqueta}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ComputeStatus({ etapa, valor, error }: { etapa: string; valor: number; error: string | null }) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-64 flex-col gap-2 rounded-md border border-border bg-card/95 p-3 shadow-lg"
    >
      {error ? (
        <p className="text-xs leading-relaxed text-destructive">No se pudo calcular el modelo: {error}</p>
      ) : (
        <>
          <p className="text-xs text-card-foreground">{etapa}…</p>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(valor * 100)}%` }} />
          </div>
        </>
      )}
    </div>
  )
}
