// Reglas del teatro: cada prueba arma una situación y comprueba una regla con los datos reales del juego.
const assert = require('assert');
const At = require('./atlas/mapa.js'), S = require('./sim.js');
const M = At.ejemplo(), D = S.DATOS, seg = n => Math.round(n * 30);
let n = 0, fallos = 0;
const t = (nombre, f) => { try { f(); n++; console.log('ok    ' + nombre); } catch (e) { fallos++; console.log('FALLA ' + nombre + '\n      ' + (e.message || e).split('\n')[0]); } };
const nuevo = (seed = 1) => S.crear({ seed, mapa: M });
const correr = (st, s) => { for (let i = 0, k = seg(s); i < k && !st.fin; i++) S.paso(st, null); };
const hasta = (st, cond, s) => { for (let i = 0, k = seg(s); i < k && !st.fin; i++) { if (cond()) return true; S.paso(st, null); } return cond(); };
const de = (st, s, c) => st.unidades.filter(u => !u.dead && u.s === s && u.c === c);
const ciudad = (st, signo, f = u => !u.capital) => st.urbes.filter(u => u.dueno === signo).filter(f)[0];
const sinFuerzas = st => { st.unidades.length = 0; S.indexar(st); };
const pista = (st, s) => st.defensas.find(d => d.s === s && d.t === S.PISTA);

t('inicio parejo: mismas fuerzas, ciudades y créditos por lado', () => {
  const st = nuevo();
  for (const c of [S.INF, S.BLI]) assert.strictEqual(de(st, 0, c).length, de(st, 1, c).length);
  assert.strictEqual(de(st, 0, S.INF).length, D.fuerzasIniciales.inf);
  assert.strictEqual(st.urbes.filter(u => u.dueno > 0).length, st.urbes.filter(u => u.dueno < 0).length);
  assert.strictEqual(st.creditos[0], st.creditos[1]);
  assert.strictEqual(pista(st, 0).hangar.length, pista(st, 1).hangar.length);
});
t('cada camión lleva diez soldados', () => { const st = nuevo(); for (const u of de(st, 0, S.INF)) { assert.strictEqual(u.fuerza, 10); assert(u.camion); } });

t('el camión embarca, marcha y desembarca; moverlo de nuevo vuelve a embarcar', () => {
  const st = nuevo(), u = de(st, 0, S.INF)[0], visto = [];
  const x = u.x + 90, y = u.y;
  assert(S.aplicar(st, 0, { t: 'mover', ids: [u.id], x, y }));
  hasta(st, () => { if (visto[visto.length - 1] !== u.st) visto.push(u.st); return u.st === S.DESPLEGADA && visto.length > 1; }, 300);
  assert.deepStrictEqual(visto, [S.EMBARCANDO, S.MARCHA, S.DESEMBARCANDO, S.DESPLEGADA]);
  assert(S.aplicar(st, 0, { t: 'mover', ids: [u.id], x: u.x - 60, y: u.y }));
  assert.strictEqual(u.st, S.EMBARCANDO);
});
t('embarcar y bajar cuestan el tiempo fijado', () => {
  const st = nuevo(), u = de(st, 0, S.INF)[0];
  S.aplicar(st, 0, { t: 'mover', ids: [u.id], x: u.x + 200, y: u.y });
  correr(st, D.orden.enlace + D.embarque.subir - 2); assert.strictEqual(u.st, S.EMBARCANDO);
  correr(st, 3); assert.strictEqual(u.st, S.MARCHA);
});
t('sin camión la compañía no puede moverse', () => {
  const st = nuevo(), u = de(st, 0, S.INF)[0]; u.camion = false;
  assert.strictEqual(S.aplicar(st, 0, { t: 'mover', ids: [u.id], x: u.x + 50, y: u.y }), false);
});
t('la columna en marcha sufre mucho más que la tropa desplegada en ciudad', () => {
  const dano = (estado, enCiudad) => {
    const st = nuevo(7), u = de(st, 1, S.INF)[0]; st.unidades.length = 0; st.unidades.push(u); u.st = estado; u.urbe = enCiudad ? 0 : -1; S.indexar(st); u.urbe = enCiudad ? 0 : -1;
    const f0 = u.fuerza; S.golpear(st, 0, u.x, u.y, 'golpe', { c: S.ATAQUE }); return f0 - u.fuerza;
  };
  const m = dano(S.MARCHA, false), c = dano(S.DESPLEGADA, true);
  assert(m > 6 * c, `marcha ${m} ciudad ${c}`);
});

// Un ataque enemigo real: su pista se acerca para que el intruso entre al área enseguida.
const intruso = (st, b) => { const p = pista(st, 1); p.x = b.x + 620; p.y = b.y - 200; st.defensas.splice(0, st.defensas.length, ...st.defensas.filter(d => d.t === S.PISTA)); return S.aplicar(st, 1, { t: 'mision', tipo: 'golpe', x: b.x, y: b.y, paquete: { [S.ATAQUE]: 2 } }); };
t('área de control: un intruso visible hace despegar cazas, sin orden', () => {
  const st = nuevo(), b = st.bases[0];
  const zona = S.aplicar(st, 0, { t: 'zona', x: b.x, y: b.y, r: 2, prio: 1, max: 2 }); assert(zona);
  assert(intruso(st, b));
  assert(hasta(st, () => de(st, 0, S.CAZA).some(u => u.aire && u.z === zona), 60), 'no despegó nadie');
  assert(de(st, 0, S.CAZA).filter(u => u.aire && u.z === zona).length <= 2, 'superó el máximo del área');
});
t('área de control: sin área no despega nadie', () => {
  const st = nuevo(), b = st.bases[0];
  assert(intruso(st, b)); correr(st, 40);
  assert.strictEqual(de(st, 0, S.CAZA).filter(u => u.aire).length, 0);
});
t('área de control: sin aviones disponibles no aparece nada y se avisa', () => {
  const st = nuevo(), b = st.bases[0];
  for (const d of st.defensas) if (d.s === 0 && d.t === S.PISTA) d.hangar.length = 0;
  S.aplicar(st, 0, { t: 'zona', x: b.x, y: b.y, r: 2, prio: 1, max: 2 });
  assert(intruso(st, b));
  let aviso = false;
  for (let i = 0; i < seg(60) && !aviso; i++) { S.paso(st, null); aviso = st.ev.some(e => e.k === 'sinAire' && e.s === 0); }
  assert.strictEqual(de(st, 0, S.CAZA).filter(u => u.aire).length, 0);
  assert(aviso, 'no avisó');
});
t('área de control: quitarla deja de activar defensa', () => {
  const st = nuevo(), b = st.bases[0], z = S.aplicar(st, 0, { t: 'zona', x: b.x, y: b.y, r: 2 });
  assert(S.aplicar(st, 0, { t: 'quitarZona', id: z })); assert.strictEqual(st.zonas.length, 0);
  assert.strictEqual(S.aplicar(st, 1, { t: 'quitarZona', id: z }), false);
});

