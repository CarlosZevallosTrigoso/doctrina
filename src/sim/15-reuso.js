  /* Azar, rutas, círculos de visión y satélites */
  function azar(st) {
    let t = st.sem = (st.sem + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  }
  function mulberry(seed) {
    const o = { sem: seed | 0 };
    return () => azar(o);
  }

  // Rutas: un campo de costos por destino y tipo de marcha, recalculado solo si cambia un puente.
  const V8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const transitable = (st, k) => !st.mapa.der.bloqueo[k] && !st.roto[k];
  // Dijkstra corre en doble precisión sobre un arreglo compartido; se guarda en simple para gastar la mitad de memoria.
  function calcularCampo(st, dest, q) {
    const { cols, rows } = st.ter, n = cols * rows, vel = st.velT[q];
    const f = st.camposTmp || (st.camposTmp = new Float64Array(n));
    f.fill(Infinity);
    const costos = [], nodos = [];
    const subir = (c, k) => {
      let i = costos.length;
      costos.push(c); nodos.push(k);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (costos[p] <= c) break;
        costos[i] = costos[p]; nodos[i] = nodos[p]; i = p;
      }
      costos[i] = c; nodos[i] = k;
    };
    const bajar = () => {
      const c0 = costos[0], k0 = nodos[0], c = costos.pop(), k = nodos.pop(), m = costos.length;
      if (m > 0) {
        let i = 0;
        for (;;) {
          let h = 2 * i + 1;
          if (h >= m) break;
          if (h + 1 < m && costos[h + 1] < costos[h]) h++;
          if (costos[h] >= c) break;
          costos[i] = costos[h]; nodos[i] = nodos[h]; i = h;
        }
        costos[i] = c; nodos[i] = k;
      }
      return [c0, k0];
    };
    f[dest] = 0; subir(0, dest);
    while (costos.length) {
      const [c, k] = bajar();
      if (c > f[k]) continue;
      const i = k % cols, j = (k - i) / cols;
      for (const [dx, dy] of V8) {
        const x = i + dx, y = j + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const o = x + y * cols;
        if (!transitable(st, o)) continue;
        if (dx && dy && (!transitable(st, i + dx + j * cols) || !transitable(st, i + (j + dy) * cols))) continue;
        const nc = c + (dx && dy ? 1.4142 : 1) / vel[o];
        if (nc < f[o]) { f[o] = nc; subir(nc, o); }
      }
    }
    return Float32Array.from(f);
  }
  // Las rutas se calculan por zona de 4×4 celdas (el mapa se divide exacto, así ambos lados son espejo): muchas unidades con destinos cercanos comparten un solo campo.
  // Cada parte conexa de la zona tiene su propia ancla, para que un río dentro de la zona no se cruce a pie.
  const ZONA = 4;
  function anclaDe(st, k) {
    const a = st.anclas;
    if (a[k] >= 0) return a[k];
    if (!transitable(st, k)) return k;
    const { cols, rows, size } = st.ter, bi = Math.floor((k % cols) / ZONA), bj = Math.floor(((k - (k % cols)) / cols) / ZONA);
    const cx = bi * ZONA + (ZONA - 1) / 2, cy = bj * ZONA + (ZONA - 1) / 2, mx = (cols - 1) / 2, my = (rows - 1) / 2, comp = [k], visto = new Set(comp);
    for (let h = 0; h < comp.length; h++) {
      const c = comp[h], i = c % cols, j = (c - i) / cols;
      for (const [dx, dy] of V8) {
        const x = i + dx, y = j + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows || Math.floor(x / ZONA) !== bi || Math.floor(y / ZONA) !== bj) continue;
        const o = x + y * cols;
        if (visto.has(o) || !transitable(st, o)) continue;
        if (dx && dy && (!transitable(st, i + dx + j * cols) || !transitable(st, i + (j + dy) * cols))) continue;
        visto.add(o); comp.push(o);
      }
    }
    // El desempate mira al centro del mapa: la ancla de una zona y la de su espejo son espejo.
    let m = comp[0], md = Infinity, mc = Infinity;
    for (const c of comp) {
      const i = c % cols, j = (c - i) / cols, d = (i - cx) * (i - cx) + (j - cy) * (j - cy), dc = (i - mx) * (i - mx) + (j - my) * (j - my);
      if (d < md || (d === md && dc < mc)) { md = d; mc = dc; m = c; }
    }
    for (const c of comp) a[c] = m;
    return m;
  }
  // Al cambiar un puente las rutas viejas siguen sirviendo unos instantes y se renuevan poco a poco:
  // recalcularlas todas de golpe congelaría el juego.
  function limpiarRutas(st) { st.genRutas++; st.anclas.fill(-1); }
  function campo(st, dest, q, forzar) {
    const ancla = anclaDe(st, dest), clave = ancla * 2 + q, e = st.campos.get(clave);
    if (e && e.gen === st.genRutas) return e.f;
    if (!forzar && st.cuotaRutas <= 0) return e ? e.f : null;
    if (!forzar) st.cuotaRutas--;
    const f = calcularCampo(st, ancla, q);
    if (!e && st.campos.size >= 384) st.campos.delete(st.campos.keys().next().value);
    st.campos.set(clave, { f, gen: st.genRutas });
    return f;
  }
  function destinoValido(st, x, y) {
    const T = st.ter, k = celdaDe(st, x, y);
    if (transitable(st, k)) return { x, y };
    const ci = k % T.cols, cj = (k - ci) / T.cols;
    for (let r = 1; r < T.cols; r++) {
      let mejor = null, md = Infinity;
      for (let j = Math.max(0, cj - r); j <= Math.min(T.rows - 1, cj + r); j++) for (let i = Math.max(0, ci - r); i <= Math.min(T.cols - 1, ci + r); i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !transitable(st, i + j * T.cols)) continue;
        const cx = (i + .5) * T.size, cy = (j + .5) * T.size, d = Math.hypot(cx - x, cy - y);
        if (d < md) { md = d; mejor = { x: cx, y: cy }; }
      }
      if (mejor) return mejor;
    }
    return { x, y };
  }

  const circulos = new Map();
  function circulo(r) {
    let c = circulos.get(r);
    if (c) return c;
    c = [];
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) c.push(x, y);
    circulos.set(r, c);
    return c;
  }
  function estampar(st, s, cx, cy, r) {
    const T = st.ter, c = circulo(r), v = st.vis[s];
    for (let k = 0; k < c.length; k += 2) {
      const x = cx + c[k], y = cy + c[k + 1];
      if (x >= 0 && y >= 0 && x < T.cols && y < T.rows) v[x + y * T.cols] = 1;
    }
  }

  // Satélites: franjas que cruzan el mapa. Cada bando tiene la misma constelación, reflejada.
  function satelites(st, s) {
    return DATOS.satelites.map(sa => {
      const nd = Math.hypot(sa.dir[0], sa.dir[1]), ux = sa.dir[0] / nd, uy = sa.dir[1] / nd;
      const ph = (st.t * DT + sa.fase) % sa.periodo, activo = ph < sa.transito;
      const esq = [0, ux * st.W, uy * st.H, ux * st.W + uy * st.H], pmin = Math.min(...esq), pmax = Math.max(...esq);
      let c = pmin - sa.ancho / 2 + (ph / sa.transito) * (pmax - pmin + sa.ancho);
      if (s === 1) c = ux * st.W + uy * st.H - c;
      return { id: sa.id, nombre: sa.nombre, activo, c, ux, uy, ancho: sa.ancho, faltan: activo ? sa.transito - ph : sa.periodo - ph, vida: sa.vida };
    });
  }
  function foto(st, s, u, c, sat, vidaS) {
    const m = st.fotos[s], viejo = m.get(u.id);
    m.set(u.id, { id: u.id, x: u.x, y: u.y, c: c >= 0 ? c : (viejo ? viejo.c : -1), t: st.t, vence: st.t + Math.round(vidaS / DT), sat });
  }

