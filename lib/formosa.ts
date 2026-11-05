export type LonLat = [number, number]

export interface CrecidaHistorica {
  anio: number
  altura: number
  nota: string
}

export const FORMOSA = {
  nombre: 'Formosa',
  provincia: 'Formosa',
  rio: 'Paraguay',
  centro: [-58.172, -26.182] as LonLat,
  zoom: 12.4,
  bbox: [-58.3, -26.28, -58.08, -26.08] as [number, number, number, number],
  demZoom: 13,
  semillasRio: [
    [-58.128, -26.183],
    [-58.124, -26.16],
    [-58.12, -26.21],
    [-58.105, -26.24],
    [-58.112, -26.12],
  ] as LonLat[],
  radioAjusteSemillaPx: 25,
  hidrometro: {
    nombre: 'Puerto Formosa',
    coords: [-58.1619, -26.1831] as LonLat,
    // Estimated from the DEM water surface at the port (~49–52 m); INA does not publish cero_ign for this station.
    cotaCero: 49.5,
  },
  umbrales: {
    aguasBajas: 1.6,
    alerta: 7.8,
    evacuacion: 8.3,
    defensa: 12,
  },
  nivelCauce: 3,
  simulador: { min: 0, max: 12.5, paso: 0.1 },
  crecidas: [
    { anio: 1983, altura: 10.73, nota: 'Máxima histórica · 31 de mayo' },
    { anio: 1992, altura: 10.13, nota: 'Crecida extraordinaria · 14 de junio' },
    { anio: 2019, altura: 9.72, nota: 'Pico del 2 de junio' },
    { anio: 2014, altura: 9.28, nota: 'Pico del 17 de julio' },
  ] as CrecidaHistorica[],
  fuentes: [
    {
      nombre: 'INA — Sistema de Alerta Hidrológico (API a5)',
      url: 'https://alerta.ina.gob.ar/pub/mapa',
    },
    {
      nombre: 'Prefectura Naval Argentina — Alturas de los ríos',
      url: 'https://contenidosweb.prefecturanaval.gob.ar/alturas/',
    },
    {
      nombre: 'Relieve: Terrarium (SRTM / Copernicus) — AWS Open Data',
      url: 'https://registry.opendata.aws/terrain-tiles/',
    },
    {
      nombre: 'Mapa base: OpenFreeMap · Satélite: EOX Sentinel-2 cloudless',
      url: 'https://openfreemap.org/',
    },
  ],
}

export type EstadoRio = 'aguas-bajas' | 'normal' | 'alerta' | 'evacuacion'

export function estadoPorAltura(altura: number): EstadoRio {
  const { aguasBajas, alerta, evacuacion } = FORMOSA.umbrales
  if (altura >= evacuacion) return 'evacuacion'
  if (altura >= alerta) return 'alerta'
  if (altura <= aguasBajas) return 'aguas-bajas'
  return 'normal'
}

export const ETIQUETA_ESTADO: Record<EstadoRio, string> = {
  'aguas-bajas': 'Aguas bajas',
  normal: 'Normal',
  alerta: 'Alerta',
  evacuacion: 'Evacuación',
}

export function cotaAgua(altura: number) {
  return FORMOSA.hidrometro.cotaCero + altura
}