// La ciudad enemiga más cercana a la capital propia: al alcance de todo aparato.
const cerca = st => st.urbes.filter(u => u.dueno < 0 && !u.capital).sort((a, b) => Math.hypot(a.x - st.bases[0].x, a.y - st.bases[0].y) - Math.hypot(b.x - st.bases[0].x, b.y - st.bases[0].y))[0];
t('misión: elegir aparatos concretos y que lleguen a la vez', () => {
  const st = nuevo(), c = cerca(st);
  const id = S.aplicar(st, 0, { t: 'mision', tipo: 'golpe', x: c.x, y: c.y, paquete: { [S.ATAQUE]: 2, [S.CAZA]: 2 } });
  assert(id);
  const m = st.misiones.find(q => q.id === id);
  assert.strictEqual(m.pend.length, 4);
  const llegadas = m.pend.map(p => p.sale / 30 + Math.hypot(p.d.x - c.x, p.d.y - c.y) / st.v[p.c]);
  assert(Math.max(...llegadas) - Math.min(...llegadas) < 2, 'no coinciden: ' + llegadas);
});
t('misión: pedir aparatos que no hay la rechaza', () => {
  const st = nuevo(); for (const d of st.defensas) if (d.s === 0 && d.t === S.PISTA) d.hangar.length = 0;
  assert.strictEqual(S.aplicar(st, 0, { t: 'mision', tipo: 'golpe', x: 2500, y: 1500, paquete: { [S.ATAQUE]: 2 } }), false);
});
t('misión: cancelar antes de salir libera los aparatos', () => {
  const st = nuevo(), c = cerca(st);
  const id = S.aplicar(st, 0, { t: 'mision', tipo: 'bombardeo', x: c.x, y: c.y, paquete: { [S.ATAQUE]: 2, [S.CAZA]: 3 }, m: 77 });
  assert(id); assert(pista(st, 0).hangar.some(h => h.res));
  assert(S.aplicar(st, 0, { t: 'cancelar', m: 77 })); assert(!pista(st, 0).hangar.some(h => h.res));
});
t('misión de asalto mueve compañías elegidas', () => {
  const st = nuevo(), L = de(st, 0, S.INF).slice(0, 3), c = ciudad(st, 1);
  assert(S.aplicar(st, 0, { t: 'mision', tipo: 'asalto', x: c.x, y: c.y, ids: L.map(u => u.id) }));
  for (const u of L) assert.strictEqual(u.st, S.EMBARCANDO);
});
t('los aparatos vuelven a su pista y se rearman antes de volver a salir', () => {
  const st = nuevo(), c = ciudad(st, 1), base = pista(st, 0), total = base.hangar.length;
  S.aplicar(st, 0, { t: 'mision', tipo: 'golpe', x: c.x, y: c.y, paquete: { [S.ATAQUE]: 1 } });
  assert(hasta(st, () => base.hangar.length === total && base.hangar.some(h => h.listo > st.t), 3600), 'no volvió a rearmarse');
});

