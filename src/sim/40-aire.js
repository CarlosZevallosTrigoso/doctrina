  /* ---------- Aire: hangares, salidas y misiones ---------- */
  const vivaPista = (st, d) => st.defensas.includes(d) && st.t >= d.listo;
  function hangarLibre(st, s, c, x, y, n) {
    const cl = DATOS.clases[c], out = [];
    const pistas = st.defensas.filter(d => d.s === s && d.t === PISTA && st.t >= d.listo && st.t >= (d.cierre || 0)).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    for (const d of pistas) {
      if (Math.hypot(d.x - x, d.y - y) > cl.alcance) continue;
      for (const h of d.hangar) if (h.c === c && !h.res && h.listo <= st.t) { out.push({ d, h }); if (out.length >= n) return out; }
    }
    return out;
  }
  function pistaCercana(st, s, x, y) {
    let m = null, md = Infinity;
    for (const d of st.defensas) if (d.s === s && d.t === PISTA && st.t >= d.listo) { const q = Math.hypot(d.x - x, d.y - y); if (q < md) { md = q; m = d; } }
    return m;
  }
  function despegar(st, d, h, rol, tx, ty, m = 0, z = 0, tgt = 0) {
    d.hangar.splice(d.hangar.indexOf(h), 1);
    const cl = DATOS.clases[h.c];
    const u = { id: st.sigId++, s: d.s, c: h.c, x: d.x, y: d.y, px: d.x, py: d.y, tx, ty, st: IDA, cd: 0, rol, m, z, tgt, tiros: cl.tiros || 0, bombas: cl.bombas || 0, aguante: cl.aguante || 0, ang: azar(st) * 6.283, dead: false, idt: false, oculto: false, aire: true, fuerza: 1, urbe: -1 };
    st.unidades.push(u);
    if (h.c === MISIL) {
      const q = Math.hypot(tx - d.x, ty - d.y) || 1;
      st.alertas[1 - d.s].push({ x: d.x, y: d.y, ux: (tx - d.x) / q, uy: (ty - d.y) / q, t: st.t });
    }
    return u;
  }
  function aterrizar(st, u, d) {
    const cl = DATOS.clases[u.c];
    d.hangar.push({ c: u.c, listo: st.t + seg(cl.rearme), res: 0 });
    u.dead = true;
  }
  function fuegoAire(st, u, cl, r) {
    if (u.cd > 0 || u.tiros <= 0) return false;
    const e = 1 - u.s;
    const t = masCercano(st, e, 0, u.x, u.y, r, w => w.c !== MISIL && st.vis[u.s][celdaDe(st, w.x, w.y)]);
    if (!t) return false;
    u.tiros--; u.cd = cl.cd;
    st.ev.push({ k: 'tiro', x: u.x, y: u.y, x2: t.x, y2: t.y, c: u.c, s: u.s, t: st.t });
    const pk = (DATOS.pkAire[u.c] || {})[t.c] || 0;
    if (azar(st) < pk) matar(st, t);
    return true;
  }
  function pasoAire(st, u) {
    const cl = DATOS.clases[u.c], v = st.v[u.c];
    if (u.cd > 0) u.cd -= DT;
    if (u.st === REGRESO) {
      const d = pistaCercana(st, u.s, u.x, u.y);
      if (!d) { u.dead = true; return; }
      if (mover(u, v, d.x, d.y)) aterrizar(st, u, d);
      return;
    }
    const orbitar = () => {
      u.aguante -= DT;
      u.ang += .5 * v / 40 * DT;
      u.x = clamp(u.tx + Math.cos(u.ang) * 40, 0, st.W); u.y = clamp(u.ty + Math.sin(u.ang) * 40, 0, st.H);
      if (u.aguante <= 0) u.st = REGRESO;
    };
    if (u.rol === 'misil') { if (mover(u, v, u.tx, u.ty)) { golpear(st, u.s, u.tx, u.ty, 'misil', u); u.dead = true; } return; }
    if (u.rol === 'int') {
      let t = st.porLado[1 - u.s][0].find(w => w.id === u.tgt && !w.dead);
      const z = st.zonas.find(q => q.id === u.z);
      if (!t && z) { t = masCercano(st, 1 - u.s, 0, z.x, z.y, z.r, w => w.c !== MISIL && st.vis[u.s][celdaDe(st, w.x, w.y)]); if (t) u.tgt = t.id; }
      if (!t) { u.st = REGRESO; return; }
      mover(u, v, t.x, t.y);
      fuegoAire(st, u, cl, cl.rango);
      u.aguante -= DT;
      if (u.tiros <= 0 || u.aguante <= 0) u.st = REGRESO;
      return;
    }
    if (u.rol === 'esc') {
      const m = st.misiones.find(q => q.id === u.m);
      fuegoAire(st, u, cl, cl.rango);
      if (u.st === IDA) { if (mover(u, v, u.tx, u.ty)) u.st = ORBITA; return; }
      orbitar();
      if (!m || m.ataqueHecho || u.tiros <= 0) u.st = REGRESO;
      return;
    }
    if (u.rol === 'rec') { if (u.st === IDA) { if (mover(u, v, u.tx, u.ty)) u.st = ORBITA; } else orbitar(); return; }
    if (u.rol === 'cas') {
      if (u.st === IDA) {
        const t = masCercano(st, 1 - u.s, 1, u.tx, u.ty, 220, w => st.vis[u.s][celdaDe(st, w.x, w.y)]);
        if (t) { u.tx = t.x; u.ty = t.y; }
        if (mover(u, v, u.tx, u.ty)) {
          golpear(st, u.s, u.x, u.y, 'ataque', u);
          if (--u.bombas <= 0) u.st = REGRESO; else u.st = ORBITA;
        }
        return;
      }
      orbitar();
      if (u.st === ORBITA && u.aguante < (cl.aguante || 100) - 4) { u.st = IDA; }
      return;
    }
    if (u.rol === 'interd') {
      if (u.st === IDA) { if (mover(u, v, u.tx, u.ty)) u.st = ORBITA; return; }
      orbitar();
      if (u.st !== ORBITA) return;
      const t = masCercano(st, 1 - u.s, 1, u.tx, u.ty, 330, w => w.st !== DESPLEGADA && st.vis[u.s][celdaDe(st, w.x, w.y)]);
      if (t && Math.hypot(t.x - u.x, t.y - u.y) < 90) {
        golpear(st, u.s, t.x, t.y, 'ataque', u);
        if (--u.bombas <= 0) u.st = REGRESO;
      }
      return;
    }
    // golpe, bomb y sup: un solo pase sobre el objetivo.
    if (mover(u, v, u.tx, u.ty)) {
      golpear(st, u.s, u.tx, u.ty, u.rol, u);
      const m = st.misiones.find(q => q.id === u.m);
      if (m) { m.golpes = (m.golpes || 0) + 1; if (m.golpes >= m.ataquesTotal) m.ataqueHecho = true; }
      u.st = REGRESO;
    }
  }
  /* Golpes: cada tipo castiga cosas distintas. */
  function golpear(st, s, x, y, modo, u) {
    const e = 1 - s, R = DATOS.expuesto, cl = u ? DATOS.clases[u.c] : {};
    const r = modo === 'misil' ? DATOS.clases[MISIL].r : (cl.r || 34);
    let impactos = 0;
    if (modo !== 'sup') {
      // Con tormenta, la aviación acierta la mitad; la artillería y los misiles no lo notan.
      const dano = (modo === 'misil' ? 1.6 : (cl.dano || 4)) * (u && u.aire && st.tormenta > st.t ? DATOS.clima.aire : 1);
      for (const w of st.porLado[e][1]) {
        if (w.dead || Math.hypot(w.x - x, w.y - y) > r) continue;
        let f = w.st === MARCHA ? R.marcha : w.st === DESPLEGADA ? R.desplegada : R.maniobra;
        if (w.urbe >= 0) f *= R.ciudad;
        if (st.mapa.areas[celdaDe(st, w.x, w.y)] === A.BOSQUE) f *= R.bosque;
        if (w.c === BLI) f *= R.blindado;
        danar(st, w, dano * f * (.7 + azar(st) * .6));
        if (w.c === INF && w.st === DESPLEGADA && w.camion && azar(st) < R.camion) w.camion = false;
        impactos++;
      }
    }
    if (modo === 'bomb' || modo === 'misil') {
      const D = DATOS.ciudad.dolor;
      for (const c of st.urbes) {
        if (Math.hypot(c.x - x, c.y - y) > 110) continue;
        c.dano = Math.min(1, c.dano + D.golpe); c.moral = Math.max(.1, c.moral - D.moral); c.guar = Math.max(0, c.guar - D.guar * (modo === 'misil' ? .5 : 1));
        impactos++;
      }
    }
    const ins = st.defensas.filter(d => d.s === e && Math.hypot(d.x - x, d.y - y) <= (modo === 'sup' ? 70 : r) && (modo !== 'sup' || d.t === AA || d.t === AM || (d.t === RADAR && !d.off)));   // la supresión busca emisiones: un radar apagado no la atrae
    for (const d of ins) {
      const hit = azar(st) < (modo === 'sup' ? .9 : modo === 'misil' ? .95 : .6);
      if (!hit) continue;
      impactos++;
      if (d.t === PISTA) {
        d.cierre = Math.max(d.cierre || 0, st.t + seg(modo === 'misil' ? 180 : 60));
        for (let q = 0; q < (modo === 'misil' ? 2 : 1) && d.hangar.length; q++) { const h = d.hangar[Math.floor(azar(st) * d.hangar.length)]; if (!h.res) { d.hangar.splice(d.hangar.indexOf(h), 1); st.stats.bajas[e]++; } }
      }
      danarInstalacion(st, d, modo === 'misil' ? 3 : modo === 'sup' ? 2 : 1);
    }
    const T = st.ter, alcance = r + 6;
    for (const k of st.puentes) {
      if (st.roto[k]) continue;
      const i = k % T.cols, j = (k - i) / T.cols;
      if (Math.hypot((i + .5) * T.size - x, (j + .5) * T.size - y) > alcance || azar(st) >= (modo === 'misil' ? .85 : DATOS.puente.pk)) continue;
      st.roto[k] = st.t + seg(DATOS.puente.reparacion);
      st.rotos.push(k);
      limpiarRutas(st);
      st.ev.push({ k: 'puente', x: (i + .5) * T.size, y: (j + .5) * T.size, s, t: st.t });
      impactos++;
    }
    if (u && u.m) { const m = st.misiones.find(q => q.id === u.m); if (m) m.res.impactos += impactos; }
    st.ev.push({ k: 'golpe', x, y, r, s, t: st.t });
  }
  function pasoDefensas(st) {
    const L = st.defensas, ad = st.t % 2 === 0;
    for (let i = ad ? 0 : L.length - 1; ad ? i < L.length : i >= 0; i += ad ? 1 : -1) {
      const d = L[i], ti = DATOS.instalaciones.tipos[d.t];
      if (st.t < d.listo || !ti.blanco) continue;
      if (d.cd > 0) { d.cd -= DT; continue; }
      const e = 1 - d.s;
      const t = ti.blanco === 'tierra' ? masCercano(st, e, 1, d.x, d.y, ti.rango, w => !w.oculto)
        : ti.blanco === 'misil' ? masCercano(st, e, 0, d.x, d.y, ti.rango, w => w.c === MISIL)
          : masCercano(st, e, 0, d.x, d.y, ti.rango, w => w.c !== MISIL);
      if (!t) continue;
      d.cd = ti.cd; t.idt = true;
      st.ev.push({ k: 'tiro', x: d.x, y: d.y, x2: t.x, y2: t.y, c: ti.blanco === 'misil' ? MISIL : ti.blanco === 'aire' ? CAZA : INF, s: d.s, t: st.t });
      if (ti.blanco === 'tierra') { danar(st, t, ti.dano * (.7 + azar(st) * .6)); continue; }
      const pk = typeof ti.pk === 'number' ? ti.pk : (ti.pk[t.c] || .3);
      if (azar(st) < pk) matar(st, t);
    }
  }

  /* ---------- Áreas de control: defensa aérea y apoyo automáticos ---------- */
  function pasoZonas(st) {
    const Z = DATOS.zonas;
    for (let s = 0; s < 2; s++) {
      const zonas = st.zonas.filter(z => z.s === s).sort((a, b) => a.prio - b.prio || a.id - b.id);
      let faltoAire = false;
      for (const z of zonas) {
        const enemigos = st.porLado[1 - s][0].filter(w => !w.dead && w.c !== MISIL && Math.hypot(w.x - z.x, w.y - z.y) <= z.r && st.vis[s][celdaDe(st, w.x, w.y)]);
        const asignados = st.porLado[s][0].filter(u => !u.dead && u.z === z.id && u.rol === 'int' && u.st !== REGRESO).length;
        const faltan = Math.min(enemigos.length, z.max) - asignados;
        for (let i = 0; i < faltan; i++) {
          const [q] = hangarLibre(st, s, CAZA, z.x, z.y, 1);
          if (!q) { faltoAire = true; break; }
          despegar(st, q.d, q.h, 'int', enemigos[i].x, enemigos[i].y, 0, z.id, enemigos[i].id);
        }
        // Apoyo cercano: tropas propias en contacto dentro del área.
        if (st.t < (z.casT || 0)) continue;
        const propios = st.porLado[s][1].filter(g => !g.dead && Math.hypot(g.x - z.x, g.y - z.y) <= z.r);
        let blanco = null;
        for (const g of propios) { blanco = masCercano(st, 1 - s, 1, g.x, g.y, 130, w => st.vis[s][celdaDe(st, w.x, w.y)]); if (blanco) break; }
        if (!blanco) continue;
        const cas = st.porLado[s][0].filter(u => !u.dead && u.z === z.id && u.rol === 'cas' && u.st !== REGRESO).length;
        if (cas >= Z.maxCas) continue;
        const [q] = hangarLibre(st, s, ATAQUE, blanco.x, blanco.y, 1);
        if (!q) { faltoAire = true; continue; }
        despegar(st, q.d, q.h, 'cas', blanco.x, blanco.y, 0, z.id, 0);
        z.casT = st.t + seg(Z.cooldownCas);
      }
      if (faltoAire && st.t - (st.sinAireT ? st.sinAireT[s] : -1e9) > seg(60)) { (st.sinAireT = st.sinAireT || [-1e9, -1e9])[s] = st.t; st.ev.push({ k: 'sinAire', s, t: st.t }); }
    }
  }

  /* ---------- Misiones ---------- */
  function rolDe(tipo, c) {
    if (c === MISIL) return 'misil';
    if (c === CAZA) return 'esc';
    if (c === ESPIA || tipo === 'reconocimiento') return 'rec';
    if (tipo === 'bombardeo') return 'bomb';
    if (tipo === 'supresion') return 'sup';
    if (tipo === 'interdiccion') return 'interd';
    if (tipo === 'asalto') return 'cas';
    return 'golpe';
  }
  function crearMision(st, s, o) {
    const T = DATOS.misiones[o.tipo];
    if (!T || !Number.isFinite(o.x) || !Number.isFinite(o.y)) return null;
    const x = clamp(o.x, 0, st.W), y = clamp(o.y, 0, st.H), pend = [];
    for (const c of T.clases) {
      const n = (o.paquete && o.paquete[c]) | 0;
      if (!n) continue;
      for (const q of hangarLibre(st, s, c, x, y, n)) { pend.push({ d: q.d, h: q.h, c, eta: Math.hypot(q.d.x - x, q.d.y - y) / st.v[c] }); }
    }
    const tropas = T.tierra && Array.isArray(o.ids) ? st.unidades.filter(u => !u.dead && u.s === s && !u.aire && o.ids.includes(u.id) && (u.c !== INF || u.camion)) : [];
    if (!pend.length && !tropas.length) return null;
    const m = { id: o.m || st.sigM++, s, tipo: o.tipo, x, y, res: { impactos: 0, perdidas: 0 }, pend: [], estado: pend.length ? 'alista' : 'curso', ini: st.t, ids: tropas.map(u => u.id), ataquesTotal: 0, golpes: 0 };
    if (m.id >= st.sigM) st.sigM = m.id + 1;
    let tMax = 0;
    for (const p of pend) tMax = Math.max(tMax, p.eta);
    // Llegada simultánea: cada aparato sale cuando le toca para coincidir con el más lejano.
    for (const p of pend) {
      p.h.res = m.id;
      const rol = rolDe(o.tipo, p.c);
      if (rol !== 'esc' && rol !== 'rec') m.ataquesTotal++;
      m.pend.push({ d: p.d, h: p.h, c: p.c, rol, sale: st.t + seg(tMax - p.eta) });
    }
    if (tropas.length) {
      // En un asalto, artillería y antiaérea no entran a la ciudad: se emplazan a distancia de tiro.
      const apoyo = o.tipo === 'asalto' ? tropas.filter(u => u.c === ART || u.c === AAM) : [];
      ordenarMover(st, s, tropas.filter(u => !apoyo.includes(u)), x, y, m.id);
      for (const u of apoyo) {
        const h = Math.hypot(u.x - x, u.y - y) || 1, r = Math.min(h, u.c === ART ? DATOS.clases[ART].rango * .6 : 120);
        ordenarMover(st, s, [u], x + (u.x - x) / h * r, y + (u.y - y) / h * r, m.id);
      }
    }
    st.misiones.push(m);
    return m;
  }
  function pasoMisiones(st) {
    for (const m of st.misiones) {
      if (m.estado === 'fin') continue;
      for (let i = m.pend.length - 1; i >= 0; i--) {
        const p = m.pend[i];
        if (p.sale > st.t) continue;
        m.pend.splice(i, 1);
        if (!vivaPista(st, p.d) || !p.d.hangar.includes(p.h)) continue;
        p.h.res = 0;
        const a = azar(st) * 6.283, d = azar(st) * 24;
        despegar(st, p.d, p.h, p.rol, clamp(m.x + Math.cos(a) * d, 0, st.W), clamp(m.y + Math.sin(a) * d, 0, st.H), m.id);
        m.estado = 'curso';
      }
      const vivos = st.unidades.some(u => !u.dead && u.m === m.id && (u.aire ? true : u.st !== DESPLEGADA));
      if (!m.pend.length && !vivos && (m.estado === 'curso' || st.t > m.ini + 30)) {
        m.estado = 'fin'; m.fin = st.t;
        st.ev.push({ k: 'parte', id: m.id, s: m.s, tipo: m.tipo, x: m.x, y: m.y, res: { ...m.res }, t: st.t });
      }
    }
    if (st.misiones.length > 80) st.misiones = st.misiones.filter(m => m.estado !== 'fin' || st.t - m.fin < seg(120));
  }
