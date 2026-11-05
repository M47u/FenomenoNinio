const TILE = 256;
const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2y = (lat, z) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z;
};
const x2lon = (x, z) => x / 2 ** z * 360 - 180;
const y2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / 2 ** z;
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
function post(msg, transfer = []) {
  ;
  self.postMessage(msg, transfer);
}
function medianFilter(src, W, H) {
  const out = new Float32Array(src.length);
  const win = new Float32Array(9);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          const v = src[yy * W + xx];
          let j = k++;
          while (j > 0 && win[j - 1] > v) {
            win[j] = win[j - 1];
            j--;
          }
          win[j] = v;
        }
      }
      out[y * W + x] = win[4];
    }
  }
  return out;
}
function priorityFlood(elev, W, H, seeds) {
  const N = W * H;
  const umbral = new Float32Array(N).fill(Number.POSITIVE_INFINITY);
  const visited = new Uint8Array(N);
  const heapIdx = new Int32Array(N);
  const heapKey = new Float32Array(N);
  let size = 0;
  const push = (i, key) => {
    let p = size++;
    while (p > 0) {
      const parent = p - 1 >> 1;
      if (heapKey[parent] <= key) break;
      heapIdx[p] = heapIdx[parent];
      heapKey[p] = heapKey[parent];
      p = parent;
    }
    heapIdx[p] = i;
    heapKey[p] = key;
  };
  const pop = () => {
    const top = heapIdx[0];
    const lastIdx = heapIdx[--size];
    const lastKey = heapKey[size];
    let p = 0;
    for (; ; ) {
      let c = 2 * p + 1;
      if (c >= size) break;
      if (c + 1 < size && heapKey[c + 1] < heapKey[c]) c++;
      if (heapKey[c] >= lastKey) break;
      heapIdx[p] = heapIdx[c];
      heapKey[p] = heapKey[c];
      p = c;
    }
    heapIdx[p] = lastIdx;
    heapKey[p] = lastKey;
    return top;
  };
  for (const s of seeds) {
    if (visited[s]) continue;
    visited[s] = 1;
    umbral[s] = elev[s];
    push(s, elev[s]);
  }
  const dx = [1, -1, 0, 0, 1, 1, -1, -1];
  const dy = [0, 0, 1, -1, 1, -1, 1, -1];
  let processed = 0;
  while (size > 0) {
    const i = pop();
    const level = umbral[i];
    const x = i % W;
    const y = (i - x) / W;
    for (let k = 0; k < 8; k++) {
      const nx = x + dx[k];
      const ny = y + dy[k];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (visited[n]) continue;
      visited[n] = 1;
      const u = elev[n] > level ? elev[n] : level;
      umbral[n] = u;
      push(n, u);
    }
    if (++processed % 4e5 === 0) {
      post({ type: "progress", etapa: "Calculando conectividad con el r\xEDo", valor: 0.5 + 0.5 * (processed / N) });
    }
  }
  return umbral;
}
self.onmessage = async (event) => {
  const { bbox, z, seeds, snapRadius } = event.data;
  try {
    const [west, south, east, north] = bbox;
    const tx0 = Math.floor(lon2x(west, z));
    const tx1 = Math.floor(lon2x(east, z));
    const ty0 = Math.floor(lat2y(north, z));
    const ty1 = Math.floor(lat2y(south, z));
    const cols = tx1 - tx0 + 1;
    const rows = ty1 - ty0 + 1;
    const W = cols * TILE;
    const H = rows * TILE;
    const raw = new Float32Array(W * H);
    const canvas = new OffscreenCanvas(TILE, TILE);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("OffscreenCanvas 2D no disponible");
    const tiles = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) tiles.push({ tx, ty });
    let loaded = 0;
    await Promise.all(
      tiles.map(async ({ tx, ty }) => {
        const res = await fetch(`${TERRARIUM}/${z}/${tx}/${ty}.png`);
        if (!res.ok) throw new Error(`Tile de relieve ${z}/${tx}/${ty} no disponible`);
        const bmp = await createImageBitmap(await res.blob());
        ctx.clearRect(0, 0, TILE, TILE);
        ctx.drawImage(bmp, 0, 0);
        const { data } = ctx.getImageData(0, 0, TILE, TILE);
        const ox = (tx - tx0) * TILE;
        const oy = (ty - ty0) * TILE;
        for (let py = 0; py < TILE; py++) {
          for (let px = 0; px < TILE; px++) {
            const p = (py * TILE + px) * 4;
            raw[(oy + py) * W + ox + px] = data[p] * 256 + data[p + 1] + data[p + 2] / 256 - 32768;
          }
        }
        loaded++;
        post({ type: "progress", etapa: "Descargando relieve", valor: loaded / tiles.length * 0.35 });
      })
    );
    post({ type: "progress", etapa: "Filtrando relieve", valor: 0.4 });
    const elev = medianFilter(raw, W, H);
    const seedIdx = seeds.map(([lon, lat]) => {
      const sx = Math.round((lon2x(lon, z) - tx0) * TILE);
      const sy = Math.round((lat2y(lat, z) - ty0) * TILE);
      let best = -1;
      let bestElev = Number.POSITIVE_INFINITY;
      for (let y = sy - snapRadius; y <= sy + snapRadius; y++) {
        for (let x = sx - snapRadius; x <= sx + snapRadius; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const v = elev[y * W + x];
          if (v < bestElev) {
            bestElev = v;
            best = y * W + x;
          }
        }
      }
      return best;
    }).filter((i) => i >= 0);
    post({ type: "progress", etapa: "Calculando conectividad con el r\xEDo", valor: 0.5 });
    const umbral = priorityFlood(elev, W, H, seedIdx);
    const latCentro = y2lat(ty0 + rows / 2, z);
    const metrosPorPx = 40075016686e-3 * Math.cos(latCentro * Math.PI / 180) / (TILE * 2 ** z);
    post(
      {
        type: "done",
        grid: {
          W,
          H,
          elev,
          umbral,
          areaCeldaKm2: metrosPorPx * metrosPorPx / 1e6,
          bounds: [x2lon(tx0, z), y2lat(ty1 + 1, z), x2lon(tx1 + 1, z), y2lat(ty0, z)]
        }
      },
      [elev.buffer, umbral.buffer]
    );
  } catch (error) {
    post({ type: "error", mensaje: error instanceof Error ? error.message : "Error desconocido" });
  }
};