t('batalla por barrios: la ciudad cae cuando pierde la mayoría, de a un barrio', () => {
  const st = nuevo(), c = ciudad(st, -1), base = de(st, 0, S.INF)[0];
  st.unidades.length = 0; c.guar = 0;
  for (let i = 0; i < 4; i++) st.unidades.push({ ...base, id: 500 + i, x: c.x + 20 * i, y: c.y + 10, tx: c.x, ty: c.y, px: c.x, py: c.y, st: S.DESPLEGADA });
  const vistos = new Set(); let primero = 0;
  hasta(st, () => { const k = c.barrios.filter(b => b.dueno > 0).length; vistos.add(k); if (k === 1 && !primero) primero = c.dueno; return c.dueno > 0; }, 1200);
  assert.strictEqual(c.dueno, 1, 'no cayó');
  assert.strictEqual(primero, -1, 'cayó con un solo barrio');
  assert(vistos.has(1));
});
t('capturar por primera vez paga un bono, solo una vez', () => {
  const st = nuevo(), c = ciudad(st, -1), base = de(st, 0, S.INF)[0];
  st.unidades.length = 0; c.guar = 0;
  for (let i = 0; i < 4; i++) st.unidades.push({ ...base, id: 500 + i, x: c.x + 20 * i, y: c.y + 10, st: S.DESPLEGADA });
  const c0 = st.creditos[0]; assert(hasta(st, () => c.dueno > 0, 1200));
  assert(st.creditos[0] - c0 >= D.ciudad.bono);
  assert(c.tomada & 1);
});
const capital = (st, signo) => st.urbes.find(u => u.capital && u.dueno === signo);
t('solo la capital recluta, y la compañía nueva nace allí', () => {
  const st = nuevo(), c = ciudad(st, 1), cap = capital(st, 1);
  assert.strictEqual(S.puedeReclutar(st, 0, S.INF, c.id), 'solo en la capital');
  assert.strictEqual(S.puedeReclutar(st, 0, S.INF, cap.id), '');
  const n0 = de(st, 0, S.INF).length; assert(S.aplicar(st, 0, { t: 'reclutar', c: S.INF, u: cap.id }));
  assert(hasta(st, () => de(st, 0, S.INF).length === n0 + 1, D.clases[S.INF].obra + 5));
  const nueva = de(st, 0, S.INF).sort((a, b) => b.id - a.id)[0]; assert(Math.hypot(nueva.x - cap.x, nueva.y - cap.y) < 60);
});
t('vía logística: por camino propio y abastecido el camión va mucho más rápido', () => {
  const st = nuevo(); sinFuerzas(st); correr(st, 6);
  const R = D.relieve, T = st.ter, base = S.crear({ seed: 1, mapa: M }).unidades.find(u => u.s === 0 && u.c === S.BLI);
  const celda = ok => { for (let k = 0; k < T.cols * T.rows; k++) if (st.velT[1][k] === Math.fround(R.camino[1]) && ok(k)) return k; };
  const avance = (k, s) => { const u = { ...base, id: 800 + s, s, x: (k % T.cols + .5) * T.size, y: (Math.floor(k / T.cols) + .5) * T.size, st: S.MARCHA }; u.px = u.x; u.py = u.y; u.tx = u.x + 8; u.ty = u.y; st.unidades.push(u); const x0 = u.x; S.paso(st, null); return Math.abs(u.x - x0) + Math.abs(u.y - u.py); };
  const propia = celda(k => st.sum[0][k] === 1 && st.ter.ctrl[k] > 0 && st.sum[1][k] !== 1), a = avance(propia, 0), b = avance(propia, 1);
  assert(a > b * 2.2, `propio ${a} ajeno ${b}`);
});
t('despliegue: la reserva empieza en la capital, se coloca solo en territorio propio y el reloj espera', () => {
  const g = S.partida({ seed: 1, mapa: M, manual: true }), st = g.st, cap = capital(st, 1);
  assert(st.despliegue); for (const u of st.unidades.filter(u => u.s === 0)) assert(Math.hypot(u.x - cap.x, u.y - cap.y) < 90);
  for (let i = 0; i < 60; i++) S.avanzar(g); assert.strictEqual(st.t, 0, 'el reloj corrió');
  const ids = de(st, 0, S.INF).slice(0, 3).map(u => u.id), c = ciudad(st, 1);
  assert.strictEqual(S.aplicar(st, 0, { t: 'colocar', ids, x: st.bases[1].x, y: st.bases[1].y }), false);
  assert(S.aplicar(st, 0, { t: 'colocar', ids, x: c.x, y: c.y }));
  for (const id of ids) { const u = st.unidades.find(q => q.id === id); assert(Math.hypot(u.x - c.x, u.y - c.y) < 60); assert.strictEqual(u.st, S.DESPLEGADA); }
  assert(S.aplicar(st, 0, { t: 'iniciar' })); S.avanzar(g); assert.strictEqual(st.t, 1);
  assert.strictEqual(S.aplicar(st, 0, { t: 'colocar', ids, x: c.x, y: c.y }), false, 'colocó con la guerra empezada');
});
t('despliegue automático reparte la reserva por las ciudades del frente', () => {
  const g = S.partida({ seed: 1, mapa: M, manual: true }), st = g.st, cap = capital(st, 1);
  assert(S.aplicar(st, 0, { t: 'desplegarAuto' }));
  assert(de(st, 0, S.INF).every(u => Math.hypot(u.x - cap.x, u.y - cap.y) > 100));
});
t('una ciudad ocupada sin guardia se subleva y puede recuperarse sola', () => {
  const st = nuevo(), c = ciudad(st, -1);
  sinFuerzas(st); c.dueno = 1; c.ocupada = { por: 1, t: 0 }; c.guar = 0; c.barrios.forEach(b => { b.dueno = 1; }); c.res = .98;
  let rev = false;
  for (let i = 0; i < seg(600) && !rev; i++) { S.paso(st, null); rev = st.ev.some(e => e.k === 'revuelta' && e.id === c.id); }
  assert(rev, 'no hubo revuelta');
});
t('tomar la capital enemiga termina la partida', () => {
  const st = nuevo(), c = st.urbes.find(u => u.capital && u.dueno < 0), base = de(st, 0, S.INF)[0];
  st.unidades.length = 0; c.guar = 0; st.defensas.length = 0;
  for (let i = 0; i < 6; i++) st.unidades.push({ ...base, id: 500 + i, x: c.x + 12 * i, y: c.y + 10, st: S.DESPLEGADA });
  assert(hasta(st, () => st.fin, 2400)); assert.strictEqual(st.fin.causa, 'capital'); assert.strictEqual(st.fin.ganador, 0);
});
t('dos tercios de las ciudades, sostenidos, ganan por conquista', () => {
  const st = nuevo(); sinFuerzas(st); const meta = Math.ceil(st.urbes.length * D.victoria.fraccion);
  st.urbes.slice().sort((a, b) => a.capital - b.capital).forEach((u, i) => { if (!u.capital && i < meta) { u.dueno = 1; u.ocupada = null; u.orig = 1; u.barrios.forEach(b => { b.dueno = 1; }); } });
  assert(hasta(st, () => st.fin, D.victoria.segundos + 30)); assert.strictEqual(st.fin.causa, 'ciudades');
});

