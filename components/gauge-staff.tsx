'use client'

import { type KeyboardEvent, type PointerEvent, useCallback, useRef } from 'react'
import { FORMOSA } from '@/lib/formosa'
import { cn } from '@/lib/utils'

interface GaugeStaffProps {
  value: number
  actual: number | null
  onChange: (value: number) => void
}

const { min, max, paso } = FORMOSA.simulador
const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`
const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / paso) * paso))

interface Marca {
  valor: number
  etiqueta: string
  className: string
}

export function GaugeStaff({ value, actual, onChange }: GaugeStaffProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const fromPointer = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      onChange(clamp(max - ((clientY - rect.top) / rect.height) * (max - min)))
    },
    [onChange],
  )

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    fromPointer(e.clientY)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientY)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowUp: paso, ArrowRight: paso, ArrowDown: -paso, ArrowLeft: -paso, PageUp: paso, PageDown: -paso }[
      e.key
    ]
    if (step !== undefined) {
      e.preventDefault()
      onChange(clamp(value + step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(min)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
    }
  }

  const marcas: Marca[] = [
    { valor: FORMOSA.umbrales.defensa, etiqueta: 'Defensa', className: 'border-foreground/60 text-foreground/80' },
    { valor: FORMOSA.umbrales.evacuacion, etiqueta: 'Evac.', className: 'border-destructive text-destructive' },
    { valor: FORMOSA.umbrales.alerta, etiqueta: 'Alerta', className: 'border-alerta text-alerta' },
  ]

  const metros = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i)

  return (
    <div className="flex h-96 select-none gap-2">
      <div className="relative w-6 font-mono text-[11px] text-muted-foreground" aria-hidden="true">
        {metros.map((m) => (
          <span key={m} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ bottom: pct(m) }}>
            {m}
          </span>
        ))}
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Altura simulada del río en el hidrómetro"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={`${value.toFixed(2)} metros`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="relative w-24 cursor-ns-resize touch-none overflow-hidden rounded-md border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className="absolute inset-y-0 left-0 w-1/2"
          style={{
            backgroundImage: `repeating-linear-gradient(to top, var(--foreground) 0 calc(100% / ${(max - min) * 10}), transparent calc(100% / ${(max - min) * 10}) calc(200% / ${(max - min) * 10}))`,
            opacity: 0.85,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 border-t-2 border-primary bg-primary/35 transition-[height] duration-75"
          style={{ height: pct(value) }}
          aria-hidden="true"
        />
        {marcas.map((m) => (
          <div
            key={m.etiqueta}
            className={cn('absolute right-0 left-1/2 border-t border-dashed', m.className)}
            style={{ bottom: pct(m.valor) }}
            aria-hidden="true"
          >
            <span className="absolute right-1 bottom-0.5 font-mono text-[10px] uppercase leading-none">
              {m.etiqueta}
            </span>
          </div>
        ))}
        {actual !== null && (
          <div
            className="absolute inset-x-0 border-t-2 border-foreground"
            style={{ bottom: pct(actual) }}
            aria-hidden="true"
          >
            <span className="absolute -top-0.5 right-1 rounded-sm bg-foreground px-1 font-mono text-[10px] font-semibold uppercase leading-4 text-background">
              Hoy
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
