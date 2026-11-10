/* doctrina · RENDER, ENTRADA, AVISOS y SONIDO */
(() => {
  'use strict';
  const S = DOCTRINA, A = ATLAS;
  const $ = id => document.getElementById(id);
  const cv = $('mapa'), ctx = cv.getContext('2d', { alpha: false });
  const capa = document.createElement('canvas'), cc = capa.getContext('2d');
  const capaEst = document.createElement('canvas'), ce = capaEst.getContext('2d');
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const VAR = ['--personal', '--vehiculo', '--avion', '--ataque', '--dron', '--espia', '--misil', '--artilleria', '--aamovil'];
  const TIERRA = [S.INF, S.BLI, S.ART, S.AAM];
  const CLAVE_NIVEL = 'doctrina.nivel';
  const NIVELES = [['manual', 'manual', 'Decides todo tú.'], ['baja', 'baja', 'El estado mayor lleva la logística: recluta, compra, construye depósitos y manda refuerzos.'], ['media', 'media', 'Además lleva la defensa aérea y el reconocimiento.'], ['alta', 'alta', 'Además dirige los fuegos y ejecuta los asaltos: tú solo marcas qué ciudades tomar.'], ['total', 'total', 'El estado mayor lo decide todo. Tú miras y fijas la doctrina.']];
  const OPCIONES_DOC = [
    ['postura', 'Postura', [['ofensiva', 'ofensiva'], ['equilibrada', 'equilibrada'], ['defensiva', 'defensiva']], 'Cuánta ventaja exige el estado mayor antes de atacar.'],
    ['preservar', 'Preservar la fuerza', [[0, 'hasta el quiebre'], [0.5, 'replegar al 50 %'], [0.65, 'replegar al 65 %']], 'La unidad castigada se retira por orden antes de quebrarse.'],
    ['emisiones', 'Radares', [['siempre', 'siempre encendidos'], ['amenaza', 'solo ante amenaza']], 'Encendido ve lejos y se delata; callado no lo oyen.'],
    ['artilleria', 'Artillería', [['libre', 'fuego libre'], ['contra', 'solo contrabatería'], ['silencio', 'silencio']], 'Disparar delata a la batería.'],
    ['riesgo', 'Riesgo aéreo', [['asumir', 'asumir'], ['evitar', 'evitar antiaéreas']], 'Si el estado mayor ataca dentro del alcance de antiaéreas conocidas.'],
    ['ciudades', 'Ciudades', [[true, 'bombardeo permitido'], [false, 'no bombardear']], 'Bombardear daña lo que luego tendrás que ocupar.'],
  ];
  // Papel en la partida: atacas, defiendes, o campaña simétrica.
  const CLAVE_ROL = 'doctrina.rol';
  const ROLES = [['atacante', 'atacas', A => `Tienes más tropa y aviación. Ganas si tienes en tu poder ${A.meta} ciudades enemigas, o su capital, antes de que acabe el día ${A.dias}.`], ['defensor', 'defiendes', A => `Tienes menos tropa, pero empieza atrincherada y fortificas antes de la guerra. Ganas si el enemigo no toma ${A.meta} de tus ciudades antes de que acabe el día ${A.dias}, si su moral colapsa o si tomas su capital.`], [null, 'campaña', () => 'Guerra simétrica y larga: gana quien tome la capital, dos tercios de las ciudades, o agote la moral del otro.']];
  let rolInicial = 'atacante', semillaFija = null;
  try { const r = localStorage.getItem(CLAVE_ROL); if (r === 'defensor') rolInicial = 'defensor'; else if (r === 'campana') rolInicial = null; } catch (_) { /* sin almacenamiento */ }
  let nivelInicial = 'manual';
  try { const n = localStorage.getItem(CLAVE_NIVEL); if (n && S.DATOS.niveles[n]) nivelInicial = n; } catch (_) { /* sin almacenamiento */ }
  const COL = VAR.map(tok);
  // El color de una instalación dice su función.
  const VAR_DEF = ['--avion', '--misil', '--personal', '--espia', '--ataque', '--vehiculo'], COL_DEF = VAR_DEF.map(tok);
  const NEGRO = tok('--negro'), HUESO = tok('--hueso'), GRIS = tok('--gris'), TENUE = tok('--tenue'), CONTACTO = tok('--contacto');
  const MONO = tok('--mono');
  const calma = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const clampV = (v, a, b) => (v < a ? a : v > b ? b : v);
  const GLIFO = { [A.LLANURA]: [[0, 0]], [A.BOSQUE]: [[-3.6, -3.6], [3.6, 3.6]], [A.MONTANA]: [[0, -5.2], [-4.6, 3.4], [4.6, 3.4]], [A.CIUDAD]: [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]] };
  const ALFA = { [A.LLANURA]: .22, [A.BOSQUE]: .38, [A.MONTANA]: .6, [A.CIUDAD]: .55 };
  const TALLA = { [A.LLANURA]: 1, [A.BOSQUE]: 1.05, [A.MONTANA]: 1.25, [A.CIUDAD]: 1.3 };
  const RITMO = {
    costa: { c: 3.6, m: [[0, .6]], col: tok('--t-costa') },
    rio: { c: 3, m: [[0, .82]], col: tok('--t-rio') },
    camino: { c: 12, m: [[0, .85], [3.4, .85]], col: tok('--t-camino') },
    frontera: { c: 18, m: [[0, 1.4], [6, .7], [9, .7], [12, .7]], col: tok('--t-frontera') },
  };
  const CLAVE_GUARDADO = 'doctrina.partida';

  let menuAb = null, plan = null, ultima = null;
  let g, st, corriendo = false, vel = 1, acum = 0, ult = performance.now();
  let mapaActual = A.ejemplo(), iniciada = false, puentesUI = [];
  let cw = 1, ch = 1, dpr = 1, sx = 1, sy = 1, s = 1, ox = 0, oy = 0, fp = 1, capaT = -1, gesto = null, cursor = null, cursorP = null, avisoHasta = 0, confirma = 0;
  let trazos = new Map(), fx = [], generacion = 0, marca = null;
  let seleccion = new Set(), grupos = {}, acu, marcas;
  let niveles = [1, 2, 3, 4], nivel = 2, trans = null, horno = null, pinza = null, faros = [], flechas = [];
  let miniT = -1, miniU = 0, miniCam = '', modoCaja = false, ruedaHasta = 0, tGuardado = 0, pausaPorPlan = false, saltando = false, velAntes = 1;
  const teclas = new Set(), toques = new Map();

  /* ---------- Sonido: síntesis en el navegador, sin archivos ---------- */
  const Sonido = (() => {
    let ac = null, salida = null, ruidoBuf = null, activo = true;
    try { activo = localStorage.getItem('doctrina.sonido') !== '0'; } catch (_) { /* sin almacenamiento */ }
    const ult = {}, HUECO = { ping: 1, alarma: 1.8, impacto: .12, tiro: .09, base: .4, fin: 0 };
    function iniciar() {
      try {
        if (!ac) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ac = new AC();
          salida = ac.createGain(); salida.gain.value = .5; salida.connect(ac.destination);
          ruidoBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * .3), ac.sampleRate);
          const d = ruidoBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended') ac.resume().catch(() => {});
      } catch (_) { ac = null; }
    }
    function tono(f0, f1, dur, tipo, vol, ret = 0) {
      const t = ac.currentTime + ret, o = ac.createOscillator(), v = ac.createGain();
      o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      v.gain.setValueAtTime(.0001, t); v.gain.exponentialRampToValueAtTime(vol, t + .006); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(v); v.connect(salida); o.start(t); o.stop(t + dur + .02);
    }
    function ruido(dur, vol, corte) {
      const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain();
      s.buffer = ruidoBuf; f.type = 'lowpass'; f.frequency.value = corte;
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f); f.connect(v); v.connect(salida); s.start(t); s.stop(t + dur + .02);
    }
    const voces = {
      ping: () => tono(1250, 850, .09, 'sine', .16),
      alarma: () => { [880, 660, 880].forEach((f, i) => tono(f, f, .1, 'square', .07, i * .13)); },
      impacto: () => ruido(.22, .3, 520),
      tiro: () => tono(420, 240, .035, 'triangle', .05),
      base: () => tono(130, 70, .22, 'sine', .32),
      fin: gano => { (gano ? [392, 523, 659] : [392, 311, 233]).forEach((f, i) => tono(f, f * .99, .32, 'sine', .22, i * .2)); },
    };
    return {
      iniciar,
      get activo() { return activo; },
      alternar() {
        activo = !activo;
        try { localStorage.setItem('doctrina.sonido', activo ? '1' : '0'); } catch (_) { /* sin almacenamiento */ }
        return activo;
      },
      sonar(n, arg) {
        if (!activo || !ac || ac.state !== 'running') return;
        const t = ac.currentTime;
        if (t - (ult[n] ?? -9) < HUECO[n]) return;
        ult[n] = t;
        try { voces[n](arg); } catch (_) { /* un sonido perdido no detiene el juego */ }
      },
    };
  })();

  /* ---------- Selección de tropas ---------- */
  const propiasTierra = () => st.unidades.filter(u => !u.dead && u.s === 0 && !u.aire);
  const puedeMoverse = u => (u.c !== S.INF || u.camion) && !u.rota && u.comb > 0.01;
  function fijarSeleccion(ids) { seleccion = new Set(ids); pintarSeleccion(); }
  function limpiarSeleccion() { if (seleccion.size) fijarSeleccion([]); }
  function seleccionarTodas() {
    const q = propiasTierra().map(u => u.id);
    if (q.length) fijarSeleccion(q); else aviso('ninguna tropa desplegada');
  }
  function aplicarCaja(a, b, sumar) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const q = propiasTierra().filter(u => u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1).map(u => u.id);
    if (sumar) fijarSeleccion([...seleccion, ...q]); else fijarSeleccion(q);
    if (!q.length && !sumar) aviso('ninguna tropa tuya en el recuadro', 1000);
  }
  function ordenarSeleccion(p, tipo) {
    const us = propiasTierra().filter(u => seleccion.has(u.id) && puedeMoverse(u));
    if (!us.length) { aviso('esas tropas no tienen camión'); return; }
    const m = st.sigM++;
    const ok = tipo ? S.ordenar(st, { t: 'mision', tipo, x: p.x, y: p.y, ids: us.map(u => u.id), m }) : S.ordenar(st, { t: 'mover', ids: us.map(u => u.id), x: p.x, y: p.y, m });
    if (ok) { marca = { x: p.x, y: p.y, ms: performance.now() }; tHud = 0; } else aviso('no se pudo dar la orden');
  }
  function pintarSeleccion() {
    const us = propiasTierra().filter(u => seleccion.has(u.id));
    $('seleccion').hidden = us.length === 0;
    $('selN').textContent = `${us.length} ${us.length === 1 ? 'seleccionada' : 'seleccionadas'} · fuerza ${Math.round(us.reduce((a, u) => a + u.fuerza, 0))}`;
    document.body.classList.toggle('con-seleccion', us.length > 0);
  }
  function podar() {
    if (!seleccion.size) return;
    const vivos = new Set(propiasTierra().map(u => u.id));
    let cambio = false;
    for (const id of seleccion) if (!vivos.has(id)) { seleccion.delete(id); cambio = true; }
    if (cambio) pintarSeleccion();
  }

  /* ---------- Partida ---------- */
  function iniciarEstado() {
    iniciada = false; acum = 0; vel = 1; saltando = false; gesto = null; horno = null; trans = null; faros = []; flechas = []; miniT = -1; nivel = 2;
    puentesUI = st.mapa.der.centrosPuente.map(c => ({ x: c.x, y: c.y, celdas: st.puentes.filter(k => { const i = k % st.ter.cols, j = (k - i) / st.ter.cols; return Math.hypot((i + .5) * st.ter.size - c.x, (j + .5) * st.ter.size - c.y) < 26; }) }));
    trazos = new Map(); fx = []; capaT = -1; marca = null;
    cerrarMenu(); cerrarPlan(); seleccion = new Set(); grupos = {};
    acu = { pro: S.NOMBRES.map(() => 0), ene: S.NOMBRES.map(() => 0), lugar: null };
    marcas = { bajas: 0, alertaT: -1, sat: {}, conGod: false };
    tuto = null; consejoAbierto = false; eraNoche = null; pintarTuto(); $('despliegue').hidden = true; $('panelMando').hidden = true;
    $('registro').textContent = ''; $('vel').textContent = '×1'; $('final').hidden = true; $('titulo').textContent = 'doctrina';
    medir(); irABase(); pintarSeleccion(); hud();
  }
  function nueva() {
    g = S.partida({ seed: semillaFija != null ? semillaFija : (Date.now() ^ (Math.random() * 1e9)) | 0, mapa: mapaActual, ia1: 'auto', manual: true, rol: rolInicial }); semillaFija = null;
    st = g.st; iniciarEstado(); S.estadoMayor(g, nivelInicial); pintarMando();
  }
  function guardar(avisar) {
    if (tuto) { if (avisar) aviso('el tutorial no se guarda'); return; }
    if (st.despliegue) { if (avisar) aviso('aún no hay nada que guardar'); return; }
    if (st.fin) { try { localStorage.removeItem(CLAVE_GUARDADO); } catch (_) { /* sin almacenamiento */ } return; }
    try {
      localStorage.setItem(CLAVE_GUARDADO, JSON.stringify({ ia: g.ias[1] ? g.ias[1].nombre : 'equilibrada', estado: S.serializar(st) }));
      if (avisar) aviso('partida guardada');
    } catch (_) { if (avisar) aviso('no se pudo guardar en este navegador'); }
  }
  function haySaved() { try { return !!localStorage.getItem(CLAVE_GUARDADO); } catch (_) { return false; } }
  function continuar() {
    try {
      const o = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
      st = S.deserializar(o.estado);
      g = { st, ias: [null, S.iaCrear((st.t ^ st.seed) | 0, o.ia)] };
      if (st.modo) g.ias[1].rol = st.modo.atacante === 1 ? 'atacante' : 'defensor';
      iniciarEstado(); iniciada = true; abrirParte(false); corriendo = true; $('pausa').textContent = 'pausa';
      S.estadoMayor(g, st.doctrina[0].nivel); pintarMando();
      if (st.god) $('titulo').textContent = 'doctrina · GOD';
      return true;
    } catch (_) { msgMapa('No se pudo abrir la partida guardada.'); return false; }
  }
  function ponerEscala(v) { s = sx = sy = v; fp = clampV(v / 1.6, .72, 1.3); }
  // Modo táctil: texto, botones y unidades más grandes y menú lateral. En «auto» sigue al último puntero usado
  // (dedo → táctil; ratón o lápiz → escritorio), para tabletas que alternan dedo con teclado y lápiz.
  const CLAVE_MODO = 'doctrina.modo';
  let tactil = false, modo = 'auto';
  try { const m = localStorage.getItem(CLAVE_MODO); if (m === 'tactil' || m === 'escritorio') modo = m; } catch (_) { /* sin almacenamiento */ }
  function ponerTactil(v) {
    if (v === tactil) return;
    tactil = v; document.documentElement.classList.toggle('tactil', v);
    if (iniciada) { medir(); capaT = -1; }
  }
  function pintarModo() { const b = $('modo'); b.textContent = modo === 'auto' ? 'modo auto' : modo === 'tactil' ? 'modo táctil' : 'modo escritorio'; }
  function alternarModo() {
    modo = modo === 'auto' ? 'tactil' : modo === 'tactil' ? 'escritorio' : 'auto';
    try { if (modo === 'auto') localStorage.removeItem(CLAVE_MODO); else localStorage.setItem(CLAVE_MODO, modo); } catch (_) { /* sin almacenamiento */ }
    ponerTactil(modo === 'auto' ? matchMedia('(pointer: coarse)').matches : modo === 'tactil'); pintarModo();
  }
  addEventListener('pointerdown', e => { if (modo === 'auto') ponerTactil(e.pointerType === 'touch'); }, true);
  function medir() {
    const cx = (cw / 2 - ox) / s, cy = (ch / 2 - oy) / s;
    dpr = Math.min(devicePixelRatio || 1, tactil ? 1.5 : 2);   // en táctil, menos píxeles: casi no se nota y alivia mucho
    cw = innerWidth; ch = innerHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    // Niveles: todo el mapa, teatro de operaciones, escala de trabajo y de cerca.
    const todo = Math.min(cw / st.W, ch / st.H), trabajo = Math.max(ch > cw ? .9 : 1, Math.min(cw / 1664, ch / 1024) * 2);
    niveles = [todo, Math.max(todo * 1.8, Math.sqrt(todo * trabajo)), trabajo, trabajo * 1.75];
    ponerEscala(niveles[nivel]);
    trans = null; horno = null;
    const mi = $('mini'), mw = mi.clientWidth || 200, mh = mi.clientHeight || 123;
    mi.width = Math.round(mw * dpr); mi.height = Math.round(mh * dpr); miniT = -1;
    centrar(cx, cy);
  }
  // El borde izquierdo admite más recorrido para que el minimapa no tape tu base.
  function acotar(q) {
    const izq = ($('mini').offsetWidth || 200) + 28, otros = 80, mw = st.W * q.s, mh = st.H * q.s;
    q.ox = mw + izq + otros <= cw ? (cw - mw) / 2 : clampV(q.ox, cw - mw - otros, izq);
    q.oy = mh + otros * 2 <= ch ? (ch - mh) / 2 : clampV(q.oy, ch - mh - otros, otros);
    return q;
  }
  function moverCam(nx, ny) { const q = acotar({ s, ox: nx, oy: ny }); ox = q.ox; oy = q.oy; }
  function centrar(x, y) { moverCam(cw / 2 - x * s, ch / 2 - y * s); }
  function irABase() { const b = st.bases[0]; moverCam(cw * .3 - b.x * s, ch * .68 - b.y * s); }
  function acabarTrans() { if (!trans) return; ponerEscala(trans.s1); ox = trans.ox1; oy = trans.oy1; trans = null; }
  function cambiarNivel(d, ax = cw / 2, ay = ch / 2) {
    acabarTrans();
    const n = clampV(nivel + d, 0, niveles.length - 1);
    if (n === nivel) return;
    nivel = n;
    const s1 = niveles[n], q = acotar({ s: s1, ox: ax - (ax - ox) * s1 / s, oy: ay - (ay - oy) * s1 / s });
    if (calma) { ponerEscala(s1); ox = q.ox; oy = q.oy; return; }
    trans = { s0: s, ox0: ox, oy0: oy, s1, ox1: q.ox, oy1: q.oy, t0: performance.now() };
  }
  function avanzarTrans(now) {
    if (!trans) return;
    const t = Math.min(1, (now - trans.t0) / 130), e = t * (2 - t);
    if (t >= 1) { acabarTrans(); return; }
    ponerEscala(trans.s0 + (trans.s1 - trans.s0) * e);
    ox = trans.ox0 + (trans.ox1 - trans.ox0) * e; oy = trans.oy0 + (trans.oy1 - trans.oy0) * e;
  }
  const enMundo = c => c.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
  const enPantalla = c => c.setTransform(dpr, 0, 0, dpr, 0, 0);
  addEventListener('resize', medir);
  // ¿Se ve este punto de pantalla (ya transformado por X/Y)?
  const enVista = (x, y, m = 30) => { const a = ox + x, b = oy + y; return a > -m && a < cw + m && b > -m && b < ch + m; };

  const X = x => x * sx, Y = y => y * sy;
  function mundo(e) {
    return { x: clampV((e.clientX - ox) / s, 0, st.W), y: clampV((e.clientY - oy) / s, 0, st.H) };
  }
  const circulo = (p, x, y, r) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); };
  const rombo = (p, x, y, r) => { p.moveTo(x, y - r); p.lineTo(x + r, y); p.lineTo(x, y + r); p.lineTo(x - r, y); p.closePath(); };
  const trazosClase = () => COL.map(() => new Path2D());
  const triangulo = (p, x, y, r) => { p.moveTo(x, y - r); p.lineTo(x + r * .92, y + r * .72); p.lineTo(x - r * .92, y + r * .72); p.closePath(); };

  /* ---------- Dibujo ---------- */
  function linea(c, p, r, h) {
    const q = new Path2D();
    A.muestrear(p, r.c, r.m, (x, y, rad) => { if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) circulo(q, X(x), Y(y), rad * fp); });
    c.fillStyle = r.col; c.fill(q);
  }
  // El terreno se hornea en un lienzo algo mayor que la vista: desplazarse solo copia una imagen.
  function hornear() {
    const T = st.ter, n = T.cols * T.rows, mx = cw / s * .35, my = ch / s * .35;
    const i0 = Math.max(0, Math.floor((-ox / s - mx) / T.size)), j0 = Math.max(0, Math.floor((-oy / s - my) / T.size));
    const i1 = Math.min(T.cols, Math.ceil(((cw - ox) / s + mx) / T.size)), j1 = Math.min(T.rows, Math.ceil(((ch - oy) / s + my) / T.size));
    const h = { s, i0, j0, i1, j1, x0: i0 * T.size, y0: j0 * T.size, x1: i1 * T.size, y1: j1 * T.size, cod: horno && horno.cod.length === n ? horno.cod : new Int8Array(n) };
    h.w = (h.x1 - h.x0) * s; h.h = (h.y1 - h.y0) * s;
    h.cod.fill(-1);
    const wp = Math.ceil(h.w * dpr), hp = Math.ceil(h.h * dpr);
    for (const c of [capa, capaEst]) if (c.width !== wp || c.height !== hp) { c.width = wp; c.height = hp; }
    cc.setTransform(1, 0, 0, 1, 0, 0); cc.clearRect(0, 0, wp, hp);
    ce.setTransform(1, 0, 0, 1, 0, 0); ce.clearRect(0, 0, wp, hp);
    ce.setTransform(dpr, 0, 0, dpr, -h.x0 * s * dpr, -h.y0 * s * dpr);
    for (const p of st.mapa.costas) linea(ce, p, RITMO.costa, h);
    for (const t of ['rio', 'camino', 'frontera']) for (const l of st.mapa.lineas) if (l.t === t) linea(ce, l.p, RITMO[t], h);
    horno = h;
    actualizarCeldas();
  }
  // Solo se repinta la celda cuyo dueño conocido o visibilidad cambió.
  function actualizarCeldas() {
    const T = st.ter, fin = !!st.fin, vis = st.vis[0], mem = st.mem[0], areas = st.mapa.areas, h = horno, bs = h.s * dpr, lado = T.size * bs;
    const lejos = h.s < 1.1, cubos = new Map(), rp = 1.2 * fp;
    cc.setTransform(1, 0, 0, 1, 0, 0);
    for (let j = h.j0; j < h.j1; j++) for (let i = h.i0; i < h.i1; i++) {
      const k = i + j * T.cols, t = areas[k];
      if (t === A.AGUA) continue;
      const d = fin ? S.dueno(st, k) : mem[k], on = fin || vis[k] ? 1 : 0, cod = (d + 1) * 2 + on;
      if (h.cod[k] === cod) continue;
      if (h.cod[k] !== -1) cc.clearRect(Math.floor((i - h.i0) * lado) - 1, Math.floor((j - h.j0) * lado) - 1, Math.ceil(lado) + 2, Math.ceil(lado) + 2);
      h.cod[k] = cod;
      const c = d + '|' + t + '|' + on;
      if (!cubos.has(c)) cubos.set(c, new Path2D());
      const q = cubos.get(c), ta = TALLA[t], cx = (i + .5) * T.size, cy = (j + .5) * T.size, r = (d === 0 ? rp * .85 : d > 0 ? rp : rp * 1.1) * ta;
      if (lejos) { q.rect(X(cx) - r, Y(cy) - r, r * 2, r * 2); continue; }
      for (const [dx, dy] of GLIFO[t]) circulo(q, X(cx + dx), Y(cy + dy), r);
    }
    cc.setTransform(dpr, 0, 0, dpr, -h.x0 * h.s * dpr, -h.y0 * h.s * dpr);
    cc.lineWidth = .85;
    for (const [c, q] of cubos) {
      const [d, t, on] = c.split('|').map(Number), tinta = d === 0 ? TENUE : GRIS;
      cc.globalAlpha = ALFA[t] * (on ? 1 : .42);
      if (d < 0) { cc.strokeStyle = tinta; cc.stroke(q); } else { cc.fillStyle = tinta; cc.fill(q); }
    }
    cc.globalAlpha = 1;
    capaT = st.t - st.t % 6;
  }
  function hornoCubre() {
    if (!horno) return false;
    if (trans) return true;
    if (horno.s !== s) return false;
    const T = st.ter, x0 = -ox / s, y0 = -oy / s, x1 = (cw - ox) / s, y1 = (ch - oy) / s;
    return (horno.x0 <= x0 || horno.i0 === 0) && (horno.y0 <= y0 || horno.j0 === 0) && (horno.x1 >= x1 || horno.i1 === T.cols) && (horno.y1 >= y1 || horno.j1 === T.rows);
  }
  function componer() {
    // Solo se copia la parte visible: el lienzo horneado es mayor que la pantalla.
    const k = s / horno.s, dx = ox + horno.x0 * s, dy = oy + horno.y0 * s, dw = horno.w * k, dh = horno.h * k;
    const x0 = Math.max(0, dx), y0 = Math.max(0, dy), x1 = Math.min(cw, dx + dw), y1 = Math.min(ch, dy + dh);
    if (x1 <= x0 || y1 <= y0) return;
    const fx0 = capa.width / dw, fy0 = capa.height / dh, u = (x0 - dx) * fx0, v = (y0 - dy) * fy0, uw = (x1 - x0) * fx0, vh = (y1 - y0) * fy0;
    ctx.drawImage(capa, u, v, uw, vh, x0, y0, x1 - x0, y1 - y0);
    ctx.drawImage(capaEst, u, v, uw, vh, x0, y0, x1 - x0, y1 - y0);
  }
  function dibujarObjetivos(v) {
    const fin = !!st.fin, sano = new Path2D(), roto = new Path2D();
    for (const p of puentesUI) {
      const x = X(p.x), y = Y(p.y);
      if (!enVista(x, y)) continue;
      if (p.celdas.some(k => (fin ? st.roto[k] : st.memRoto[0][k]))) { roto.moveTo(x - 3.6, y - 3.6); roto.lineTo(x + 3.6, y + 3.6); roto.moveTo(x + 3.6, y - 3.6); roto.lineTo(x - 3.6, y + 3.6); }
      else circulo(sano, x, y, 3.6 * fp);
    }
    ctx.strokeStyle = HUESO; ctx.lineWidth = 1; ctx.stroke(sano); ctx.lineWidth = 1.3; ctx.stroke(roto);
    // Áreas de control.
    ctx.setLineDash([2, 6]); ctx.lineWidth = 1;
    for (const z of v.zonas) {
      if (!enVista(X(z.x), Y(z.y), z.r * s + 8)) continue;
      ctx.strokeStyle = HUESO; ctx.globalAlpha = z.prio === 1 ? .55 : z.prio === 2 ? .38 : .24;
      ctx.beginPath(); ctx.arc(X(z.x), Y(z.y), z.r * s, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // Instalaciones: triángulos.
    for (const d of v.defensas.concat(v.defensasE)) {
      const x = X(d.x), y = Y(d.y), propia = d.s === 0, obra = propia ? st.t < d.listo : d.enObra;
      if (!enVista(x, y)) continue;
      const q = new Path2D(), r = (d.t === S.PISTA ? 8 : 6) * fp;
      triangulo(q, x, y, r);
      ctx.globalAlpha = obra || d.off ? .45 : 1;
      if (propia) { ctx.fillStyle = COL_DEF[d.t]; ctx.fill(q); }
      else { ctx.strokeStyle = COL_DEF[d.t]; ctx.lineWidth = 1.2; ctx.stroke(q); }
      ctx.globalAlpha = 1;
      if (propia && obra) {
        const total = TIPOS_DEF()[d.t].obra / S.DT, p = clampV(1 - (d.listo - st.t) / total, 0, 1);
        ctx.strokeStyle = HUESO; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.04, p)); ctx.stroke();
      }
    }
    // Ciudades: el cuadro es la ciudad, los cuadritos alrededor son sus barrios.
    const conNombre = s >= niveles[2] * .95;
    ctx.font = `10px ${MONO}`; ctx.textAlign = 'center';
    for (const c of v.ciudades) {
      const x = X(c.x), y = Y(c.y);
      if (!enVista(x, y, 60)) continue;
      const L = (c.capital ? 18 : Math.min(15, 8 + Math.sqrt(c.n) * 2)) * fp, x0 = x - L / 2, y0 = y - L / 2;
      ctx.lineWidth = 1.5;
      if (c.dueno > 0) { ctx.fillStyle = HUESO; ctx.fillRect(x0, y0, L, L); }
      else { ctx.strokeStyle = c.dueno < 0 ? HUESO : TENUE; ctx.strokeRect(x0, y0, L, L); }
      if (c.capital) { ctx.strokeStyle = c.dueno > 0 ? HUESO : c.dueno < 0 ? HUESO : TENUE; ctx.lineWidth = 1; ctx.strokeRect(x0 - 4, y0 - 4, L + 8, L + 8); }
      if (c.barrios && s >= niveles[1] * .95) {
        const b = 3.4 * fp;
        for (const q of c.barrios) {
          const bx = x + (q.x - c.x) * s, by = y + (q.y - c.y) * s;
          if (q.dueno > 0) { ctx.fillStyle = HUESO; ctx.fillRect(bx - b / 2, by - b / 2, b, b); }
          else { ctx.strokeStyle = q.dueno < 0 ? HUESO : TENUE; ctx.lineWidth = 1; ctx.strokeRect(bx - b / 2, by - b / 2, b, b); }
        }
      }
      if (c.batalla) {
        const R = (34 + (calma ? 0 : 3 * Math.sin(performance.now() / 260))) * fp;
        ctx.strokeStyle = COL[S.MISIL]; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
      }
      if (c.batalla) {
        // Balanza: la parte llena es tu fuerza en la batalla; la marca central, el empate.
        const P = c.batalla.P, tot = P[0] + P[1], w = 46 * fp, bx = x - w / 2, by = y - 46 * fp;
        if (tot > 0) {
          ctx.fillStyle = NEGRO; ctx.fillRect(bx, by, w, 4);
          ctx.fillStyle = HUESO; ctx.fillRect(bx, by, w * P[0] / tot, 4);
          ctx.strokeStyle = HUESO; ctx.lineWidth = 1; ctx.strokeRect(bx, by, w, 4);
          ctx.strokeStyle = COL[S.MISIL]; ctx.beginPath(); ctx.moveTo(x, by - 2.5); ctx.lineTo(x, by + 6.5); ctx.stroke();
        }
      }
      if (c.cerco > 0 && c.dueno > 0) {
        ctx.strokeStyle = COL[S.MISIL]; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(x, y, 25 * fp, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = COL[S.MISIL]; ctx.fillText('cercada ' + reloj(S.DATOS.cerco.ciudad - c.cerco), x, y + (conNombre ? 48 : 36) * fp);
      }
      if (st.doctrina[0].objetivos.includes(c.id) && c.dueno <= 0) { const R = L / 2 + 9; ctx.strokeStyle = COL[S.MISIL]; ctx.lineWidth = 1.3; ctx.beginPath(); for (const [a1, b1] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(x + a1 * (R - 5), y + b1 * R); ctx.lineTo(x + a1 * R, y + b1 * R); ctx.lineTo(x + a1 * R, y + b1 * (R - 5)); } ctx.stroke(); }
      if (c.ocupada && c.dueno > 0) { ctx.strokeStyle = COL[S.DRON]; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.strokeRect(x0 - 3, y0 - 3, L + 6, L + 6); ctx.setLineDash([]); }
      if (conNombre) { ctx.fillStyle = GRIS; ctx.fillText(c.nombre, x, y + 36 * fp); }
    }
    ctx.textAlign = 'left';
  }
  // Las capitales no tienen ranuras: su fuerza está en hangares y tropas.
  function dibujarUnidades(v, a) {
    const todos = v.propias.concat(v.contactos);
    generacion++;
    for (const u of todos) {
      if (!u.aire || u.gris) continue;
      const x = u.px + (u.x - u.px) * a, y = u.py + (u.y - u.py) * a;
      let tr = trazos.get(u.id);
      if (!tr) { tr = { p: [], g: 0 }; trazos.set(u.id, tr); }
      tr.g = generacion;
      const ul = tr.p[tr.p.length - 1];
      if (!ul || Math.hypot(ul.x - x, ul.y - y) >= 8 / s) { tr.p.push({ x, y }); if (tr.p.length > 14) tr.p.shift(); }
      if (u.st !== S.REGRESO && enVista(X(x), Y(y), 90)) {
        ctx.fillStyle = COL[u.c];
        tr.p.forEach((p, i) => { ctx.globalAlpha = (i + 1) / tr.p.length * .4; ctx.fillRect(X(p.x) - .7, Y(p.y) - .7, 1.4, 1.4); });
        ctx.globalAlpha = 1;
      }
    }
    for (const [k, tr] of trazos) if (tr.g !== generacion) trazos.delete(k);
    const pro = trazosClase(), ene = trazosClase(), grises = new Path2D(), centros = new Path2D(), anillos = new Path2D(), camiones = new Path2D(), marchando = new Path2D();
    const rotas = trazosClase(), sinMun = new Path2D(), sinComb = new Path2D();
    const ut = tactil ? 1.4 : 1, det = s >= niveles[1] * .95, trincheras = new Path2D(), colas = new Path2D(), arcos = new Path2D(), arcosBajos = new Path2D(), aisladas = [], CL = S.DATOS.clases;
    for (const u of todos) {
      const x = X(u.px + (u.x - u.px) * a), y = Y(u.py + (u.y - u.py) * a);
      if (!enVista(x, y, 80)) continue;
      if (u.gris) { rombo(grises, x, y, 4.6); centros.rect(x - .8, y - .8, 1.6, 1.6); continue; }
      const f = (u.aire ? 3.2 : (u.c === S.INF ? 2.6 + u.fuerza * .22 : 4.4)) * ut;
      if (u.s === 0) {
        if (!u.aire && u.c === S.INF && (u.st === S.MARCHA || u.st === S.EMBARCANDO)) pro[u.c].rect(x - f, y - f * .8, f * 2, f * 1.6);
        else circulo(u.rota ? rotas[u.c] : pro[u.c], x, y, f);
        if (seleccion.has(u.id)) circulo(anillos, x, y, f + 6.5);
        if (!u.aire && u.c === S.INF && u.st === S.DESPLEGADA && u.camion) camiones.rect(x - 1.7, y + f + 4.6, 3.4, 2.2);
        if (!u.aire && (u.st === S.EMBARCANDO || u.st === S.DESEMBARCANDO)) circulo(marchando, x, y, f + 2.6);
        if (!u.aire && det && u.mun < S.DATOS.abastos.aviso) sinMun.rect(x + f + 1.5, y - f - 3.5, 2.4, 2.4);
        if (!u.aire && det && u.comb < S.DATOS.abastos.aviso) sinComb.rect(x - f - 3.9, y - f - 3.5, 2.4, 2.4);
        if (!u.aire && det && u.st === S.DESPLEGADA && u.fort >= .5) {
          // Atrincherada: cuatro esquinas alrededor.
          const h = f + 3.4, e = 2.4;
          // Dos esquinas a medio atrincherar, las cuatro cuando ya lo está.
          for (const [a1, b1] of (u.fort >= 1 ? [[-1, -1], [1, -1], [1, 1], [-1, 1]] : [[-1, -1], [1, 1]])) { trincheras.moveTo(x + a1 * (h - e), y + b1 * h); trincheras.lineTo(x + a1 * h, y + b1 * h); trincheras.lineTo(x + a1 * h, y + b1 * (h - e)); }
        }
        if (!u.aire && u.sinSum > 0) aisladas.push([x, y, f, u.sinSum]);
      } else rombo(ene[u.c], x, y, (u.aire ? 4.6 : 5) * ut);
      if (!u.aire && det) {
        if (u.st === S.MARCHA) {
          // En marcha: una cola opuesta al avance.
          let dx = u.x - u.px, dy = u.y - u.py; if (Math.hypot(dx, dy) < .01) { dx = u.tx - u.x; dy = u.ty - u.y; }
          const n = Math.hypot(dx, dy);
          if (n > .01) { dx /= n; dy /= n; colas.moveTo(x - dx * (f + 1.5), y - dy * (f + 1.5)); colas.lineTo(x - dx * (f + 10), y - dy * (f + 10)); }
        }
        const fr = u.fuerza / CL[u.c].fuerza;
        if (fr < .95) { const q = fr < .4 ? arcosBajos : arcos, r = (u.s === 0 ? f : 5 * ut) + 1.9; q.moveTo(x, y - r); q.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.05, fr)); }
      }
    }
    ctx.lineWidth = 1.2;
    for (let c = 0; c < COL.length; c++) { ctx.fillStyle = COL[c]; ctx.fill(pro[c]); ctx.strokeStyle = COL[c]; ctx.stroke(ene[c]); ctx.stroke(rotas[c]); }
    ctx.fillStyle = COL[S.MISIL]; ctx.fill(sinMun); ctx.fillStyle = COL[S.DRON]; ctx.fill(sinComb);
    ctx.strokeStyle = CONTACTO; ctx.stroke(grises); ctx.fillStyle = CONTACTO; ctx.fill(centros);
    ctx.fillStyle = COL[S.BLI]; ctx.fill(camiones);
    ctx.globalAlpha = calma ? 1 : .35 + .65 * Math.abs(Math.sin(performance.now() / 320));
    ctx.strokeStyle = HUESO; ctx.lineWidth = .9; ctx.setLineDash([1.5, 2.5]); ctx.stroke(marchando); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = GRIS; ctx.lineWidth = 1; ctx.stroke(trincheras);
    ctx.lineWidth = 1.4; ctx.stroke(colas);
    ctx.strokeStyle = HUESO; ctx.lineWidth = 1.3; ctx.stroke(arcos); ctx.strokeStyle = COL[S.MISIL]; ctx.stroke(arcosBajos);
    if (aisladas.length) {
      ctx.strokeStyle = COL[S.MISIL]; ctx.fillStyle = COL[S.MISIL]; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]); ctx.font = `9px ${MONO}`; ctx.textAlign = 'center';
      for (const [x, y, f, n] of aisladas) { ctx.beginPath(); ctx.arc(x, y, f + 9, 0, TAU); ctx.stroke(); ctx.fillText(reloj(S.DATOS.cerco.unidad - n), x, y - f - 12); }
      ctx.setLineDash([]); ctx.textAlign = 'left';
    }
    ctx.strokeStyle = HUESO; ctx.lineWidth = .9; ctx.stroke(anillos);
  }
  function dibujarFotos(v) {
    const vivos = new Set(v.contactos.map(u => u.id));
    ctx.lineWidth = 1;
    for (const f of v.fotos) {
      if (vivos.has(f.id)) continue;
      const a = clampV((f.vence - st.t) / (f.vence - f.t), 0, 1);
      const p = new Path2D(), x = X(f.x), y = Y(f.y);
      if (!enVista(x, y)) continue;
      rombo(p, x, y, 4);
      ctx.globalAlpha = .12 + a * .55;
      ctx.strokeStyle = f.c >= 0 ? COL[f.c] : CONTACTO; ctx.stroke(p);
      if (f.c < 0) { ctx.fillStyle = CONTACTO; ctx.fillRect(x - .7, y - .7, 1.4, 1.4); }
    }
    ctx.globalAlpha = 1;
  }
  function dibujarSatelites() {
    const L = st.W + st.H, activos = S.satelites(st, 0).filter(q => q.activo), vida = S.DATOS.alerta.vida;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, st.W * s, st.H * s); ctx.clip();
    ctx.strokeStyle = HUESO; ctx.lineWidth = .8; ctx.setLineDash([1, 7]);
    for (const q of activos) {
      const px = -q.uy, py = q.ux;
      ctx.globalAlpha = .5;
      for (const d of [-q.ancho / 2, q.ancho / 2]) {
        const cx = q.ux * (q.c + d), cy = q.uy * (q.c + d);
        ctx.beginPath(); ctx.moveTo(X(cx - px * L), Y(cy - py * L)); ctx.lineTo(X(cx + px * L), Y(cy + py * L)); ctx.stroke();
      }
    }
    ctx.setLineDash([2, 5]);
    for (const a of st.alertas[0]) {
      const t = (st.t - a.t) * S.DT / vida;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = COL[S.MISIL]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(a.x + a.ux * 280), Y(a.y + a.uy * 280)); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineWidth = 1.4;
    for (const a of st.alertas[0]) {
      const t = (st.t - a.t) * S.DT / vida, x = X(a.x), y = Y(a.y);
      if (!enVista(x, y)) continue;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
    }
    ctx.restore();
    for (const q of activos) {
      const tp = -q.uy * (cw / 2 - ox) / s + q.ux * (ch / 2 - oy) / s;
      etiqueta(X(q.ux * q.c - q.uy * tp), Y(q.uy * q.c + q.ux * tp), `satélite ${q.nombre}`);
    }
  }

  // Órdenes en alistamiento: reloj en la ranura, línea hasta el destino y segundos que faltan.
  const faltan = q => Math.max(1, Math.ceil((q.listo - st.t) * S.DT));
  function anotar(e) {
    if (e.k === 'tiro') { Sonido.sonar('tiro'); return; }
    if (e.k === 'golpe') { Sonido.sonar('impacto'); return; }
    if (e.k === 'puente') { registrar('puente destruido', true, e); faro(e.x, e.y, 'puente'); Sonido.sonar('impacto'); return; }
    if (e.k === 'defensa') { if (e.s === 0) { registrar(`${TIPOS_DEF()[e.d].nombre} destruida`, true, e); faro(e.x, e.y, 'base'); } Sonido.sonar('impacto'); return; }
    if (e.k === 'baja') { if (e.s === 0) { acu.pro[e.c]++; acu.lugar = { x: e.x, y: e.y }; } else acu.ene[e.c]++; }
  }
  // Noticias que llegan aunque el lugar no esté a la vista.
  function noticia(e) {
    const nom = id => st.urbes[id].nombre;
    const K = S.DATOS.cerco, min = n => Math.round(n / 60);
    if (e.k === 'ciudad') {
      if (e.nuevo > 0) { registrar(`Tomaste ${nom(e.id)}`, true, e); faro(e.x, e.y, 'ciudad'); Sonido.sonar('ping'); frenar(`tomaste ${nom(e.id)}`); }
      else if (e.antes > 0) { registrar(`Cayó ${nom(e.id)}`, true, e); faro(e.x, e.y, 'ciudad'); Sonido.sonar('alarma'); frenar(`cayó ${nom(e.id)}`); }
    } else if (e.k === 'batalla') {
      const u = st.urbes[e.id];
      if (u.dueno > 0 || e.a === 0) { registrar(`Batalla por ${nom(e.id)}`, true, e); faro(e.x, e.y, 'combate'); frenar(`batalla por ${nom(e.id)}`); }
    } else if (e.k === 'revuelta' && e.s === 0) { registrar(`Revuelta en ${nom(e.id)}`, true, e); faro(e.x, e.y, 'base'); Sonido.sonar('alarma'); frenar(`revuelta en ${nom(e.id)}`); consejo('revuelta', 'Una ciudad ocupada sin guarnición acumula resistencia y se subleva. Selecciona una compañía, haz clic en la ciudad y elige «Guarnecer».'); }
    else if (e.k === 'cercada') {
      if (e.s === 0) { registrar(`${nom(e.id)} cercada: capitula en ${min(K.ciudad - K.aviso)} min si no llega suministro`, true, e); faro(e.x, e.y, 'base'); Sonido.sonar('alarma'); frenar(`${nom(e.id)} cercada`); consejo('cercada', 'Una ciudad cortada de tu capital y tus depósitos capitula a los seis minutos. Recupera el territorio que la une a los tuyos o construye un depósito junto a ella.'); }
      else registrar(`${nom(e.id)} quedó cercada`, false, e);
    } else if (e.k === 'capitula') registrar(e.s === 0 ? `${nom(e.id)} capituló por cerco` : `${nom(e.id)} capituló`, true, e);
    else if (e.k === 'moral') {
      const p = Math.round((1 - e.nivel) * 100);
      if (e.s === 0) { registrar(`La moral del país baja a ${p} %: si llega a cero, colapsas`, true); Sonido.sonar('alarma'); frenar(`moral en ${p} %`); }
      else registrar(`La moral enemiga baja a ${p} %`, false);
    }
    else if (e.k === 'quiebre' && e.s === 0) { registrar(`${S.NOMBRES[e.c]} quebrada: se retira a rehacerse`, false, e); consejo('quiebre', 'Una unidad muy castigada se quiebra: deja de pelear y se retira sola a una ciudad tuya, donde se rehace con suministro y calma. Retira la tropa antes de que llegue a ese punto y durará más.'); }
    else if (e.k === 'repliegue' && e.s === 0) registrar(`${S.NOMBRES[e.c]} se repliega por doctrina`, false, e);
    else if (e.k === 'doctrina' && e.s === 0) { registrar('La nueva doctrina ya rige', false); pintarMando(); }
    else if (e.k === 'repuesta' && e.s === 0) registrar(`${S.NOMBRES[e.c]} rehecha, vuelve al servicio`, false, e);
    else if (e.k === 'sinCombustible' && e.s === 0) { registrar(`${S.NOMBRES[e.c]} sin combustible: detenida`, true, e); faro(e.x, e.y, 'combate'); consejo('combustible', 'Marchar gasta combustible y solo se repone dentro de tu red de suministro. Una columna que se queda seca fuera de ella no se mueve hasta que la red la alcance: avanza por etapas o construye un depósito.'); }
    else if (e.k === 'escasez' && e.s === 0) registrar(`${S.NOMBRES[e.c]} con poca ${e.mun ? 'munición' : 'reserva de combustible'}`, false, e);
    else if (e.k === 'clima') { registrar('Tormenta: se ve menos y la aviación rinde la mitad', true); frenar('tormenta'); }
    else if (e.k === 'aislada' && e.s === 0) { registrar(`${S.NOMBRES[e.c]} aislada: se rinde en ${min(K.unidad - K.aviso)} min`, true, e); faro(e.x, e.y, 'combate'); frenar('compañía aislada'); consejo('aislada', 'Una compañía detenida lejos de tu línea de abastecimiento se rinde a los cinco minutos. Muévela de vuelta hacia tu territorio, o construye un depósito cerca.'); }
    else if (e.k === 'rendicion' && e.s === 0) { registrar(`Una compañía de ${S.NOMBRES[e.c]} se rindió, cercada`, true, e); frenar('una compañía se rindió'); }
    else if (e.k === 'pacificada' && e.s === 0) registrar(`${nom(e.id)} pacificada`, false, e);
    else if (e.k === 'sinAire' && e.s === 0) { registrar('Sin aire disponible para un área de control', true); frenar('sin aire para un área'); consejo('sinAire', 'Un área de control solo defiende si quedan aviones libres en una pista cercana. Compra cazas en la capital o construye otra pista.'); }
    else if (e.k === 'lista' && e.s === 0) registrar(`${S.NOMBRES[e.c]} lista`, false, e);
    else if (e.k === 'parte' && e.s === 0) {
      const T = S.DATOS.misiones[e.tipo], ds = [e.res.impactos ? `${e.res.impactos} impactos` : 'sin impactos', e.res.perdidas ? `${e.res.perdidas} ${e.res.perdidas === 1 ? 'pérdida' : 'pérdidas'}` : 'sin pérdidas'];
      frenar(`parte de la misión M${e.id}`);
      registrar(`Parte M${e.id} · ${T.nombre}: ${e.tipo === 'reconocimiento' || e.tipo === 'refuerzo' || e.tipo === 'asalto' ? (e.res.perdidas ? ds[1] : 'cumplida') : ds.join(', ')}`, !!e.res.perdidas, e);
    }
  }
  const NOTICIA = new Set(['ciudad', 'batalla', 'revuelta', 'pacificada', 'sinAire', 'lista', 'parte', 'cercada', 'capitula', 'aislada', 'rendicion', 'moral', 'quiebre', 'repuesta', 'sinCombustible', 'escasez', 'clima', 'repliegue', 'doctrina']);
  function dibujarEfectos() {
    const vis = st.vis[0], fin = !!st.fin;
    for (const e of st.ev) {
      if (NOTICIA.has(e.k)) { noticia(e); continue; }
      if (e.k === 'barrio') continue;
      if (fin || vis[S.celdaDe(st, e.x, e.y)]) { fx.push(e); if (!fin) anotar(e); }
    }
    st.ev.length = 0;
    if (fx.length > 500) fx.splice(0, fx.length - 500);
    const nuevos = [];
    for (const e of fx) {
      const t = (st.t - e.t) * S.DT;
      if (t > 1) continue;
      if (!enVista(X(e.x), Y(e.y), 60)) { nuevos.push(e); continue; }
      if (e.k === 'puente' || e.k === 'defensa') {
        if (t > .8) continue;
        ctx.strokeStyle = HUESO; ctx.globalAlpha = 1 - t / .8; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), 4 + (calma ? 8 : t * 26), 0, TAU); ctx.stroke();
      } else if (e.k === 'tiro') {
        if (t > .16) continue;
        ctx.strokeStyle = COL[e.c]; ctx.globalAlpha = .75 * (1 - t / .16); ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(X(e.x), Y(e.y)); ctx.lineTo(X(e.x2), Y(e.y2)); ctx.stroke();
      } else if (e.k === 'golpe') {
        if (t > .6) continue;
        ctx.fillStyle = HUESO; ctx.globalAlpha = 1 - t / .6;
        const n = calma ? 0 : 14;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + e.x, R = e.r * (.35 + 1.1 * t / .6); ctx.fillRect(X(e.x + Math.cos(a) * R) - .8, Y(e.y + Math.sin(a) * R) - .8, 1.6, 1.6); }
        if (calma) ctx.fillRect(X(e.x) - 2, Y(e.y) - 2, 4, 4);
      } else {
        if (t > .5) continue;
        ctx.strokeStyle = COL[e.c] || HUESO; ctx.globalAlpha = 1 - t / .5; ctx.lineWidth = .9;
        ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), 2.5 + (calma ? 0 : t * 16), 0, TAU); ctx.stroke();
      }
      nuevos.push(e);
    }
    fx = nuevos;
    ctx.globalAlpha = 1;
  }
  function etiqueta(x, y, t) {
    enPantalla(ctx);
    ctx.font = `11px ${MONO}`;
    const sxp = ox + x, syp = oy + y;
    if (sxp < -10 || sxp > cw + 10 || syp < -10 || syp > ch + 10) { enMundo(ctx); return; }
    const m = ctx.measureText(t).width, px = Math.min(sxp + 12, cw - m - 6), py = Math.max(syp - 10, 12);
    ctx.fillStyle = NEGRO; ctx.globalAlpha = .75; ctx.fillRect(px - 3, py - 10, m + 6, 14); ctx.globalAlpha = 1;
    ctx.fillStyle = HUESO; ctx.fillText(t, px, py);
    enMundo(ctx);
  }
  function dibujarCursor() {
    if (st.fin || !$('parte').hidden) return;
    if (marca) {
      const t = (performance.now() - marca.ms) / 350;
      if (t >= 1) marca = null;
      else { ctx.strokeStyle = HUESO; ctx.lineWidth = 1; ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(X(marca.x), Y(marca.y), 4 + (calma ? 6 : t * 16), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    if (menuAb || plan) {
      const q = menuAb ? menuAb.p : plan.p, x = X(q.x), y = Y(q.y);
      ctx.strokeStyle = HUESO; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
      return;
    }
    if (gesto && gesto.modo === 'caja') {
      const a = gesto.w0, b = gesto.w, x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      const n = propiasTierra().filter(u => u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1).length;
      ctx.strokeStyle = HUESO; ctx.lineWidth = 1; ctx.globalAlpha = .8; ctx.setLineDash([3, 4]);
      ctx.strokeRect(X(x0), Y(y0), X(x1) - X(x0), Y(y1) - Y(y0));
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      etiqueta(X(b.x), Y(b.y), `selección ${n}`);
      return;
    }
    const p = cursor;
    if (!p) return;
    const l = leerLugar(p);
    if (l.def && TIPOS_DEF()[l.def.t].rango) {
      const R = TIPOS_DEF()[l.def.t].rango * s;
      ctx.strokeStyle = COL_DEF[l.def.t]; ctx.globalAlpha = .4; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(X(l.def.x), Y(l.def.y), R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (l.especial) etiqueta(X(p.x), Y(p.y), l.presencia ? `${l.titulo} · ${l.presencia}` : l.titulo);
  }
  function faro(x, y, tipo, id) {
    const previo = faros.find(f => (id && f.id === id) || (!id && f.tipo === tipo && Math.hypot(f.x - x, f.y - y) < 50));
    const vence = st.t + 30 * 20;
    if (previo) { previo.x = x; previo.y = y; previo.vence = vence; previo.n = st.t; return; }
    faros.push({ x, y, tipo, id, vence, n: st.t });
    if (faros.length > 24) faros.shift();
  }
  function ultimoFaro() { let m = null; for (const f of faros) if (f.vence > st.t && (!m || f.n > m.n)) m = f; return m; }
  function dibujarFlechas() {
    flechas = [];
    const ins = 26, cx = cw / 2, cy = ch / 2, pulso = calma ? 1 : .65 + .35 * Math.sin(performance.now() / 180);
    ctx.lineWidth = 1.8;
    for (let k = faros.length - 1; k >= 0; k--) {
      const f = faros[k];
      if (f.vence <= st.t) continue;
      const px = ox + f.x * s, py = oy + f.y * s;
      if (px > 0 && px < cw && py > 0 && py < ch) continue;
      const dx = px - cx, dy = py - cy;
      const t = Math.min(dx ? ((dx > 0 ? cw - ins : ins) - cx) / dx : 1e9, dy ? ((dy > 0 ? ch - ins : ins + 34) - cy) / dy : 1e9);
      const x = cx + dx * t, y = cy + dy * t;
      if (flechas.some(q => Math.hypot(q.x - x, q.y - y) < 40)) continue;
      flechas.push({ x, y, f });
      const a = Math.atan2(dy, dx), c = Math.cos(a), n = Math.sin(a);
      ctx.strokeStyle = f.tipo === 'misil' ? COL[S.MISIL] : HUESO;
      ctx.globalAlpha = pulso;
      ctx.beginPath();
      ctx.moveTo(x - 9 * c - 7 * n, y - 9 * n + 7 * c); ctx.lineTo(x + 3 * c, y + 3 * n); ctx.lineTo(x - 9 * c + 7 * n, y - 9 * n - 7 * c);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    cv.classList.toggle('sobre-flecha', !!cursorP && flechas.some(q => Math.hypot(q.x - cursorP.x, q.y - cursorP.y) < 20));
  }

  /* ---------- Minimapa ---------- */
  const miniTerreno = document.createElement('canvas'), mtc = miniTerreno.getContext('2d');
  function pintarMini(v, now) {
    const cam = `${ox | 0},${oy | 0},${s.toFixed(3)}`;
    if (now - miniU < 150 && cam === miniCam) return;
    miniU = now; miniCam = cam;
    const mi = $('mini'), mc = mi.getContext('2d', { alpha: false }), T = st.ter, W = mi.clientWidth, H = mi.clientHeight, k = W / st.W;
    if (miniT < 0 || st.t - miniT >= 30) {
      miniT = st.t;
      if (miniTerreno.width !== T.cols) { miniTerreno.width = T.cols; miniTerreno.height = T.rows; }
      const im = mtc.createImageData(T.cols, T.rows), mem = st.mem[0], areas = st.mapa.areas;
      for (let n = 0; n < mem.length; n++) {
        const g = areas[n] === A.AGUA ? 0 : mem[n] > 0 ? 92 : mem[n] < 0 ? 46 : 26;
        im.data[n * 4] = g; im.data[n * 4 + 1] = g; im.data[n * 4 + 2] = g * .95; im.data[n * 4 + 3] = 255;
      }
      mtc.putImageData(im, 0, 0);
    }
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.imageSmoothingEnabled = false;
    mc.drawImage(miniTerreno, 0, 0, W, H);
    for (const c of v.ciudades) {
      const x = c.x * k - 2, y = c.y * k - 2;
      if (c.dueno > 0) { mc.fillStyle = HUESO; mc.fillRect(x, y, 4, 4); }
      else { mc.strokeStyle = c.dueno < 0 ? HUESO : GRIS; mc.lineWidth = 1; mc.strokeRect(x + .5, y + .5, 3, 3); }
    }
    for (const d of v.defensas) { mc.fillStyle = COL_DEF[d.t]; mc.fillRect(d.x * k - 1.5, d.y * k - 1.5, 3, 3); }
    for (const d of v.defensasE) { mc.strokeStyle = COL_DEF[d.t]; mc.lineWidth = 1; mc.strokeRect(Math.round(d.x * k) - 1.5, Math.round(d.y * k) - 1.5, 3, 3); }
    for (const u of v.propias) { mc.fillStyle = COL[u.c]; mc.fillRect(u.x * k - 1, u.y * k - 1, 2, 2); }
    mc.lineWidth = 1;
    for (const u of v.contactos) {
      mc.strokeStyle = u.gris ? CONTACTO : COL[u.c];
      mc.strokeRect(Math.round(u.x * k) - 1.5, Math.round(u.y * k) - 1.5, 3, 3);
    }
    for (const f of faros) if (f.vence > st.t) {
      mc.strokeStyle = f.tipo === 'misil' ? COL[S.MISIL] : HUESO;
      mc.beginPath(); mc.arc(f.x * k, f.y * k, 5, 0, TAU); mc.stroke();
    }
    mc.strokeStyle = HUESO; mc.lineWidth = 1;
    mc.strokeRect(Math.round(-ox / s * k) + .5, Math.round(-oy / s * k) + .5, Math.max(4, Math.round(cw / s * k) - 1), Math.max(4, Math.round(ch / s * k) - 1));
  }
  function miniA(e) {
    const r = $('mini').getBoundingClientRect();
    centrar(clampV((e.clientX - r.left) / r.width, 0, 1) * st.W, clampV((e.clientY - r.top) / r.height, 0, 1) * st.H);
  }
  (function prepararMini() {
    const mi = $('mini');
    let activo = false;
    mi.addEventListener('pointerdown', e => {
      if (st.fin || !$('parte').hidden) return;
      if (menuAb) cerrarMenu();
      activo = true; acabarTrans(); miniA(e);
      try { mi.setPointerCapture(e.pointerId); } catch (_) { /* puntero ya liberado */ }
    });
    mi.addEventListener('pointermove', e => { if (activo) miniA(e); });
    const fin = () => { activo = false; };
    mi.addEventListener('pointerup', fin); mi.addEventListener('pointercancel', fin);
  })();

  // Suministro: el borde interior es el abastecimiento pleno; el exterior, hasta dónde una tropa no queda cercada.
  let sumClave = -1, sumPleno = null, sumLinea = null, vias = null;
  function dibujarSuministro() {
    const clave = st.seed * 1e7 + (st.t - st.t % 150);
    if (clave !== sumClave) {
      sumClave = clave; sumPleno = new Path2D(); sumLinea = new Path2D(); vias = new Path2D();
      const camino = Math.fround(S.DATOS.relieve.camino[0]), V = st.velT[0], C = st.ter.ctrl;
      const M = st.sum[0], c = st.ter.cols, r = st.ter.rows, z = st.ter.size;
      for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
        const a = M[i + j * c];
        if (a === 1 && V[i + j * c] === camino && C[i + j * c] > 0) vias.rect((i + .5) * z - .9, (j + .5) * z - .9, 1.8, 1.8);   // vía logística activa
        if (i + 1 < c) { const b = M[i + 1 + j * c]; if ((a === 1) !== (b === 1)) { sumPleno.moveTo((i + 1) * z, j * z); sumPleno.lineTo((i + 1) * z, (j + 1) * z); } if ((a > 0) !== (b > 0)) { sumLinea.moveTo((i + 1) * z, j * z); sumLinea.lineTo((i + 1) * z, (j + 1) * z); } }
        if (j + 1 < r) { const b = M[i + (j + 1) * c]; if ((a === 1) !== (b === 1)) { sumPleno.moveTo(i * z, (j + 1) * z); sumPleno.lineTo((i + 1) * z, (j + 1) * z); } if ((a > 0) !== (b > 0)) { sumLinea.moveTo(i * z, (j + 1) * z); sumLinea.lineTo((i + 1) * z, (j + 1) * z); } }
      }
    }
    ctx.save(); ctx.setTransform(dpr * s, 0, 0, dpr * s, ox * dpr, oy * dpr);
    ctx.lineWidth = 1 / s; ctx.strokeStyle = COL[S.INF];
    ctx.globalAlpha = .34; ctx.setLineDash([2 / s, 4 / s]); ctx.stroke(sumPleno);
    ctx.globalAlpha = .2; ctx.setLineDash([1 / s, 7 / s]); ctx.stroke(sumLinea);
    ctx.globalAlpha = .8; ctx.fillStyle = HUESO; ctx.fill(vias);
    ctx.restore();
  }
  // Rutas de las misiones en curso: de cada pista o tropa a su objetivo.
  function dibujarRutas(v) {
    const linea = new Path2D(), rotulos = []; let hay = false;
    ctx.font = `9px ${MONO}`; ctx.fillStyle = GRIS;
    for (const m of v.misiones) {
      if (m.estado === 'fin') continue;
      const tx = X(m.x), ty = Y(m.y); let n = 0;
      for (const p of m.pend) { linea.moveTo(X(p.d.x), Y(p.d.y)); linea.lineTo(tx, ty); n++; }
      for (const u of v.propias) if (u.m === m.id && (u.aire ? u.st === S.IDA : u.st !== S.DESPLEGADA)) { linea.moveTo(X(u.x), Y(u.y)); linea.lineTo(tx, ty); n++; }
      if (n) { hay = true; const r = rotulos.find(q => Math.hypot(q.x - tx, q.y - ty) < 24); if (r) { if (++r.n <= 3) r.t += ' M' + m.id; else r.mas = r.n - 3; } else rotulos.push({ x: tx, y: ty, t: 'M' + m.id, n: 1, mas: 0 }); }
    }
    for (const r of rotulos) if (enVista(r.x, r.y)) ctx.fillText(r.t + (r.mas ? ` +${r.mas}` : ''), r.x + 42 * fp, r.y + 3);
    if (!hay) return;
    ctx.strokeStyle = HUESO; ctx.globalAlpha = .32; ctx.lineWidth = 1; ctx.setLineDash([1, 5]); ctx.stroke(linea); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // Barra de escala: una celda del mapa es 1 km.
  function dibujarEscala() {
    if (!iniciada || st.fin) return;
    const km = [5, 10, 20, 50, 100].find(k => k * 16 * s >= 70) || 100, w = km * 16 * s, x = cw / 2 - w / 2, y = ch - 14;
    ctx.strokeStyle = GRIS; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - 4); ctx.stroke();
    ctx.fillStyle = GRIS; ctx.font = `10px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText(`${km} km`, cw / 2, y - 5); ctx.textAlign = 'left';
  }
  function dibujar(a, now) {
    enPantalla(ctx);
    ctx.fillStyle = NEGRO; ctx.fillRect(0, 0, cw, ch);
    if (!hornoCubre()) hornear();
    else if (capaT !== st.t - st.t % 6) actualizarCeldas();
    componer();
    enMundo(ctx);
    const v = S.vista(st, 0);
    dibujarSuministro();
    dibujarRutas(v);
    dibujarObjetivos(v);
    dibujarFotos(v);
    dibujarUnidades(v, a);
    dibujarEfectos();
    dibujarSatelites();
    dibujarCursor();
    enPantalla(ctx);
    dibujarEscala();
    dibujarAncla();
    dibujarFlechas();
    pintarMini(v, now);
  }

  /* ---------- Entrada ---------- */
  /* ---------- Menú de acciones ---------- */
  const reloj = seg => { const t = Math.max(0, Math.ceil(seg)); return t >= 3600 ? `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  function leerLugar(p) {
    const v = S.vista(st, 0), k = S.celdaDe(st, p.x, p.y), d = v.celdas[k];
    const cerca = (lista, r) => { let m = null, md = r; for (const o of lista) { const h = Math.hypot(o.x - p.x, o.y - p.y); if (h <= md) { md = h; m = o; } } return m; };
    const lejos = clampV(1.6 / s, 1, 7) * (tactil ? 1.5 : 1), agua = !S.transitable(st, k);
    const def = cerca(v.defensas.concat(v.defensasE), 13 * lejos), urbe = cerca(v.ciudades, 42 * lejos), cont = cerca(v.contactos, 18 * lejos), propia = cerca(v.propias.filter(u => !u.aire), 14 * lejos);
    const zona = v.zonas.filter(z => Math.hypot(z.x - p.x, z.y - p.y) <= z.r).sort((a, b) => a.r - b.r)[0] || null;
    const baseP = Math.hypot(p.x - st.bases[0].x, p.y - st.bases[0].y) <= 192;
    const propio = d === 1, enemigo = d === -1;
    const titulo = def ? `${TIPOS_DEF()[def.t].nombre} ${def.s === 0 ? 'propia' : 'enemiga'}` : urbe ? `${urbe.capital ? 'Capital ' : ''}${urbe.nombre}` : cont ? (cont.gris ? 'Contacto sin identificar' : `${S.NOMBRES[cont.c]} enemigo`) : agua ? 'Agua' : propio ? 'Territorio propio' : enemigo ? 'Territorio enemigo' : 'Territorio en disputa';
    let presencia = '';
    if (urbe) {
      const propios = urbe.barrios ? urbe.barrios.filter(b => b.dueno > 0).length : null, n = urbe.barrios ? urbe.barrios.length : 0;
      presencia = urbe.guar == null ? 'sin información' : [urbe.barrios ? `barrios ${propios}/${n}` : null, `guarnición ${Math.round(urbe.guar)}`, urbe.dano > .02 ? `daño ${Math.round(urbe.dano * 100)} %` : null, urbe.batalla ? 'en batalla' : null, urbe.ocupada && urbe.dueno > 0 ? `ocupada · resistencia ${Math.round(urbe.res * 100)} %` : null, urbe.edad > 900 ? `hace ${Math.round(urbe.edad * S.DT / 60)} min` : null].filter(Boolean).join(' · ');
    } else if (def && def.s === 0 && def.t === S.PISTA) presencia = `${def.hangar.length} aparatos en hangar`;
    else if (propia) presencia = `${S.NOMBRES[propia.c]} · fuerza ${Math.round(propia.fuerza)}/${S.DATOS.clases[propia.c].fuerza}${propia.rota ? ' · quebrada, se rehace' : propia.fort >= 1 ? ' · atrincherada' : ''} · munición ${Math.round(propia.mun * 100)} % · combustible ${Math.round(propia.comb * 100)} %${propia.c === S.INF && !propia.camion ? ' · sin camión' : ''}`;
    return { p, v, def, urbe, cont, propia, zona, agua, baseP, propio, enemigo, titulo, presencia, especial: !!(def || urbe || cont || propia) };
  }
  const TIPOS_DEF = () => S.DATOS.instalaciones.tipos;
  function misionesAqui(l) {
    if (l.urbe && l.urbe.dueno > 0) return ['refuerzo', 'interdiccion', 'reconocimiento'];
    if (l.urbe) return ['asalto', 'bombardeo', 'golpe', 'supresion', 'reconocimiento', 'interdiccion'];
    if (l.def && l.def.s !== 0) return ['golpe', 'supresion', 'reconocimiento'];
    if (l.cont) return ['golpe', 'interdiccion', 'reconocimiento'];
    return l.propio ? ['interdiccion', 'reconocimiento'] : ['golpe', 'interdiccion', 'reconocimiento'];
  }
  function filasDelMenu() {
    const { l } = menuAb, p = l.p, f = [];
    if (st.despliegue) {
      // Antes de la guerra solo se coloca la reserva, y solo en territorio propio.
      const us = propiasTierra().filter(u => seleccion.has(u.id));
      // El defensor fortifica antes de la guerra: obras al instante, pagadas con su presupuesto inicial.
      if (!us.length && st.obras[0] > 0 && !l.agua && (l.propio || l.baseP)) TIPOS_DEF().forEach((ti, d) => { const motivo = S.puedeConstruir(st, 0, d, p.x, p.y); f.push({ sec: `Fortificar · obras ${Math.floor(st.obras[0])}`, id: 'construir', dd: d, n: ti.nombre, col: VAR_DEF[d], tri: true, b: ti.costo, em: motivo || 'al instante', ok: !motivo, run: () => { if (S.ordenar(st, { t: 'construir', d, x: p.x, y: p.y })) { capaT = -1; pintarDespliegue(); } else aviso('ahí no se puede'); } }); });
      if (f.length) return f;
      f.push({ sec: 'Despliegue', id: 'colocar', n: us.length ? 'Colocar aquí' : 'Selecciona compañías primero', col: '--hueso', b: us.length || '', ok: us.length > 0 && l.propio && !l.agua, motivo: !us.length ? '' : l.propio ? '' : 'solo en tu territorio',
        run: () => { if (S.ordenar(st, { t: 'colocar', ids: us.map(u => u.id), x: p.x, y: p.y })) { marca = { x: p.x, y: p.y, ms: performance.now() }; limpiarSeleccion(); pintarDespliegue(); } else aviso('ahí no se puede'); } });
      return f;
    }
    if (seleccion.size && !menuAb.todo) {
      const us = propiasTierra().filter(u => seleccion.has(u.id)), m = us.filter(puedeMoverse);
      f.push({ sec: 'Tropas seleccionadas', id: 'mover', n: 'Mover aquí', col: '--hueso', b: m.length, ok: m.length > 0, motivo: m.length ? '' : 'sin camión', run: () => ordenarSeleccion(p) });
      if (l.urbe && l.urbe.dueno <= 0) f.push({ sec: 'Tropas seleccionadas', id: 'asaltar', n: 'Asaltar la ciudad', col: '--misil', b: m.length, ok: m.length > 0, run: () => ordenarSeleccion(p, 'asalto') });
      if (l.urbe && l.urbe.dueno > 0) f.push({ sec: 'Tropas seleccionadas', id: 'guarnecer', n: 'Guarnecer', col: '--personal', b: m.length, ok: m.length > 0, run: () => ordenarSeleccion(p, 'refuerzo') });
      return f;
    }
    if (l.urbe && l.urbe.dueno <= 0) { const m = st.doctrina[0].objetivos.includes(l.urbe.id); f.push({ sec: 'Estado mayor', id: 'objetivo', n: m ? 'Quitar de los objetivos' : 'Marcar como objetivo', col: '--misil', ok: true, run: () => { S.ordenar(st, { t: 'objetivo', id: l.urbe.id, on: !m }); aviso(m ? 'objetivo retirado' : st.doctrina[0].nivel === 'alta' || st.doctrina[0].nivel === 'total' ? 'objetivo marcado: el estado mayor prepara el asalto' : 'objetivo marcado (lo ejecuta el estado mayor en nivel alta)', 2600); pintarMando(); } }); }
    for (const tipo of misionesAqui(l)) f.push({ sec: 'Misión', id: 'mision-' + tipo, n: S.DATOS.misiones[tipo].nombre, col: '--hueso', ok: true, run: () => abrirPlan(tipo, p, l.urbe ? l.urbe.nombre : l.titulo) });
    if (l.zona) {
      const z = l.zona, sig = z.prio % 3 + 1;
      f.push({ sec: 'Área de control', id: 'zona-prio', n: `Prioridad ${z.prio} → ${sig}`, col: '--hueso', ok: true, run: () => S.ordenar(st, { t: 'prioridadZona', id: z.id, prio: sig }) });
      f.push({ sec: 'Área de control', id: 'zona-quitar', n: 'Quitar esta área', col: '--gris', ok: true, run: () => S.ordenar(st, { t: 'quitarZona', id: z.id }) });
    }
    ['chica', 'media', 'grande'].forEach((n, r) => f.push({ sec: 'Designar área de control', id: 'zona-' + r, n, col: '--hueso', b: `${S.DATOS.zonas.radios[r]}`, ok: true, run: () => { if (S.ordenar(st, { t: 'zona', x: p.x, y: p.y, r, prio: 2, max: 2 })) { marca = { x: p.x, y: p.y, ms: performance.now() }; aviso('área de control designada'); } else aviso('demasiadas áreas'); } }));
    if (l.urbe && l.urbe.dueno > 0 && l.urbe.capital) for (const c of TIERRA) { const cl = S.DATOS.clases[c], motivo = S.puedeReclutar(st, 0, c, l.urbe.id); f.push({ sec: 'Reclutar', id: 'reclutar', dc: c, n: S.NOMBRES[c], col: VAR[c], b: cl.costo, em: motivo || reloj(cl.obra), ok: !motivo, run: () => reclutar(c, { u: l.urbe.id }, l.urbe) }); }
    if (l.def && l.def.s === 0 && l.def.t === S.RADAR) { const d = l.def; f.push({ sec: 'Radar', id: 'radar', n: d.off ? 'Encender (ve lejos, se delata)' : 'Apagar (no ve, no lo oyen)', col: '--espia', ok: true, run: () => { S.ordenar(st, { t: 'radar', id: d.id, on: !!d.off }); aviso(d.off ? 'radar apagado' : 'radar encendido'); } }); }
    if (l.def && l.def.s === 0 && l.def.t === S.PISTA) for (const c of [S.CAZA, S.ATAQUE, S.DRON, S.ESPIA, S.MISIL]) { const cl = S.DATOS.clases[c], motivo = S.puedeComprarAire(st, 0, c, l.def.id); f.push({ sec: 'Comprar para esta pista', id: 'comprar', dc: c, n: S.NOMBRES[c], col: VAR[c], b: cl.costo, em: motivo || reloj(cl.obra), ok: !motivo, run: () => reclutar(c, { d: l.def.id }, l.def) }); }
    if (!l.agua && (l.propio || l.baseP)) TIPOS_DEF().forEach((ti, d) => { const motivo = S.puedeConstruir(st, 0, d, p.x, p.y); f.push({ sec: `Construir · ${st.god ? '∞' : Math.floor(st.creditos[0])} créditos`, id: 'construir', dd: d, n: ti.nombre, col: VAR_DEF[d], tri: true, b: ti.costo, em: motivo || reloj(ti.obra), ok: !motivo, run: () => { const m = st.sigM++; if (S.ordenar(st, { t: 'construir', d, x: p.x, y: p.y, m })) marca = { x: p.x, y: p.y, ms: performance.now() }; else aviso('no se pudo construir aquí'); } }); });
    return f;
  }
  function reclutar(c, lugar, ref) {
    const m = st.sigM++;
    if (S.ordenar(st, { t: 'reclutar', c, ...lugar, m })) { marca = { x: ref.x, y: ref.y, ms: performance.now() }; aviso(`${S.NOMBRES[c]} en preparación`); } else aviso('no se pudo');
  }
  function pintarMenu() {
    const caja = $('menu'), { l } = menuAb, filas = filasDelMenu();
    caja.textContent = '';
    const cab = document.createElement('div'); cab.className = 'cab';
    const t1 = document.createElement('b'); t1.textContent = l.titulo;
    const t2 = document.createElement('span'); t2.textContent = l.presencia;
    cab.append(t1, t2); caja.appendChild(cab);
    if (seleccion.size && !menuAb.todo && !st.despliegue) {
      const v = document.createElement('button');
      v.type = 'button'; v.className = 'op ver'; v.dataset.a = 'ver-todas'; v.setAttribute('role', 'menuitem');
      const et = document.createElement('span'); et.textContent = 'ver todas las opciones'; v.appendChild(et);
      v.addEventListener('click', () => { menuAb.todo = true; pintarMenu(); });
      caja.appendChild(v);
    }
    let grupo = null, primera = null;
    for (const f of filas) {
      if (grupo !== f.sec) { grupo = f.sec; const h = document.createElement('div'); h.className = 'acc'; h.textContent = f.sec; caja.appendChild(h); }
      const b = document.createElement('button');
      b.type = 'button'; b.className = f.tri ? 'op def' : 'op'; b.setAttribute('role', 'menuitem'); b.dataset.a = f.id; b.disabled = !f.ok;
      if (f.dc !== undefined) b.dataset.c = f.dc;
      if (f.dd !== undefined) b.dataset.d = f.dd;
      const i = document.createElement('i'); i.style.setProperty('--c', `var(${f.col})`);
      const nom = document.createElement('span'); nom.textContent = f.n;
      const cant = document.createElement('b'); cant.textContent = f.b === undefined ? '' : f.b;
      const fin = document.createElement('em'); fin.textContent = f.em || f.motivo || '';
      b.append(i, nom, cant, fin);
      b.addEventListener('click', () => ejecutarFila(f));
      caja.appendChild(b);
      if (f.ok && !primera) primera = b;
    }
    caja.hidden = false;
    const r = caja.getBoundingClientRect();
    caja.style.left = `${clampV(menuAb.sx + 12, 8, innerWidth - r.width - 8)}px`;
    caja.style.top = `${clampV(menuAb.sy - 10, 8, innerHeight - r.height - 8)}px`;
    caja.classList.toggle('izq', menuAb.sx > innerWidth / 2);   // en táctil el menú va al lado opuesto del toque
    (primera || caja.querySelector('button') || caja).focus && (primera || caja.querySelector('button') || caja).focus({ preventScroll: true });
  }
  function abrirMenu(p, sx2, sy2, toque) {
    cerrarPlan();
    menuAb = { p, sx: sx2, sy: sy2, toque, t0: performance.now(), l: leerLugar(p) };
    pintarMenu();
  }
  function cerrarMenu() {
    menuAb = null;
    const c = $('menu');
    if (c) { if (c.contains(document.activeElement)) document.activeElement.blur(); c.hidden = true; }
  }
  function ejecutarFila(f) {
    if (!menuAb || (menuAb.toque && performance.now() - menuAb.t0 < 350)) return;
    const run = f.run;
    cerrarMenu();
    run();
    tHud = 0;
  }

  /* ---------- Planificador de misiones ---------- */
  function tropasDisponibles(c, p) {
    return propiasTierra().filter(u => u.c === c && puedeMoverse(u) && u.st === S.DESPLEGADA && !st.misiones.some(m => m.id === u.m && m.estado !== 'fin')).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  }
  function abrirPlan(tipo, p, titulo) {
    const T = S.DATOS.misiones[tipo], paquete = {};
    for (const c of T.clases) paquete[c] = 0;
    plan = { tipo, p, titulo, paquete, tropas: { [S.INF]: 0, [S.BLI]: 0 } };
    if (saltando) { saltando = false; vel = velAntes; pintarVel(); }
    if (corriendo) { corriendo = false; pausaPorPlan = true; $('pausa').textContent = 'seguir'; }
    pintarPlan();
  }
  function cerrarPlan() {
    if (!plan) return;
    plan = null; $('plan').hidden = true;
    if (pausaPorPlan) { pausaPorPlan = false; corriendo = true; $('pausa').textContent = 'pausa'; }
  }
  function pintarPlan() {
    const c = $('plan'), T = S.DATOS.misiones[plan.tipo], p = plan.p;
    c.textContent = '';
    const h = document.createElement('h2'); h.textContent = `${T.nombre} · ${plan.titulo}`; c.appendChild(h);
    const pst = document.createElement('p'); pst.textContent = 'El juego se detiene mientras planificas. Los aparatos se coordinan para llegar a la vez.'; c.appendChild(pst);
    const fila = (txt, col, disp, val, set) => {
      const d = document.createElement('div'); d.className = 'pfila';
      const i = document.createElement('i'); i.style.setProperty('--c', `var(${col})`);
      const n = document.createElement('span'); n.textContent = txt;
      const dp = document.createElement('small'); dp.textContent = `${disp} disponibles`;
      const m = document.createElement('button'); m.type = 'button'; m.textContent = '−'; m.setAttribute('aria-label', `Menos ${txt}`); m.disabled = val <= 0;
      const b = document.createElement('b'); b.textContent = val;
      const mas = document.createElement('button'); mas.type = 'button'; mas.textContent = '+'; mas.setAttribute('aria-label', `Más ${txt}`); mas.disabled = val >= disp;
      m.addEventListener('click', () => { set(val - 1); pintarPlan(); });
      mas.addEventListener('click', () => { set(val + 1); pintarPlan(); });
      d.append(i, n, dp, m, b, mas); c.appendChild(d);
    };
    let etaMax = 0, total = 0;
    for (const k of T.clases) {
      const lista = S.hangarLibre(st, 0, k, p.x, p.y, 99);
      plan.paquete[k] = Math.min(plan.paquete[k], lista.length);
      fila(S.NOMBRES[k], VAR[k], lista.length, plan.paquete[k], v => { plan.paquete[k] = v; });
      total += plan.paquete[k];
      if (plan.paquete[k]) etaMax = Math.max(etaMax, ...lista.slice(0, plan.paquete[k]).map(q => Math.hypot(q.d.x - p.x, q.d.y - p.y) / st.v[k]));
    }
    if (T.tierra) {
      // La misión solo mueve la tropa que tú seleccionaste: nunca toma compañías por su cuenta.
      const us = propiasTierra().filter(u => seleccion.has(u.id) && puedeMoverse(u));
      plan.ids = us.map(u => u.id); total += us.length;
      for (const u of us) { const e = S.etaRuta(st, u.c, u.x, u.y, p.x, p.y); if (Number.isFinite(e)) etaMax = Math.max(etaMax, e + S.DATOS.embarque.subir); }
      const tp = document.createElement('p'); tp.className = 'ptropa';
      tp.textContent = us.length ? `Tropa: ${us.length} ${us.length === 1 ? 'compañía seleccionada' : 'compañías seleccionadas'}` : 'Sin tropa seleccionada. Para que vaya tropa, cierra, selecciona las compañías y vuelve a abrir la misión.';
      c.appendChild(tp);
    }
    const est = document.createElement('p'); est.className = 'peta'; est.textContent = total ? `llegada en ${reloj(etaMax)}` : 'elige al menos una unidad'; c.appendChild(est);
    const b = document.createElement('div'); b.className = 'acciones';
    const lan = document.createElement('button'); lan.type = 'button'; lan.className = 'accion'; lan.id = 'lanzarPlan'; lan.textContent = 'Lanzar'; lan.disabled = !total;
    lan.addEventListener('click', lanzarPlan);
    const can = document.createElement('button'); can.type = 'button'; can.className = 'sec'; can.textContent = 'Cancelar'; can.addEventListener('click', cerrarPlan);
    b.append(lan, can); c.appendChild(b);
    c.hidden = false;
  }
  function lanzarPlan() {
    if (!plan) return;
    const T = S.DATOS.misiones[plan.tipo], ids = [];
    if (T.tierra) ids.push(...(plan.ids || []));
    const q = plan.p, tipo = plan.tipo, paquete = { ...plan.paquete };
    const id = S.ordenar(st, { t: 'mision', tipo, x: q.x, y: q.y, paquete, ids });
    if (id) { marca = { x: q.x, y: q.y, ms: performance.now() }; aviso(`misión M${id} en marcha`); } else aviso('no se pudo lanzar');
    cerrarPlan();
    tHud = 0;
  }
  function aviso(t, ms = 1600) { $('aviso').textContent = t; avisoHasta = performance.now() + ms; }

  /* ---------- Paneles ---------- */
  function cancelarUltima() {
    const v = S.vista(st, 0), todas = filasOrdenes(v).filter(f => f.m);
    if (!todas.length) { aviso('nada que cancelar'); return; }
    const u = todas[todas.length - 1];
    if (S.ordenar(st, { t: 'cancelar', m: u.m })) aviso(`M${u.m} cancelada`);
  }
  function filasOrdenes(v) {
    const f = [];
    for (const m of v.misiones) {
      if (m.estado === 'fin') continue;
      const T = S.DATOS.misiones[m.tipo], prox = m.pend.length ? Math.min(...m.pend.map(p => p.sale)) : null;
      const puede = m.pend.length || st.unidades.some(u => !u.dead && u.m === m.id && u.c !== S.MISIL && (u.aire ? u.st !== S.REGRESO : u.st !== S.DESPLEGADA));
      f.push({ m: puede ? m.id : 0, txt: `M${m.id} ${T.nombre}`, col: '--hueso', est: m.estado === 'alista' ? 'alista' : 'en curso', t: prox !== null ? reloj((prox - st.t) * S.DT) : '' });
    }
    for (const q of v.cola) f.push({ m: q.m, txt: `prepara · ${S.NOMBRES[q.c]}`, col: VAR[q.c], est: '', t: reloj((q.listo - st.t) * S.DT) });
    for (const d of v.defensas) if (st.t < d.listo && d.m) f.push({ m: d.m, txt: `obra · ${TIPOS_DEF()[d.t].nombre}`, col: VAR_DEF[d.t], est: '', t: reloj((d.listo - st.t) * S.DT) });
    return f;
  }
  function pintarOrdenes(v) {
    const caja = $('misiones'), f = filasOrdenes(v), max = 7, ocultas = Math.max(0, f.length - max);
    caja.textContent = '';
    caja.hidden = !f.length;
    if (ocultas) { const d = document.createElement('div'); d.className = 'm mas'; d.textContent = `+${ocultas} órdenes más`; caja.appendChild(d); }
    for (const q of f.slice(-max)) {
      const d = document.createElement('div'); d.className = 'm';
      const i = document.createElement('i'); i.style.setProperty('--c', `var(${q.col})`);
      const a = document.createElement('span'); a.textContent = q.txt;
      const e = document.createElement('span'); e.className = 'e'; e.textContent = q.est;
      const t = document.createElement('b'); t.textContent = q.t;
      const x = document.createElement(q.m ? 'button' : 'span');
      if (q.m) { x.type = 'button'; x.className = 'x'; x.dataset.m = q.m; x.textContent = '×'; x.title = 'Cancelar (X cancela la última)'; x.setAttribute('aria-label', `Cancelar ${q.txt}`); }
      d.append(i, a, e, t, x);
      caja.appendChild(d);
    }
  }
  $('misiones').addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('button.x');
    if (!b) return;
    e.preventDefault();
    if (S.ordenar(st, { t: 'cancelar', m: +b.dataset.m })) { aviso(`M${b.dataset.m} cancelada`); tHud = 0; }
  });
  function pintarBatallas(v) {
    const caja = $('batallas'), L = v.ciudades.filter(c => c.batalla);
    caja.textContent = '';
    caja.hidden = !L.length;
    for (const c of L.slice(0, 6)) {
      const propios = c.barrios ? c.barrios.filter(b => b.dueno > 0).length : 0, n = c.barrios ? c.barrios.length : 0;
      const d = document.createElement('button'); d.type = 'button'; d.className = 'b'; d.dataset.x = c.x; d.dataset.y = c.y;
      d.title = 'Ir a la batalla';
      const a = document.createElement('span'); a.textContent = `Batalla por ${c.nombre}`;
      const t = document.createElement('b'); t.textContent = `${propios}/${n}`;
      d.append(a, t);
      caja.appendChild(d);
    }
  }
  $('batallas').addEventListener('click', e => { const b = e.target.closest('.b'); if (b) { acabarTrans(); centrar(+b.dataset.x, +b.dataset.y); } });
  function pintarFuerzas(v) {
    const caja = $('fuerzas');
    caja.textContent = '';
    const tierra = TIERRA.map(c => ({ c, n: v.propias.filter(u => u.c === c).length }));
    const fila = (c, txt, val) => {
      const d = document.createElement('div'); d.className = 'f';
      const i = document.createElement('i'); i.style.setProperty('--c', `var(${VAR[c]})`);
      const n = document.createElement('span'); n.textContent = txt;
      const b = document.createElement('b'); b.textContent = val;
      d.append(i, n, b); caja.appendChild(d);
    };
    for (const q of tierra) fila(q.c, S.NOMBRES[q.c], q.n);
    const cupo = S.cupoTierra(g.st, 0);
    const lin = document.createElement('div'); lin.className = 'f'; lin.title = 'Compañías que tu territorio sostiene: más ciudades, más cupo';
    const li = document.createElement('i'); li.style.background = 'transparent'; const ln = document.createElement('span'); ln.textContent = 'cupo de tierra'; const lb = document.createElement('b'); lb.textContent = `${cupo.usadas}/${cupo.tope}`;
    lin.append(li, ln, lb); caja.appendChild(lin);
    for (const c of [S.CAZA, S.ATAQUE, S.DRON, S.ESPIA, S.MISIL]) { const h = v.hangar[c] || { listos: 0, total: 0 }; const vuelo = v.propias.filter(u => u.c === c).length; fila(c, S.NOMBRES[c], `${h.listos}/${h.total + vuelo}`); }
  }
  cv.addEventListener('contextmenu', e => e.preventDefault());
  function alternarCaja(on = !modoCaja) {
    modoCaja = on;
    $('caja').setAttribute('aria-pressed', String(on));
    if (on) aviso('arrastra para seleccionar', 2200);
  }
  cv.addEventListener('pointerdown', e => {
    if (st.fin || !$('parte').hidden) return;
    Sonido.iniciar();
    if (menuAb) { cerrarMenu(); return; }
    if (plan) return;
    acabarTrans();
    if (e.pointerType === 'touch') {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 2) {
        const [a, b] = [...toques.values()];
        gesto = null; pinza = { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return;
      }
      if (toques.size > 2) return;
    }
    const p = mundo(e);
    cursor = e.pointerType === 'mouse' ? p : null;
    if (e.button === 0) {
      const fl = flechas.find(q => Math.hypot(q.x - e.clientX, q.y - e.clientY) < 20);
      if (fl) { centrar(fl.f.x, fl.f.y); return; }
    }
    if (e.button === 2) { if (seleccion.size) ordenarSeleccion(p); return; }
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* puntero ya liberado */ }
    gesto = { x0: e.clientX, y0: e.clientY, cx: e.clientX, cy: e.clientY, w0: p, w: p, modo: e.button === 1 ? 'pan' : 'nuevo', caja: e.shiftKey || modoCaja, sumar: e.ctrlKey || e.metaKey, umbral: e.pointerType === 'mouse' ? 8 : 14 };
  });
  cv.addEventListener('pointermove', e => {
    cursorP = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null;
    if (e.pointerType === 'touch' && toques.has(e.pointerId)) {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinza && toques.size === 2) {
        const [a, b] = [...toques.values()], d = Math.hypot(a.x - b.x, a.y - b.y), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        moverCam(ox + x - pinza.x, oy + y - pinza.y);
        pinza.x = x; pinza.y = y;
        if (d / pinza.d > 1.3) { cambiarNivel(1, x, y); pinza.d = d; } else if (d / pinza.d < .77) { cambiarNivel(-1, x, y); pinza.d = d; }
        return;
      }
    }
    const p = mundo(e);
    cursor = e.pointerType === 'mouse' ? p : null;
    if (!gesto) return;
    gesto.w = p;
    if (gesto.modo === 'nuevo' && Math.hypot(e.clientX - gesto.x0, e.clientY - gesto.y0) > gesto.umbral) gesto.modo = gesto.caja ? 'caja' : 'pan';
    if (gesto.modo === 'pan') {
      moverCam(ox + e.clientX - gesto.cx, oy + e.clientY - gesto.cy);
      cv.classList.add('arrastrando');
    }
    gesto.cx = e.clientX; gesto.cy = e.clientY;
  });
  const soltar = e => {
    if (e.pointerType === 'touch') { toques.delete(e.pointerId); if (toques.size < 2) pinza = null; }
    cv.classList.remove('arrastrando');
    if (!gesto) return;
    const q = gesto;
    gesto = null;
    if (e.type === 'pointercancel') return;
    if (q.modo === 'nuevo') {
      const L = leerLugar(q.w), h = o => Math.hypot(o.x - q.w.x, o.y - q.w.y);
      // Si el toque cae más cerca de la ciudad que de la tropa, es la ciudad lo que se quiso tocar.
      const t = L.propia && L.urbe && h(L.urbe) < h(L.propia) ? null : L.propia;
      if (t && !seleccion.has(t.id)) {
        // Con el dedo, un toque sobre un grupo apretado toma el grupo: elegir un punto de 6 px entre varios no es razonable.
        const junto = tactil ? propiasTierra().filter(u => Math.hypot(u.x - t.x, u.y - t.y) * s < 26) : [t];
        fijarSeleccion(seleccion.size && (e.ctrlKey || e.metaKey) ? [...seleccion, t.id] : junto.map(u => u.id));
        if (junto.length > 1) aviso(`${junto.length} compañías seleccionadas · acerca el mapa para elegir una sola`, 2600);
        return;
      }
      abrirMenu(q.w, e.clientX, e.clientY, e.pointerType !== 'mouse');
    } else if (q.modo === 'caja') { aplicarCaja(q.w0, q.w, q.sumar); if (modoCaja) alternarCaja(false); }
  };
  cv.addEventListener('pointerup', soltar);
  cv.addEventListener('pointercancel', soltar);
  cv.addEventListener('pointerleave', () => { cursor = null; cursorP = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (st.fin || !$('parte').hidden) return;
    const now = performance.now();
    if (now < ruedaHasta || !e.deltaY) return;
    ruedaHasta = now + 160;
    if (menuAb) cerrarMenu();
    cambiarNivel(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
  }, { passive: false });

  // Tiempo inteligente: algo que pide tu atención baja la velocidad sola; en salto, pausa.
  const pintarVel = () => { $('vel').textContent = saltando ? '▸▸' : '×' + vel; $('salto').setAttribute('aria-pressed', String(saltando)); };
  function frenar(motivo) {
    if (st.fin) return;
    if (saltando) {
      saltando = false; vel = velAntes; corriendo = false; $('pausa').textContent = 'seguir'; pintarVel();
      aviso(`en pausa · ${motivo}`, 1e9);
    } else if (vel > 1 && corriendo) { vel = 1; pintarVel(); aviso(`velocidad ×1 · ${motivo}`, 3000); }
  }
  function saltar() {
    if (st.fin || !$('parte').hidden || !$('plan').hidden) return;
    if (st.despliegue) { aviso('primero coloca tu tropa y pulsa «Empezar la guerra»', 2600); return; }
    if (saltando) { saltando = false; vel = velAntes; pintarVel(); aviso('salto cancelado'); return; }
    saltando = true; velAntes = vel; vel = 80; pausaPorPlan = false;
    if (!corriendo) { corriendo = true; $('pausa').textContent = 'pausa'; }
    pintarVel(); aviso('avanzando hasta el próximo evento…', 2500);
  }
  function alternarPausa() {
    if (st.fin || !$('parte').hidden) return;
    if (st.despliegue) { aviso('primero coloca tu tropa y pulsa «Empezar la guerra»', 2600); return; }
    if (saltando) { saltando = false; vel = velAntes; pintarVel(); }
    pausaPorPlan = false;
    corriendo = !corriendo;
    $('pausa').textContent = corriendo ? 'pausa' : 'seguir';
    aviso(corriendo ? '' : 'en pausa · puedes dar órdenes', corriendo ? 0 : 1e9);
  }
  function alternarVel() { if (saltando) { saltando = false; vel = velAntes; } else vel = vel === 1 ? 4 : vel === 4 ? 16 : vel === 16 ? 48 : 1; pintarVel(); }
  function alternarSonido() { const on = Sonido.alternar(); Sonido.iniciar(); $('sonido').setAttribute('aria-pressed', String(on)); }
  function abrirParte(on) {
    $('parte').hidden = !on;
    if (on) {
      corriendo = false; $('pausa').textContent = 'seguir';
      $('bloqueMapa').hidden = iniciada;
      $('empezar').textContent = iniciada ? 'Seguir' : 'Empezar';
      $('continuar').hidden = iniciada || !haySaved();
      $('tutorial').hidden = iniciada; $('tutorial').textContent = recuerda(CLAVE_TUTO) ? 'Tutorial' : 'Tutorial · 12 min';
      $('tutorial').parentNode.classList.toggle('novato', !recuerda(CLAVE_TUTO));
    }
  }
  function empezar() {
    Sonido.iniciar(); iniciada = true; abrirParte(false); corriendo = !st.despliegue; tGuardado = performance.now();
    $('pausa').textContent = corriendo ? 'pausa' : 'seguir'; $('aviso').textContent = '';
    pintarDespliegue();
  }
  // Fase de despliegue: el reloj espera mientras colocas la reserva.
  function pintarDespliegue() {
    const caja = $('despliegue');
    caja.hidden = !st.despliegue || !iniciada || !!tuto;   // en el tutorial, el despliegue lo guía su propia caja
    if (caja.hidden) return;
    const cap = st.urbes.find(u => u.capital && u.dueno > 0), enReserva = propiasTierra().filter(u => Math.hypot(u.x - cap.x, u.y - cap.y) < 90).length;
    const A = S.DATOS.asalto, yo = st.modo ? (st.modo.atacante === 0 ? 'atacante' : 'defensor') : null;
    $('despliegue').querySelector('.cab').textContent = yo === 'atacante' ? 'despliegue · atacas' : yo === 'defensor' ? `despliegue · defiendes · obras ${Math.floor(st.obras[0])}` : 'despliegue';
    $('despTexto').textContent = (yo === 'atacante' ? `Debes tener ${A.meta} ciudades enemigas, o su capital, antes de que acabe el día ${A.dias}. Elige por dónde atacar: concentra la tropa. ` : yo === 'defensor' ? `Resiste hasta que acabe el día ${A.dias} sin perder ${A.meta} ciudades. Tu tropa empezará atrincherada. Sin nada seleccionado, un clic en tu territorio construye al instante con tus obras. ` : '') + `Tu tropa está en reserva alrededor de la capital (${enReserva} sin colocar). Selecciona compañías y haz clic en tu territorio para colocarlas donde quieras. El reloj no corre todavía.`;
  }
  function iniciarGuerra() {
    if (!S.ordenar(st, { t: 'iniciar' })) return;
    limpiarSeleccion(); cerrarMenu(); pintarDespliegue();
    corriendo = true; $('pausa').textContent = 'pausa'; tGuardado = performance.now(); aviso('la guerra empieza', 2200);
  }
  const conClic = (id, f) => $(id).addEventListener('click', e => { f(); if (e.detail) e.currentTarget.blur(); });
  conClic('titulo', () => location.reload());
  conClic('pausa', alternarPausa);
  conClic('vel', alternarVel);
  conClic('salto', saltar);
  conClic('mandoBtn', alternarMando);
  conClic('modo', alternarModo);
  ponerTactil(modo === 'auto' ? matchMedia('(pointer: coarse)').matches : modo === 'tactil'); pintarModo();
  conClic('todas', seleccionarTodas);
  conClic('sonido', alternarSonido);
  conClic('soltarSel', limpiarSeleccion);
  conClic('zMas', () => cambiarNivel(1));
  conClic('zMenos', () => cambiarNivel(-1));
  conClic('irBase', () => { acabarTrans(); irABase(); });
  conClic('caja', () => alternarCaja());
  conClic('ayuda', () => abrirParte($('parte').hidden));
  conClic('empezar', empezar);
  conClic('despAuto', () => { if (S.ordenar(st, { t: 'desplegarAuto' })) { limpiarSeleccion(); cerrarMenu(); capaT = -1; pintarDespliegue(); aviso(st.modo && st.modo.atacante === 0 ? 'tropa concentrada en dos ejes de ataque' : st.modo ? 'tropa repartida y frente fortificado' : 'tropa repartida por las ciudades del frente', 2400); } });
  conClic('despIniciar', iniciarGuerra);
  conClic('tutorial', iniciarTutorial);
  conClic('continuar', () => { continuar(); });
  conClic('guardar', () => guardar(true));
  conClic('otra', () => { nueva(); empezar(); });
  conClic('otroPapel', () => { semillaFija = st.seed; rolInicial = st.modo.atacante === 0 ? 'defensor' : 'atacante'; pintarRolInicio(); nueva(); empezar(); });
  conClic('reiniciar', () => {
    const b = $('reiniciar'), now = performance.now();
    if (now < confirma) { confirma = 0; b.textContent = 'reiniciar'; nueva(); abrirParte(true); return; }
    confirma = now + 2500; b.textContent = '¿seguro?';
    setTimeout(() => { if (performance.now() >= confirma) { b.textContent = 'reiniciar'; confirma = 0; } }, 2600);
  });
  let tecleo = '';
  function alternarGod() {
    const on = !st.god;
    S.ordenar(st, { t: 'god', on });
    $('titulo').textContent = on ? 'doctrina · GOD' : 'doctrina';
    aviso(on ? 'GOD activado' : 'GOD desactivado');
    if (on) marcas.conGod = true;
  }
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (plan && e.key === 'Escape') { e.preventDefault(); cerrarPlan(); return; }
    if (menuAb) {
      if (e.key === 'Escape') { e.preventDefault(); cerrarMenu(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const l = [...$('menu').querySelectorAll('.op:not(:disabled)')], i = l.indexOf(document.activeElement);
        if (l.length) l[(i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length].focus();
        return;
      }
    }
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.key.startsWith('Arrow') && !menuAb) { e.preventDefault(); teclas.add(e.key); return; }
    if (e.key.length === 1) { tecleo = (tecleo + e.key.toLowerCase()).slice(-3); if (tecleo === 'god') { tecleo = ''; alternarGod(); return; } }
    const grupo = /^(?:Digit|Numpad)([890])$/.exec(e.code);
    if (grupo) {
      const n = grupo[1];
      if (e.shiftKey) { if (seleccion.size) { grupos[n] = [...seleccion]; aviso(`grupo ${n} guardado · ${seleccion.size}`); } }
      else if (grupos[n]) {
        const vivos = new Set(propiasTierra().map(u => u.id)), q = grupos[n].filter(id => vivos.has(id));
        if (q.length) { fijarSeleccion(q); aviso(`grupo ${n} · ${q.length}`); } else aviso(`el grupo ${n} ya no tiene unidades`);
      }
      return;
    }
    const k = e.key.toLowerCase(), enBoton = e.target && e.target.tagName === 'BUTTON';
    if (e.code === 'Space' && !enBoton) { e.preventDefault(); if (!$('parte').hidden) empezar(); else alternarPausa(); }
    else if (e.key === 'Escape') limpiarSeleccion();
    else if (k === 'v') alternarVel();
    else if (k === 'n') saltar();
    else if (k === 'd') alternarMando();
    else if (k === 't') seleccionarTodas();
    else if (k === 'x') cancelarUltima();
    else if (k === 'm') alternarSonido();
    else if (e.key === '+' || e.key === '=') cambiarNivel(1);
    else if (e.key === '-') cambiarNivel(-1);
    else if (k === 'b') { acabarTrans(); irABase(); }
    else if (k === 'c') alternarCaja();
    else if (k === 'f') { const f = ultimoFaro(); if (f) { acabarTrans(); centrar(f.x, f.y); } else aviso('sin alertas recientes'); }
    else if (k === 'h' || e.key === '?') abrirParte($('parte').hidden);
  });
  addEventListener('keyup', e => teclas.delete(e.key));
  addEventListener('blur', () => teclas.clear());

  /* ---------- Elegir mapa ---------- */
  const msgMapa = t => { $('msgMapa').textContent = t; };
  function usarMapa(n) {
    const d = A.derivar(n);
    if (!d.separa) { msgMapa('Ese mapa no sirve todavía: su frontera no separa las bases.'); return false; }
    if (!d.hayRuta) { msgMapa('Ese mapa no sirve todavía: no hay ruta terrestre entre las bases.'); return false; }
    if (d.bloqueo[A.idx(1, A.ROWS - 2)] || d.bloqueo[A.idx(A.COLS - 2, 1)]) { msgMapa('Ese mapa no sirve todavía: una base está sobre agua.'); return false; }
    mapaActual = n; nueva(); abrirParte(true);
    msgMapa(`Mapa listo: ${n.nombre}`);
    return true;
  }
  function mapaDelAtlas() { try { const t = localStorage.getItem('atlas.mapa.v1'); return t ? A.deJSON(t) : null; } catch (_) { return null; } }
  (function prepararSelector() {
    const del = mapaDelAtlas();
    if (del) { const o = document.createElement('option'); o.value = 'atlas'; o.textContent = `Atlas: ${del.nombre}`; $('mapaSel').appendChild(o); }
    $('irAtlas').hidden = window.top !== window.self;
  })();
  $('mapaSel').addEventListener('change', e => {
    const ok = usarMapa(e.target.value === 'atlas' ? mapaDelAtlas() || A.ejemplo() : A.ejemplo());
    if (!ok) e.target.value = 'ejemplo';
  });
  conClic('pegarMapa', () => { const p = $('pegado'); p.hidden = !p.hidden; if (!p.hidden) $('jsonMapa').focus(); });
  conClic('usarPegado', () => {
    try { if (usarMapa(A.deJSON($('jsonMapa').value))) $('pegado').hidden = true; }
    catch (err) { msgMapa(err.message); }
  });

  /* ---------- Registro de mensajes ---------- */
  const mmss = t => { const s = Math.floor(t * S.DT); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const lista = a => a.map((n, c) => (n ? `${n} ${S.NOMBRES[c]}` : '')).filter(Boolean).join(', ');
  function registrar(txt, grave, lugar) {
    const r = $('registro'), d = document.createElement('div');
    const min = S.minutoDe(st); d.textContent = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')} ${txt}`;   // hora del día, como el reloj de arriba
    if (grave) d.className = 'grave';
    if (lugar) { d.classList.add('ir'); d.title = 'Ir a ese lugar'; d.addEventListener('click', () => { acabarTrans(); centrar(lugar.x, lugar.y); }); }
    r.appendChild(d);
    while (r.children.length > 6) r.removeChild(r.firstChild);
  }
  function vigilar() {
    if (st.fin) return;
    const v = S.vista(st, 0), t = st.t, b = st.bases[0];
    let misil = 0;
    for (const u of v.contactos) if (u.aire && !u.gris && u.c === S.MISIL) { misil++; faro(u.x, u.y, 'misil', u.id); }
    if (misil && t - (marcas.alarma || -1e9) > 300) { marcas.alarma = t; registrar('misil entrante', true); Sonido.sonar('alarma'); }
    if (t - marcas.bajas >= 1800) {
      marcas.bajas = t;
      const lista = a => a.map((n, c) => (n ? `${n} ${S.NOMBRES[c]}` : '')).filter(Boolean).join(', '), p = lista(acu.pro), n = lista(acu.ene);
      if (p) { registrar(`bajas propias: ${p}`, false, acu.lugar); if (acu.lugar) faro(acu.lugar.x, acu.lugar.y, 'combate'); }
      if (n) registrar(`bajas enemigas: ${n}`, false);
      acu.pro.fill(0); acu.ene.fill(0);
    }
    const nuevas = st.alertas[0].filter(a => a.t > marcas.alertaT);
    if (nuevas.length) { marcas.alertaT = Math.max(...nuevas.map(a => a.t)); registrar(`lanzamiento de misil detectado${nuevas.length > 1 ? ` ×${nuevas.length}` : ''}`, true, nuevas[0]); Sonido.sonar('alarma'); }
    for (const q of S.satelites(st, 0)) {
      const m = marcas.sat[q.id] || (marcas.sat[q.id] = { activo: false, desde: 0 });
      if (q.activo && !m.activo) { m.activo = true; m.desde = t; }
      else if (!q.activo && m.activo) { m.activo = false; const n = v.fotos.filter(f => f.sat === q.id && f.t >= m.desde).length; registrar(`satélite ${q.nombre}: ${n ? `${n} ${n === 1 ? 'contacto' : 'contactos'}` : 'sin contactos'}`, false); if (n) Sonido.sonar('ping'); }
    }
    void b;
  }

  function hud() {
    const v = S.vista(st, 0), n = st.ter.ctrl.length - st.mapa.der.bloqueo.reduce((a, q) => a + q, 0), pct = k => Math.round(100 * k / n);
    let mem = 0; for (const d of st.mem[0]) if (d === -1) mem++;
    const grises = v.contactos.filter(u => u.gris).length;
    const hh = String(Math.floor(v.minuto / 60)).padStart(2, '0'), mm = String(v.minuto % 60).padStart(2, '0'), dia = 1 + Math.floor((S.DATOS.reloj.inicio + st.t / 30) / 1440);
    if (v.noche !== eraNoche) { if (eraNoche !== null && iniciada && !st.despliegue) registrar(v.noche ? 'Anochece: la tropa ve menos y el satélite óptico no ve' : 'Amanece', false); eraNoche = v.noche; }
    $('estado').textContent = `día ${dia} · ${hh}:${mm}${v.noche ? ' · noche' : ''}${v.tormenta ? ' · tormenta' : ''} · terreno ${pct(st.ter.cuenta[0])} % · enemigo ~${pct(mem)} %${v.contactos.length ? ` · contactos ${v.contactos.length}${grises ? ` (${grises} grises)` : ''}` : ''}`;
    const urb = v.ciudades, tot = urb.length, meta = Math.ceil(tot * S.DATOS.victoria.fraccion), mias = urb.filter(c => c.dueno > 0).length, suyas = urb.filter(c => c.dueno < 0).length;
    const mk = $('marcador'); mk.textContent = '';
    const fila = document.createElement('span'); fila.className = 'fila';
    for (let i = 0; i < tot; i++) { const c = document.createElement('i'); c.className = i < mias ? 'mia' : i >= tot - suyas ? 'suya' : 'libre'; fila.appendChild(c); }
    const seg = S.DATOS.victoria.segundos, tx = document.createElement('span');
    const mo = st.modo, quedan = mo ? Math.max(0, mo.plazo - st.t) / 30 : 0, plazoTxt = mo ? `quedan ${Math.floor(quedan / 1440)} d ${String(Math.floor(quedan % 1440 / 60)).padStart(2, '0')} h` : '';
    tx.textContent = mo ? (mo.atacante === 0 ? `tienes ${v.tomadas} de ${mo.meta} ciudades · ${plazoTxt}` : `el enemigo tiene ${v.tomadas} de ${mo.meta} · ${plazoTxt}`) : st.conq[0] > 0 ? `victoria en ${reloj(seg - st.conq[0])}` : st.conq[1] > 0 ? `derrota en ${reloj(seg - st.conq[1])}` : `${mias} de ${tot} · meta ${meta}`;
    if (st.conq[0] > 0 || st.conq[1] > 0 || (mo && (v.tomadas >= mo.meta - 1 || quedan < 720))) tx.className = 'urge';
    mk.append(fila, tx);
    const sat = $('sat'); sat.textContent = '';
    S.satelites(st, 0).forEach(q => { const e = document.createElement('span'); if (q.activo) e.className = 'activo'; e.textContent = `${q.nombre} ${q.activo ? 'pasando ' : ''}${reloj(q.faltan)}`; sat.appendChild(e); });
    const ag = st.agot.map(a => Math.max(0, Math.round((1 - a) * 100)));
    const tope = S.DATOS.abastos.reserva.base + S.DATOS.abastos.reserva.porDeposito * v.defensas.filter(d => d.t === S.DEPOSITO && st.t >= d.listo).length;
    $('moral').textContent = `abastos ${Math.round(v.abastos)}/${tope} · moral ${ag[0]} % · enemiga ${ag[1]} %`; $('moral').classList.toggle('grave', ag[0] <= 25);
    const renta = urb.filter(c => c.dueno > 0).reduce((a, c) => a + (c.capital ? S.DATOS.ciudad.capital : 1) * S.DATOS.ciudad.ingreso * (1 - (c.dano || 0) * .6) * (c.suministro ? 1 : .3), 0) * (1 - S.DATOS.agotamiento.ingreso * Math.min(1, st.agot[0]));
    $('creditos').textContent = st.god ? 'créditos ∞' : `créditos ${Math.floor(st.creditos[0])} · +${Math.round(renta)}/min`;
    pintarOrdenes(v); pintarBatallas(v); pintarFuerzas(v);
    podar();
    if (seleccion.size) pintarSeleccion();
    vigilar();
    if (avisoHasta && performance.now() > avisoHasta) { $('aviso').textContent = ''; avisoHasta = 0; }
    if (iniciada && !st.fin && performance.now() - tGuardado > 60000) { tGuardado = performance.now(); guardar(false); }
  }
  function cerrar() {
    const f = st.fin, n = st.ter.ctrl.length - st.mapa.der.bloqueo.reduce((a, q) => a + q, 0), pct = k => Math.round(100 * k / n) + ' %';
    capaT = -1;
    limpiarSeleccion(); cerrarPlan(); cerrarMenu();
    guardar(false);
    Sonido.sonar('fin', f.ganador === 0);
    const gano = f.ganador === 0;
    $('otroPapel').hidden = !st.modo;
    $('finTitulo').textContent = f.causa === 'objetivos' ? (gano ? 'Objetivos tomados' : 'El enemigo tomó sus objetivos') : f.causa === 'plazo' ? (gano ? 'Resististe hasta el plazo' : 'Se acabó el plazo') : f.causa === 'colapso' ? (gano ? 'El enemigo colapsó' : 'Tu país colapsó') : f.causa === 'capital' ? (gano ? 'Capital enemiga tomada' : 'Tu capital cayó') : f.causa === 'ciudades' ? (gano ? 'Ciudades bajo tu control' : 'El enemigo controla las ciudades') : (gano ? 'El enemigo quedó sin fuerzas' : 'Te quedaste sin fuerzas');
    $('finTexto').textContent = f.causa === 'objetivos' ? `${gano ? 'Tienes' : 'El enemigo tiene'} en su poder ${st.modo.meta} ciudades del defensor antes del plazo.` : f.causa === 'plazo' ? (gano ? 'El enemigo no logró sus objetivos a tiempo: la defensa aguantó.' : 'No tomaste las ciudades necesarias a tiempo: la defensa aguantó.') : f.causa === 'colapso' ? `${gano ? 'Su' : 'Tu'} moral llegó a cero: demasiadas bajas y ciudades perdidas para seguir la guerra.` : f.causa === 'ciudades' ? `${gano ? 'Mantuviste' : 'Mantuvo'} dos tercios de las ciudades durante ${S.DATOS.victoria.segundos / 60} minutos.` : '';
    if (marcas.conGod) $('finTexto').textContent += ' Partida jugada con GOD.';
    $('finT').textContent = reloj(f.t * S.DT);
    $('finA').textContent = pct(st.ter.cuenta[0]); $('finB').textContent = pct(st.ter.cuenta[1]);
    $('finBA').textContent = st.stats.bajas[0]; $('finBB').textContent = st.stats.bajas[1];
    $('finP').textContent = g.ias[1] ? g.ias[1].nombre : '';
    $('final').hidden = false;
  }

  let tHud = 0, cerrado = false;
  // ── Tutorial: una partida real con el enemigo quieto. Cada paso avanza cuando haces la acción. ──
  const CLAVE_TUTO = 'doctrina.tutorial';
  let tuto = null, consejoAbierto = false, eraNoche = null;
  const recuerda = k => { try { return !!localStorage.getItem(k); } catch (_) { return false; } };
  const anota = k => { try { localStorage.setItem(k, '1'); } catch (_) { /* sin almacenamiento */ } };
  const miTierra = () => st.unidades.filter(u => !u.dead && u.s === 0 && !u.aire);
  const PASOS = [
    { t: 'Moverse', x: () => 'Arrastra el mapa para desplazarte. El minimapa, abajo a la izquierda, te lleva a cualquier punto.',
      entra: T => { T.cam = [ox, oy]; }, listo: T => Math.hypot(ox - T.cam[0], oy - T.cam[1]) > 120 },
    { t: 'Zoom', x: () => 'Acerca o aleja con la rueda, pellizcando, o con los botones − y +.', foco: ['zMas', 'zMenos'],
      entra: T => { T.niv = nivel; }, listo: T => nivel !== T.niv },
    { t: 'Despliegue', x: T => `La guerra aún no empieza: tu tropa está en reserva junto a la capital. Pulsa «todas» para seleccionarla, haz clic junto a ${T.F.nombre} (el anillo) y elige «Colocar aquí».`, foco: ['todas'],
      entra: T => { irA(T.F); }, ancla: T => ({ x: T.F.x + 80, y: T.F.y + 60 }),
      listo: T => miTierra().filter(u => Math.hypot(u.x - T.F.x, u.y - T.F.y) < 170).length >= 3 },
    { t: 'Empezar', x: () => 'Así decides dónde arranca cada compañía. En una partida normal también puedes repartirlas con «Despliegue automático». Ahora empieza la guerra.',
      boton: 'Empezar la guerra', alPulsar: () => iniciarGuerra() },
    { t: 'Seleccionar', x: T => `Los puntos rellenos junto a ${T.F.nombre} son tus unidades; el color dice la clase. Las claras son infantería: diez soldados y su camión. Haz clic en una.`,
      entra: T => { cerrarMenu(); limpiarSeleccion(); irA(T.F); T.u0 = miTierra().filter(u => u.c === S.INF).sort((a, b) => Math.hypot(a.x - T.F.x, a.y - T.F.y) - Math.hypot(b.x - T.F.x, b.y - T.F.y))[0]; }, ancla: T => T.u0, listo: () => seleccion.size > 0 },
    { t: 'Mover', x: () => 'Ahora haz clic en un punto cercano del mapa y elige «Mover aquí». Los soldados suben al camión, viajan y bajan al llegar. Quieta dos minutos, la compañía se atrinchera (cuatro esquinas).',
      ancla: T => ({ x: T.F.x - 130, y: T.F.y + 110 }), listo: () => miTierra().some(u => u.st === S.EMBARCANDO || u.st === S.MARCHA) },
    { t: 'Acelerar', x: () => 'El camión tarda. Pulsa V, o el botón ×1, para acelerar el tiempo. Espacio pausa: en pausa también puedes dar órdenes.', foco: ['vel'],
      listo: () => vel > 1 },
    { t: 'Área de control', x: T => `Las áreas defienden solas. Haz clic en ${T.F.nombre} y, bajo «Designar área de control», elige «media».`,
      entra: T => { limpiarSeleccion(); irA(T.F); }, ancla: T => T.F, listo: () => st.zonas.some(z => z.s === 0) },
    { t: 'Defensa automática', x: () => 'Viene un avión enemigo. No des ninguna orden: tus cazas (azules) despegan solos porque hay un área y aviones libres.',
      entra: T => {
        const p = st.defensas.find(d => d.s === 1 && d.t === S.PISTA); T.pista = p ? [p, p.x, p.y] : null; T.t0 = st.t;
        if (p) { p.x = T.E.x + 40; p.y = T.E.y; S.aplicar(st, 1, { t: 'mision', tipo: 'golpe', x: T.F.x, y: T.F.y, paquete: { [S.ATAQUE]: 1 } }); }
      },
      sale: T => { if (T.pista) { T.pista[0].x = T.pista[1]; T.pista[0].y = T.pista[2]; T.pista = null; } },
      ancla: T => T.F, listo: T => st.unidades.some(u => u.s === 0 && u.aire && u.c === S.CAZA) || st.t - T.t0 > 30 * 90 },
    { t: 'Misión aérea', x: T => `Ahora ataca tú. Haz clic en ${T.E.nombre}, la ciudad enemiga (cuadrado hueco), elige «bombardeo», suma aparatos con + y pulsa «Lanzar». El juego se pausa mientras planificas.`,
      entra: T => { cerrarMenu(); limpiarSeleccion(); irA(T.E); }, ancla: T => T.E,
      listo: T => $('plan').hidden && st.misiones.some(m => m.s === 0 && m.tipo !== 'asalto' && m.tipo !== 'refuerzo') },
    { t: 'Asalto', x: T => `Mientras vuelan, manda la tropa. Pulsa «todas» para seleccionar tus compañías, haz clic en ${T.E.nombre} y elige «Asaltar la ciudad». La artillería y la antiaérea móvil se quedan a distancia de tiro.`, foco: ['todas'],
      ancla: T => T.E, listo: T => st.misiones.some(m => m.s === 0 && m.tipo === 'asalto') || miTierra().some(u => Math.hypot(u.tx - T.E.x, u.ty - T.E.y) < 150) },
    { t: 'Batalla por barrios', x: T => `Los cuadritos de ${T.E.nombre} son sus barrios. Tu tropa los disputa uno a uno y, con la mayoría, la ciudad cae. La barra sobre la ciudad es la balanza: la parte llena es tuya. Acelera con V mientras llegan.`,
      ancla: T => T.E, listo: T => T.E.dueno > 0 },
    { t: 'Guarnición y cerco', x: T => `${T.E.nombre} es tuya. Deja siempre alguna compañía dentro: una ciudad ocupada sin guardia se subleva. Una unidad muy castigada se quiebra (círculo hueco) y se retira sola a rehacerse. Y no detengas tropa muy lejos de tu territorio: gasta munición y combustible que solo repone en tu red, y si queda cercada se rinde.`,
      boton: 'Entendido' },
    { t: 'Saltar el tiempo', x: () => 'Pulsa «▸ evento», o N: el juego avanza rápido y se detiene solo cuando pasa algo importante.', foco: ['salto'],
      listo: () => saltando },
    { t: 'Refuerzos', x: T => `Todo lo nuevo nace en la capital. Haz clic en ${T.cap.nombre}, tu capital, y recluta una compañía de infantería. Luego viaja al frente: por los caminos de tu territorio (puntos claros) va cuatro veces más rápido.`,
      entra: T => { if (saltando) saltar(); cerrarMenu(); limpiarSeleccion(); irA(T.cap); }, ancla: T => T.cap, listo: () => st.colas[0].length > 0 },
    { t: 'Mando', x: () => 'No tienes que decidirlo todo. Pulsa «mando» (o D) y, en «Automatización», elige «baja»: tu estado mayor se encarga de reclutar, comprar y mandar refuerzos.', foco: ['mandoBtn'],
      entra: () => { cerrarMenu(); }, listo: () => st.doctrina[0].nivel !== 'manual' },
    { t: 'Doctrina', x: () => 'En el mismo panel fijas reglas para todo tu bando. En «Preservar la fuerza» elige «replegar al 50 %»: tus unidades se retirarán por orden antes de quebrarse. El cambio tarda unos segundos en llegar.',
      entra: () => { if ($('panelMando').hidden) alternarMando(); }, listo: () => st.doctrina[0].preservar > 0 || !!(st.doctrinaPend[0] && st.doctrinaPend[0].d.preservar > 0) },
    { t: 'Cómo se gana', entra: () => { $('panelMando').hidden = true; }, x: () => 'Toma la capital enemiga, mantén dos tercios de las ciudades cinco minutos, o agota la moral enemiga (panel derecho) antes que la tuya. Un clic en terreno propio permite construir defensas; en tu capital, reclutar. Arriba a la izquierda están el día y la hora (de noche se ve menos); a la derecha, tus abastos y la moral. El botón ? repite las reglas.',
      final: true },
  ];
  function irA(p) { acabarTrans(); centrar(p.x, p.y); }
  function iniciarTutorial() {
    g = S.partida({ seed: 4242, mapa: A.ejemplo(), ia1: null, manual: true }); st = g.st; iniciarEstado(); S.estadoMayor(g, 'manual'); pintarMando();
    const mias = st.urbes.filter(u => u.dueno > 0 && !u.capital), ene = st.urbes.filter(u => u.dueno < 0 && !u.capital);
    let par = null;
    for (const f of mias) for (const e of ene) { const d = Math.hypot(f.x - e.x, f.y - e.y); if (!par || d < par.d) par = { f, e, d }; }
    // Parte de tu fuerza ya está en la ciudad del frente, y la ciudad enemiga vecina está poco defendida.
    st.unidades = st.unidades.filter(u => !(u.s === 1 && !u.aire && Math.hypot(u.x - par.e.x, u.y - par.e.y) < 500));
    S.indexar(st);
    tuto = { i: -1, F: par.f, E: par.e, u0: null, cap: st.urbes.find(u => u.capital && u.dueno > 0) };
    empezar(); irA(par.f); pasoTutorial(0);
  }
  function pasoTutorial(i) {
    const previo = PASOS[tuto.i]; if (previo && previo.sale) previo.sale(tuto);
    tuto.i = i; const p = PASOS[i]; if (p.entra) p.entra(tuto);
    pintarTuto();
  }
  function terminarTutorial(seguir) {
    const previo = tuto && PASOS[tuto.i]; if (previo && previo.sale) previo.sale(tuto);
    tuto = null; anota(CLAVE_TUTO); pintarTuto();
    if (seguir) { g.ias[1] = S.iaCrear((st.t ^ st.seed) | 0, 'equilibrada'); aviso('el enemigo despierta'); }
    else { nueva(); abrirParte(true); }
  }
  function vigilarTutorial() {
    if (!tuto) return;
    if (st.fin) { tuto = null; pintarTuto(); return; }
    tuto.E.guar = Math.min(tuto.E.guar, 8);   // la primera ciudad se deja tomar
    const p = PASOS[tuto.i];
    if (p.listo && p.listo(tuto)) pasoTutorial(tuto.i + 1);
  }
  function pintarTuto() {
    const caja = $('tuto');
    document.querySelectorAll('.foco').forEach(e => e.classList.remove('foco'));
    if (!tuto) { if (!consejoAbierto) caja.hidden = true; return; }
    consejoAbierto = false;
    const p = PASOS[tuto.i]; caja.hidden = false; caja.textContent = '';
    const cab = document.createElement('div'); cab.className = 'cab'; cab.textContent = `tutorial ${tuto.i + 1}/${PASOS.length} · ${p.t}`;
    const tx = document.createElement('p'); tx.textContent = p.x(tuto);
    const pie = document.createElement('div'); pie.className = 'pie';
    const boton = (txt, f, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; if (cls) b.className = cls; b.addEventListener('click', f); pie.appendChild(b); };
    if (p.boton) boton(p.boton, () => { if (p.alPulsar) p.alPulsar(tuto); pasoTutorial(tuto.i + 1); }, 'accion');
    if (p.final) { boton('Seguir esta partida', () => terminarTutorial(true), 'accion'); boton('Partida nueva', () => terminarTutorial(false), 'accion'); }
    else boton('saltar tutorial', () => terminarTutorial(false), 'salir');
    caja.append(cab, tx, pie);
    for (const id of p.foco || []) $(id).classList.add('foco');
  }
  // Consejo suelto: la primera vez que ocurre algo que el tutorial no cubre.
  function consejo(k, texto) {
    if (tuto || consejoAbierto || recuerda('doctrina.consejo.' + k)) return;
    anota('doctrina.consejo.' + k); consejoAbierto = true;
    const caja = $('tuto'); caja.hidden = false; caja.textContent = '';
    const cab = document.createElement('div'); cab.className = 'cab'; cab.textContent = 'consejo';
    const tx = document.createElement('p'); tx.textContent = texto;
    const pie = document.createElement('div'); pie.className = 'pie';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'accion'; b.textContent = 'Entendido';
    b.addEventListener('click', () => { consejoAbierto = false; caja.hidden = true; }); pie.appendChild(b);
    caja.append(cab, tx, pie);
  }
  function dibujarAncla() {
    const p = tuto && PASOS[tuto.i], q = p && p.ancla && p.ancla(tuto);
    if (!q) return;
    const px = ox + q.x * s, py = oy + q.y * s, f = calma ? .5 : (performance.now() / 900) % 1;
    ctx.save(); ctx.strokeStyle = '#f2efe6'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.arc(px, py, 16 + f * 26, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(px, py, 16, 0, 6.2832); ctx.stroke();
    ctx.restore();
    if (px < 0 || py < 0 || px > cw || py > ch) faro(q.x, q.y, 'ciudad', 'tuto');
  }

  /* ---------- Mando: nivel de automatización y doctrina ---------- */
  function ponerNivel(n) {
    S.estadoMayor(g, n); nivelInicial = n;
    try { localStorage.setItem(CLAVE_NIVEL, n); } catch (_) { /* sin almacenamiento */ }
    pintarMando(); pintarNivelInicio();
  }
  function pintarRolInicio() {
    const c = $('rolInicio'); c.textContent = '';
    for (const [id, txt] of ROLES) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.setAttribute('aria-pressed', String(id === rolInicial));
      b.addEventListener('click', () => { rolInicial = id; try { localStorage.setItem(CLAVE_ROL, id || 'campana'); } catch (_) { /* sin almacenamiento */ } if (!iniciada) nueva(); pintarRolInicio(); });
      c.appendChild(b);
    }
    $('rolAyuda').textContent = ROLES.find(q => q[0] === rolInicial)[2](S.DATOS.asalto);
  }
  function pintarNivelInicio() {
    const c = $('nivelInicio'); c.textContent = '';
    for (const [id, txt, ayuda] of NIVELES) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = ayuda; b.setAttribute('aria-pressed', String(id === nivelInicial));
      b.addEventListener('click', () => { nivelInicial = id; try { localStorage.setItem(CLAVE_NIVEL, id); } catch (_) { /* sin almacenamiento */ } if (!iniciada) { S.estadoMayor(g, id); pintarMando(); } pintarNivelInicio(); });
      c.appendChild(b);
    }
    $('nivelAyuda').textContent = NIVELES.find(q => q[0] === nivelInicial)[2];
  }
  function alternarMando() { const c = $('panelMando'); if (c.hidden) { cerrarMenu(); cerrarPlan(); c.hidden = false; pintarMando(); } else c.hidden = true; }
  function pintarMando() {
    const c = $('panelMando'), doc = st.doctrina[0], pend = st.doctrinaPend[0];
    $('mandoBtn').textContent = `mando · ${doc.nivel}`;
    if (c.hidden) return;
    c.textContent = '';
    const h = document.createElement('h2'); h.textContent = 'Mando'; c.appendChild(h);
    const grupo = (titulo, ayuda, opciones, actual, pendiente, alElegir) => {
      const d = document.createElement('div'); d.className = 'grupo';
      const t = document.createElement('b'); t.textContent = titulo; const a = document.createElement('small'); a.textContent = ayuda;
      const f = document.createElement('div'); f.className = 'ops';
      for (const [val, txt] of opciones) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = txt;
        b.setAttribute('aria-pressed', String(val === actual)); if (pendiente !== undefined && val === pendiente && val !== actual) b.classList.add('llega');
        b.addEventListener('click', () => { alElegir(val); pintarMando(); }); f.appendChild(b);
      }
      d.append(t, a, f); c.appendChild(d);
    };
    grupo('Automatización', NIVELES.find(q => q[0] === doc.nivel)[2], NIVELES.map(q => [q[0], q[1]]), doc.nivel, undefined, v => ponerNivel(v));
    for (const [k, titulo, ops, ayuda] of OPCIONES_DOC) grupo(titulo, ayuda, ops, doc[k], pend ? pend.d[k] : undefined, v => { S.ordenar(st, { t: 'doctrina', [k]: v }); });
    const pie = document.createElement('p'); pie.className = 'pie';
    pie.textContent = pend ? `El cambio de doctrina llega a las unidades en ${reloj((pend.t - st.t) * S.DT)}.` : doc.nivel === 'alta' ? `Objetivos marcados: ${doc.objetivos.length ? doc.objetivos.map(id => st.urbes[id].nombre).join(', ') : 'ninguno. Haz clic en una ciudad enemiga y elige «Marcar como objetivo».'}` : 'Una orden tuya directa manda sobre el estado mayor durante diez minutos.';
    c.appendChild(pie);
    const x = document.createElement('button'); x.type = 'button'; x.className = 'sec'; x.textContent = 'Cerrar'; x.addEventListener('click', () => { c.hidden = true; }); c.appendChild(x);
  }

  pintarNivelInicio(); pintarRolInicio();
  function cuadro(now) {
    const dt = Math.min(.25, (now - ult) / 1000); ult = now;
    avanzarTrans(now);
    if (teclas.size && $('parte').hidden && !st.fin) {
      const v = 700 * dt, dx = (teclas.has('ArrowLeft') ? v : 0) - (teclas.has('ArrowRight') ? v : 0), dy = (teclas.has('ArrowUp') ? v : 0) - (teclas.has('ArrowDown') ? v : 0);
      if (dx || dy) moverCam(ox + dx, oy + dy);
    }
    if (corriendo && !st.fin) {
      acum += dt * vel;
      let n = 0;
      while (acum >= S.DT && n < 40) { S.avanzar(g); acum -= S.DT; n++; }
      if (n >= 40) acum = 0;
    }
    if (st.fin && !cerrado) { cerrado = true; cerrar(); } else if (!st.fin) cerrado = false;
    dibujar(corriendo ? Math.min(1, acum / S.DT) : 1, now);
    if (now - tHud > 200) { tHud = now; hud(); vigilarTutorial(); }
    requestAnimationFrame(cuadro);
  }


  $('sonido').setAttribute('aria-pressed', String(Sonido.activo));
  nueva();
  abrirParte(true);
  window.doctrina = { get partida() { return g; }, get seleccion() { return [...seleccion]; }, S, aPantalla: (x, y) => [ox + x * s, oy + y * s], centrar: (x, y) => { acabarTrans(); centrar(x, y); }, get camara() { return { s, ox, oy, nivel, niveles: [...niveles], cubre: hornoCubre() }; }, get flechas() { return flechas; }, cambiarNivel, guardar, continuar };
  requestAnimationFrame(cuadro);
})();