// Un punto transitable fuera de toda línea de abastecimiento propia y lejos de las ciudades.
const puntoAislado = (st, otro) => { const T = st.ter; for (let k = T.cols * T.rows - 1; k >= 0; k--) { const x = (k % T.cols + .5) * T.size, y = (Math.floor(k / T.cols) + .5) * T.size; if (st.sum[0][k] === 0 && st.sum[1][k] === 1 && st.urbes.every(u => Math.hypot(u.x - x, u.y - y) > 260) && (!otro || Math.hypot(otro.x - x, otro.y - y) > 400) && S.destinoValido(st, x, y)) return { x, y }; } };
t('cerco: una compañía detenida fuera de la línea avisa y luego se rinde', () => {
  const st = nuevo(), base = de(st, 0, S.INF)[0]; sinFuerzas(st); correr(st, 6);
  const p = puntoAislado(st); assert(p, 'no hay punto aislado');
  const u = { ...base, id: 700, x: p.x, y: p.y, tx: p.x, ty: p.y, st: S.DESPLEGADA, sinSum: 0 }; st.unidades.push(u);
  correr(st, D.cerco.aviso + 2); assert(st.ev.some(e => e.k === 'aislada' && e.id === 700), 'no avisó'); assert(!u.dead);
  correr(st, D.cerco.unidad - D.cerco.aviso + 2); assert(u.dead, 'no se rindió'); assert(st.ev.some(e => e.k === 'rendicion' && e.id === 700));
});
t('cerco: la columna en marcha no corre el reloj', () => {
  const st = nuevo(), base = de(st, 0, S.INF)[0]; sinFuerzas(st); correr(st, 6);
  const p = puntoAislado(st), q = puntoAislado(st, p); assert(p && q);
  const u = { ...base, id: 701, x: p.x, y: p.y, tx: q.x, ty: q.y, st: S.MARCHA, sinSum: 0, via: null }; st.unidades.push(u);
  correr(st, 12); assert.strictEqual(u.sinSum, 0);
});
t('cerco: una ciudad cortada del suministro avisa y capitula', () => {
  const st = nuevo(); sinFuerzas(st);
  const cap = st.urbes.find(u => u.capital && u.dueno > 0), c = st.urbes.filter(u => u.dueno > 0 && !u.capital).sort((a, b) => Math.hypot(b.x - cap.x, b.y - cap.y) - Math.hypot(a.x - cap.x, a.y - cap.y))[0];
  const propias = new Set([...cap.celdas, ...c.celdas]);
  c.desde = -1e6;   // lleva mucho en tus manos: no aplica la gracia de recién tomada
  for (let k = 0; k < st.ter.ctrl.length; k++) if (st.ter.ctrl[k] > 0 && !propias.has(k)) st.ter.ctrl[k] = -1;
  for (const u of st.urbes) if (u.dueno > 0 && u !== cap && u !== c) { u.dueno = 0; u.orig = 0; u.guar = 0; u.barrios.forEach(b => { b.dueno = 0; }); }   // neutrales: nadie gana por ciudades mientras tanto
  assert(hasta(st, () => st.ev.some(e => e.k === 'cercada' && e.id === c.id), D.cerco.aviso + 10), 'no avisó');
  assert.strictEqual(c.dueno, 1);
  assert(hasta(st, () => c.dueno === -1, D.cerco.ciudad + 20), 'no capituló');
  assert(st.ev.some(e => e.k === 'capitula' && e.id === c.id));
});
t('agotamiento: perder compañías y ciudades baja la moral; tomar ciudades la sube', () => {
  const st = nuevo(), u = de(st, 0, S.INF)[0]; correr(st, 1);
  const a0 = st.agot[0]; S.matar(st, u); assert(Math.abs(st.agot[0] - a0 - D.agotamiento.tierra) < 1e-9);
  const c = ciudad(st, -1), b0 = st.agot[1], a1 = st.agot[0]; S.caerCiudad(st, c, 1);
  assert(Math.abs(st.agot[1] - b0 - D.agotamiento.ciudad) < 1e-9); assert(st.agot[0] < a1);
});
t('agotamiento: un misil gastado no pesa', () => {
  const st = nuevo(); correr(st, 1); const a0 = st.agot[0];
  S.matar(st, { ...de(st, 0, S.INF)[0], id: 990, c: S.MISIL, aire: true }); assert.strictEqual(st.agot[0], a0);
});
t('agotamiento: quien llega primero a cero de moral colapsa, con avisos antes', () => {
  const st = nuevo(); sinFuerzas(st); st.agot[1] = .88;
  for (let i = 0; i < 30; i++) S.cansar(st, 1, D.agotamiento.tierra);
  assert(st.ev.some(e => e.k === 'moral' && e.s === 1 && e.nivel === .9), 'no avisó');
  correr(st, 2); assert(st.fin && st.fin.causa === 'colapso' && st.fin.ganador === 0, JSON.stringify(st.fin));
});
t('agotamiento: la moral baja reduce el ingreso', () => {
  const g = a => { const st = nuevo(); sinFuerzas(st); st.agot[0] = a; const c0 = st.creditos[0]; correr(st, 30); return st.creditos[0] - c0; };
  assert(g(.9) < g(0) * .75);
});
t('cerco: una ciudad recién tomada no cuenta como cercada', () => {
  const st = nuevo(); sinFuerzas(st); const c = ciudad(st, -1);
  S.caerCiudad(st, c, 1); c.barrios.forEach(b => { b.dueno = 1; }); c.guar = 20;
  correr(st, D.cerco.aviso + 30); assert.strictEqual(c.cerco, 0); assert(!st.ev.some(e => e.k === 'cercada' && e.id === c.id));
});
t('cerco: la capital no capitula', () => {
  const st = nuevo(); sinFuerzas(st); const cap = st.urbes.find(u => u.capital && u.dueno > 0);
  correr(st, 30); assert.strictEqual(cap.cerco, 0);
});

