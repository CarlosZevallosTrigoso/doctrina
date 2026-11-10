/* atlas · núcleo del mapa: formato, trazos, conversión a celdas, frontera y validación. Sin DOM. */
const ATLAS = (() => {
  'use strict';
  // ATLAS_DIV solo existe para las pruebas: un mapa menor con las mismas reglas.
  const DIV = (typeof process !== 'undefined' && process.env && +process.env.ATLAS_DIV) || 1;
  const COLS = 312 / DIV, ROWS = 192 / DIV, CELDA = 16, W = COLS * CELDA, H = ROWS * CELDA, N = COLS * ROWS;
  const LLANURA = 0, AGUA = 1, BOSQUE = 2, MONTANA = 3, CIUDAD = 4;
  const LETRAS = 'labmc', TIPOS = ['rio', 'camino', 'frontera'];
  const R_ZONA = 190, MARGEN = 28;
  const BASES = [{ x: MARGEN, y: H - MARGEN }, { x: W - MARGEN, y: MARGEN }];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const idx = (i, j) => i + j * COLS;
  const celdaDe = (x, y) => [clamp(Math.floor(x / CELDA), 0, COLS - 1), clamp(Math.floor(y / CELDA), 0, ROWS - 1)];

  function crearVacio() {
    return { nombre: 'sin título', areas: new Uint8Array(N), lineas: [], simetria: true, sigG: 1 };
  }

  // Pincel: pinta siempre la celda bajo el cursor y las que caen dentro del radio.
  function pintar(m, x, y, radio, tipo) {
    const poner = k => { m.areas[k] = tipo; if (m.simetria) m.areas[N - 1 - k] = tipo; };
    const [ci, cj] = celdaDe(x, y);
    poner(idx(ci, cj));
    const r = Math.ceil(radio / CELDA);
    for (let j = Math.max(0, cj - r); j <= Math.min(ROWS - 1, cj + r); j++) {
      for (let i = Math.max(0, ci - r); i <= Math.min(COLS - 1, ci + r); i++) {
        if (Math.hypot((i + .5) * CELDA - x, (j + .5) * CELDA - y) <= radio) poner(idx(i, j));
      }
    }
  }

  // Limpieza del trazo a mano: quita temblor, redondea y lleva los extremos al borde o al centro.
  function simplificar(p, tol) {
    const n = p.length / 2;
    if (n < 3) return p.slice();
    const marca = new Uint8Array(n); marca[0] = marca[n - 1] = 1;
    const pila = [[0, n - 1]];
    while (pila.length) {
      const [a, b] = pila.pop();
      let mx = -1, md = tol;
      for (let k = a + 1; k < b; k++) {
        const d = distSeg(p[k * 2], p[k * 2 + 1], p[a * 2], p[a * 2 + 1], p[b * 2], p[b * 2 + 1]);
        if (d > md) { md = d; mx = k; }
      }
      if (mx >= 0) { marca[mx] = 1; pila.push([a, mx], [mx, b]); }
    }
    const q = [];
    for (let k = 0; k < n; k++) if (marca[k]) q.push(p[k * 2], p[k * 2 + 1]);
    return q;
  }
  function suavizar(p, pasadas = 1) {
    let q = p;
    for (let v = 0; v < pasadas; v++) {
      if (q.length < 6) return q.slice();
      const r = [q[0], q[1]];
      for (let k = 0; k + 3 < q.length; k += 2) {
        const [x0, y0, x1, y1] = [q[k], q[k + 1], q[k + 2], q[k + 3]];
        r.push(x0 * .75 + x1 * .25, y0 * .75 + y1 * .25, x0 * .25 + x1 * .75, y0 * .25 + y1 * .75);
      }
      r.push(q[q.length - 2], q[q.length - 1]);
      q = r;
    }
    return q;
  }
  function limpiarTrazo(p, simetria) {
    const q = suavizar(simplificar(p, 2.2), 1);
    const ajustar = k => {
      if (simetria && Math.hypot(q[k] - W / 2, q[k + 1] - H / 2) <= CELDA * 1.5) { q[k] = W / 2; q[k + 1] = H / 2; return; }
      if (q[k] <= CELDA * 1.5) q[k] = 0; else if (q[k] >= W - CELDA * 1.5) q[k] = W;
      if (q[k + 1] <= CELDA * 1.5) q[k + 1] = 0; else if (q[k + 1] >= H - CELDA * 1.5) q[k + 1] = H;
    };
    ajustar(0); ajustar(q.length - 2);
    return q;
  }
  const espejoP = p => p.map((v, k) => (k % 2 === 0 ? W - v : H - v));
  function agregarLinea(m, t, p) {
    const g = m.sigG++;
    m.lineas.push({ t, p, g });
    if (m.simetria) m.lineas.push({ t, p: espejoP(p), g });
    return g;
  }
  function distSeg(x, y, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy;
    const t = l ? clamp(((x - x0) * dx + (y - y0) * dy) / l, 0, 1) : 0;
    return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
  }
  function quitarLineaCerca(m, x, y, tol) {
    let mejor = null, md = tol;
    for (const l of m.lineas) {
      for (let k = 0; k + 3 < l.p.length; k += 2) {
        const d = distSeg(x, y, l.p[k], l.p[k + 1], l.p[k + 2], l.p[k + 3]);
        if (d < md) { md = d; mejor = l; }
      }
    }
    if (!mejor) return false;
    m.lineas = m.lineas.filter(l => l.g !== mejor.g);
    return true;
  }

  // Recorrido 4-conexo: un trazo convertido a celdas nunca deja huecos en diagonal.
  function celdasDeSegmento(x0, y0, x1, y1, emitir) {
    x0 = clamp(x0, 0, W - 1e-6); x1 = clamp(x1, 0, W - 1e-6);
    y0 = clamp(y0, 0, H - 1e-6); y1 = clamp(y1, 0, H - 1e-6);
    let cx = Math.floor(x0 / CELDA), cy = Math.floor(y0 / CELDA);
    const ex = Math.floor(x1 / CELDA), ey = Math.floor(y1 / CELDA);
    const dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    let tx = dx !== 0 ? ((sx > 0 ? (cx + 1) * CELDA : cx * CELDA) - x0) / dx : Infinity;
    let ty = dy !== 0 ? ((sy > 0 ? (cy + 1) * CELDA : cy * CELDA) - y0) / dy : Infinity;
    const dtx = dx !== 0 ? CELDA / Math.abs(dx) : Infinity, dty = dy !== 0 ? CELDA / Math.abs(dy) : Infinity;
    emitir(cx, cy);
    let tope = COLS + ROWS + 4;
    while ((cx !== ex || cy !== ey) && tope-- > 0) {
      if (tx < ty) { tx += dtx; cx += sx; } else { ty += dty; cy += sy; }
      emitir(clamp(cx, 0, COLS - 1), clamp(cy, 0, ROWS - 1));
    }
  }
  function rasterizar(m, t, sal) {
    for (const l of m.lineas) {
      if (l.t !== t) continue;
      for (let k = 0; k + 3 < l.p.length; k += 2) {
        celdasDeSegmento(l.p[k], l.p[k + 1], l.p[k + 2], l.p[k + 3], (i, j) => { sal[idx(i, j)] = 1; });
      }
    }
  }

  const V8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function ruta(bloqueo, a, b) {
    if (bloqueo[a] || bloqueo[b]) return false;
    const vis = new Uint8Array(N), cola = [a];
    vis[a] = 1;
    for (let h = 0; h < cola.length; h++) {
      const k = cola[h];
      if (k === b) return true;
      const i = k % COLS, j = (k - i) / COLS;
      for (const [dx, dy] of V8) {
        const x = i + dx, y = j + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const q = idx(x, y);
        if (vis[q] || bloqueo[q]) continue;
        // Sin atajos por las esquinas de lo que bloquea.
        if (dx && dy && (bloqueo[idx(i + dx, j)] || bloqueo[idx(i, j + dy)])) continue;
        vis[q] = 1; cola.push(q);
      }
    }
    return false;
  }

  function derivar(m) {
    const rio = new Uint8Array(N), camino = new Uint8Array(N), fro = new Uint8Array(N);
    rasterizar(m, 'rio', rio); rasterizar(m, 'camino', camino); rasterizar(m, 'frontera', fro);
    // Dos trazos en espejo no caen en celdas exactamente opuestas: se unen para que el mapa sea justo.
    if (m.simetria) for (const c of [rio, camino, fro]) for (let k = 0; k < N; k++) if (c[k]) c[N - 1 - k] = 1;
    const puente = new Uint8Array(N), bloqueo = new Uint8Array(N);
    const cuenta = [0, 0, 0, 0, 0];
    for (let k = 0; k < N; k++) {
      cuenta[m.areas[k]]++;
      const agua = m.areas[k] === AGUA || rio[k];
      puente[k] = agua && camino[k] ? 1 : 0;
      bloqueo[k] = agua && !puente[k] ? 1 : 0;
    }
    const [ax, ay] = celdaDe(BASES[0].x, BASES[0].y), [bx, by] = celdaDe(BASES[1].x, BASES[1].y);
    const A = idx(ax, ay), B = idx(bx, by);

    // Lados: la frontera es una barrera 4-conexa, así que un relleno 8-conexo no la atraviesa.
    const lado = new Int8Array(N), hayFrontera = m.lineas.some(l => l.t === 'frontera');
    let separa = false;
    if (hayFrontera && !fro[A] && !fro[B]) {
      const cola = [A]; lado[A] = 1;
      for (let h = 0; h < cola.length; h++) {
        const k = cola[h], i = k % COLS, j = (k - i) / COLS;
        for (const [dx, dy] of V8) {
          const x = i + dx, y = j + dy;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          const q = idx(x, y);
          if (!lado[q] && !fro[q]) { lado[q] = 1; cola.push(q); }
        }
      }
      separa = lado[B] === 0;
    }
    for (let k = 0; k < N; k++) {
      const i = k % COLS, j = (k - i) / COLS;
      const dA = Math.hypot((i + .5) * CELDA - BASES[0].x, (j + .5) * CELDA - BASES[0].y);
      const dB = Math.hypot((i + .5) * CELDA - BASES[1].x, (j + .5) * CELDA - BASES[1].y);
      const cerca = dA < dB ? 1 : dA > dB ? -1 : (k < N / 2 ? 1 : -1);
      if (!separa) lado[k] = cerca;
      else if (fro[k]) lado[k] = cerca;
      else if (!lado[k]) lado[k] = -1;
    }

    let puentes = 0;
    const vistoP = new Uint8Array(N), centrosPuente = [];
    for (let k = 0; k < N; k++) {
      if (!puente[k] || vistoP[k]) continue;
      puentes++;
      const cola = [k]; vistoP[k] = 1;
      let sx = 0, sy = 0;
      for (let h = 0; h < cola.length; h++) {
        const c = cola[h], i = c % COLS, j = (c - i) / COLS;
        sx += (i + .5) * CELDA; sy += (j + .5) * CELDA;
        for (const [dx, dy] of V8) {
          const x = i + dx, y = j + dy;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          const q = idx(x, y);
          if (puente[q] && !vistoP[q]) { vistoP[q] = 1; cola.push(q); }
        }
      }
      centrosPuente.push({ x: sx / cola.length, y: sy / cola.length });
    }
    const hayRuta = ruta(bloqueo, A, B);
    const avisos = [];
    if (!hayFrontera) avisos.push('falta dibujar la frontera');
    else if (!separa) avisos.push('la frontera no separa las bases');
    if (!hayRuta) avisos.push('no hay ruta terrestre entre las bases');
    if (bloqueo[A] || bloqueo[B]) avisos.push('una base está sobre agua');
    return { rio, camino, fro, puente, bloqueo, lado, separa, hayRuta, puentes, centrosPuente, cuenta, avisos };
  }

  // Costas: contorno del agua, encadenado y redondeado para que no se lea la retícula.
  function costas(m) {
    const seg = [], clave = (x, y) => x + y * (COLS + 1), desde = new Map(), entrantes = new Map();
    const esAgua = (i, j) => m.areas[idx(i, j)] === AGUA;
    const poner = (x0, y0, x1, y1) => {
      const s = { x0, y0, x1, y1, usado: false };
      seg.push(s);
      const a = clave(x0, y0), b = clave(x1, y1);
      if (!desde.has(a)) desde.set(a, []);
      desde.get(a).push(s);
      entrantes.set(b, (entrantes.get(b) || 0) + 1);
    };
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      if (!esAgua(i, j)) continue;
      if (j > 0 && !esAgua(i, j - 1)) poner(i, j, i + 1, j);
      if (i < COLS - 1 && !esAgua(i + 1, j)) poner(i + 1, j, i + 1, j + 1);
      if (j < ROWS - 1 && !esAgua(i, j + 1)) poner(i + 1, j + 1, i, j + 1);
      if (i > 0 && !esAgua(i - 1, j)) poner(i, j + 1, i, j);
    }
    const caminos = [];
    const recorrer = ini => {
      const p = [ini.x0 * CELDA, ini.y0 * CELDA];
      let s = ini;
      while (s && !s.usado) {
        s.usado = true;
        p.push(s.x1 * CELDA, s.y1 * CELDA);
        s = (desde.get(clave(s.x1, s.y1)) || []).find(o => !o.usado);
      }
      caminos.push(suavizar(p, 3));
    };
    for (const s of seg) if (!s.usado && !entrantes.has(clave(s.x0, s.y0))) recorrer(s);
    for (const s of seg) if (!s.usado) recorrer(s);
    return caminos;
  }

  // Muestreo por ritmo: cada patrón es una lista de posiciones y radios dentro de un ciclo.
  function muestrear(p, ciclo, marcas, emitir) {
    let acum = 0, k = 0, n = 0;
    if (p.length < 4) return;
    let lseg = Math.hypot(p[2] - p[0], p[3] - p[1]);
    for (let c = 0; c < 20000; c++) {
      for (const [d, r] of marcas) {
        const s = c * ciclo + d;
        while (s > acum + lseg) {
          acum += lseg; k += 2;
          if (k + 3 >= p.length) return;
          lseg = Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]);
        }
        const t = lseg ? (s - acum) / lseg : 0;
        emitir(p[k] + (p[k + 2] - p[k]) * t, p[k + 1] + (p[k + 3] - p[k + 1]) * t, r, n++);
      }
    }
  }

  // Formato de archivo
  function aRLE(a) {
    let s = '', k = 0;
    while (k < a.length) {
      let f = k;
      while (f < a.length && a[f] === a[k]) f++;
      s += LETRAS[a[k]] + (f - k);
      k = f;
    }
    return s;
  }
  function deRLE(s, total = N) {
    const a = new Uint8Array(total);
    const re = /([labmc])(\d+)/g;
    let k = 0, m, fin = 0;
    while ((m = re.exec(s))) {
      if (m.index !== fin) throw new Error('El dibujo de áreas está dañado.');
      fin = re.lastIndex;
      const n = +m[2];
      if (k + n > total) throw new Error('El dibujo de áreas tiene más celdas que el mapa.');
      a.fill(LETRAS.indexOf(m[1]), k, k + n);
      k += n;
    }
    if (fin !== s.length || k !== total) throw new Error('El dibujo de áreas no cubre el mapa completo.');
    return a;
  }
  function aJSON(m) {
    return JSON.stringify({ formato: 'doctrina-mapa', v: 3, nombre: m.nombre, cols: COLS, rows: ROWS, celda: CELDA, simetria: m.simetria, areas: aRLE(m.areas),
      lineas: m.lineas.map(l => ({ t: l.t, g: l.g, p: l.p.map(v => Math.round(v * 10) / 10) })) });
  }
  function deJSON(txt) {
    let o;
    try { o = JSON.parse(txt); } catch (_) { throw new Error('El texto no es JSON válido.'); }
    if (!o || o.formato !== 'doctrina-mapa') throw new Error('Este JSON no es un mapa de doctrina.');
    if (o.v !== 1 && o.v !== 2 && o.v !== 3) throw new Error(`Versión de mapa no admitida: ${o.v}.`);
    // Los mapas antiguos medían 52×32 (v1) o 104×64 (v2): se convierten multiplicando cada celda y coordenada.
    const escala = o.v === 1 ? COLS / 52 : o.v === 2 ? COLS / 104 : 1, antiguo = escala > 1, colsO = COLS / escala, rowsO = ROWS / escala;
    if (o.cols !== colsO || o.rows !== rowsO || o.celda !== CELDA) throw new Error(`El mapa debe medir ${colsO}×${rowsO} celdas de ${CELDA}.`);
    if (typeof o.areas !== 'string') throw new Error('Falta el dibujo de áreas.');
    if (!Array.isArray(o.lineas) || o.lineas.length > 600) throw new Error('La lista de líneas no es válida.');
    const m = crearVacio();
    m.nombre = typeof o.nombre === 'string' ? o.nombre.slice(0, 80) : 'sin título';
    m.simetria = !!o.simetria;
    if (antiguo) {
      const v = deRLE(o.areas, colsO * rowsO);
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) m.areas[idx(i, j)] = v[Math.floor(i / escala) + Math.floor(j / escala) * colsO];
    } else m.areas = deRLE(o.areas);
    let g = 1;
    for (const l of o.lineas) {
      if (!l || !TIPOS.includes(l.t) || !Array.isArray(l.p) || l.p.length < 4 || l.p.length % 2 || l.p.length > 8000 || !l.p.every(Number.isFinite)) throw new Error('Una línea del mapa no es válida.');
      const gr = Number.isInteger(l.g) ? l.g : g;
      m.lineas.push({ t: l.t, g: gr, p: l.p.map((v, k) => clamp(v * escala, 0, k % 2 ? H : W)) });
      g = Math.max(g, gr + 1);
    }
    m.sigG = g;
    return m;
  }

  // Mapa de ejemplo, trazado sobre una mitad y reflejado
  function ejemplo() {
    const m = crearVacio();
    m.nombre = 'Dos riberas';
    const ruido = (x, y) => Math.sin(x * .0052 + 1.3) * Math.cos(y * .0045 + .7) + .5 * Math.sin(x * .0117 + y * .0083);
    const poner = (k, t) => { m.areas[k] = t; m.areas[N - 1 - k] = t; };
    const e = W / 4992, cada = f => { for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) f((i + .5) * CELDA / e, (j + .5) * CELDA / e, idx(i, j)); };
    const distA = (x, y, L) => { let d = 1e9; for (let k = 0; k + 3 < L.length; k += 2) d = Math.min(d, distSeg(x, y, L[k], L[k + 1], L[k + 2], L[k + 3])); return d; };
    cada((x, y, k) => { if (Math.hypot(x, y) + ruido(x, y) * 156 < 1056) poner(k, AGUA); });
    // Lagos interiores de cada región.
    for (const [cx, cy, r] of [[2260, 3000, 170], [560, 1720, 150]]) cada((x, y, k) => { if (Math.hypot(x - cx, y - cy) + ruido(x * 2, y * 2) * 44 < r) poner(k, AGUA); });
    // Sierras: la del norte y una al sureste que obliga a rodear.
    for (const L of [[1320, 348, 1572, 708, 1800, 1020, 2112, 1284], [3000, 2840, 3260, 2560, 3500, 2460], [240, 1000, 420, 800, 560, 1040]]) {
      cada((x, y, k) => { const d = distA(x, y, L); if (d + ruido(x * 2, y * 2) * 72 < 170 && Math.hypot(x - 1572, y - 708) > 90) poner(k, MONTANA); });
    }
    for (const [cx, cy, r] of [[1908, 2112, 330], [1392, 1476, 200], [504, 1608, 230], [2580, 2484, 310], [3096, 2712, 200], [990, 2640, 170], [3630, 2790, 170], [1050, 1040, 210], [2080, 2860, 160], [320, 2460, 150]]) {
      cada((x, y, k) => { if (m.areas[k] === LLANURA && Math.hypot(x - cx, y - cy) + ruido(x * 3, y * 3) * 54 < r) poner(k, BOSQUE); });
    }
    // Dieciocho ciudades por lado, repartidas por regiones. Conservan su radio: conquistar una cuesta lo mismo.
    const urbes = [[700, 2650, 16], [1250, 2860, 14], [420, 2120, 14], [1800, 2790, 14], [1236, 2112, 18], [2250, 2520, 16], [756, 1980, 12], [250, 1420, 14], [720, 1240, 16],
      [1590, 1470, 14], [2136, 1776, 16], [2820, 2292, 20], [1320, 820, 14], [3300, 2700, 16], [3600, 2900, 14], [3150, 2150, 14], [2500, 2950, 14], [1800, 2200, 14]];
    for (const [cx, cy, r] of urbes) cada((x, y, k) => { if (m.areas[k] !== AGUA && Math.hypot(x - cx, y - cy) < r / e) poner(k, CIUDAD); });
    const curva = p => suavizar(p, 2).map(v => v * e);
    agregarLinea(m, 'frontera', curva([1008, 0, 1284, 288, 1200, 660, 1608, 900, 1836, 1236, 2244, 1356, 2496, 1536]));
    agregarLinea(m, 'rio', curva([576, 576, 1008, 1128, 1128, 1692, 1572, 2172, 1680, 2652, 1932, 3072]));
    agregarLinea(m, 'rio', curva([1800, 1056, 1560, 1284, 1284, 1440, 1116, 1572]));
    agregarLinea(m, 'rio', curva([3010, 3072, 3080, 2700, 2960, 2400, 3180, 2050, 3340, 1860]));
    for (const L of [
      [120, 2904, 360, 2712, 780, 2412, 1236, 2088, 1728, 1956, 2124, 1788, 2496, 1536],
      [240, 2892, 960, 2820, 1800, 2790, 2400, 2652, 2820, 2304, 3360, 2352, 3636, 2448, 3912, 2172],
      [780, 2412, 756, 1980, 900, 1572, 1284, 1284, 1572, 708, 1284, 432],
      [1284, 1284, 1590, 1470, 1728, 1956],
      [756, 1980, 420, 2120], [900, 1572, 720, 1240, 250, 1420], [720, 1240, 1320, 820, 1572, 708],
      [360, 2712, 700, 2650, 1250, 2860], [1236, 2088, 1800, 2200, 2250, 2520, 2400, 2652],
      [2820, 2304, 3150, 2150], [2400, 2652, 2500, 2950, 3300, 2700, 3600, 2900], [3300, 2700, 3360, 2352],
    ]) agregarLinea(m, 'camino', curva(L));
    return m;
  }

  return { COLS, ROWS, CELDA, W, H, N, LLANURA, AGUA, BOSQUE, MONTANA, CIUDAD, TIPOS, BASES, R_ZONA,
    crearVacio, pintar, limpiarTrazo, agregarLinea, quitarLineaCerca, celdasDeSegmento, derivar, ruta, costas, muestrear, aJSON, deJSON, ejemplo, idx };
})();
if (typeof module !== 'undefined') module.exports = ATLAS;
