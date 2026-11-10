  /* ---------- Índice, visión e inteligencia ---------- */
  function indexar(st) {
    const L = st.porLado || (st.porLado = [[[], []], [[], []]]);
    L[0][0].length = L[0][1].length = L[1][0].length = L[1][1].length = 0;
    for (const u of st.unidades) if (!u.dead) L[u.s][u.aire ? 0 : 1].push(u);
  }
  function masCercano(st, lado, tierra, x, y, r, pred) {
    let m = null, md = r * r;
    for (const u of st.porLado[lado][tierra]) {
      if (u.dead) continue;
      const d = (u.x - x) ** 2 + (u.y - y) ** 2;
      if (d < md && (!pred || pred(u))) { md = d; m = u; }
    }
    return m;
  }
  // Minuto del día (0–1439) y si es de noche.
  const minutoDe = st => (DATOS.reloj.inicio + Math.floor(st.t / 30)) % 1440;
  const esNoche = st => { const m = minutoDe(st); return m < DATOS.reloj.amanece || m >= DATOS.reloj.anochece; };
  function vision(st) {
    const T = st.ter;
    for (let s = 0; s < 2; s++) {
      st.vis[s].fill(0);
      const v = st.vis[s], signo = signoDe(s);
      for (const k of st.radar[s]) v[k] = 1;
      const puesto = (k, r) => { if (dueno(st, k) === signo) { const i = k % T.cols; estampar(st, s, i, (k - i) / T.cols, r); } };
      for (const k of st.vigia[s]) puesto(k, DATOS.vigilancia.frontera);
      for (const k of st.ciudades) puesto(k, DATOS.vigilancia.ciudad);
    }
    // De noche y con tormenta se ve menos; el caza y el avión espía llevan radar y no lo notan.
    const fv = (esNoche(st) ? DATOS.reloj.visNoche : 1) * (st.tormenta > st.t ? DATOS.clima.vis : 1);
    for (const u of st.unidades) if (!u.dead) estampar(st, u.s, Math.floor(u.x / T.size), Math.floor(u.y / T.size), Math.max(1, Math.round(DATOS.clases[u.c].vis * (u.c === CAZA || u.c === ESPIA ? 1 : fv) / T.size)));
    for (const d of st.defensas) estampar(st, d.s, Math.floor(d.x / T.size), Math.floor(d.y / T.size), st.t < d.listo || (d.t === RADAR && d.off) ? 2 : DATOS.instalaciones.tipos[d.t].vis);
    const intel = st.intel || (st.intel = [[], []]);
    for (let s = 0; s < 2; s++) {
      const v = st.vis[s], m = st.mem[s];
      for (let i = 0; i < v.length; i++) if (v[i]) m[i] = dueno(st, i);
      for (const k of st.puentes) if (v[k]) st.memRoto[s][k] = st.roto[k] ? 1 : 0;
      for (const u of st.urbes) if (v[celdaDe(st, u.x, u.y)] || u.dueno === signoDe(s)) intel[s][u.id] = { dueno: u.dueno, guar: u.guar, moral: u.moral, dano: u.dano, barrios: u.barrios.filter(b => b.dueno === u.dueno).length, batalla: !!u.batalla, t: st.t };
    }
    identificar(st);
    pasarSatelites(st);
    recordarDefensas(st);
  }
  function identificar(st) {
    for (const u of st.unidades) {
      if (u.dead) continue;
      const s = 1 - u.s, cu = celdaDe(st, u.x, u.y);
      if (!st.vis[s][cu]) { u.idt = false; u.oculto = false; continue; }
      const cerca = r => masCercano(st, s, 0, u.x, u.y, r) || masCercano(st, s, 1, u.x, u.y, r);
      u.oculto = !u.aire && st.mapa.areas[cu] === A.BOSQUE && !cerca(DATOS.bosque.rDeteccion);
      if (u.oculto) { u.idt = false; continue; }
      if (u.idt) continue;
      const b = st.bases[s];
      if (Math.hypot(u.x - b.x, u.y - b.y) <= DATOS.base.rIdent) { u.idt = true; continue; }
      if (st.defensas.some(d => d.s === s && d.t === RADAR && st.t >= d.listo && Math.hypot(u.x - d.x, u.y - d.y) <= DATOS.instalaciones.tipos[RADAR].idr)) { u.idt = true; continue; }
      if (st.porLado[s][0].concat(st.porLado[s][1]).some(w => !w.dead && Math.hypot(w.x - u.x, w.y - u.y) <= DATOS.clases[w.c].idr)) u.idt = true;
    }
  }
  function recordarDefensas(st) {
    for (let s = 0; s < 2; s++) {
      const m = st.memDef[s], v = st.vis[s], vivas = new Set();
      for (const d of st.defensas) if (d.s !== s) {
        vivas.add(d.id);
        if (v[celdaDe(st, d.x, d.y)] || (d.t === RADAR && !d.off && st.t >= d.listo)) m.set(d.id, { id: d.id, x: d.x, y: d.y, t: d.t, s: d.s, enObra: st.t < d.listo });
      }
      for (const [id, q] of m) if (!vivas.has(id) && v[celdaDe(st, q.x, q.y)]) m.delete(id);
    }
  }
  function pasarSatelites(st) {
    const T = st.ter;
    for (const e of st.unidades) {
      if (e.dead || e.rol !== 'rec' || e.st !== ORBITA) continue;
      const idr = DATOS.clases[e.c].idr;
      for (const u of st.unidades) if (!u.dead && u.s !== e.s && Math.hypot(u.x - e.x, u.y - e.y) <= idr) { u.idt = true; foto(st, e.s, u, u.c, 'espia', 60); }
    }
    for (let s = 0; s < 2; s++) {
      for (const sa of satelites(st, s)) {
        if (!sa.activo) continue;
        const dentro = (x, y) => Math.abs(x * sa.ux + y * sa.uy - sa.c) <= sa.ancho / 2;
        for (const u of st.unidades) {
          if (u.dead || u.s === s || !dentro(u.x, u.y)) continue;
          if (sa.id === 'optico') {
            if (esNoche(st) || st.tormenta > st.t) continue;   // el óptico no ve de noche ni con tormenta
            if (!u.aire && st.mapa.areas[celdaDe(st, u.x, u.y)] === A.BOSQUE) continue;
            foto(st, s, u, u.c, sa.id, sa.vida);
            if (st.vis[s][celdaDe(st, u.x, u.y)]) u.idt = true;
          } else if (sa.id === 'radar') { if (!u.aire) foto(st, s, u, -1, sa.id, sa.vida); }
          else if (u.aire) foto(st, s, u, -1, sa.id, sa.vida);
        }
        if (sa.id !== 'optico') continue;
        for (let j = 0; j < T.rows; j++) for (let i = 0; i < T.cols; i++) {
          if (!dentro((i + .5) * T.size, (j + .5) * T.size)) continue;
          const k = i + j * T.cols;
          st.mem[s][k] = dueno(st, k);
          if (st.mapa.der.puente[k]) st.memRoto[s][k] = st.roto[k] ? 1 : 0;
        }
        for (const u of st.urbes) if (dentro(u.x, u.y)) st.intel[s][u.id] = { dueno: u.dueno, guar: u.guar, moral: u.moral, dano: u.dano, barrios: u.barrios.filter(b => b.dueno === u.dueno).length, batalla: !!u.batalla, t: st.t };
      }
      for (const [id, f] of st.fotos[s]) if (st.t >= f.vence) st.fotos[s].delete(id);
      const vida = seg(DATOS.alerta.vida);
      if (st.alertas[s].length) st.alertas[s] = st.alertas[s].filter(a => st.t - a.t < vida);
    }
  }

  /* ---------- Suministro ---------- */
  // Fluye desde la capital y los depósitos por tu territorio; sobrepasa la frontera unas pocas celdas.
  function calcularSuministro(st) {
    const { cols, rows, size } = st.ter, n = cols * rows, cola = st.colaSum || (st.colaSum = new Int32Array(n)), alcance = DATOS.suministro.alcance;
    const nivel = st.nivelSum || (st.nivelSum = new Int16Array(n));
    for (let s = 0; s < 2; s++) {
      const S = st.sum[s], signo = signoDe(s), cap = capitalDe(st, s);
      S.fill(0); nivel.fill(0);
      let a = 0, b = 0;
      const fuente = (x, y) => { const k = celdaDe(st, x, y); if (!S[k]) { S[k] = 1; cola[b++] = k; } };
      if (cap && cap.dueno === signo) fuente(cap.x, cap.y);
      for (const d of st.defensas) if (d.s === s && d.t === DEPOSITO && st.t >= d.listo) fuente(d.x, d.y);
      while (a < b) {
        const k = cola[a++], i = k % cols, j = (k - i) / cols, l = nivel[k];
        for (let e = 0; e < 4; e++) {
          const x = i + (e === 0 ? 1 : e === 1 ? -1 : 0), y = j + (e === 2 ? 1 : e === 3 ? -1 : 0);
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const q = x + y * cols;
          if (S[q]) continue;
          if (!transitable(st, q)) { S[q] = 1; continue; }   // la orilla cuenta, pero no propaga
          const propia = dueno(st, q) === signo;
          // Fuera del territorio propio, el suministro solo avanza unas celdas.
          if (!propia && l >= alcance) continue;
          S[q] = 1; nivel[q] = propia ? 0 : l + 1; cola[b++] = q;
        }
      }
      // Línea de abastecimiento (2): más allá del suministro pleno, una tropa aún no está cercada.
      a = 0; nivel.fill(0);
      while (a < b) {
        const k = cola[a++], i = k % cols, j = (k - i) / cols, l = nivel[k];
        if (l >= DATOS.cerco.linea) continue;
        for (let e = 0; e < 4; e++) {
          const x = i + (e === 0 ? 1 : e === 1 ? -1 : 0), y = j + (e === 2 ? 1 : e === 3 ? -1 : 0);
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const q = x + y * cols;
          if (S[q] || !transitable(st, q)) continue;
          S[q] = 2; nivel[q] = l + 1; cola[b++] = q;
        }
      }
    }
    void size;
  }
  const conSuministro = (st, s, x, y) => st.sum[s][celdaDe(st, x, y)] === 1;
  const conLinea = (st, s, x, y) => st.sum[s][celdaDe(st, x, y)] > 0;

  /* ---------- Marcha y combate en tierra ---------- */
  const qDe = u => 1;
  function mover(u, v, tx, ty) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), p = v * DT;
    if (d <= p) { u.x = tx; u.y = ty; return true; }
    u.x += dx / d * p; u.y += dy / d * p;
    return false;
  }
  function llegar(st, u) {
    u.via = null;
    if (u.c !== BLI) { u.st = DESEMBARCANDO; u.t = DATOS.embarque.bajar; } else u.st = DESPLEGADA;   // la infantería baja; artillería y antiaérea se emplazan
  }
  function marchar(st, u) {
    const T = st.ter, q = qDe(u), tx = u.tx, ty = u.ty, ci = celdaDe(st, u.x, u.y), cd = celdaDe(st, tx, ty);
    const pisa = transitable(st, ci), ac = anclaDe(st, cd);
    // Vía logística: por un camino en territorio propio y abastecido se viaja mucho más rápido.
    const via = pisa && st.velT[q][ci] === Math.fround(DATOS.relieve.camino[q]) && st.sum[u.s][ci] === 1 && dueno(st, ci) === signoDe(u.s);
    const v = st.v[u.c] * (via ? DATOS.relieve.via : pisa ? st.velT[q][ci] : 1);
    u.comb -= v * DT / DATOS.abastos.autonomia;
    if (u.comb <= 0) { u.comb = 0; u.tx = u.x; u.ty = u.y; llegar(st, u); st.ev.push({ k: 'sinCombustible', id: u.id, s: u.s, c: u.c, x: u.x, y: u.y, t: st.t }); return; }
    if (ci === cd || !pisa || anclaDe(st, ci) === ac) { if (mover(u, v, tx, ty)) llegar(st, u); return; }
    const f = campo(st, cd, q);
    if (!f) return;
    let mejor = -1, md = f[ci];
    if (!Number.isFinite(md)) { llegar(st, u); return; }
    const i = ci % T.cols, j = (ci - i) / T.cols;
    for (const [dx, dy] of V8) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= T.cols || y >= T.rows) continue;
      const o = x + y * T.cols;
      if (f[o] >= md || !transitable(st, o)) continue;
      if (dx && dy && (!transitable(st, i + dx + j * T.cols) || !transitable(st, i + (j + dy) * T.cols))) continue;
      md = f[o]; mejor = o;
    }
    if (mejor < 0) { llegar(st, u); return; }
    if (anclaDe(st, mejor) === ac) { mover(u, v, tx, ty); return; }
    const mi = mejor % T.cols, mj = (mejor - mi) / T.cols;
    mover(u, v, (mi + .5) * T.size, (mj + .5) * T.size);
  }
  function eta(st, u) {
    if (u.aire) return Math.hypot(u.x - u.tx, u.y - u.ty) / st.v[u.c];
    return etaRuta(st, u.c, u.x, u.y, u.tx, u.ty, false);
  }
  function etaRuta(st, c, x, y, tx, ty, forzar = true) {
    const cd = celdaDe(st, tx, ty), f = campo(st, cd, 1, forzar);
    if (!f) return Math.hypot(tx - x, ty - y) / st.v[c];
    return f[celdaDe(st, x, y)] * st.ter.size / st.v[c];
  }
  // Sube o baja el agotamiento de un bando y avisa al cruzar un umbral.
  function cansar(st, s, d) {
    const a = st.agot[s], b = Math.max(0, a + d); st.agot[s] = b;
    for (const n of DATOS.agotamiento.avisos) if (a < n && b >= n) st.ev.push({ k: 'moral', s, nivel: n, x: st.bases[s].x, y: st.bases[s].y, t: st.t });
  }
  function matar(st, u) {
    if (u.dead) return;
    u.dead = true; st.stats.bajas[u.s]++;
    cansar(st, u.s, u.c === MISIL ? 0 : u.c === DRON ? DATOS.agotamiento.dron : u.aire ? DATOS.agotamiento.avion : DATOS.agotamiento.tierra);
    if (u.m) { const m = st.misiones.find(q => q.id === u.m); if (m) m.res.perdidas++; }
    st.ev.push({ k: 'baja', x: u.x, y: u.y, c: u.c, s: u.s, t: st.t, m: u.m, id: u.id });
  }
  function danar(st, u, d) {
    if (!u.aire) {
      const F = DATOS.fortificacion;
      d *= 1 - F.max * (u.fort || 0);
      if (st.mapa.areas[celdaDe(st, u.x, u.y)] === A.MONTANA) d *= F.montana;
    }
    u.fuerza -= d; st.stats.fuerzaPerdida[u.s] += d;
    if (u.fuerza <= 0.05) { matar(st, u); return; }
    if (!u.aire && !u.rota && u.fuerza < DATOS.clases[u.c].fuerza * DATOS.quiebre.umbral) { quebrar(st, u); return; }
    // Doctrina de preservación: retirarse por orden antes de quebrarse. Conserva la cohesión y sigue obedeciendo.
    const pres = st.doctrina[u.s].preservar;
    if (!u.aire && !u.rota && pres > 0 && u.fuerza < DATOS.clases[u.c].fuerza * pres && !(u.repliegue > st.t) && (u.c !== INF || u.camion)) {
      const signo = signoDe(u.s), h = c => Math.hypot(c.x - u.x, c.y - u.y);
      const ref = st.urbes.filter(c => c.dueno === signo && !c.batalla && conSuministro(st, u.s, c.x, c.y) && h(c) > DATOS.ciudad.rZona).sort((a, b) => h(a) - h(b) || a.id - b.id)[0];
      if (ref) { u.repliegue = st.t + seg(240); u.m = 0; ordenarMover(st, u.s, [u], ref.x, ref.y, 0); st.ev.push({ k: 'repliegue', id: u.id, s: u.s, c: u.c, x: u.x, y: u.y, t: st.t }); }
    }
  }
  // Se quiebra: no pelea ni obedece hasta rehacerse; se retira sola a la ciudad propia abastecida más cercana.
  function quebrar(st, u) {
    u.rota = true; u.fort = 0; u.m = 0;
    cansar(st, u.s, DATOS.agotamiento.tierra * DATOS.quiebre.moral);
    st.ev.push({ k: 'quiebre', id: u.id, s: u.s, c: u.c, x: u.x, y: u.y, t: st.t });
    if (u.c === INF && !u.camion) return;
    const signo = signoDe(u.s), h = c => Math.hypot(c.x - u.x, c.y - u.y);
    const ref = st.urbes.filter(c => c.dueno === signo && !c.batalla && conSuministro(st, u.s, c.x, c.y)).sort((a, b) => h(a) - h(b) || a.id - b.id)[0] || st.urbes.find(c => c.capital && c.dueno === signo);
    if (ref) ordenarMover(st, u.s, [u], ref.x, ref.y, 0, true);
  }
  function danarInstalacion(st, d, n = 1) {
    d.hp -= n;
    if (d.hp > 0) return;
    const i = st.defensas.indexOf(d);
    if (i >= 0) st.defensas.splice(i, 1);
    st.ev.push({ k: 'defensa', x: d.x, y: d.y, d: d.t, s: d.s, t: st.t });
  }
  function pasoTierra(st, u) {
    if (u.cd > 0) u.cd -= DT;
    if (u.st === EMBARCANDO) { u.t -= DT; if (u.t <= 0) u.st = MARCHA; return; }
    if (u.st === DESEMBARCANDO) { u.t -= DT; if (u.t <= 0) u.st = DESPLEGADA; return; }
    const cl = DATOS.clases[u.c], e = 1 - u.s, C = DATOS.combate, enBatalla = u.urbe >= 0 && st.urbes[u.urbe].batalla;
    if (u.rota) { if (u.st === MARCHA) marchar(st, u); return; }
    const roe = st.doctrina[u.s].artilleria;
    if (u.c === ART && u.st === DESPLEGADA && u.cd <= 0 && u.mun > 0 && roe !== 'silencio') {
      // Fuego indirecto: sobre lo que su bando ve o sobre una batería que se delató al disparar (contrabatería primero).
      let t = null, mejor = 1e9;
      for (const w of st.porLado[e][1]) {
        if (w.dead) continue;
        const h = Math.hypot(w.x - u.x, w.y - u.y);
        if (h > cl.rango || h < cl.directo) continue;
        const delatada = w.delata > st.t;
        if (roe === 'contra' && !(delatada && w.c === ART)) continue;   // solo contrabatería
        if (!delatada && (w.oculto || !st.vis[u.s][celdaDe(st, w.x, w.y)])) continue;
        const p = (delatada && w.c === ART ? 0 : 1e4) + h;
        if (p < mejor) { mejor = p; t = w; }
      }
      if (t) {
        u.cd = cl.cd * (.85 + azar(st) * .3); u.idt = true; u.oculto = false; u.delata = st.t + seg(DATOS.artilleria.delata); u.mun = Math.max(0, u.mun - DATOS.abastos.tiro[ART]);
        const x = t.x + (azar(st) - .5) * 24, y = t.y + (azar(st) - .5) * 24;
        st.ev.push({ k: 'tiro', x: u.x, y: u.y, x2: x, y2: y, c: u.c, s: u.s, t: st.t });
        golpear(st, u.s, x, y, 'golpe', u);
        if (t.urbe >= 0) { const c = st.urbes[t.urbe]; if (c.batalla && ladoDe(c.dueno) === e) retirarDeGuarnicion(c, DATOS.artilleria.guarnicion); }
        return;
      }
    }
    if (u.c === AAM && u.st === DESPLEGADA && u.cd <= 0 && u.mun > 0) {
      const t = masCercano(st, e, 0, u.x, u.y, cl.rango, w => w.c !== MISIL);
      if (t) {
        u.cd = cl.cd; t.idt = true; u.idt = true; u.mun = Math.max(0, u.mun - DATOS.abastos.tiro[AAM]);
        st.ev.push({ k: 'tiro', x: u.x, y: u.y, x2: t.x, y2: t.y, c: CAZA, s: u.s, t: st.t });
        if (azar(st) < (cl.pk[t.c] || .3)) matar(st, t);
        return;
      }
    }
    const blanco = enBatalla ? null : masCercano(st, e, 1, u.x, u.y, cl.directo || cl.rango, w => !w.oculto);
    if (u.st === MARCHA) {
      // Una compañía embarcada no pelea: si la emboscan, desembarca donde esté.
      if (u.c === INF && masCercano(st, e, 1, u.x, u.y, C.emboscada, w => w.st === DESPLEGADA || w.c === BLI)) { u.st = DESEMBARCANDO; u.t = DATOS.embarque.bajar; return; }
      if (!blanco) { marchar(st, u); return; }
      if (u.c === INF) return;
    }
    if (u.cd > 0) return;
    if (blanco) {
      u.cd = cl.cd * (.85 + azar(st) * .3); u.idt = true; u.oculto = false;
      st.ev.push({ k: 'tiro', x: u.x, y: u.y, x2: blanco.x, y2: blanco.y, c: u.c, s: u.s, t: st.t });
      const cruce = u.c === BLI && blanco.c === INF ? C.blindadoVsInf : u.c === INF && blanco.c === BLI ? C.infVsBlindado : 1;
      const sum = conSuministro(st, u.s, u.x, u.y) ? 1 : C.sinSuministro, cob = st.mapa.areas[celdaDe(st, blanco.x, blanco.y)] === A.BOSQUE ? C.bosque : 1;
      const seca = u.mun > 0 ? 1 : DATOS.abastos.sinMunicion; u.mun = Math.max(0, u.mun - (DATOS.abastos.tiro[u.c] || .02));
      danar(st, blanco, C.perdida * u.fuerza * cl.peso * cruce * sum * cob * seca * (.7 + azar(st) * .6));
      return;
    }
    const q = st.defensas.filter(w => w.s === e && Math.hypot(w.x - u.x, w.y - u.y) <= (cl.directo || cl.rango)).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y) || a.id - b.id)[0];
    if (q) { u.cd = cl.cd * 2; st.ev.push({ k: 'tiro', x: u.x, y: u.y, x2: q.x, y2: q.y, c: u.c, s: u.s, t: st.t }); if (azar(st) < .35) danarInstalacion(st, q); }
  }

  /* ---------- Ciudades, barrios y resistencia ---------- */
  function retirarDeGuarnicion(u, n) { u.guar = Math.max(0, u.guar - n); }
  function repartirPerdida(st, L, total) {
    if (!L.length || total <= 0) return;
    const c = total / L.length;
    for (const u of L) danar(st, u, c * (.7 + azar(st) * .6));
  }
  function caerCiudad(st, u, nuevo) {
    const antes = u.dueno;
    u.dueno = nuevo; u.desde = st.t; u.guar = 0; u.cerco = 0; u.moral = Math.min(u.moral, .6); u.cambio = true; u.prog = 0;
    if (nuevo === u.orig) u.ocupada = null; else if (u.orig && nuevo) u.ocupada = { por: nuevo, t: st.t };
    if (nuevo) { const q = ladoDe(nuevo); if (!(u.tomada & (1 << q))) { u.tomada = (u.tomada || 0) | (1 << q); if (st.t > 0) st.creditos[q] += DATOS.ciudad.bono; } }
    for (const k of u.celdas) st.ter.ctrl[k] = nuevo || 0;
    if (st.t > 0) { if (antes) cansar(st, ladoDe(antes), DATOS.agotamiento.ciudad); if (nuevo) cansar(st, ladoDe(nuevo), -DATOS.agotamiento.ciudad); }
    st.ev.push({ k: 'ciudad', id: u.id, x: u.x, y: u.y, nuevo, antes, t: st.t });
    if (u.capital && nuevo !== u.orig) st.fin = { ganador: ladoDe(nuevo || -u.orig), t: st.t, causa: 'capital' };
  }
  function pasoCiudades(st) {
    const C = DATOS.ciudad, K = DATOS.cerco;
    // Reserva nacional de abastos: entra por las ciudades, cabe según los depósitos.
    for (let s = 0; s < 2; s++) {
      const R = DATOS.abastos.reserva, signo = signoDe(s);
      const tope = R.base + R.porDeposito * st.defensas.filter(d => d.s === s && d.t === DEPOSITO && st.t >= d.listo).length;
      st.abastos[s] = Math.min(tope, st.abastos[s] + R.ingreso + R.porCiudad * st.urbes.filter(u => u.dueno === signo).length);
    }
    for (let s = 0; s < 2; s++) {
      // Un cambio de doctrina tarda en llegar a las unidades.
      const pend = st.doctrinaPend[s];
      if (pend && st.t >= pend.t) { Object.assign(st.doctrina[s], pend.d); st.doctrinaPend[s] = null; st.ev.push({ k: 'doctrina', s, t: st.t }); }
      // Emisiones «solo ante amenaza»: el radar calla hasta que su bando ve algo volando cerca.
      if (st.doctrina[s].emisiones === 'amenaza') for (const d of st.defensas) {
        if (d.s !== s || d.t !== RADAR || st.t < d.listo) continue;
        const R = DATOS.doctrina;
        if (st.porLado[1 - s][0].some(w => !w.dead && Math.hypot(w.x - d.x, w.y - d.y) <= R.radarAmenaza && st.vis[s][celdaDe(st, w.x, w.y)])) d.hasta = st.t + seg(R.radarSigue);
        d.off = !(d.hasta > st.t);
      }
    }
    // Clima: de vez en cuando una tormenta estorba al aire y a la vista.
    if (st.t % seg(DATOS.clima.cada) === 0 && st.tormenta <= st.t && azar(st) < DATOS.clima.prob) {
      const d = DATOS.clima.dura; st.tormenta = st.t + seg(d[0] + azar(st) * (d[1] - d[0]));
      st.ev.push({ k: 'clima', hasta: st.tormenta, t: st.t });
    }
    // Ingenieros: una compañía de infantería junto a un puente roto acelera su reparación.
    for (const k of st.rotos) {
      const x = (k % st.ter.cols + .5) * st.ter.size, y = (Math.floor(k / st.ter.cols) + .5) * st.ter.size;
      if (st.unidades.some(g => !g.dead && g.c === INF && !g.rota && g.st === DESPLEGADA && Math.hypot(g.x - x, g.y - y) <= DATOS.ingenieros.radio)) st.roto[k] -= seg(DATOS.ingenieros.ritmo);
    }
    for (const g of st.unidades) {
      if (g.aire || g.dead) continue;
      g.urbe = -1;
      // Reponer munición y combustible: pleno dentro de la red, un hilo con la línea estirada, nada si está cortada. Sale de la reserva nacional.
      {
        const B = DATOS.abastos, nivel = st.sum[g.s][celdaDe(st, g.x, g.y)], f = nivel === 1 ? 1 : nivel === 2 ? B.repone.estirado : 0;
        if (f > 0 && st.abastos[g.s] > 0 && (g.mun < 1 || g.comb < 1)) {
          const dm = Math.min(1 - g.mun, B.repone.mun * f), dc = Math.min(1 - g.comb, B.repone.comb * f), gasto = dm * B.costo.mun + dc * B.costo.comb;
          const k = Math.min(1, st.abastos[g.s] / (gasto || 1));
          g.mun += dm * k; g.comb += dc * k; st.abastos[g.s] = Math.max(0, st.abastos[g.s] - gasto * k);
        }
        const bajo = g.mun < B.aviso || g.comb < B.aviso;
        if (bajo && !g.escasa) st.ev.push({ k: 'escasez', id: g.id, s: g.s, c: g.c, x: g.x, y: g.y, mun: g.mun < B.aviso, t: st.t });
        g.escasa = bajo;
      }
      // Atrincherarse lleva tiempo; rehacerse exige suministro, calma y, para la tropa sana, una ciudad propia.
      if (g.st !== DESPLEGADA) g.fort = 0;
      else {
        const Q = DATOS.quiebre, max = DATOS.clases[g.c].fuerza;
        if (!g.rota) g.fort = Math.min(1, (g.fort || 0) + 1 / DATOS.fortificacion.segundos);
        if (g.fuerza < max && conSuministro(st, g.s, g.x, g.y) && !masCercano(st, 1 - g.s, 1, g.x, g.y, 200)) {
          const enCasa = st.urbes.some(c => c.dueno === signoDe(g.s) && !c.batalla && Math.hypot(c.x - g.x, c.y - g.y) <= C.rZona);
          const sube = Math.min(max - g.fuerza, g.rota ? Q.tasa * (enCasa ? 1 : .4) : enCasa ? Q.descanso : 0), cuesta = sube * DATOS.abastos.costo.fuerza;
          if (sube > 0 && st.abastos[g.s] >= cuesta) { g.fuerza += sube; st.abastos[g.s] -= cuesta; }   // los reemplazos también salen de la reserva
        }
        if (g.rota && g.fuerza >= max * Q.recupera) { g.rota = false; st.ev.push({ k: 'repuesta', id: g.id, s: g.s, c: g.c, x: g.x, y: g.y, t: st.t }); }
      }
      // Una compañía aislada aguanta un tiempo y luego se rinde.
      if (conLinea(st, g.s, g.x, g.y)) { g.sinSum = 0; continue; }
      if (g.st === MARCHA || g.st === EMBARCANDO) continue;   // en ruta lleva lo suyo; el reloj corre al detenerse
      g.sinSum++;
      if (g.sinSum === K.aviso) st.ev.push({ k: 'aislada', id: g.id, x: g.x, y: g.y, s: g.s, c: g.c, t: st.t });
      else if (g.sinSum >= K.unidad) { st.ev.push({ k: 'rendicion', id: g.id, x: g.x, y: g.y, s: g.s, c: g.c, t: st.t }); matar(st, g); }
    }
    for (const u of st.urbes) {
      const L = [[], []];
      for (const g of st.unidades) {
        if (g.dead || g.aire || g.rota || g.st !== DESPLEGADA || Math.hypot(g.x - u.x, g.y - u.y) > C.rZona) continue;
        L[g.s].push(g); g.urbe = u.id;
      }
      const h = u.dueno > 0 ? 0 : u.dueno < 0 ? 1 : -1, P = [0, 0];
      for (let s = 0; s < 2; s++) {
        let t = 0;
        for (const g of L[s]) t += g.fuerza * DATOS.clases[g.c].peso * (g.mun > 0 ? 1 : DATOS.abastos.sinMunicion);
        const sum = conSuministro(st, s, u.x, u.y) ? 1 : DATOS.combate.sinSuministro;
        P[s] = (t + (h === s ? u.guar : 0)) * sum * (h === s ? (.5 + .5 * u.moral) : 1);
      }
      const hayA = h < 0 ? L[0].length > 0 || L[1].length > 0 : L[1 - h].length > 0;
      if (hayA && (P[0] > 0 || P[1] > 0)) {
        const a = h < 0 ? (P[0] >= P[1] ? 0 : 1) : 1 - h, d = 1 - a, bonus = h === d ? C.bonus * (u.capital ? C.bonusCapital : 1) * (1 - u.dano * .5) : 1, Pa = P[a], Pd = P[d] * bonus;
        const firme = signoDe(a), objetivo = u.barrios.find(b => b.dueno !== firme);
        const nueva = !u.batalla;
        for (const g of L[0].concat(L[1])) g.mun = Math.max(0, g.mun - DATOS.abastos.batalla);   // pelear gasta munición
        u.batalla = { a, inicio: nueva ? st.t : u.batalla.inicio, P: [P[0], P[1]] };
        if (nueva) st.ev.push({ k: 'batalla', id: u.id, x: u.x, y: u.y, a, t: st.t });
        if (Pd > 0) {
          const pa = C.perdida * Pd * (.7 + azar(st) * .6) * 3, pd = C.perdida * Pa * (.7 + azar(st) * .6) * 3;
          repartirPerdida(st, L[a], pa);
          let resto = pd;
          if (h === d && u.guar > 0) { const g = Math.min(u.guar, pd * .7); retirarDeGuarnicion(u, g); resto -= g; }
          repartirPerdida(st, L[d], resto);
          u.prog += C.avance * (Pa / (Pa + Pd) - .5) * 2;
        } else u.prog += C.libre;
        if (u.prog >= 1 && objetivo) { objetivo.dueno = firme; u.prog = 0; st.ev.push({ k: 'barrio', id: u.id, x: objetivo.x, y: objetivo.y, s: a, t: st.t }); }
        else if (u.prog <= -1) {
          const b = [...u.barrios].reverse().find(q => q.dueno === firme);
          if (b) { b.dueno = signoDe(d); st.ev.push({ k: 'barrio', id: u.id, x: b.x, y: b.y, s: d, t: st.t }); }
          u.prog = 0;
        }
        const n = u.barrios.filter(b => b.dueno === firme).length;
        if (n * 2 > u.barrios.length && u.dueno !== firme) caerCiudad(st, u, firme);
      } else {
        u.batalla = null;
        // Sin atacantes, los barrios perdidos vuelven a quien manda la ciudad.
        if (u.dueno) { const b = u.barrios.find(q => q.dueno !== u.dueno); if (b && !L[1 - h].length) { u.prog -= C.libre; if (u.prog <= -1) { b.dueno = u.dueno; u.prog = 0; } } else if (!b) u.prog = 0; }
      }
      if (u.dueno) {
        const s = ladoDe(u.dueno), sum = conSuministro(st, s, u.x, u.y);
        if (sum && !u.batalla) {
          const tope = u.ocupada ? C.ocupada : u.capital ? C.guarnicion * 2 : C.guarnicion;
          u.guar = Math.min(tope, u.guar + C.regenera); u.moral = Math.min(1 - DATOS.agotamiento.moral * Math.min(1, st.agot[s]), u.moral + .002); u.dano = Math.max(0, u.dano - C.repara);
        } else if (!sum) { u.guar = Math.max(0, u.guar - .02); u.moral = Math.max(.1, u.moral - .002); }
        // Cercada: avisa, y si el enemigo ya la abastece y nadie rompe el cerco, capitula.
        // Recién tomada: el territorio de alrededor aún no cambió de manos; no cuenta como cerco.
        if (sum || u.capital || st.t - u.desde < K.gracia * 30) u.cerco = 0;
        else {
          u.cerco++;
          if (u.cerco === K.aviso) st.ev.push({ k: 'cercada', id: u.id, x: u.x, y: u.y, s, t: st.t });
          if (u.cerco >= K.ciudad && conLinea(st, 1 - s, u.x, u.y)) {
            st.ev.push({ k: 'capitula', id: u.id, x: u.x, y: u.y, s, t: st.t });
            const nuevo = -u.dueno; for (const b of u.barrios) b.dueno = nuevo;
            u.batalla = null; caerCiudad(st, u, nuevo);
          }
        }
        st.creditos[s] += (u.capital ? C.capital : 1) * C.ingreso / 60 * (1 - u.dano * .6) * (sum ? 1 : .3) * (1 - DATOS.agotamiento.ingreso * Math.min(1, st.agot[s]));
      }
      if (u.ocupada && st.t % seg(DATOS.resistencia.cada) === 0) resistencia(st, u, L);
    }
  }
  // Una ciudad ocupada con poca guarnición se subleva. El bombardeo previo la vuelve más hostil.
  function resistencia(st, u, L) {
    const R = DATOS.resistencia, s = ladoDe(u.dueno);
    let tropa = u.guar;
    for (const g of L[s]) tropa += g.fuerza * DATOS.clases[g.c].peso;
    if (tropa >= R.guardia) u.res = Math.max(0, u.res - R.baja * Math.min(3, tropa / R.guardia) * R.cada);
    else u.res = Math.min(1.2, u.res + (R.sube + u.dano * R.porDano) * R.cada / 10);
    if (st.t - u.ocupada.t > seg(1200) && u.res < .05 && tropa >= R.guardia) { u.ocupada = null; u.orig = u.dueno; st.ev.push({ k: 'pacificada', id: u.id, x: u.x, y: u.y, s, t: st.t }); return; }
    if (u.res < 1) return;
    u.res = .35;
    if (u.guar > 0) u.guar = Math.max(0, u.guar - R.golpe);
    const b = u.barrios.find(q => q.dueno === u.dueno);
    if (b) b.dueno = u.orig;
    st.ev.push({ k: 'revuelta', id: u.id, x: u.x, y: u.y, s, t: st.t });
    if (u.barrios.filter(q => q.dueno === u.dueno).length * 2 <= u.barrios.length) caerCiudad(st, u, u.orig);
  }
  function pasoTerreno(st) {
    const T = st.ter, P = DATOS.terreno, ctrl = T.ctrl, bloq = st.mapa.der.bloqueo, prov = st.prov;
    for (let k = 0; k < ctrl.length; k++) {
      const p = prov[k];
      if (p < 0 || bloq[k]) continue;
      const u = st.urbes[p];
      if (u.cambio && u.dueno) ctrl[k] = clamp(ctrl[k] + u.dueno * P.provincia, -1, 1);
    }
    for (const g of st.unidades) {
      if (g.dead || g.c !== INF || g.st !== DESPLEGADA || !conSuministro(st, g.s, g.x, g.y)) continue;
      const ci = clamp(Math.floor(g.x / T.size), 0, T.cols - 1), cj = clamp(Math.floor(g.y / T.size), 0, T.rows - 1), signo = signoDe(g.s), r = P.radio;
      for (let j = Math.max(0, cj - r); j <= Math.min(T.rows - 1, cj + r); j++) for (let i = Math.max(0, ci - r); i <= Math.min(T.cols - 1, ci + r); i++) {
        if ((i - ci) ** 2 + (j - cj) ** 2 > r * r) continue;
        const k = i + j * T.cols;
        if (bloq[k]) continue;
        // Solo avanza lo que toca tu territorio.
        const junto = dueno(st, k) === signo || (i > 0 && dueno(st, k - 1) === signo) || (i < T.cols - 1 && dueno(st, k + 1) === signo) || (j > 0 && dueno(st, k - T.cols) === signo) || (j < T.rows - 1 && dueno(st, k + T.cols) === signo);
        if (junto) ctrl[k] = clamp(ctrl[k] + signo * P.tasa, -1, 1);
      }
    }
    contarTerreno(st);
  }