/* ---------- Los cuatro paquetes de realismo ---------- */
// Un escenario limpio: solo las unidades que la prueba pone, lejos de las ciudades, en llanura propia.
const llano = (st, lado = 0) => { const T = st.ter; for (let k = 0; k < T.cols * T.rows; k++) { const x = (k % T.cols + .5) * T.size, y = (Math.floor(k / T.cols) + .5) * T.size; if (st.sum[lado][k] === 1 && st.sum[1 - lado][k] === 0 && st.mapa.areas[k] === 0 && st.urbes.every(u => Math.hypot(u.x - x, u.y - y) > 420) && st.defensas.every(d => Math.hypot(d.x - x, d.y - y) > 420) && S.transitable(st, k) && S.transitable(st, k + 26)) return { x, y }; } };
const pon = (st, s, c, x, y, extra = {}) => { const m = S.crear({ seed: 9, mapa: M }).unidades.find(u => u.c === c && u.s === 0); const u = { ...m, id: st.sigId++, s, x, y, px: x, py: y, tx: x, ty: y, st: S.DESPLEGADA, ...extra }; st.unidades.push(u); S.indexar(st); return u; };
const limpio = () => { const st = nuevo(); sinFuerzas(st); correr(st, 6); st.tormenta = 0; return st; };
t('artillería: bate a distancia lo que su bando ve, y no lo que no ve', () => {
  const st = limpio(), p = llano(st, 1); assert(p);   // en tierra enemiga: nada propio la vigila
  const a = pon(st, 0, S.ART, p.x, p.y), b = pon(st, 1, S.INF, p.x + 300, p.y), f0 = b.fuerza;
  S.vision(st); assert(!st.vis[0][S.celdaDe(st, b.x, b.y)], 'la prueba necesita un blanco fuera de vista');
  correr(st, 20); assert.strictEqual(b.fuerza, f0, 'disparó a ciegas');
  pon(st, 0, S.INF, p.x + 230, p.y);   // un observador adelantado
  assert(hasta(st, () => b.fuerza < f0 || b.dead, 40), 'no disparó con observador'); assert(a.mun < 1);
});
t('artillería: disparar la delata y la batería enemiga responde (contrabatería)', () => {
  const st = limpio(), p = llano(st, 1);
  const a = pon(st, 0, S.ART, p.x, p.y), obs = pon(st, 0, S.INF, p.x + 230, p.y), blanco = pon(st, 1, S.INF, p.x + 300, p.y), e = pon(st, 1, S.ART, p.x + 380, p.y + 120), f0 = a.fuerza;
  assert(hasta(st, () => a.delata > st.t, 30), 'no se delató');
  assert(S.vista(st, 1).contactos.some(w => w.id === a.id), 'el enemigo no la localiza');
  assert(hasta(st, () => a.fuerza < f0 || a.dead, 60), 'no hubo contrabatería'); void obs; void blanco; void e;
});
t('artillería y antiaérea se emplazan: tardan en estar listas al llegar', () => {
  const st = limpio(), p = llano(st), a = pon(st, 0, S.ART, p.x, p.y);
  S.aplicar(st, 0, { t: 'mover', ids: [a.id], x: p.x + 60, y: p.y }); assert.strictEqual(a.st, S.EMBARCANDO);
  assert(hasta(st, () => a.st === S.DESEMBARCANDO, 120)); assert(hasta(st, () => a.st === S.DESPLEGADA, D.embarque.bajar + 2));
});
t('antiaérea móvil: emplazada, derriba a los aviones que atacan cerca', () => {
  const st = limpio(), b = st.bases[0]; assert(intruso(st, b)); pon(st, 0, S.AAM, b.x + 40, b.y - 20); pon(st, 0, S.AAM, b.x - 30, b.y + 30);
  const n0 = st.stats.bajas[1]; correr(st, 90); assert(st.stats.bajas[1] > n0, 'no derribó nada');
  assert.strictEqual(de(st, 0, S.CAZA).filter(u => u.aire).length, 0, 'no debía haber cazas');
});
t('quiebre: muy castigada, se quiebra, se retira sola y no obedece; en retaguardia se rehace', () => {
  const st = limpio(), p = llano(st), u = pon(st, 0, S.INF, p.x, p.y);
  S.danar(st, u, 7.2); assert(u.rota && !u.dead, 'no se quebró'); assert(st.ev.some(e => e.k === 'quiebre' && e.id === u.id));
  assert.notStrictEqual(u.st, S.DESPLEGADA, 'no se retira');
  const tx = u.tx, ty = u.ty; S.aplicar(st, 0, { t: 'mover', ids: [u.id], x: p.x + 500, y: p.y });
  assert(u.tx === tx && u.ty === ty, 'obedeció estando quebrada');
  assert(hasta(st, () => !u.rota, 2400), 'no se rehízo'); assert(u.fuerza >= 10 * D.quiebre.recupera - .1);
});
t('fortificación: la tropa que lleva tiempo quieta recibe menos daño', () => {
  const st = limpio(), p = llano(st), a = pon(st, 0, S.INF, p.x, p.y), b = pon(st, 0, S.INF, p.x + 200, p.y);
  correr(st, D.fortificacion.segundos + 2); b.fort = 0;
  assert(a.fort > .98, 'fort ' + a.fort); const fa = a.fuerza, fb = b.fuerza; S.danar(st, a, 2); S.danar(st, b, 2);
  assert(Math.abs((fa - a.fuerza) / (fb - b.fuerza) - (1 - D.fortificacion.max)) < .01, `${fa - a.fuerza} ${fb - b.fuerza}`);
  S.aplicar(st, 0, { t: 'mover', ids: [a.id], x: p.x + 40, y: p.y }); assert.strictEqual(a.fort, 0, 'moverse no la desatrinchera');
});
t('munición: pelear la gasta, sin ella se pega mucho menos, y se repone de la reserva dentro de la red', () => {
  const st = limpio(), q = puntoAislado(st), p = llano(st), a = pon(st, 0, S.BLI, q.x, q.y), b = pon(st, 1, S.BLI, q.x + 50, q.y, { fuerza: 999, cd: 1e9 });
  assert(hasta(st, () => a.mun < .9, 60), 'no gastó');
  const pega = mun => { const w = limpio(), z = puntoAislado(w), x = pon(w, 0, S.BLI, z.x, z.y, { mun }), y = pon(w, 1, S.INF, z.x + 50, z.y, { fuerza: 999, mun: 0, cd: 1e9 }); w.sem = 5; hasta(w, () => y.fuerza < 999, 20); void x; return 999 - y.fuerza; };
  assert(Math.abs(pega(0) / pega(1) - D.abastos.sinMunicion) < .01);
  b.dead = true; a.x = a.px = a.tx = p.x; a.y = a.py = a.ty = p.y; a.mun = .2; S.indexar(st); st.abastos[0] = 30;
  assert(hasta(st, () => a.mun > .999, 120), 'no repuso'); assert(st.abastos[0] < 30 + 12 - .7, 'no salió de la reserva');
});
t('combustible: marchar lo gasta; sin combustible la columna se detiene y no acepta órdenes de marcha', () => {
  const st = limpio(), p = puntoAislado(st), u = pon(st, 0, S.BLI, p.x, p.y, { comb: .004 });
  S.aplicar(st, 0, { t: 'mover', ids: [u.id], x: p.x - 400, y: p.y }); correr(st, 2); assert.strictEqual(u.st, S.DESPLEGADA, 'aceptó la orden');
  const r = D.abastos.repone.comb; D.abastos.repone.comb = 0;   // sin reposición, para medir solo el gasto
  try {
    u.comb = .02; S.aplicar(st, 0, { t: 'mover', ids: [u.id], x: p.x - 400, y: p.y });
    assert(hasta(st, () => st.ev.some(e => e.k === 'sinCombustible' && e.id === u.id), 240), 'no se quedó seca'); assert(Math.hypot(u.x - p.x, u.y - p.y) < 200);
  } finally { D.abastos.repone.comb = r; }
});
t('reserva nacional: entra por las ciudades y los depósitos amplían lo que cabe', () => {
  const st = limpio(); st.abastos[0] = 0; correr(st, 30); assert(st.abastos[0] > 2);
  st.abastos[0] = 9999; correr(st, 2); assert.strictEqual(st.abastos[0], D.abastos.reserva.base);
});
t('radar: encendido se delata aunque no lo vean; apagado no ve y no lo oyen', () => {
  const st = limpio(), b0 = st.bases[0], c = st.urbes.filter(u => u.dueno > 0 && !u.capital).sort((x, y) => Math.hypot(x.x - b0.x, x.y - b0.y) - Math.hypot(y.x - b0.x, y.y - b0.y))[0], k = [[90, 0], [0, 90], [-90, 0], [0, -90], [140, 60]].find(([dx, dy]) => S.puedeConstruir(st, 0, S.RADAR, c.x + dx, c.y + dy) === ''); assert(k, 'sin sitio');
  assert(S.aplicar(st, 0, { t: 'construir', d: S.RADAR, x: c.x + k[0], y: c.y + k[1] }));
  const r = st.defensas.find(d => d.s === 0 && d.t === S.RADAR); correr(st, D.instalaciones.tipos[S.RADAR].obra + 3);
  assert(S.vista(st, 1).defensasE.some(d => d.id === r.id), 'el enemigo no lo oye');
  const ve = () => st.vis[0].reduce((a, b) => a + b, 0), encendido = ve();
  assert(S.aplicar(st, 0, { t: 'radar', id: r.id, on: false })); st.memDef[1].clear(); correr(st, 2);
  assert(!S.vista(st, 1).defensasE.some(d => d.id === r.id), 'apagado se delata'); assert(ve() < encendido, `apagado sigue viendo ${ve()} ${encendido}`);
  assert.strictEqual(S.aplicar(st, 1, { t: 'radar', id: r.id, on: true }), false);
});
t('reloj, noche y tormenta: se ve menos de noche y la aviación acierta la mitad con tormenta', () => {
  const st = limpio(), p = llano(st);
  assert.strictEqual(S.minutoDe({ t: 0 }), 360); assert(!S.esNoche({ t: 0 })); assert(S.esNoche({ t: 30 * (1200 - 360) })); assert(!S.esNoche({ t: 30 * 1440 }));
  const u = pon(st, 0, S.INF, p.x, p.y), borde = S.celdaDe(st, p.x + 80, p.y);
  S.vision(st); assert(st.vis[0][borde]); const t0 = st.t; st.t = 30 * (1200 - 360) + 30; S.vision(st); assert(!st.vis[0][borde], 'de noche ve igual'); st.t = t0; void u;
  const dano = tormenta => { const q = limpio(), z = llano(q), w = pon(q, 1, S.INF, z.x, z.y, { st: S.MARCHA }), f = w.fuerza; q.sem = 77; q.tormenta = tormenta ? 1e9 : 0; S.golpear(q, 0, z.x, z.y, 'golpe', { c: S.DRON, aire: true }); return f - w.fuerza; };
  const claro = dano(false), malo = dano(true); assert(Math.abs(malo / claro - D.clima.aire) < .01, `${claro} ${malo}`);
});
t('ingenieros: infantería junto a un puente roto lo repara antes', () => {
  const tarda = conTropa => { const st = limpio(), k = st.puentes[0], x = (k % st.ter.cols + .5) * 16, y = (Math.floor(k / st.ter.cols) + .5) * 16; st.roto[k] = st.t + 30 * 400; st.rotos.push(k); if (conTropa) pon(st, 0, S.INF, x + 30, y); const t0 = st.t; hasta(st, () => !st.roto[k], 420); return (st.t - t0) / 30; };
  const sola = tarda(false), ayudada = tarda(true); assert(ayudada < sola * .5, `${sola} ${ayudada}`);
});
t('orden: lejos de la red tarda más en cumplirse', () => {
  const st = limpio(), p = llano(st), q = puntoAislado(st), a = pon(st, 0, S.BLI, p.x, p.y), b = pon(st, 0, S.BLI, q.x, q.y);
  S.aplicar(st, 0, { t: 'mover', ids: [a.id], x: p.x + 60, y: p.y }); S.aplicar(st, 0, { t: 'mover', ids: [b.id], x: q.x + 60, y: q.y });
  assert(Math.abs(b.t - a.t - D.orden.lejos) < .01);
});

