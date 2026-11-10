  /* ---------- Paso de simulación ---------- */
  function paso(st, ordenes) {
    if (st.fin) return;
    if (ordenes) for (const [s, o, staff] of ordenes) { st.directa = s === 0 && !staff; aplicar(st, s, o); st.directa = false; }
    st.t++;
    st.cuotaRutas = st.recienCargada ? 1e9 : 4; st.recienCargada = false;
    indexar(st);
    const us = st.unidades, ad = st.t % 2 === 0;
    for (let i = ad ? 0 : us.length - 1; ad ? i < us.length : i >= 0; i += ad ? 1 : -1) {
      const u = us[i];
      if (u.dead) continue;
      u.px = u.x; u.py = u.y;
      if (u.aire) pasoAire(st, u); else pasoTierra(st, u);
    }
    pasoDefensas(st);
    pasoMisiones(st);
    let n = 0;
    for (let i = 0; i < us.length; i++) if (!us[i].dead) us[n++] = us[i];
    us.length = n;
    if (st.god) for (const d of st.defensas) if (d.s === 0 && d.t === PISTA) for (const h of d.hangar) h.listo = 0;
    if (st.t % 30 === 0) {
      pasoCiudades(st);
      pasoTerreno(st);
      pasoColas(st);
      indexar(st);
      pasoZonas(st);
      verVictoria(st);
    }
    if (st.t % DATOS.suministro.cada === 0) calcularSuministro(st);
    if (st.t % 30 === 0 && st.rotos.length) {
      const antes = st.rotos.length;
      st.rotos = st.rotos.filter(k => { if (st.t >= st.roto[k]) { st.roto[k] = 0; return false; } return true; });
      if (st.rotos.length !== antes) limpiarRutas(st);
    }
    if (st.t % 6 === 0) { indexar(st); vision(st); }
    if (st.ev.length > 800) st.ev.splice(0, st.ev.length - 800);
  }
  function verVictoria(st) {
    if (st.fin) return;
    const V = DATOS.victoria, tot = st.urbes.length, meta = Math.ceil(tot * V.fraccion);
    // La guerra cansa a los dos; quien llega primero al límite, colapsa.
    cansar(st, 0, DATOS.agotamiento.tiempo); cansar(st, 1, DATOS.agotamiento.tiempo);
    if (st.agot[0] >= 1 || st.agot[1] >= 1) {
      if (st.agot[0] !== st.agot[1]) { st.fin = { ganador: st.agot[0] > st.agot[1] ? 1 : 0, t: st.t, causa: 'colapso' }; return; }
    }
    for (let s = 0; s < 2; s++) {
      const n = st.urbes.filter(u => u.dueno === signoDe(s)).length;
      st.conq[s] = n >= meta ? st.conq[s] + 1 : Math.max(0, st.conq[s] - 2);
      if (st.conq[s] >= V.segundos) { st.fin = { ganador: s, t: st.t, causa: 'ciudades' }; return; }
      const fuerza = st.unidades.filter(u => u.s === s && !u.aire).length + st.colas[s].length, hay = st.urbes.some(u => u.dueno === signoDe(s));
      if (!fuerza && !hay) { st.fin = { ganador: 1 - s, t: st.t, causa: 'agotamiento' }; return; }
    }
  }

  /* ---------- Vista con niebla ---------- */
  function resumenHangar(st, s) {
    const R = {};
    for (const d of st.defensas) {
      if (d.s !== s || d.t !== PISTA) continue;
      for (const h of d.hangar) {
        const q = R[h.c] || (R[h.c] = { total: 0, listos: 0 });
        q.total++;
        if (h.listo <= st.t && !h.res && st.t >= (d.cierre || 0) && st.t >= d.listo) q.listos++;
      }
    }
    return R;
  }
  function vista(st, s) {
    const T = st.ter, v = st.vis[s], propias = [], contactos = [];
    for (const u of st.unidades) {
      if (u.dead) continue;
      if (u.s === s) propias.push(u);
      else if (st.fin || (v[celdaDe(st, u.x, u.y)] && !u.oculto) || u.delata > st.t) contactos.push(st.fin || u.idt ? u : { id: u.id, s: u.s, x: u.x, y: u.y, px: u.px, py: u.py, c: -1, st: -1, tx: u.x, ty: u.y, gris: true, aire: u.aire });
    }
    const intel = st.intel[s], be = st.bases[1 - s], signo = signoDe(s);
    return {
      s, t: st.t, W: st.W, H: st.H, cols: T.cols, rows: T.rows, size: T.size, base: st.bases[s], baseEnemiga: { x: be.x, y: be.y },
      propias, contactos, doctrina: st.doctrina[s], doctrinaPend: st.doctrinaPend[s], abastos: st.abastos[s], minuto: minutoDe(st), noche: esNoche(st), tormenta: st.tormenta > st.t, linea: (x, y) => conLinea(st, s, x, y), celdas: st.mem[s], visibles: v, pasable: k => transitable(st, k), fotos: [...st.fotos[s].values()], alertas: st.alertas[s],
      creditos: st.creditos[s], defensas: st.defensas.filter(d => d.s === s), defensasE: st.fin ? st.defensas.filter(d => d.s !== s).map(d => ({ id: d.id, x: d.x, y: d.y, t: d.t, s: d.s, enObra: st.t < d.listo })) : [...st.memDef[s].values()],
      hangar: resumenHangar(st, s), cola: st.colas[s], zonas: st.zonas.filter(z => z.s === s), misiones: st.misiones.filter(m => m.s === s),
      ciudades: st.urbes.map(u => {
        const q = st.fin || u.dueno === signo ? { dueno: u.dueno, guar: u.guar, moral: u.moral, dano: u.dano, t: st.t } : intel[u.id];
        const conocida = st.fin || u.dueno === signo || !!q;
        return {
          id: u.id, nombre: u.nombre, x: u.x, y: u.y, capital: u.capital, n: u.celdas.length, barrios: st.fin || u.dueno === signo || v[celdaDe(st, u.x, u.y)] ? u.barrios : null, desde: u.desde,
          dueno: conocida ? q.dueno : duenoMayoria(u.celdas, k => st.mem[s][k]), guar: conocida ? q.guar : null, moral: conocida ? q.moral : null, dano: conocida ? q.dano : null, edad: conocida ? st.t - q.t : Infinity,
          batalla: (u.dueno === signo || v[celdaDe(st, u.x, u.y)]) ? u.batalla : null, ocupada: u.ocupada, res: u.dueno === signo ? u.res : 0, suministro: conSuministro(st, s, u.x, u.y), prog: u.prog, cerco: u.dueno === signo ? u.cerco : 0,
        };
      }),
    };
  }

  /* ---------- Partida ---------- */
  function partida({ seed = 1, mapa = null, ia0 = null, ia1 = 'auto', manual = false } = {}) {
    const st = crear({ seed, mapa, manual: [!!manual, false] });
    const ias = [ia0, ia1].map((x, i) => {
      if (!x) return null;
      if (typeof x === 'function') return { fn: x };
      return iaCrear((seed * 31 + i * 7919) | 0, x === 'auto' ? null : x);
    });
    // La IA metódica cuida su fuerza y calla sus radares; las demás pelean con la doctrina por defecto.
    ias.forEach((ia, i) => { if (ia && ia.nombre === 'metodica') Object.assign(st.doctrina[i], { preservar: 0.5, emisiones: 'amenaza' }); });
    return { st, ias };
  }
  // Estado mayor del jugador: según el nivel, unas secciones deciden solas con las mismas órdenes que daría él.
  function estadoMayor(g, nivel) {
    const N = DATOS.niveles, n = nivel in N ? nivel : 'manual', st = g.st;
    st.doctrina[0].nivel = n;
    if (!N[n].length) { g.ias[0] = null; return n; }
    const ia = g.ias[0] && g.ias[0].staff ? g.ias[0] : iaCrear((st.seed * 17 + 4241) | 0, 'equilibrada');
    ia.staff = true; ia.sec = { log: false, def: false, fue: false, man: false }; for (const k of N[n]) ia.sec[k] = true;
    ia.marcados = n === 'alta';   // en «alta» solo ataca lo que el mando marca
    g.ias[0] = ia; return n;
  }
  // Orden directa del jugador: queda marcada para que su estado mayor no la deshaga.
  function ordenar(st, o) { st.directa = true; try { return aplicar(st, 0, o); } finally { st.directa = false; } }
  function avanzar(g, ordenes) {
    const st = g.st, todas = ordenes ? ordenes.map(o => [0, o]) : [];
    if (st.despliegue) { for (const [s, o] of todas) aplicar(st, s, o); return; }   // el reloj no corre hasta empezar
    if (st.t % 30 === 0) {
      const prim = (st.t / 30) % 2;
      for (const s of [prim, 1 - prim]) {
        const ia = g.ias[s];
        if (ia) for (const o of (ia.fn ? ia.fn(vista(st, s)) : iaDecidir(ia, vista(st, s)))) todas.push([s, o, true]);
      }
    }
    paso(st, todas);
  }
  function hash(st) {
    let h = 2166136261 >>> 0;
    const m = n => { h = Math.imul(h ^ (n | 0), 16777619) >>> 0; };
    m(st.t); m(st.sem); m(st.unidades.length);
    for (const u of st.unidades) { m(u.id); m(u.c); m(Math.round(u.x * 100)); m(Math.round(u.y * 100)); m(Math.round(u.fuerza * 100)); }
    for (const d of st.defensas) { m(d.id); m(d.hp); }
    for (const u of st.urbes) { m(u.dueno); m(Math.round(u.guar * 10)); }
    m(Math.round(st.creditos[0] * 10)); m(Math.round(st.creditos[1] * 10)); m(Math.round(st.agot[0] * 1e6)); m(Math.round(st.agot[1] * 1e6));
    return h;
  }

  /* ---------- Guardar y continuar ---------- */
  const aB64 = a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; const P = 8192; for (let i = 0; i < u.length; i += P) s += String.fromCharCode.apply(null, u.subarray(i, i + P)); return typeof btoa === 'function' ? btoa(s) : Buffer.from(u).toString('base64'); };
  const deB64 = (t, C) => { const b = typeof atob === 'function' ? atob(t) : Buffer.from(t, 'base64').toString('binary'), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new C(u.buffer); };
  function serializar(st) {
    const mapa = A.aJSON({ nombre: st.mapa.nombre, areas: st.mapa.areas, lineas: st.mapa.lineas, simetria: false, sigG: 1 });
    const misiones = st.misiones.map(m => ({ ...m, pend: m.pend.map(p => ({ did: p.d.id, hi: p.d.hangar.indexOf(p.h), c: p.c, rol: p.rol, sale: p.sale })) }));
    return JSON.stringify({ formato: 'doctrina-partida', v: 1, mapa, t: st.t, sem: st.sem, seed: st.seed, sigId: st.sigId, sigDef: st.sigDef, sigM: st.sigM, sigZ: st.sigZ, god: st.god, fin: st.fin,
      agot: st.agot, abastos: st.abastos, tormenta: st.tormenta, doctrina: st.doctrina, doctrinaPend: st.doctrinaPend, unidades: st.unidades, defensas: st.defensas, zonas: st.zonas, misiones, colas: st.colas, creditos: st.creditos, urbes: st.urbes, conq: st.conq, stats: st.stats, intel: st.intel,
      fotos: st.fotos.map(m => [...m.values()]), memDef: st.memDef.map(m => [...m.values()]), alertas: st.alertas,
      ctrl: aB64(st.ter.ctrl), mem: st.mem.map(aB64), memRoto: st.memRoto.map(aB64), rotos: st.rotos.map(k => [k, st.roto[k]]) });
  }
  function deserializar(txt) {
    const o = JSON.parse(txt);
    if (!o || o.formato !== 'doctrina-partida') throw new Error('No es una partida guardada de doctrina.');
    const st = crear({ seed: o.seed, mapa: A.deJSON(o.mapa) });
    for (const k of ['t', 'sem', 'sigId', 'sigDef', 'sigM', 'sigZ', 'god', 'fin', 'unidades', 'defensas', 'zonas', 'colas', 'creditos', 'conq', 'agot', 'despliegue', 'abastos', 'tormenta', 'doctrina', 'doctrinaPend', 'stats', 'intel', 'alertas']) st[k] = o[k];
    // Partidas guardadas antes del cerco y el agotamiento.
    st.agot = o.agot || [0, 0]; for (const u of st.unidades) { u.sinSum = u.sinSum || 0; u.fort = u.fort || 0; u.delata = u.delata || 0; u.rota = !!u.rota; if (u.mun === undefined) { u.mun = 1; u.comb = 1; } }
    if (!o.doctrina) { st.doctrina = [0, 1].map(() => ({ ...DATOS.doctrina.inicial, objetivos: [] })); st.doctrinaPend = [null, null]; }
    st.abastos = o.abastos || [DATOS.abastos.reserva.inicio, DATOS.abastos.reserva.inicio]; st.tormenta = o.tormenta || 0;
    const dur = st.urbes.map((u, i) => ({ cerco: 0, ...o.urbes[i], celdas: u.celdas }));
    st.urbes = dur;
    st.fotos = o.fotos.map(l => new Map(l.map(f => [f.id, f])));
    st.memDef = o.memDef.map(l => new Map(l.map(f => [f.id, f])));
    st.ter.ctrl = deB64(o.ctrl, Float32Array);
    st.mem = o.mem.map(t => deB64(t, Int8Array));
    st.memRoto = o.memRoto.map(t => deB64(t, Uint8Array));
    st.roto.fill(0); st.rotos = o.rotos.map(([k, v]) => { st.roto[k] = v; return k; });
    st.misiones = o.misiones.map(m => ({ ...m, pend: m.pend.map(p => { const d = st.defensas.find(q => q.id === p.did); return d && d.hangar[p.hi] ? { d, h: d.hangar[p.hi], c: p.c, rol: p.rol, sale: p.sale } : null; }).filter(Boolean) }));
    limpiarRutas(st); st.recienCargada = true;   // sin cuota el primer paso: nadie se demora por falta de ruta
    indexar(st); calcularSuministro(st); contarTerreno(st); vision(st);
    return st;
  }

  return {
    DT, INF, BLI, CAZA, ATAQUE, DRON, ESPIA, MISIL, ART, AAM, AA, AM, FORTIN, RADAR, PISTA, DEPOSITO, EMBARCANDO, MARCHA, DESEMBARCANDO, DESPLEGADA, IDA, ORBITA, REGRESO,
    NOMBRES, DATOS, POSTURAS, crear, paso, aplicar, vista, celdaDe, dueno, transitable, destinoValido, eta, etaRuta, satelites, esSuelo, puedeConstruir, puedeReclutar, puedeComprarAire, cupoTierra, minutoDe, esNoche, quebrar, danar, matar, caerCiudad, cansar,
    iaCrear, iaDecidir, estadoMayor, ordenar, partida, avanzar, hash, mulberry, indexar, vision, calcularSuministro, golpear, pasoCiudades, resumenHangar, capitalDe, serializar, deserializar, hangarLibre,
  };
})();
if (typeof module !== 'undefined') module.exports = DOCTRINA;
