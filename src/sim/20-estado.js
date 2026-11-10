  const dueno = (st, i) => { const c = st.ter.ctrl[i], u = DATOS.umbralTerreno; return c > u ? 1 : c < -u ? -1 : 0; };
  function celdaDe(st, x, y) {
    const T = st.ter;
    return clamp(Math.floor(x / T.size), 0, T.cols - 1) + clamp(Math.floor(y / T.size), 0, T.rows - 1) * T.cols;
  }
  const signoDe = s => (s === 0 ? 1 : -1);
  const ladoDe = d => (d > 0 ? 0 : 1);

  /* ---------- Creación ---------- */
  function nuevaInstalacion(st, s, t, x, y, listo, m = 0, pagado = 0, extra = {}) {
    const ti = DATOS.instalaciones.tipos[t];
    const d = { id: st.sigDef++, s, t, x, y, hp: extra.hp || ti.hp, listo, cd: 0, m, pagado, cierre: 0 };
    if (t === PISTA) d.hangar = [];
    st.defensas.push(d);
    return d;
  }
  function nuevaUnidad(st, s, c, x, y) {
    const cl = DATOS.clases[c];
    const u = { id: st.sigId++, s, c, x, y, px: x, py: y, tx: x, ty: y, st: DESPLEGADA, cd: 0, fuerza: cl.fuerza, camion: c === INF, via: null, t: 0, m: 0, dead: false, idt: false, oculto: false, urbe: -1, aire: false, sinSum: 0, rota: false, fort: 0, delata: 0, mun: 1, comb: 1 };
    st.unidades.push(u);
    return u;
  }
  // manual[s]: ese bando arranca con su tropa en reserva en la capital y la coloca antes de que corra el reloj.
  // modo: null (campaña simétrica) o { atacante: 0|1 } para ataque/defensa.
  function crear({ seed = 1, mapa = null, manual = [false, false], modo = null } = {}) {
    const m = mapa || A.crearVacio(), der = A.derivar(m);
    const size = A.CELDA, cols = A.COLS, rows = A.ROWS, W = A.W, H = A.H, n = A.N;
    const st = {
      W, H, despliegue: !!(manual[0] || manual[1]), modo: modo ? { atacante: modo.atacante ? 1 : 0, plazo: seg(DATOS.asalto.dias * 1440 - DATOS.reloj.inicio), meta: DATOS.asalto.meta } : null, obras: [0, 0], sem: seed | 0, seed, t: 0, sigId: 1, sigDef: 1, sigM: 1, sigZ: 1, fin: null, god: false,
      unidades: [], ev: [], defensas: [], zonas: [], misiones: [], colas: [[], []],
      creditos: [DATOS.creditos.inicio, DATOS.creditos.inicio], memDef: [new Map(), new Map()],
      ter: { cols, rows, size, ctrl: new Float32Array(n), cuenta: [0, 0] },
      vis: [new Uint8Array(n), new Uint8Array(n)], mem: [new Int8Array(n), new Int8Array(n)], memRoto: [new Uint8Array(n), new Uint8Array(n)],
      sum: [new Uint8Array(n), new Uint8Array(n)], prov: new Int16Array(n).fill(-1),
      mapa: { nombre: m.nombre, areas: m.areas, lineas: m.lineas, der, costas: A.costas(m) },
      roto: new Int32Array(n), rotos: [], campos: new Map(), anclas: new Int32Array(n).fill(-1), genRutas: 0, cuotaRutas: 4,
      velT: [new Float32Array(n), new Float32Array(n)],
      ciudades: [], puentes: [], vigia: [[], []], radar: [[], []], fotos: [new Map(), new Map()], alertas: [[], []],
      urbes: [], conq: [0, 0], agot: [0, 0], abastos: [DATOS.abastos.reserva.inicio, DATOS.abastos.reserva.inicio], tormenta: 0,
      doctrina: [0, 1].map(() => ({ ...DATOS.doctrina.inicial, objetivos: [] })), doctrinaPend: [null, null], stats: { bajas: [0, 0], fuerzaPerdida: [0, 0] }, bases: [{ ...A.BASES[0], s: 0, signo: 1 }, { ...A.BASES[1], s: 1, signo: -1 }],
    };
    st.v = DATOS.clases.map(c => DATOS.dRef / c.cruce);
    const R = DATOS.relieve;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = (i + .5) * size, y = (j + .5) * size, k = i + j * cols, t = m.areas[k];
      for (let q = 0; q < 2; q++) st.velT[q][k] = der.camino[k] ? R.camino[q] : R.vel[q][t];
      if (t === A.CIUDAD) st.ciudades.push(k);
      if (der.puente[k]) st.puentes.push(k);
      if (der.bloqueo[k]) continue;
      if (der.separa) st.ter.ctrl[k] = der.lado[k];
      else if (Math.hypot(x - st.bases[0].x, y - st.bases[0].y) <= 250) st.ter.ctrl[k] = 1;
      else if (Math.hypot(x - st.bases[1].x, y - st.bases[1].y) <= 250) st.ter.ctrl[k] = -1;
      if (der.separa) {
        let junto = false;
        for (let dy = -1; dy <= 1 && !junto; dy++) for (let dx = -1; dx <= 1; dx++) {
          const a = i + dx, b = j + dy;
          if (a >= 0 && b >= 0 && a < cols && b < rows && der.fro[a + b * cols]) { junto = true; break; }
        }
        if (junto) st.vigia[der.lado[k] > 0 ? 0 : 1].push(k);
      }
    }
    for (let s = 0; s < 2; s++) {
      const b = st.bases[s], lista = st.radar[s];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = (i + .5) * size, y = (j + .5) * size;
        if (Math.hypot(x - b.x, y - b.y) > DATOS.base.rVision) continue;
        let libre = true;
        const destino = i + j * cols;
        A.celdasDeSegmento(b.x, b.y, x, y, (ci, cj) => { const q = ci + cj * cols; if (q !== destino && m.areas[q] === A.MONTANA) libre = false; });
        if (libre) lista.push(destino);
      }
      for (let i = 0; i < n; i++) st.mem[s][i] = dueno(st, i);
    }
    armarCiudades(st);
    for (let s = 0; s < 2; s++) desplegarInicio(st, s, manual[s]);
    calcularSuministro(st);
    contarTerreno(st);
    vision(st);
    return st;
  }
  // Cada grupo de celdas urbanas es una ciudad; las capitales son la base de cada bando.
  function armarCiudades(st) {
    const { cols, rows, size } = st.ter, n = cols * rows, vistoU = new Uint8Array(n), areas = st.mapa.areas, grupos = [];
    for (const k0 of st.ciudades) {
      if (vistoU[k0]) continue;
      const celdas = [k0]; vistoU[k0] = 1;
      let sx = 0, sy = 0;
      for (let h = 0; h < celdas.length; h++) {
        const k = celdas[h], i = k % cols, j = (k - i) / cols;
        sx += (i + .5) * size; sy += (j + .5) * size;
        for (const [dx, dy] of V8) {
          const a = i + dx, b = j + dy;
          if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
          const q = a + b * cols;
          if (!vistoU[q] && areas[q] === A.CIUDAD) { vistoU[q] = 1; celdas.push(q); }
        }
      }
      grupos.push({ celdas, x: sx / celdas.length, y: sy / celdas.length, capital: false });
    }
    for (const b of st.bases) grupos.push({ celdas: [celdaDe(st, b.x, b.y)], x: b.x, y: b.y, capital: true, lado: b.s });
    grupos.forEach((g, i) => {
      const d = g.capital ? signoDe(g.lado) : duenoMayoria(g.celdas, k => dueno(st, k)), nb = g.capital ? 6 : 3 + (g.celdas.length > 2 ? 1 : 0) + (g.celdas.length > 4 ? 1 : 0);
      const barrios = [];
      for (let b = 0; b < nb; b++) { const a = b / nb * 6.2832 - 1.57; barrios.push({ dueno: d, x: g.x + Math.cos(a) * 19, y: g.y + Math.sin(a) * 19 }); }
      st.urbes.push({
        id: i, nombre: g.capital ? (g.lado === 0 ? 'Aurora' : 'Ocaso') : DATOS.nombresCiudad[i % DATOS.nombresCiudad.length], x: g.x, y: g.y, celdas: g.celdas, capital: g.capital,
        dueno: d, orig: d, barrios, prog: 0, guar: g.capital ? DATOS.ciudad.guarnicion * 2 : (d ? DATOS.ciudad.guarnicion : 8), moral: 1, dano: 0, res: 0, ocupada: null, desde: 0, cambio: false, batalla: null, cerco: 0,
      });
    });
    // Provincias: cada celda transitable pertenece a la ciudad más cercana por tierra.
    const der = st.mapa.der, cola = new Int32Array(n), ini = new Int32Array(n).fill(-1);
    let a = 0, b = 0;
    st.urbes.forEach(u => { for (const k of u.celdas) { if (st.prov[k] < 0) { st.prov[k] = u.id; cola[b++] = k; } } });
    while (a < b) {
      const k = cola[a++], i = k % cols, j = (k - i) / cols;
      for (const [dx, dy] of V8) {
        const x = i + dx, y = j + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const q = x + y * cols;
        if (st.prov[q] >= 0 || der.bloqueo[q]) continue;
        st.prov[q] = st.prov[k]; cola[b++] = q;
      }
    }
    void ini;
    if (der.separa) st.salidasCap = true;
  }
  function duenoMayoria(celdas, f) {
    let a = 0, b = 0;
    for (const k of celdas) { const d = f(k); if (d > 0) a++; else if (d < 0) b++; }
    return a * 2 > celdas.length ? 1 : b * 2 > celdas.length ? -1 : 0;
  }
  function capitalDe(st, s) { return st.urbes.find(u => u.capital && u.orig === signoDe(s)); }
  function desplegarInicio(st, s, manual) {
    const rol = st.modo ? (st.modo.atacante === s ? 'atacante' : 'defensor') : null;
    const F = rol ? { ...DATOS.fuerzasIniciales, ...DATOS.asalto[rol] } : DATOS.fuerzasIniciales, D = DATOS.instalaciones, b = st.bases[s], cap = capitalDe(st, s);
    let pista = null;
    for (const q of D.enCapital) {
      const a = q.ang * Math.PI / 180;
      const d = nuevaInstalacion(st, s, q.t, b.x + b.signo * q.r * Math.cos(a), b.y - b.signo * q.r * Math.sin(a), 0, 0, 0, q.t === PISTA ? { hp: 14 } : {});
      if (q.t === PISTA) pista = d;
    }
    const mas = rol === 'atacante' ? DATOS.asalto.aviacion : 1;
    for (const [c, n] of Object.entries(F.hangar)) for (let i = 0; i < Math.round(n * mas); i++) pista.hangar.push({ c: +c, listo: 0, res: 0 });
    if (rol === 'atacante') st.abastos[s] = DATOS.abastos.reserva.base;
    if (rol === 'defensor') st.obras[s] = DATOS.asalto.obras;
    // Las tropas iniciales guarnecen las ciudades propias más cercanas a la frontera y la capital.
    const propias = st.urbes.filter(u => u.dueno === signoDe(s) && !u.capital).sort((p, q) => Math.hypot(q.x - b.x, q.y - b.y) - Math.hypot(p.x - b.x, p.y - b.y));
    for (let i = 0; i < F.inf; i++) nuevaUnidad(st, s, INF, cap.x, cap.y);
    for (let i = 0; i < F.bli; i++) nuevaUnidad(st, s, BLI, cap.x, cap.y);
    for (let i = 0; i < F.art; i++) nuevaUnidad(st, s, ART, cap.x, cap.y);
    for (let i = 0; i < F.aam; i++) nuevaUnidad(st, s, AAM, cap.x, cap.y);
    if (manual) reserva(st, s); else { repartir(st, s); fortificarAuto(st, s); }
  }
  const tierraDe = (st, s) => st.unidades.filter(u => !u.dead && u.s === s && !u.aire);
  const poner = (st, u, x, y) => { const q = destinoValido(st, x, y); u.x = u.px = u.tx = q.x; u.y = u.py = u.ty = q.y; u.st = DESPLEGADA; u.m = 0; };
  // En reserva: un anillo alrededor de la capital, para poder elegirlas.
  function reserva(st, s) {
    const cap = capitalDe(st, s), L = tierraDe(st, s);
    L.forEach((u, i) => { const a = i / L.length * Math.PI * 2; poner(st, u, cap.x + Math.cos(a) * 64, cap.y + Math.sin(a) * 64); });
  }
  // Fortificación automática del defensor: gasta las obras iniciales en fortines y antiaéreas en las ciudades del frente.
  function fortificarAuto(st, s) {
    if (!st.modo || st.modo.atacante === s) return;
    const b = st.bases[s], T = DATOS.instalaciones.tipos;
    const frente = st.urbes.filter(u => u.dueno === signoDe(s) && !u.capital).sort((p, q) => Math.hypot(q.x - b.x, q.y - b.y) - Math.hypot(p.x - b.x, p.y - b.y));
    let i = 0;
    while (st.obras[s] >= T[FORTIN].costo && i < 12) {
      const c = frente[i % Math.max(1, frente.length)] || capitalDe(st, s), t = i % 3 === 2 && st.obras[s] >= T[AA].costo ? AA : FORTIN, a = i * 2.1;
      const q = destinoValido(st, c.x + Math.cos(a) * 62, c.y + Math.sin(a) * 62);
      if (!st.defensas.some(d => Math.hypot(d.x - q.x, d.y - q.y) < DATOS.instalaciones.separacion)) { nuevaInstalacion(st, s, t, q.x, q.y, 0, 0, 0); st.obras[s] -= T[t].costo; }
      i++;
    }
  }
  // Reparto automático: guarnece las ciudades propias más cercanas a la frontera. El atacante se concentra en dos ejes.
  function repartir(st, s) {
    const b = st.bases[s], cap = capitalDe(st, s);
    const propias = st.urbes.filter(u => u.dueno === signoDe(s) && !u.capital).sort((p, q) => Math.hypot(q.x - b.x, q.y - b.y) - Math.hypot(p.x - b.x, p.y - b.y));
    if (st.modo && st.modo.atacante === s) propias.length = Math.min(propias.length, 2);
    const inf = tierraDe(st, s).filter(u => u.c === INF), bli = tierraDe(st, s).filter(u => u.c !== INF);
    inf.forEach((w, i) => { const u = propias[i % Math.max(1, propias.length)] || cap; poner(st, w, u.x + (i % 3 - 1) * 26, u.y + 26); });
    bli.forEach((w, i) => { const u = propias[i % Math.max(1, propias.length)] || cap; poner(st, w, u.x + (i % 2) * 30 - 15, u.y - 30); });
  }
  function contarTerreno(st) {
    let a = 0, b = 0;
    for (let i = 0; i < st.ter.ctrl.length; i++) { const d = dueno(st, i); if (d > 0) a++; else if (d < 0) b++; }
    st.ter.cuenta[0] = a; st.ter.cuenta[1] = b;
  }
