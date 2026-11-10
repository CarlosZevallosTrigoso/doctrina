  /* ---------- IA: decide con la misma vista y las mismas órdenes que el jugador ---------- */
  const POSTURAS = {
    equilibrada: { aire: 1, tierra: 1, audacia: 2.0 },
    aerea: { aire: 1.5, tierra: .7, audacia: 2.2 },
    terrestre: { aire: .6, tierra: 1.4, audacia: 1.7 },
    metodica: { aire: 1, tierra: 1, audacia: 3 },
  };
  function iaCrear(seed, nombre) {
    const r = mulberry(seed), claves = ['equilibrada', 'aerea', 'terrestre', 'metodica'], n = nombre && POSTURAS[nombre] ? nombre : claves[Math.floor(r() * claves.length)];
    return { r, nombre: n, p: POSTURAS[n], sec: { log: true, def: true, fue: true, man: true }, marcados: false, prox: seg(10 + r() * 10), proxAire: seg(40 + r() * 40), zonasK: '', objetivo: null, objT: 0 };
  }
  function iaDecidir(ia, v) {
    const o = [], r = ia.r, p = ia.p;
    if (v.t < ia.prox) return o;
    ia.prox = v.t + seg(12 + r() * 10);
    // Secciones del estado mayor activas (logística, defensa aérea y reconocimiento, fuegos, maniobra) y doctrina del bando.
    const SEC = ia.sec, doc = v.doctrina, aud = p.audacia * DATOS.doctrina.audacia[doc.postura];
    const signo = v.s === 0 ? 1 : -1, C = DATOS.clases, b = v.base, e = v.baseEnemiga, cr = { v: v.creditos };
    const d = (q, w) => Math.hypot(q.x - w.x, q.y - w.y);
    const mias = v.ciudades.filter(c => c.dueno === signo), ajenas = v.ciudades.filter(c => c.dueno !== signo);
    const tierra = v.propias.filter(u => !u.aire && !u.rota && !(u.manual > v.t)), enemigosT = v.contactos.filter(u => !u.aire);
    const distFrente2 = c => v.ciudades.filter(q => q.dueno === signo).reduce((m, q) => Math.min(m, d(c, q)), 1e9);
    const distFrente = c => ajenas.reduce((m, q) => Math.min(m, d(c, q)), 1e9);
    // Zonas de control: capital y ciudades del frente.
    const frente = mias.filter(c => !c.capital).sort((x, y) => distFrente(x) - distFrente(y)).slice(0, 3);
    const clave = frente.map(c => c.id).join(',');
    if (SEC.def && clave !== ia.zonasK) {
      ia.zonasK = clave;
      for (const z of v.zonas) o.push({ t: 'quitarZona', id: z.id });
      o.push({ t: 'zona', x: b.x, y: b.y, r: 2, prio: 1, max: 4 });
      for (const c of frente) o.push({ t: 'zona', x: c.x, y: c.y, r: 1, prio: 2, max: 2 });
    }
    // Compras: lo que más falta respecto de su doctrina.
    const hay = c => v.propias.filter(u => u.c === c).length + (v.hangar[c] ? v.hangar[c].total : 0) + v.cola.filter(q => q.c === c).length;
    const metas = [[INF, 20 * p.tierra], [BLI, 8 * p.tierra], [ART, 4 * p.tierra], [AAM, 3], [CAZA, 12 * p.aire], [ATAQUE, 10 * p.aire], [DRON, 9], [ESPIA, 3], [MISIL, 12 * p.aire]];
    metas.sort((x, y) => hay(x[0]) / x[1] - hay(y[0]) / y[1]);
    const pista = v.defensas.find(q => q.t === PISTA && v.t >= q.listo);
    for (const [c] of SEC.log ? metas : []) {
      if (cr.v < C[c].costo) continue;
      if (esSuelo(c)) {
        if (tierra.length + v.cola.filter(q => esSuelo(q.c)).length >= DATOS.ejercito.base + mias.length * DATOS.ejercito.porCiudad) continue;
        const lugar = mias.find(q => q.capital && !q.batalla);   // todo lo nuevo nace en la capital
        if (lugar) { o.push({ t: 'reclutar', c, u: lugar.id }); cr.v -= C[c].costo; }
      } else if (pista) { o.push({ t: 'reclutar', c, d: pista.id }); cr.v -= C[c].costo; }
      break;
    }
    // Instalaciones: defensa de la capital y del frente.
    const T = DATOS.instalaciones.tipos;
    if (SEC.log && r() < .45) {
      const nEn = (t, c, R) => v.defensas.filter(q => q.t === t && d(q, c) <= R).length;
      const alrededor = (c, R) => { const a = r() * 6.283; return { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R }; };
      const caps = mias.find(c => c.capital);
      if (caps && cr.v >= T[AA].costo + 100 && nEn(AA, caps, 200) < 4) { const a = r() * 1.57, q = { x: b.x + b.signo * (70 + r() * 90) * Math.cos(a), y: b.y - b.signo * (70 + r() * 90) * Math.sin(a) }; o.push({ t: 'construir', d: AA, x: q.x, y: q.y }); cr.v -= T[AA].costo; }
      else if (frente[0] && cr.v >= T[FORTIN].costo + 100 && nEn(FORTIN, frente[0], 120) < 2) { const q = alrededor(frente[0], 55); o.push({ t: 'construir', d: FORTIN, x: q.x, y: q.y }); cr.v -= T[FORTIN].costo; }
      else if (frente[0] && cr.v >= T[AA].costo + 200 && nEn(AA, frente[0], 200) < 1) { const q = alrededor(frente[0], 70); o.push({ t: 'construir', d: AA, x: q.x, y: q.y }); cr.v -= T[AA].costo; }
      else if (frente[1] && cr.v >= T[PISTA].costo + 300 && v.defensas.filter(q => q.t === PISTA).length < 2) { const q = alrededor(frente[1], 90); o.push({ t: 'construir', d: PISTA, x: q.x, y: q.y }); cr.v -= T[PISTA].costo; }
      else if (frente[0] && !frente[0].suministro && cr.v >= T[DEPOSITO].costo) { const q = alrededor(frente[0], 60); o.push({ t: 'construir', d: DEPOSITO, x: q.x, y: q.y }); cr.v -= T[DEPOSITO].costo; }
    }
    // Tierra: socorrer lo amenazado, guarnecer lo ocupado, concentrar y asaltar.
    // Comprometida: peleando en una ciudad ajena o en contacto. A esa compañía no se la retira.
    const noMias = v.ciudades.filter(c => c.dueno !== signo);
    const comprometida = u => noMias.some(c => d(u, c) <= DATOS.ciudad.rZona + 30) || enemigosT.some(w => d(u, w) < 140);
    const ocupadas = new Set(), libres = tierra.filter(u => u.st === DESPLEGADA && (u.c !== INF || u.camion) && !v.misiones.some(m => m.id === u.m && m.estado !== 'fin' && m.tipo !== 'refuerzo') && !comprometida(u));
    const tomar = (c, n) => libres.filter(u => !ocupadas.has(u.id)).sort((x, y) => d(x, c) - d(y, c)).slice(0, n);
    const fuerzaCerca = (c, R) => tierra.filter(u => d(u, c) <= R).reduce((a, u) => a + u.fuerza * C[u.c].peso, 0);
    // Socorrer solo lo que esté en desventaja y no tenga ya refuerzos en camino.
    const enCamino = c => tierra.filter(u => u.st !== DESPLEGADA && d({ x: u.tx, y: u.ty }, c) < 170).reduce((a, u) => a + u.fuerza * C[u.c].peso, 0);
    const amenazaDe = c => enemigosT.filter(u => d(u, c) < 300).reduce((a, u) => a + (u.fuerza || 6) * (C[u.c] ? C[u.c].peso || 1 : 1), 0);
    const amenazadas = mias.filter(c => { const a = amenazaDe(c); return (c.batalla || a > 0) && fuerzaCerca(c, 200) + (c.guar || 0) + enCamino(c) < a * 1.3 + 8; }).sort((x, y) => (y.capital - x.capital) || (amenazaDe(y) - amenazaDe(x)));
    for (const c of SEC.log ? amenazadas.slice(0, 1) : []) {
      const n = tomar(c, 3).filter(u => d(u, c) > DATOS.ciudad.rZona);
      if (n.length) { n.forEach(u => ocupadas.add(u.id)); o.push({ t: 'mision', tipo: 'refuerzo', x: c.x, y: c.y, ids: n.map(u => u.id) }); }
    }
    for (const c of SEC.log ? mias.filter(q => q.ocupada && fuerzaCerca(q, 140) < 8).slice(0, 2) : []) {
      const n = tomar(c, 1);
      if (n.length) { ocupadas.add(n[0].id); o.push({ t: 'mision', tipo: 'refuerzo', x: c.x, y: c.y, ids: [n[0].id] }); }
    }
    // Objetivo: la ciudad ajena más accesible, ponderando lo que se sabe de ella.
    const fijo = ia.objetivo != null ? v.ciudades.find(c => c.id === ia.objetivo) : null;
    if (!fijo || fijo.dueno === signo || v.t - ia.objT > seg(2400) || (ia.marcados && !doc.objetivos.includes(fijo.id))) {
      let m = null, mv = -Infinity;
      const ref = mias.length ? mias : [{ x: b.x, y: b.y }];
      // Solo objetivos donde la tropa no quedaría cercada, si los hay.
      const alcanzables = ajenas.filter(c => v.linea(c.x, c.y));
      // Con objetivos marcados por el mando, el estado mayor solo ataca esos.
      const candidatas = ia.marcados ? ajenas.filter(c => doc.objetivos.includes(c.id)) : alcanzables.length ? alcanzables : ajenas;
      for (const c of candidatas) {
        const cerca = ref.reduce((a, q) => Math.min(a, d(c, q)), 1e9);
        const estima = (c.guar == null ? 14 : c.guar) + enemigosT.filter(u => d(u, c) < 200).reduce((a, u) => a + (u.fuerza || 6) * (C[u.c] ? C[u.c].peso || 1 : 1), 0);
        const val = -cerca / 400 - estima / 6 + (c.capital ? 8 : 0) + r() * 2;
        if (val > mv) { mv = val; m = c; }
      }
      ia.objetivo = m ? m.id : null; ia.objT = v.t;
    }
    const objetivo = ia.objetivo != null ? v.ciudades.find(c => c.id === ia.objetivo) : null;
    if (objetivo && SEC.man) {
      const base0 = mias.length ? mias.reduce((m, c) => (d(c, objetivo) < d(m, objetivo) ? c : m)) : { x: b.x, y: b.y };
      const disponibles = libres.filter(u => !ocupadas.has(u.id));
      const reunida = disponibles.filter(u => d(u, base0) <= 260);
      const fuerza = reunida.reduce((a, u) => a + u.fuerza * C[u.c].peso, 0);
      const estima = (objetivo.guar == null ? 14 : objetivo.guar) * (objetivo.dueno ? 1.45 : 1) + enemigosT.filter(u => d(u, objetivo) < 220).reduce((a, u) => a + (u.fuerza || 6) * (C[u.c] ? C[u.c].peso || 1 : 1), 0);
      if (fuerza >= Math.max(20, estima * aud)) {
        const paquete = {};
        if (SEC.fue && v.hangar[ATAQUE] && v.hangar[ATAQUE].listos >= 2) paquete[ATAQUE] = 2;
        if (SEC.fue && v.hangar[CAZA] && v.hangar[CAZA].listos >= 2) paquete[CAZA] = 2;
        o.push({ t: 'mision', tipo: 'asalto', x: objetivo.x, y: objetivo.y, ids: reunida.map(u => u.id), paquete });
        ia.objT = v.t;
      } else if (objetivo.batalla && disponibles.length) {
        // Si la batalla ya empezó, alimentarla con lo que esté libre.
        const n = disponibles.sort((x, y) => d(x, objetivo) - d(y, objetivo)).slice(0, 3);
        o.push({ t: 'mision', tipo: 'asalto', x: objetivo.x, y: objetivo.y, ids: n.map(u => u.id) });
      } else {
        const lejos = disponibles.filter(u => d(u, base0) > 260 && !mias.some(c => (c.ocupada || c.batalla) && d(u, c) < 160));
        if (lejos.length) o.push({ t: 'mover', ids: lejos.map(u => u.id), x: base0.x + (r() - .5) * 90, y: base0.y + (r() - .5) * 90 });
      }
    }
    // Aire: mirar antes de golpear, suprimir antes de bombardear.
    if ((SEC.def || SEC.fue) && v.t >= ia.proxAire) {
      ia.proxAire = v.t + seg(45 + r() * 45);
      const h = c => (v.hangar[c] ? v.hangar[c].listos : 0);
      const mis = (tipo, x, y, paquete) => o.push({ t: 'mision', tipo, x, y, paquete });
      const mirar = objetivo || (SEC.def && !SEC.man ? ajenas.slice().sort((x, y) => distFrente2(x) - distFrente2(y))[0] : null);
      if (SEC.def && mirar && (mirar.edad === Infinity || mirar.edad > seg(180)) && (h(ESPIA) || h(DRON))) mis('reconocimiento', mirar.x, mirar.y, h(ESPIA) ? { [ESPIA]: 1 } : { [DRON]: 1 });
      else if (SEC.fue) {
        // Riesgo aéreo «evitar»: no se ataca dentro del alcance de una antiaérea conocida sin suprimirla antes.
        const cubierto = q => doc.riesgo === 'evitar' && v.defensasE.some(w => w.t === AA && d(w, q) < 200);
        const aaCerca = objetivo ? v.defensasE.find(q => q.t === AA && d(q, objetivo) < 500) : null;
        const columna = enemigosT.filter(u => u.st === MARCHA).sort((x, y) => d(x, b) - d(y, b))[0];
        if (aaCerca && h(ATAQUE) >= 2) mis('supresion', aaCerca.x, aaCerca.y, { [ATAQUE]: 2, ...(h(CAZA) >= 2 ? { [CAZA]: 1 } : {}) });
        else if (columna && !cubierto(columna) && h(ATAQUE) >= 1 && r() < .7) mis('golpe', columna.x, columna.y, { [ATAQUE]: Math.min(2, h(ATAQUE)) });
        else if (objetivo && doc.ciudades && !cubierto(objetivo) && objetivo.dueno && h(ATAQUE) >= 3 && (objetivo.guar == null || objetivo.guar > 8)) mis('bombardeo', objetivo.x, objetivo.y, { [ATAQUE]: Math.min(4, h(ATAQUE) - 1), ...(h(CAZA) >= 2 ? { [CAZA]: 2 } : {}) });
        else if (h(MISIL) >= 2) { const q = v.defensasE.filter(w => w.t === PISTA || w.t === AA || w.t === RADAR).sort((x, y) => d(x, b) - d(y, b))[0]; if (q) mis('golpe', q.x, q.y, { [MISIL]: q.t === PISTA ? 3 : 2 }); }
      }
    }
    // Fuegos sin maniobra: la artillería libre se adelanta a la ciudad del frente más expuesta.
    if (SEC.fue && !SEC.man && frente[0]) {
      const piezas = tierra.filter(u => u.c === ART && u.st === DESPLEGADA && d(u, frente[0]) > 320);
      if (piezas.length) o.push({ t: 'mover', ids: piezas.map(u => u.id), x: frente[0].x - b.signo * 40, y: frente[0].y + b.signo * 40 });
    }
    void e;
    return o;
  }
