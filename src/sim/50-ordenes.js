  /* ---------- Órdenes ---------- */
  function ordenarMover(st, s, lista, x, y, m = 0, forzar = false) {
    if (!forzar) lista = lista.filter(u => !u.rota);   // la tropa quebrada no obedece hasta rehacerse
    lista = lista.filter(u => u.comb > 0.01);        // sin combustible no hay marcha
    lista.forEach((u, i) => {
      if (st.directa) u.manual = st.t + seg(600);   // una orden tuya manda sobre el estado mayor un buen rato
      const a = i * 2.4, d = i ? 16 + Math.sqrt(i) * 12 : 0, q = destinoValido(st, clamp(x + Math.cos(a) * d, 0, st.W), clamp(y + Math.sin(a) * d, 0, st.H));
      u.tx = q.x; u.ty = q.y; u.m = m; u.fort = 0;
      if (u.st === MARCHA) return;
      // La orden tarda en llegar, más lejos de la red; luego la infantería embarca y las piezas se desmontan.
      const demora = DATOS.orden.enlace + (conSuministro(st, s, u.x, u.y) ? 0 : DATOS.orden.lejos);
      u.st = EMBARCANDO; u.t = demora + (u.c !== BLI ? DATOS.embarque.subir : 0);
    });
  }
  // Devuelve el motivo por el que no se puede construir aquí, o '' si se puede.
  function puedeConstruir(st, s, d, x, y) {
    const D = DATOS.instalaciones, ti = D.tipos[d];
    if (!ti) return 'tipo inválido';
    const k = celdaDe(st, x, y), b = st.bases[s];
    if (!transitable(st, k)) return 'aquí no se puede';
    if (dueno(st, k) !== signoDe(s) && Math.hypot(x - b.x, y - b.y) > 192) return 'territorio ajeno';
    if (st.defensas.filter(q => q.s === s).length >= D.tope) return `tope de ${D.tope}`;
    if (st.defensas.some(q => Math.hypot(q.x - x, q.y - y) < D.separacion)) return 'muy cerca de otra';
    if (!(s === 0 && st.god) && st.creditos[s] < ti.costo) return `faltan ${Math.ceil(ti.costo - st.creditos[s])}`;
    return '';
  }
  function cupoTierra(st, s) {
    const n = st.urbes.filter(u => u.dueno === signoDe(s)).length;
    const usadas = st.unidades.filter(u => !u.dead && u.s === s && !u.aire).length + st.colas[s].filter(q => esSuelo(q.c)).length;
    return { tope: DATOS.ejercito.base + n * DATOS.ejercito.porCiudad, usadas };
  }
  // Una ciudad recluta si es tuya, tiene suministro y la controlas desde hace un tiempo.
  function puedeReclutar(st, s, c, id) {
    const cl = DATOS.clases[c], u = st.urbes[id];
    if (!cl || !esSuelo(c)) return 'clase inválida';
    if (!u || u.dueno !== signoDe(s)) return 'ciudad ajena';
    if (!u.capital) return 'solo en la capital';
    if (!u.capital && st.t - u.desde < seg(DATOS.ciudad.antiguedad) && u.desde > 0) return 'recién tomada';
    if (u.batalla) return 'en batalla';
    if (!conSuministro(st, s, u.x, u.y)) return 'sin suministro';
    if (!(s === 0 && st.god)) { const q = cupoTierra(st, s); if (q.usadas >= q.tope) return `tope de ${q.tope} compañías`; }
    if (st.colas[s].length >= 16) return 'cola llena';
    if (!(s === 0 && st.god) && st.creditos[s] < cl.costo) return `faltan ${Math.ceil(cl.costo - st.creditos[s])}`;
    return '';
  }
  function puedeComprarAire(st, s, c, id) {
    const cl = DATOS.clases[c], d = st.defensas.find(q => q.id === id && q.s === s && q.t === PISTA);
    if (!cl || esSuelo(c)) return 'clase inválida';
    if (!d || st.t < d.listo) return 'sin pista';
    if (st.colas[s].length >= 16) return 'cola llena';
    if (!(s === 0 && st.god) && st.creditos[s] < cl.costo) return `faltan ${Math.ceil(cl.costo - st.creditos[s])}`;
    return '';
  }
  function pasoColas(st) {
    for (let s = 0; s < 2; s++) {
      const L = st.colas[s];
      for (let i = L.length - 1; i >= 0; i--) {
        const q = L[i];
        if (q.listo > st.t) continue;
        L.splice(i, 1);
        if (q.u !== undefined) {
          const u = st.urbes[q.u];
          if (u.dueno === signoDe(s)) { nuevaUnidad(st, s, q.c, u.x + (azar(st) - .5) * 40, u.y + (azar(st) - .5) * 40); st.ev.push({ k: 'lista', c: q.c, s, m: q.m, x: u.x, y: u.y, t: st.t }); }
          else st.creditos[s] += q.pagado;
        } else {
          const d = st.defensas.find(w => w.id === q.d);
          if (d) { d.hangar.push({ c: q.c, listo: 0, res: 0 }); st.ev.push({ k: 'lista', c: q.c, s, m: q.m, x: d.x, y: d.y, t: st.t }); }
          else st.creditos[s] += q.pagado;
        }
      }
    }
  }
  function aplicar(st, s, o) {
    if (st.fin || !o) return false;
    if (o.t === 'mover') {
      if (!Array.isArray(o.ids) || !Number.isFinite(o.x) || !Number.isFinite(o.y)) return false;
      const L = st.unidades.filter(u => !u.dead && u.s === s && !u.aire && o.ids.includes(u.id) && (u.c !== INF || u.camion));
      if (!L.length) return false;
      ordenarMover(st, s, L, clamp(o.x, 0, st.W), clamp(o.y, 0, st.H), o.m | 0);
      return true;
    }
    if (o.t === 'mision') { const m = crearMision(st, s, o); return m ? m.id : false; }
    if (o.t === 'zona') {
      if (!Number.isFinite(o.x) || !Number.isFinite(o.y) || st.zonas.filter(z => z.s === s).length >= 16) return false;
      const r = DATOS.zonas.radios[clamp(o.r | 0, 0, DATOS.zonas.radios.length - 1)], prio = clamp(o.prio | 0 || 2, 1, 3), max = clamp(o.max | 0 || 2, 1, DATOS.zonas.maxInt);
      const z = { id: st.sigZ++, s, x: clamp(o.x, 0, st.W), y: clamp(o.y, 0, st.H), r, prio, max, casT: 0 };
      st.zonas.push(z);
      return z.id;
    }
    if (o.t === 'quitarZona') { const i = st.zonas.findIndex(z => z.id === o.id && z.s === s); if (i < 0) return false; st.zonas.splice(i, 1); return true; }
    if (o.t === 'prioridadZona') { const z = st.zonas.find(q => q.id === o.id && q.s === s); if (!z) return false; z.prio = clamp(o.prio | 0, 1, 3); return true; }
    if (o.t === 'construir') {
      if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return false;
      const x = clamp(o.x, 0, st.W), y = clamp(o.y, 0, st.H), ti = DATOS.instalaciones.tipos[o.d];
      if (puedeConstruir(st, s, o.d, x, y)) return false;
      const paga = s === 0 && st.god ? 0 : ti.costo;
      st.creditos[s] -= paga;
      nuevaInstalacion(st, s, o.d, x, y, st.t + seg(ti.obra), o.m | 0, paga);
      return true;
    }
    if (o.t === 'reclutar') {
      const cl = DATOS.clases[o.c];
      if (esSuelo(o.c)) { if (puedeReclutar(st, s, o.c, o.u)) return false; }
      else if (puedeComprarAire(st, s, o.c, o.d)) return false;
      const paga = s === 0 && st.god ? 0 : cl.costo;
      st.creditos[s] -= paga;
      st.colas[s].push({ c: o.c, u: esSuelo(o.c) ? o.u : undefined, d: esSuelo(o.c) ? undefined : o.d, listo: st.t + seg(cl.obra), m: o.m | 0, pagado: paga });
      return true;
    }
    if (o.t === 'cancelar') {
      const id = o.m | 0;
      if (!id) return false;
      let n = 0;
      const L = st.colas[s];
      for (let i = L.length - 1; i >= 0; i--) if (L[i].m === id) { st.creditos[s] += L[i].pagado; L.splice(i, 1); n++; }
      for (let i = st.defensas.length - 1; i >= 0; i--) { const d = st.defensas[i]; if (d.s === s && d.m === id && st.t < d.listo) { st.creditos[s] += d.pagado; st.defensas.splice(i, 1); n++; } }
      const m = st.misiones.find(q => q.id === id && q.s === s);
      if (m) { for (const p of m.pend) { p.h.res = 0; n++; } m.pend = []; m.ataqueHecho = true; }
      for (const u of st.unidades) {
        if (u.dead || u.s !== s || u.m !== id) continue;
        if (u.aire) { if (u.c !== MISIL && u.st !== REGRESO) { u.st = REGRESO; n++; } }
        else if (u.st === MARCHA || u.st === EMBARCANDO) { u.tx = u.x; u.ty = u.y; llegar(st, u); n++; }
      }
      return n > 0;
    }
    // Despliegue inicial: colocar la reserva en territorio propio, repartirla sola, y dar por empezada la guerra.
    if (o.t === 'colocar') {
      if (!st.despliegue) return false;
      const k = celdaDe(st, o.x, o.y);
      if (dueno(st, k) !== signoDe(s) || !transitable(st, k)) return false;
      const L = st.unidades.filter(u => !u.dead && u.s === s && !u.aire && Array.isArray(o.ids) && o.ids.includes(u.id));
      L.forEach((u, i) => { const a = i * 2.4, d = i ? 18 + Math.sqrt(i) * 12 : 0; poner(st, u, clamp(o.x + Math.cos(a) * d, 0, st.W), clamp(o.y + Math.sin(a) * d, 0, st.H)); });
      if (L.length) { indexar(st); vision(st); }
      return L.length > 0;
    }
    if (o.t === 'desplegarAuto') { if (!st.despliegue) return false; repartir(st, s); indexar(st); vision(st); return true; }
    if (o.t === 'iniciar') { if (!st.despliegue) return false; st.despliegue = false; indexar(st); calcularSuministro(st); vision(st); return true; }
    // Encender o apagar un radar propio: encendido ve lejos y se delata; apagado no ve ni lo oyen.
    // Doctrina general del bando: se aplica con demora. Los objetivos marcados y el nivel valen al instante.
    if (o.t === 'doctrina') {
      const I = DATOS.doctrina, d = {}, ok = { postura: ['ofensiva', 'equilibrada', 'defensiva'], preservar: [0, 0.5, 0.65], emisiones: ['siempre', 'amenaza'], artilleria: ['libre', 'contra', 'silencio'], riesgo: ['asumir', 'evitar'], ciudades: [true, false] };
      for (const k of Object.keys(ok)) if (k in o && ok[k].includes(o[k])) d[k] = o[k];
      if (o.nivel in DATOS.niveles) st.doctrina[s].nivel = o.nivel;
      if (!Object.keys(d).length) return o.nivel in DATOS.niveles;
      st.doctrinaPend[s] = { t: st.despliegue || st.t === 0 ? 0 : st.t + seg(I.demora), d: { ...(st.doctrinaPend[s] ? st.doctrinaPend[s].d : {}), ...d } };
      if (st.despliegue) { Object.assign(st.doctrina[s], st.doctrinaPend[s].d); st.doctrinaPend[s] = null; }
      return true;
    }
    if (o.t === 'objetivo') {
      const u = st.urbes[o.id], L = st.doctrina[s].objetivos; if (!u) return false;
      const i = L.indexOf(u.id); if (o.on && i < 0) L.push(u.id); else if (!o.on && i >= 0) L.splice(i, 1);
      return true;
    }
    if (o.t === 'radar') { const d = st.defensas.find(q => q.id === o.id && q.s === s && q.t === RADAR); if (!d) return false; d.off = !o.on; return true; }
    if (o.t === 'god') { if (s !== 0) return false; st.god = !!o.on; return true; }
    return false;
  }
