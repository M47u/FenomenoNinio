'use client'

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FORMOSA } from '@/lib/formosa'

interface LevelChartProps {
  data: { fecha: string; altura: number }[]
}

const fmtDia = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })

export function LevelChart({ data }: LevelChartProps) {
  const maxY = Math.ceil(Math.max(FORMOSA.umbrales.evacuacion + 0.7, ...data.map((d) => d.altura + 0.5)))

  return (
    <div className="h-44 w-full" role="img" aria-label="Altura diaria del río Paraguay en Formosa, últimos 30 días">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="fillAltura" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={fmtDia}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[0, maxY]}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--foreground)',
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtDia(String(v))}
            formatter={(v) => [`${Number(v).toFixed(2)} m`, 'Altura']}
          />
          <ReferenceLine y={FORMOSA.umbrales.alerta} stroke="var(--alerta)" strokeDasharray="4 3" />
          <ReferenceLine y={FORMOSA.umbrales.evacuacion} stroke="var(--destructive)" strokeDasharray="4 3" />
          <Area
            type="monotone"
            dataKey="altura"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#fillAltura)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