/* ---------- Doctrina y niveles de automatización ---------- */
t('doctrina: un cambio tarda en llegar; durante el despliegue es inmediato', () => {
  const st = limpio(); assert(S.aplicar(st, 0, { t: 'doctrina', artilleria: 'silencio' }));
  assert.strictEqual(st.doctrina[0].artilleria, 'libre'); correr(st, D.doctrina.demora + 2); assert.strictEqual(st.doctrina[0].artilleria, 'silencio');
  assert.strictEqual(S.aplicar(st, 0, { t: 'doctrina', artilleria: 'disparate' }), false);
  const g = S.partida({ seed: 1, mapa: M, manual: true }); S.aplicar(g.st, 0, { t: 'doctrina', postura: 'defensiva' }); assert.strictEqual(g.st.doctrina[0].postura, 'defensiva');
});
t('doctrina de artillería: en silencio no dispara; en contrabatería solo responde a baterías', () => {
  const caso = roe => { const st = limpio(), p = llano(st, 1); st.doctrina[0].artilleria = roe; pon(st, 0, S.ART, p.x, p.y); pon(st, 0, S.INF, p.x + 230, p.y); const b = pon(st, 1, S.INF, p.x + 300, p.y, { cd: 1e9 }), f = b.fuerza; correr(st, 30); return f - b.fuerza; };
  assert(caso('libre') > 0); assert.strictEqual(caso('silencio'), 0); assert.strictEqual(caso('contra'), 0);
});
t('doctrina de preservación: la unidad se repliega por orden antes de quebrarse, y sigue obedeciendo', () => {
  const st = limpio(), p = llano(st), u = pon(st, 0, S.INF, p.x, p.y); st.doctrina[0].preservar = .5;
  S.danar(st, u, 5.5); assert(!u.rota, 'se quebró'); assert(st.ev.some(e => e.k === 'repliegue' && e.id === u.id), 'no se replegó'); assert.notStrictEqual(u.st, S.DESPLEGADA);
  assert(S.aplicar(st, 0, { t: 'mover', ids: [u.id], x: p.x + 80, y: p.y })); assert(Math.abs(u.tx - (p.x + 80)) < 30, 'no obedece');
  const w = pon(st, 0, S.INF, p.x, p.y + 100); st.doctrina[0].preservar = 0; S.danar(st, w, 5.5); assert.strictEqual(w.st, S.DESPLEGADA, 'se replegó sin doctrina');
});
t('doctrina de emisiones: el radar calla hasta que su bando ve algo volando cerca', () => {
  const st = limpio(), b = st.bases[0]; assert(S.aplicar(st, 0, { t: 'construir', d: S.RADAR, x: b.x + 140, y: b.y - 60 }));
  const r = st.defensas.find(d => d.s === 0 && d.t === S.RADAR); correr(st, D.instalaciones.tipos[S.RADAR].obra + 3);
  st.doctrina[0].emisiones = 'amenaza'; correr(st, 3); assert(r.off, 'no calló');
  const aa = st.defensas.filter(d => d.t !== S.PISTA && d !== r); st.defensas.splice(0, st.defensas.length, ...st.defensas.filter(d => !aa.includes(d)));
  const p = pista(st, 1); p.x = b.x + 620; p.y = b.y - 200; assert(S.aplicar(st, 1, { t: 'mision', tipo: 'golpe', x: b.x, y: b.y, paquete: { [S.ATAQUE]: 2 } }));
  assert(hasta(st, () => !r.off, 90), 'no encendió ante la amenaza');
});
const staff = nivel => { const g = S.partida({ seed: 21, mapa: M, ia1: 'equilibrada' }); S.estadoMayor(g, nivel); return g; };
const corre = (g, s) => { for (let i = 0; i < seg(s) && !g.st.fin; i++) S.avanzar(g); };
t('nivel baja: el estado mayor recluta y compra, pero no designa áreas ni lanza misiones aéreas', () => {
  const g = staff('baja'), st = g.st; corre(g, 420);
  assert(st.colas[0].length + st.unidades.filter(u => u.s === 0 && !u.aire).length > 13, 'no reclutó');
  assert.strictEqual(st.zonas.filter(z => z.s === 0).length, 0); assert(!st.misiones.some(m => m.s === 0 && m.tipo !== 'refuerzo'));
});
t('nivel media: además designa áreas de control y hace reconocimiento, sin atacar', () => {
  const g = staff('media'), st = g.st; corre(g, 600);
  assert(st.zonas.filter(z => z.s === 0).length >= 1, 'sin áreas'); assert(!st.misiones.some(m => m.s === 0 && ['asalto', 'golpe', 'bombardeo', 'supresion'].includes(m.tipo)));
});
t('nivel alta: no ataca hasta que el mando marca un objetivo, y entonces ataca ese', () => {
  const g = staff('alta'), st = g.st; corre(g, 900);
  assert(!st.misiones.some(m => m.s === 0 && m.tipo === 'asalto'), 'atacó sin objetivo');
  const c = cerca(st); assert(S.aplicar(st, 0, { t: 'objetivo', id: c.id, on: true }));
  let visto = false; for (let i = 0; i < seg(2400) && !visto && !st.fin; i++) { S.avanzar(g); visto = st.misiones.some(m => m.s === 0 && m.tipo === 'asalto'); }
  assert(visto, 'no atacó el objetivo marcado');
  assert(st.misiones.filter(m => m.s === 0 && m.tipo === 'asalto').every(m => Math.hypot(m.x - c.x, m.y - c.y) < 5), 'atacó otra ciudad');
});
t('nivel total: el estado mayor elige objetivo y ataca solo; manual lo apaga', () => {
  const g = staff('total'), st = g.st; let visto = false;
  for (let i = 0; i < seg(2400) && !visto && !st.fin; i++) { S.avanzar(g); visto = st.misiones.some(m => m.s === 0 && m.tipo === 'asalto'); }
  assert(visto, 'no atacó'); S.estadoMayor(g, 'manual'); assert.strictEqual(g.ias[0], null); assert.strictEqual(st.doctrina[0].nivel, 'manual');
});
t('una orden directa del jugador manda sobre el estado mayor; las del estado mayor no se marcan', () => {
  const g = staff('total'), st = g.st, u = de(st, 0, S.INF)[0];
  S.avanzar(g, [{ t: 'mover', ids: [u.id], x: u.x + 60, y: u.y }]); assert(u.manual > st.t, 'no quedó marcada');
  corre(g, 300); assert(st.unidades.filter(w => w.s === 0 && !w.aire && w.id !== u.id).every(w => !(w.manual > 0)), 'el estado mayor marcó unidades');
});
t('guardar conserva doctrina, objetivos y nivel', () => {
  const g = staff('alta'), st = g.st; S.aplicar(st, 0, { t: 'objetivo', id: cerca(st).id, on: true }); st.doctrina[0].postura = 'ofensiva'; corre(g, 30);
  const b = S.deserializar(S.serializar(st)); assert.deepStrictEqual(b.doctrina[0], st.doctrina[0]);
});

