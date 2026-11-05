'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { construirMascaraAnillo, type FloodGrid, paintFlood, paintRain } from '@/lib/flood'
import { FORMOSA } from '@/lib/formosa'

export type Vista = '2d' | '3d'
export type Base = 'calles' | 'satelite'
export type TemaMapa = 'claro' | 'nocturno'

interface FloodMapProps {
  grid: FloodGrid | null
  cota: number
  cotaCauce: number
  vista: Vista
  base: Base
  tema: TemaMapa
  escenario: 'rio' | 'lluvia'
  lluviaMm: number
  duracionHoras: number
}

const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function cornerCoords([w, s, e, n]: FloodGrid['bounds'] | typeof FORMOSA.bbox) {
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ] as [[number, number], [number, number], [number, number], [number, number]]
}

export default function FloodMap({ grid, cota, cotaCauce, vista, base, tema, escenario, lluviaMm, duracionHoras }: FloodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<ImageData | null>(null)
  const maskRef = useRef<Uint8Array | null>(null)
  const maskGridRef = useRef<FloodGrid | null>(null)
  const maskAnilloRef = useRef<number[][][] | null>(null)
  const frameRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [anillo, setAnillo] = useState<number[][][] | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: tema === 'claro' ? 'https://tiles.openfreemap.org/styles/bright' : 'https://tiles.openfreemap.org/styles/dark',
      center: FORMOSA.centro,
      zoom: FORMOSA.zoom,
      minZoom: 10,
      maxPitch: 75,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')

    map.on('load', () => {
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id

      map.addSource('satelite', {
        type: 'raster',
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Sentinel-2 cloudless — EOX IT Services GmbH (Copernicus 2020)',
      })
      map.addLayer({ id: 'satelite', type: 'raster', source: 'satelite', layout: { visibility: 'none' } }, firstSymbol)

      map.addSource('dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution: 'Relieve: Mapzen Terrain Tiles (AWS Open Data)',
      })

      map.addSource('anillo-contencion', {
        type: 'geojson',
        data: '/anillo-contencion.geojson',
      })
      map.addLayer({
        id: 'anillo-contencion-relleno',
        type: 'fill',
        source: 'anillo-contencion',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.08 },
      })
      map.addLayer({
        id: 'anillo-contencion-borde',
        type: 'line',
        source: 'anillo-contencion',
        paint: { 'line-color': '#f59e0b', 'line-width': 2.5, 'line-opacity': 0.95 },
      })

      fetch('/anillo-contencion.geojson')
        .then((response) => response.json())
        .then((geojson) => {
          const coordinates = geojson?.features?.[0]?.geometry?.coordinates ?? geojson?.geometry?.coordinates
          if (Array.isArray(coordinates)) setAnillo(coordinates)
        })
        .catch(() => setAnillo(null))

      map.addSource('inundacion', { type: 'image', url: TRANSPARENT_PX, coordinates: cornerCoords(FORMOSA.bbox) })
      map.addLayer(
        {
          id: 'inundacion',
          type: 'raster',
          source: 'inundacion',
          paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
        },
        firstSymbol,
      )

      const el = document.createElement('div')
      el.className =
        'flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-card-foreground shadow-lg'
      el.innerHTML =
        '<span class="size-2 rounded-full bg-primary"></span><span>Hidrómetro Pto. Formosa</span>'
      new maplibregl.Marker({ element: el, anchor: 'left', offset: [8, 0] })
        .setLngLat(FORMOSA.hidrometro.coords)
        .addTo(map)

      setReady(true)
    })

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !grid) return
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      if (!canvasRef.current || canvasRef.current.width !== grid.W || canvasRef.current.height !== grid.H) {
        const canvas = document.createElement('canvas')
        canvas.width = grid.W
        canvas.height = grid.H
        canvasRef.current = canvas
        imageRef.current = new ImageData(grid.W, grid.H)
      }
      const ctx = canvasRef.current.getContext('2d')
      const image = imageRef.current
      if (!ctx || !image) return
      if (maskGridRef.current !== grid || maskAnilloRef.current !== anillo) {
        maskRef.current = construirMascaraAnillo(grid, anillo ?? undefined)
        maskGridRef.current = grid
        maskAnilloRef.current = anillo
      }
      if (escenario === 'lluvia') {
        paintRain(image, grid, lluviaMm, duracionHoras)
      } else {
        paintFlood(image, grid, cota, cotaCauce, maskRef.current ?? undefined)
      }
      ctx.putImageData(image, 0, 0)
      const source = map.getSource('inundacion') as maplibregl.ImageSource | undefined
      source?.updateImage({ url: canvasRef.current.toDataURL('image/png'), coordinates: cornerCoords(grid.bounds) })
    })
  }, [ready, grid, cota, cotaCauce, anillo, escenario, lluviaMm, duracionHoras])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    if (vista === '3d') {
      map.setTerrain({ source: 'dem', exaggeration: 4 })
      map.easeTo({ pitch: 62, bearing: -20, duration: 900 })
    } else {
      map.setTerrain(null)
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
    }
  }, [ready, vista])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setLayoutProperty('satelite', 'visibility', base === 'satelite' ? 'visible' : 'none')
  }, [ready, base])

  return (
    <div
      ref={containerRef}
      className="size-full"
      role="region"
      aria-label="Mapa de Formosa con la mancha de inundación simulada"
    />
  )
}
