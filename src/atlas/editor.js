/* atlas · dibujo y entrada */
(() => {
  'use strict';
  const A = ATLAS;
  const $ = id => document.getElementById(id);
  const cv = $('lienzo'), ctx = cv.getContext('2d', { alpha: false });
  const capa = document.createElement('canvas'), cc = capa.getContext('2d');
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const NEGRO = tok('--negro'), HUESO = tok('--hueso'), GRIS = tok('--gris'), TENUE = tok('--tenue'), CONTACTO = tok('--contacto');
  const COL = ['--avion', '--dron', '--misil', '--personal', '--vehiculo'].map(tok);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const CLAVE = 'atlas.mapa.v1';

  // Lenguaje gráfico: el número de puntos dice el terreno; el ritmo, el tipo de línea.
  const GLIFO = { [A.LLANURA]: [[0, 0]], [A.BOSQUE]: [[-3.6, -3.6], [3.6, 3.6]], [A.MONTANA]: [[0, -5.2], [-4.6, 3.4], [4.6, 3.4]], [A.CIUDAD]: [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]] };
  const ALFA = { [A.LLANURA]: .38, [A.BOSQUE]: .64, [A.MONTANA]: .95, [A.CIUDAD]: 1 };
  const TALLA = { [A.LLANURA]: 1, [A.BOSQUE]: 1.05, [A.MONTANA]: 1.25, [A.CIUDAD]: 1.3 };
  const RITMO = {
    costa: { c: 3.6, m: [[0, .6]], col: tok('--t-costa') },
    rio: { c: 3, m: [[0, .82]], col: tok('--t-rio') },
    camino: { c: 12, m: [[0, .85], [3.4, .85]], col: tok('--t-camino') },
    frontera: { c: 18, m: [[0, 1.75], [6, .8], [9, .8], [12, .8]], col: tok('--t-frontera') },
  };
  const AREAS = [
    { id: 'llanura', tipo: A.LLANURA, n: 'llanura', k: '1' },
    { id: 'agua', tipo: A.AGUA, n: 'agua', k: '2' },
    { id: 'bosque', tipo: A.BOSQUE, n: 'bosque', k: '3' },
    { id: 'montana', tipo: A.MONTANA, n: 'montaña', k: '4' },
    { id: 'ciudad', tipo: A.CIUDAD, n: 'ciudad', k: '5' },
  ];
  const LINEAS = [
    { id: 'rio', linea: 'rio', n: 'río', k: '6' },
    { id: 'camino', linea: 'camino', n: 'camino', k: '7' },
    { id: 'frontera', linea: 'frontera', n: 'frontera', k: '8' },
    { id: 'borrar', n: 'borrar línea', k: '9' },
  ];
  const HERR = [...AREAS, ...LINEAS];
  const PINCEL = [1, 36, 120];
  const ZOOM = [1, 2, 4, 7];

  let m, der, muestra = [], herr = 'bosque', pincel = 1, capaJuego = true;
  let undo = [], redo = [], trazo = null, cursor = null, sucio = true, capaSucia = true, costasCache = [], tGuardar = 0;
  let cw = 1, ch = 1, dpr = 1, s = 1, ox = 0, oy = 0, rot = false, f = 1, nivel = 0, base = 1, espacio = false, paneo = null, pinza = null, ruedaHasta = 0;
  const toques = new Map();

  /* ---------- Escala y giro ---------- */
  function medir() {
    const r = $('mesa').getBoundingClientRect();
    const cxp = cw / 2, cyp = ch / 2, wx = (cxp - ox) / s, wy = (cyp - oy) / s;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cw = Math.max(1, r.width); ch = Math.max(1, r.height);
    for (const c of [cv, capa]) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    rot = ch > cw * 1.05;
    const mw = rot ? A.H : A.W, mh = rot ? A.W : A.H;
    base = Math.min(cw / mw, ch / mh);
    s = base * ZOOM[nivel];
    f = clamp(s / 1.6, .72, 1.3);
    ox = cw / 2 - wx * s; oy = ch / 2 - wy * s;
    acotar();
    capaSucia = sucio = true;
    pedir();
  }
  function acotar() {
    const mw = (rot ? A.H : A.W) * s, mh = (rot ? A.W : A.H) * s;
    ox = mw <= cw ? (cw - mw) / 2 : clamp(ox, cw - mw, 0);
    oy = mh <= ch ? (ch - mh) / 2 : clamp(oy, ch - mh, 0);
  }
  function repintarVista() { capaSucia = sucio = true; pedir(); }
  function moverVista(dx, dy) { ox += dx; oy += dy; acotar(); repintarVista(); }
  function cambiarZoom(d, ax = cw / 2, ay = ch / 2) {
    const n = clamp(nivel + d, 0, ZOOM.length - 1);
    if (n === nivel) return;
    nivel = n;
    const s1 = base * ZOOM[n];
    ox = ax - (ax - ox) * s1 / s; oy = ay - (ay - oy) * s1 / s;
    s = s1; f = clamp(s / 1.6, .72, 1.3);
    acotar(); repintarVista();
  }
  const PX = (x, y) => (rot ? ox + y * s : ox + x * s);
  const PY = (x, y) => (rot ? oy + (A.W - x) * s : oy + y * s);
  function aMundo(e) {
    const r = cv.getBoundingClientRect();
    const u = (e.clientX - r.left - ox) / s, v = (e.clientY - r.top - oy) / s;
    const x = rot ? A.W - v : u, y = rot ? u : v;
    return { x: clamp(x, 0, A.W), y: clamp(y, 0, A.H) };
  }

  /* ---------- Dibujo ---------- */
  const circulo = (p, x, y, r) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); };
  const rombo = (p, x, y, r) => { p.moveTo(x, y - r); p.lineTo(x + r, y); p.lineTo(x, y + r); p.lineTo(x - r, y); p.closePath(); };

  function linea(c, p, r) {
    const q = new Path2D();
    A.muestrear(p, r.c, r.m, (x, y, rad) => { const a = PX(x, y), b = PY(x, y); if (a > -8 && a < cw + 8 && b > -8 && b < ch + 8) circulo(q, a, b, rad * f); });
    c.fillStyle = r.col; c.fill(q);
  }
  function dibujarBase(c, b, signo, propio) {
    const R = A.R_ZONA;
    const arco = new Path2D();
    for (let a = 0; a <= Math.PI / 2 + .001; a += 4 / R) circulo(arco, PX(b.x + signo * R * Math.cos(a), b.y - signo * R * Math.sin(a)), PY(b.x + signo * R * Math.cos(a), b.y - signo * R * Math.sin(a)), .7 * f);
    c.fillStyle = TENUE; c.fill(arco);
    if (!capaJuego) return;
    const n = 5, w = (Math.PI / 2 - .16) / n;
    for (let k = 0; k < n; k++) {
      const q = new Path2D(), a0 = k * (w + .04);
      for (let r = 44; r <= 164; r += 13) {
        const t = Math.max(1, Math.floor(w * r / 13));
        for (let i = 0; i < t; i++) {
          const a = a0 + (i + .5) * w / t, wx = b.x + signo * r * Math.cos(a), wy = b.y - signo * r * Math.sin(a);
          if (propio) circulo(q, PX(wx, wy), PY(wx, wy), 2.5 * f); else rombo(q, PX(wx, wy), PY(wx, wy), 3.4 * f);
        }
      }
      if (propio) { c.fillStyle = COL[k]; c.fill(q); } else { c.strokeStyle = COL[k]; c.globalAlpha = .5; c.lineWidth = 1; c.stroke(q); c.globalAlpha = 1; }
    }
  }
  function dibujarCapa() {
    const c = cc;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = NEGRO; c.fillRect(0, 0, cw, ch);

    // Glifos: la forma dice el dueño y el número de puntos, el terreno.
    const cubos = new Map();
    const cubo = (l, t) => { const k = l + '|' + t; if (!cubos.has(k)) cubos.set(k, new Path2D()); return cubos.get(k); };
    const rp = 1.2 * f, rr = 1.75 * f;
    for (let j = 0; j < A.ROWS; j++) for (let i = 0; i < A.COLS; i++) {
      const k = A.idx(i, j), t = m.areas[k];
      if (t === A.AGUA) continue;
      const cx = (i + .5) * A.CELDA, cy = (j + .5) * A.CELDA, pc = PX(cx, cy), qc = PY(cx, cy);
      if (pc < -20 || pc > cw + 20 || qc < -20 || qc > ch + 20) continue;
      const l = capaJuego ? der.lado[k] : 0, q = cubo(l, t), ta = TALLA[t];
      // Lejos, un punto por celda: dibujar todos los glifos del mapa entero sería lento.
      if (s < 1.1) { const r = rp * ta; q.rect(pc - r, qc - r, r * 2, r * 2); continue; }
      for (const [dx, dy] of GLIFO[t]) {
        const x = PX(cx + dx, cy + dy), y = PY(cx + dx, cy + dy);
        if (l < 0) rombo(q, x, y, rr * ta); else circulo(q, x, y, (l > 0 ? rp : rp * .85) * ta);
      }
    }
    c.lineWidth = .85;
    for (const [k, q] of cubos) {
      const [l, t] = k.split('|').map(Number), tinta = t === A.CIUDAD ? HUESO : GRIS;
      c.globalAlpha = ALFA[t];
      if (l < 0) { c.strokeStyle = tinta; c.stroke(q); } else { c.fillStyle = tinta; c.fill(q); }
    }
    c.globalAlpha = 1;

    for (const p of costasCache) linea(c, p, RITMO.costa);
    for (const t of ['rio', 'camino', 'frontera']) for (const l of m.lineas) if (l.t === t) linea(c, l.p, RITMO[t]);

    const puentes = new Path2D();
    for (const p of der.centrosPuente) circulo(puentes, PX(p.x, p.y), PY(p.x, p.y), 3.6 * f);
    c.strokeStyle = HUESO; c.lineWidth = 1; c.stroke(puentes);

    dibujarBase(c, A.BASES[0], 1, true);
    dibujarBase(c, A.BASES[1], -1, false);

    if (capaJuego) {
      const pro = COL.map(() => new Path2D()), ene = COL.map(() => new Path2D()), gr = new Path2D(), ce = new Path2D();
      for (const u of muestra) {
        const x = PX(u.x, u.y), y = PY(u.x, u.y);
        if (u.gris) { rombo(gr, x, y, 4.6 * f); ce.rect(x - .8, y - .8, 1.6, 1.6); }
        else if (u.lado > 0) circulo(pro[u.c], x, y, (u.c < 3 ? 3.2 : 2.7) * f);
        else rombo(ene[u.c], x, y, (u.c < 3 ? 4.6 : 4) * f);
      }
      c.lineWidth = 1.2;
      COL.forEach((col, k) => { c.fillStyle = col; c.fill(pro[k]); c.strokeStyle = col; c.stroke(ene[k]); });
      c.strokeStyle = CONTACTO; c.stroke(gr); c.fillStyle = CONTACTO; c.fill(ce);
    }

    // Esquinas del mapa, para leer sus límites cuando sobra margen
    const esq = new Path2D();
    for (const [x, y] of [[0, 0], [A.W, 0], [0, A.H], [A.W, A.H]]) { const px = PX(x, y), py = PY(x, y); esq.rect(px - 1, py - 1, 2, 2); }
    c.fillStyle = TENUE; c.fill(esq);
    capaSucia = false;
  }

  function dibujar() {
    sucio = false;
    if (capaSucia) dibujarCapa();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(capa, 0, 0, cw, ch);
    const h = HERR.find(x => x.id === herr);
    if (trazo && trazo.k === 'linea' && trazo.p.length >= 4) linea(ctx, trazo.p, RITMO[h.linea]);
    if (cursor) {
      const x = PX(cursor.x, cursor.y), y = PY(cursor.x, cursor.y);
      ctx.strokeStyle = HUESO; ctx.lineWidth = 1; ctx.globalAlpha = .75;
      ctx.beginPath();
      if (h.tipo !== undefined) ctx.arc(x, y, Math.max(A.CELDA * .5, PINCEL[pincel]) * s, 0, TAU);
      else ctx.arc(x, y, h.id === 'borrar' ? 8 * s : 3, 0, TAU);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  function pedir() { if (!pedir.p) { pedir.p = true; requestAnimationFrame(() => { pedir.p = false; dibujar(); }); } }

  /* ---------- Estado derivado ---------- */
  function generarMuestra() {
    const r = (() => { let t = 11; return () => { t = (t + 0x6D2B79F5) | 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; })();
    const cand = [[], []];
    for (let j = 0; j < A.ROWS; j++) for (let i = 0; i < A.COLS; i++) {
      const k = A.idx(i, j);
      if (der.bloqueo[k]) continue;
      let frente = false;
      for (let dy = -4; dy <= 4 && !frente; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = i + dx, y = j + dy;
        if (x >= 0 && y >= 0 && x < A.COLS && y < A.ROWS && der.lado[A.idx(x, y)] !== der.lado[k]) { frente = true; break; }
      }
      if (frente) cand[der.lado[k] > 0 ? 0 : 1].push([i, j]);
    }
    muestra = [];
    const pesos = [1, 2, 0, 5, 2];
    const tomar = () => { let t = r() * 10; for (let c = 0; c < 5; c++) { t -= pesos[c]; if (t <= 0) return c; } return 3; };
    cand.forEach((l, q) => {
      for (let n = 0; n < Math.min(34, l.length); n++) {
        const [i, j] = l[Math.floor(r() * l.length)];
        muestra.push({ x: (i + .2 + r() * .6) * A.CELDA, y: (j + .2 + r() * .6) * A.CELDA, c: tomar(), lado: q ? -1 : 1, gris: q === 1 && r() < .4 });
      }
    });
  }
  function pintarEstado() {
    const pct = t => Math.round(100 * der.cuenta[t] / A.N);
    const filas = [
      [der.separa ? 'la frontera separa las bases' : (der.avisos.find(a => a.includes('frontera')) || 'la frontera no separa las bases'), !der.separa],
      [der.hayRuta ? 'hay ruta terrestre entre bases' : 'no hay ruta terrestre entre bases', !der.hayRuta],
      [`puentes ${der.puentes}`, false],
      [`agua ${pct(A.AGUA)} % · bosque ${pct(A.BOSQUE)} %`, false],
      [`montaña ${pct(A.MONTANA)} % · ciudad ${pct(A.CIUDAD)} %`, false],
    ];
    if (der.avisos.some(a => a.includes('base está'))) filas.push(['una base está sobre agua', true]);
    const ul = $('valida');
    ul.textContent = '';
    for (const [t, mal] of filas) { const li = document.createElement('li'); li.textContent = t; if (mal) li.className = 'falta'; ul.appendChild(li); }
    $('deshacer').disabled = !undo.length; $('rehacer').disabled = !redo.length;
  }
  function cambio(geometria = true) {
    der = A.derivar(m);
    if (geometria) costasCache = A.costas(m);
    generarMuestra();
    pintarEstado();
    capaSucia = sucio = true;
    pedir();
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => { try { localStorage.setItem(CLAVE, A.aJSON(m)); } catch (_) { /* sin almacenamiento */ } }, 400);
  }
  const copia = () => ({ areas: m.areas.slice(), lineas: m.lineas.map(l => ({ t: l.t, g: l.g, p: l.p.slice() })), sigG: m.sigG });
  function guardarUndo() { undo.push(copia()); if (undo.length > 60) undo.shift(); redo = []; }
  function restaurar(e) { m.areas = e.areas; m.lineas = e.lineas; m.sigG = e.sigG; cambio(); }
  function deshacer() { if (undo.length) { redo.push(copia()); restaurar(undo.pop()); } }
  function rehacer() { if (redo.length) { undo.push(copia()); restaurar(redo.pop()); } }
  function cargarMapa(n) {
    m = n; undo = []; redo = [];
    $('nombre').value = m.nombre;
    $('simetria').setAttribute('aria-pressed', String(m.simetria));
    cambio();
  }

  /* ---------- Herramientas ---------- */
  function iconoArea(t) {
    if (t === A.AGUA) return '<svg width="26" height="14" aria-hidden="true"></svg>';
    return `<svg width="26" height="14" viewBox="-13 -7 26 14" aria-hidden="true">${GLIFO[t].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="currentColor"/>`).join('')}</svg>`;
  }
  function iconoLinea(t) {
    if (!t) return '<svg width="26" height="14" viewBox="-13 -7 26 14" aria-hidden="true"><path d="M-5-5 5 5M5-5-5 5" stroke="currentColor" fill="none"/></svg>';
    const r = RITMO[t], k = 26 / (t === 'frontera' ? 30 : t === 'camino' ? 30 : 26);
    let o = '';
    for (let c = 0; c * r.c < 30; c++) for (const [d, rad] of r.m) { const x = (c * r.c + d) * k - 13; if (x <= 13) o += `<circle cx="${x.toFixed(1)}" cy="0" r="${(rad * .9).toFixed(2)}" fill="currentColor"/>`; }
    return `<svg width="26" height="14" viewBox="-13 -7 26 14" aria-hidden="true">${o}</svg>`;
  }
  const botones = new Map();
  function crearBoton(h, cont, icono) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'herr'; b.setAttribute('role', 'radio');
    b.innerHTML = `${icono}<span>${h.n}</span><kbd>${h.k}</kbd>`;
    b.addEventListener('click', e => { elegir(h.id); if (e.detail) b.blur(); });
    cont.appendChild(b);
    botones.set(h.id, b);
  }
  AREAS.forEach(h => crearBoton(h, $('herrAreas'), iconoArea(h.tipo)));
  LINEAS.forEach(h => crearBoton(h, $('herrLineas'), iconoLinea(h.linea)));
  function elegir(id) { herr = id; for (const [k, b] of botones) b.setAttribute('aria-checked', String(k === id)); pedir(); }
  const tamanos = [...document.querySelectorAll('[data-p]')];
  function elegirPincel(p) { pincel = clamp(p, 0, 2); tamanos.forEach(b => b.setAttribute('aria-checked', String(+b.dataset.p === pincel))); pedir(); }
  tamanos.forEach(b => b.addEventListener('click', e => { elegirPincel(+b.dataset.p); if (e.detail) b.blur(); }));

  /* ---------- Entrada ---------- */
  function pintarHasta(p) {
    const h = HERR.find(x => x.id === herr), a = trazo.ult, d = Math.hypot(p.x - a.x, p.y - a.y), paso = Math.max(4, PINCEL[pincel] / 2), n = Math.max(1, Math.ceil(d / paso));
    for (let i = 1; i <= n; i++) A.pintar(m, a.x + (p.x - a.x) * i / n, a.y + (p.y - a.y) * i / n, PINCEL[pincel], h.tipo);
    trazo.ult = p;
  }
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 2) {
        // El segundo dedo convierte el gesto en desplazamiento: se descarta lo que empezó el primero.
        if (trazo && trazo.k === 'area') deshacer();
        trazo = null;
        const [a, b] = [...toques.values()];
        pinza = { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return;
      }
      if (toques.size > 2) return;
    }
    if (e.button === 1 || (e.button === 0 && espacio)) {
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* puntero ya liberado */ }
      paneo = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* puntero ya liberado */ }
    const p = aMundo(e), h = HERR.find(x => x.id === herr);
    if (h.tipo !== undefined) {
      guardarUndo();
      A.pintar(m, p.x, p.y, PINCEL[pincel], h.tipo);
      trazo = { k: 'area', ult: p };
      cambio();
    } else if (h.linea) {
      trazo = { k: 'linea', p: [p.x, p.y] };
    } else {
      guardarUndo();
      if (A.quitarLineaCerca(m, p.x, p.y, 10)) cambio(); else { undo.pop(); pintarEstado(); }
    }
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && toques.has(e.pointerId)) {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinza && toques.size === 2) {
        const [a, b] = [...toques.values()], d = Math.hypot(a.x - b.x, a.y - b.y), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        moverVista(x - pinza.x, y - pinza.y);
        pinza.x = x; pinza.y = y;
        if (d / pinza.d > 1.3) { cambiarZoom(1, x, y); pinza.d = d; } else if (d / pinza.d < .77) { cambiarZoom(-1, x, y); pinza.d = d; }
        return;
      }
    }
    if (paneo) { moverVista(e.clientX - paneo.x, e.clientY - paneo.y); paneo.x = e.clientX; paneo.y = e.clientY; return; }
    const p = aMundo(e);
    cursor = e.pointerType === 'mouse' ? p : null;
    if (trazo && trazo.k === 'area') {
      pintarHasta(p);
      // Recalcular todo el mapa en cada movimiento pesa: durante el trazo basta unas veces por segundo.
      const ahora = performance.now();
      if (ahora - (trazo.t || 0) > 160) { trazo.t = ahora; cambio(); } else { capaSucia = sucio = true; }
    }
    else if (trazo && trazo.k === 'linea') {
      const q = trazo.p, n = q.length;
      if (Math.hypot(p.x - q[n - 2], p.y - q[n - 1]) >= 3) q.push(p.x, p.y);
    }
    pedir();
  });
  const soltar = e => {
    if (e.pointerType === 'touch') { toques.delete(e.pointerId); if (toques.size < 2) pinza = null; }
    if (paneo) { paneo = null; return; }
    if (trazo && trazo.k === 'area') cambio();
    if (trazo && trazo.k === 'linea' && e.type === 'pointerup') {
      const q = trazo.p;
      let largo = 0;
      for (let k = 0; k + 3 < q.length; k += 2) largo += Math.hypot(q[k + 2] - q[k], q[k + 3] - q[k + 1]);
      if (largo >= 12) { guardarUndo(); A.agregarLinea(m, HERR.find(x => x.id === herr).linea, A.limpiarTrazo(q, m.simetria)); trazo = null; cambio(); }
    }
    trazo = null;
    pedir();
  };
  cv.addEventListener('pointerup', soltar);
  cv.addEventListener('pointercancel', soltar);
  cv.addEventListener('pointerleave', () => { cursor = null; pedir(); });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now();
    if (now < ruedaHasta || !e.deltaY) return;
    ruedaHasta = now + 160;
    const r = cv.getBoundingClientRect();
    cambiarZoom(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const conClic = (id, fn) => $(id).addEventListener('click', e => { fn(); if (e.detail) e.currentTarget.blur(); });
  function alternarSimetria() { m.simetria = !m.simetria; $('simetria').setAttribute('aria-pressed', String(m.simetria)); cambio(false); }
  function alternarJuego() { capaJuego = !capaJuego; $('juego').setAttribute('aria-pressed', String(capaJuego)); capaSucia = true; pedir(); }
  conClic('titulo', () => location.reload());
  conClic('simetria', alternarSimetria);
  conClic('juego', alternarJuego);
  conClic('deshacer', deshacer);
  conClic('rehacer', rehacer);
  conClic('ejemplo', () => { guardarUndo(); const e = A.ejemplo(); m.areas = e.areas; m.lineas = e.lineas; m.sigG = e.sigG; m.nombre = e.nombre; m.simetria = e.simetria; $('nombre').value = m.nombre; $('simetria').setAttribute('aria-pressed', String(m.simetria)); cambio(); });
  conClic('limpiar', () => { guardarUndo(); const e = A.crearVacio(); m.areas = e.areas; m.lineas = e.lineas; m.sigG = e.sigG; cambio(); });
  $('nombre').addEventListener('input', e => { m.nombre = e.target.value; cambio(false); });

  /* ---------- Guardar y cargar ---------- */
  const msg = t => { $('msgJson').textContent = t; };
  function abrirJson() { $('json').value = A.aJSON(m); msg(''); $('hojaJson').hidden = false; $('json').focus(); $('json').select(); }
  function cerrarJson() { $('hojaJson').hidden = true; }
  function intentarCargar(txt) {
    try { const n = A.deJSON(txt); guardarUndo(); const u = undo; cargarMapa(n); undo = u; pintarEstado(); msg(`Mapa cargado: ${n.nombre}`); return true; }
    catch (err) { msg(err.message); return false; }
  }
  conClic('abrirJson', abrirJson);
  conClic('cerrarJson', cerrarJson);
  conClic('cargar', () => { if (intentarCargar($('json').value)) cerrarJson(); });
  conClic('copiar', () => {
    const t = $('json').value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => msg('Copiado.'), () => { $('json').select(); msg('El navegador no dejó copiar. El texto quedó seleccionado.'); });
    } else { $('json').select(); msg('El texto quedó seleccionado.'); }
  });
  conClic('elegirArchivo', () => $('archivo').click());
  $('archivo').addEventListener('change', e => {
    const a = e.target.files && e.target.files[0];
    if (!a) return;
    const r = new FileReader();
    r.onload = () => { $('json').value = String(r.result); msg('Archivo leído. Pulsa cargar.'); };
    r.onerror = () => msg('No pude leer ese archivo.');
    r.readAsText(a);
    e.target.value = '';
  });
  // La descarga solo existe fuera de un marco; dentro de un artefacto el navegador la bloquea.
  $('bajar').hidden = window.top !== window.self;
  conClic('bajar', () => {
    const b = new Blob([A.aJSON(m)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = (m.nombre || 'mapa').replace(/[^\w\-áéíóúñ ]+/gi, '').trim().replace(/\s+/g, '-') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  addEventListener('keydown', e => {
    const t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') { if (e.key === 'Escape' && !$('hojaJson').hidden) cerrarJson(); return; }
    if (e.key === 'Escape' && !$('hojaJson').hidden) { cerrarJson(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); espacio = true; cv.classList.add('mover'); return; }
    if (e.key.startsWith('Arrow')) { e.preventDefault(); moverVista(e.key === 'ArrowLeft' ? 90 : e.key === 'ArrowRight' ? -90 : 0, e.key === 'ArrowUp' ? 90 : e.key === 'ArrowDown' ? -90 : 0); return; }
    if (e.key === '+' || e.key === '=') { cambiarZoom(1); return; }
    if (e.key === '-') { cambiarZoom(-1); return; }
    const h = HERR.find(x => x.k === e.key);
    if (h) { elegir(h.id); return; }
    const k = e.key.toLowerCase();
    if (e.key === '[') elegirPincel(pincel - 1);
    else if (e.key === ']') elegirPincel(pincel + 1);
    else if (k === 's') alternarSimetria();
    else if (k === 'j') alternarJuego();
  });

  addEventListener('keyup', e => { if (e.code === 'Space') { espacio = false; cv.classList.remove('mover'); } });
  addEventListener('blur', () => { espacio = false; cv.classList.remove('mover'); });
  conClic('zMas', () => cambiarZoom(1));
  conClic('zMenos', () => cambiarZoom(-1));

  /* ---------- Inicio ---------- */
  new ResizeObserver(medir).observe($('mesa'));
  let inicial = null;
  try { const g = localStorage.getItem(CLAVE); if (g) inicial = A.deJSON(g); } catch (_) { inicial = null; }
  elegir(herr); elegirPincel(pincel);
  medir();
  cargarMapa(inicial || A.ejemplo());
  window.atlas = { get mapa() { return m; }, get der() { return der; }, A };
})();