t('las ciudades pagan créditos con el tiempo', () => {
  const st = nuevo(); sinFuerzas(st); const c0 = st.creditos[0]; correr(st, 60); assert(st.creditos[0] > c0 + 20);
});
t('GOD: solo el jugador; construye y recluta sin pagar', () => {
  const st = nuevo(), c = st.urbes.find(u => u.capital && u.dueno > 0), c0 = st.creditos[0];
  assert.strictEqual(S.aplicar(st, 1, { t: 'god', on: true }), false); assert(!st.god);
  assert(S.aplicar(st, 0, { t: 'god', on: true }));
  assert(S.aplicar(st, 0, { t: 'reclutar', c: S.BLI, u: c.id })); assert.strictEqual(st.creditos[0], c0);
});
t('cupo de tierra: el territorio limita cuántas compañías se sostienen', () => {
  const st = nuevo(), c = capital(st, 1), q = S.cupoTierra(st, 0);
  assert.strictEqual(q.tope, D.ejercito.base + st.urbes.filter(u => u.dueno > 0).length);
  const base = de(st, 0, S.INF)[0];
  for (let i = q.usadas; i < q.tope; i++) st.unidades.push({ ...base, id: 4000 + i, dead: false });
  st.creditos[0] = 9999;
  assert(S.puedeReclutar(st, 0, S.INF, c.id).startsWith('tope'));
  S.aplicar(st, 0, { t: 'god', on: true });
  assert.strictEqual(S.puedeReclutar(st, 0, S.INF, c.id), '');
});
t('construir: solo en territorio propio, cobra y cancelar devuelve', () => {
  const st = nuevo(), c0 = st.creditos[0], b = st.bases[0], x = b.x + 150, y = b.y - 40;
  assert.notStrictEqual(S.puedeConstruir(st, 0, S.AA, st.bases[1].x, st.bases[1].y), '');
  assert(S.aplicar(st, 0, { t: 'construir', d: S.FORTIN, x, y, m: 55 }));
  assert.strictEqual(st.creditos[0], c0 - D.instalaciones.tipos[S.FORTIN].costo);
  assert(S.aplicar(st, 0, { t: 'cancelar', m: 55 })); assert.strictEqual(st.creditos[0], c0);
});

t('niebla: la IA no ve lo que no ha detectado', () => {
  const st = nuevo(); correr(st, 2);
  const v = S.vista(st, 1), lejos = de(st, 0, S.INF).filter(u => !st.vis[1][S.celdaDe(st, u.x, u.y)]);
  assert(lejos.length > 0, 'la prueba necesita tropas fuera de vista');
  for (const u of lejos) assert(!v.contactos.some(w => w.id === u.id), 'filtró ' + u.id);
});
t('los barrios de una ciudad enemiga no visible no se revelan', () => {
  const st = nuevo(); correr(st, 2);
  const v = S.vista(st, 0), oculta = v.ciudades.find(c => c.dueno < 0 && !st.vis[0][S.celdaDe(st, c.x, c.y)]);
  assert(oculta); assert(!oculta.barrios || !oculta.barrios.length);
});

t('determinismo: misma semilla, misma partida', () => {
  const uno = () => { const g = S.partida({ seed: 3, mapa: M, ia0: 'equilibrada', ia1: 'aerea' }); for (let i = 0; i < seg(600); i++) S.avanzar(g); return S.hash(g.st); };
  assert.strictEqual(uno(), uno());
});
t('guardar restaura el estado y la partida continúa', () => {
  const g = S.partida({ seed: 5, mapa: M, ia0: 'equilibrada', ia1: 'terrestre' }); for (let i = 0; i < seg(400); i++) S.avanzar(g);
  const b = S.deserializar(S.serializar(g.st));
  assert.strictEqual(S.hash(b), S.hash(g.st), 'el estado cargado difiere');
  for (let i = 0; i < seg(120); i++) { S.paso(g.st, null); S.paso(b, null); }
  // Las rutas se recalculan al cargar y pueden elegir otro desempate: la partida sigue, no idéntica al tick.
  assert(Math.abs(b.unidades.length - g.st.unidades.length) <= 3);
  for (const u of b.unidades) assert(Number.isFinite(u.x) && Number.isFinite(u.fuerza));
  assert.deepStrictEqual(b.urbes.filter(u => u.dueno > 0).length, g.st.urbes.filter(u => u.dueno > 0).length);
});
t('un archivo que no es partida se rechaza con un error claro', () => { assert.throws(() => S.deserializar('{"formato":"otro"}'), /partida guardada/); });
t('partida IA contra IA sin NaN ni unidades fuera del mapa', () => {
  const g = S.partida({ seed: 11, mapa: M, ia0: 'metodica', ia1: 'aerea' }), st = g.st;
  for (let i = 0; i < seg(1800) && !st.fin; i++) S.avanzar(g);
  for (const u of st.unidades) { assert(Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.fuerza), 'NaN en ' + u.id); assert(u.x >= -50 && u.y >= -50 && u.x <= st.W + 50 && u.y <= st.H + 50, 'fuera ' + u.id); }
  assert(st.creditos.every(Number.isFinite));
  assert(st.creditos.every(c => c > -1), 'créditos negativos');
});
console.log(`\n${n} pruebas pasaron${fallos ? `, ${fallos} FALLARON` : ''}`);
process.exitCode = fallos ? 1 : 0;
