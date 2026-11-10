process.env.ATLAS_DIV = '3';
const assert = require('assert');
const A = require('./mapa.js');
let n = 0;
const t = (nombre, f) => { f(); n++; console.log('ok  ' + nombre); };
const { COLS, ROWS, CELDA, W, H, N } = A;

t('segmento: la conversión a celdas es 4-conexa', () => {
  for (const [a, b, c, d] of [[3, 3, 800, 500], [800, 12, 7, 490], [0, 250, 831, 251], [401, 0, 402, 511], [16, 16, 480, 480]]) {
    const l = [];
    A.celdasDeSegmento(a, b, c, d, (i, j) => l.push([i, j]));
    for (let k = 1; k < l.length; k++) assert.strictEqual(Math.abs(l[k][0] - l[k - 1][0]) + Math.abs(l[k][1] - l[k - 1][1]), 1, 'salto');
  }
});
const riv = () => { const m = A.crearVacio(); m.simetria = false; return m; };
t('río de borde a borde corta la ruta terrestre', () => {
  const m = riv();
  A.agregarLinea(m, 'rio', [832, 0, 800, 300, 880, 600, 832, 1024]);
  const d = A.derivar(m);
  assert.strictEqual(d.hayRuta, false);
  assert(d.avisos.some(a => a.includes('ruta')));
});
t('río diagonal no deja atajos', () => {
  const m = riv();
  A.agregarLinea(m, 'rio', [0, 0, 1664, 1024]);
  // Bases en BL y TR: la diagonal TL–BR las separa.
  assert.strictEqual(A.derivar(m).hayRuta, false);
});
t('un camino que cruza el río crea un puente y abre la ruta', () => {
  const m = riv();
  A.agregarLinea(m, 'rio', [832, 0, 800, 300, 880, 600, 832, 1024]);
  A.agregarLinea(m, 'camino', [100, 600, 1500, 520]);
  const d = A.derivar(m);
  assert.strictEqual(d.puentes, 1);
  assert.strictEqual(d.hayRuta, true);
});
t('agua pintada de lado a lado también bloquea', () => {
  const m = riv();
  for (let j = 0; j < ROWS; j++) A.pintar(m, 25 * CELDA, (j + .5) * CELDA, 1, A.AGUA);
  assert.strictEqual(A.derivar(m).hayRuta, false);
});
t('sin atajos por esquinas entre celdas de agua en diagonal', () => {
  const m = riv();
  for (let k = 0; k < Math.min(COLS, ROWS); k++) { m.areas[A.idx(COLS - 1 - k, ROWS - 1 - k)] = A.AGUA; }
  for (let i = 0; i < COLS - ROWS; i++) m.areas[A.idx(i, 0)] = A.AGUA;
  const d = A.derivar(m);
  assert.strictEqual(d.hayRuta, false, 'la diagonal cierra el paso');
});
t('frontera de borde a borde separa las bases y reparte el mapa', () => {
  const m = riv();
  A.agregarLinea(m, 'frontera', [0, 0, 1664, 1024]);
  const d = A.derivar(m);
  assert.strictEqual(d.separa, true);
  const [ax, ay] = [Math.floor(A.BASES[0].x / CELDA), Math.floor(A.BASES[0].y / CELDA)];
  assert.strictEqual(d.lado[A.idx(ax, ay)], 1);
  assert.strictEqual(d.lado[A.idx(COLS - 1 - ax, ROWS - 1 - ay)], -1);
  assert(d.lado.every(v => v === 1 || v === -1), 'toda celda tiene lado');
});
t('frontera incompleta no separa y avisa', () => {
  const m = riv();
  A.agregarLinea(m, 'frontera', [200, 100, 600, 300]);
  const d = A.derivar(m);
  assert.strictEqual(d.separa, false);
  assert(d.avisos.some(a => a.includes('no separa')));
});
t('limpiarTrazo lleva los extremos al borde', () => {
  const q = A.limpiarTrazo([12, 100, 100, 110, 200, 90, 300, 100, 1652, 1012], false);
  assert.strictEqual(q[0], 0);
  assert.strictEqual(q[q.length - 2], W); assert.strictEqual(q[q.length - 1], H);
});
t('limpiarTrazo con reflejo cierra en el centro', () => {
  const q = A.limpiarTrazo([400, 2, 600, 200, 821, 506], true);
  assert.strictEqual(q[q.length - 2], W / 2); assert.strictEqual(q[q.length - 1], H / 2);
  assert.strictEqual(q[1], 0);
});
t('reflejo: pincel y líneas salen simétricos, y la frontera reparte en espejo', () => {
  const m = A.crearVacio();
  A.pintar(m, 200, 150, 40, A.BOSQUE);
  A.agregarLinea(m, 'frontera', A.limpiarTrazo([360, 4, 520, 240, 680, 360, 824, 504], true));
  for (let k = 0; k < N; k++) assert.strictEqual(m.areas[k], m.areas[N - 1 - k]);
  assert.strictEqual(m.lineas.length, 2);
  assert.strictEqual(m.lineas[0].g, m.lineas[1].g);
  const d = A.derivar(m);
  assert.strictEqual(d.separa, true);
  for (let k = 0; k < N; k++) assert.strictEqual(d.lado[k], -d.lado[N - 1 - k], 'lado en espejo');
});
t('borrar una línea quita también su reflejo', () => {
  const m = A.crearVacio();
  A.agregarLinea(m, 'rio', [100, 100, 300, 300]);
  A.agregarLinea(m, 'camino', [500, 100, 500, 400]);
  assert.strictEqual(A.quitarLineaCerca(m, 200, 203, 8), true);
  assert.strictEqual(m.lineas.length, 2);
  assert(m.lineas.every(l => l.t === 'camino'));
  assert.strictEqual(A.quitarLineaCerca(m, 5, 500, 8), false);
});
t('muestrear respeta el ciclo', () => {
  const xs = [];
  A.muestrear([0, 0, 100, 0], 10, [[0, 1], [4, 2]], (x, y, r) => xs.push([x, r]));
  assert.deepStrictEqual(xs.slice(0, 4).map(([x, r]) => [Math.round(x * 1e6) / 1e6, r]), [[0, 1], [4, 2], [10, 1], [14, 2]]);
  assert(xs[xs.length - 1][0] <= 100);
});
t('JSON: ida y vuelta sin pérdida', () => {
  const m = A.ejemplo();
  const r = A.deJSON(A.aJSON(m));
  assert.deepStrictEqual(Array.from(r.areas), Array.from(m.areas));
  assert.strictEqual(r.lineas.length, m.lineas.length);
  assert.strictEqual(r.nombre, m.nombre);
  const d0 = A.derivar(m), d1 = A.derivar(r);
  assert.strictEqual(d0.puentes, d1.puentes);
  assert.strictEqual(d0.separa, d1.separa);
});
t('JSON: un mapa antiguo de 52×32 se convierte al tamaño nuevo', () => {
  const v1 = { formato: 'doctrina-mapa', v: 1, nombre: 'viejo', cols: 52, rows: 32, celda: 16, simetria: true, areas: 'a1b' + (52 * 32 - 2) + 'c1', lineas: [{ t: 'rio', g: 1, p: [10, 20, 400, 300] }] };
  const m = A.deJSON(JSON.stringify(v1));
  assert.strictEqual(m.areas.length, N);
  for (const k of [0, 1, A.COLS, A.COLS + 1]) assert.strictEqual(m.areas[k], A.AGUA, 'la celda vieja ocupa cuatro');
  assert.strictEqual(m.areas[2], A.BOSQUE);
  assert.strictEqual(m.areas[N - 1], A.CIUDAD);
  assert.deepStrictEqual(m.lineas[0].p, [20, 40, 800, 600]);
  assert.strictEqual(JSON.parse(A.aJSON(m)).v, 3);
});
t('JSON: rechaza lo inválido con mensaje claro', () => {
  const buena = JSON.parse(A.aJSON(A.ejemplo()));
  const caso = (o, frag) => assert.throws(() => A.deJSON(typeof o === 'string' ? o : JSON.stringify(o)), e => e.message.includes(frag), frag);
  caso('{no', 'JSON válido');
  caso({ formato: 'otro' }, 'no es un mapa');
  caso({ ...buena, v: 9 }, 'Versión');
  caso({ ...buena, cols: 10 }, 'debe medir');
  caso({ ...buena, areas: 'l5' }, 'no cubre');
  caso({ ...buena, areas: 'x' + N }, 'no cubre');
  caso({ ...buena, lineas: [{ t: 'muro', p: [0, 0, 1, 1] }] }, 'línea');
  caso({ ...buena, lineas: [{ t: 'rio', p: [0, 0, 1] }] }, 'línea');
  caso({ ...buena, lineas: [{ t: 'rio', p: [0, 0, null, 1] }] }, 'línea');
});
t('ejemplo: válido, simétrico y con puentes', () => {
  const m = A.ejemplo();
  const d = A.derivar(m);
  assert.deepStrictEqual(d.avisos, []);
  assert.strictEqual(d.separa, true); assert.strictEqual(d.hayRuta, true);
  assert(d.puentes >= 4, `puentes ${d.puentes}`);
  for (let k = 0; k < N; k++) { assert.strictEqual(m.areas[k], m.areas[N - 1 - k]); assert.strictEqual(d.lado[k], -d.lado[N - 1 - k]); }
  for (const t2 of [A.AGUA, A.BOSQUE, A.MONTANA, A.CIUDAD]) assert(d.cuenta[t2] > 0, 'falta terreno ' + t2);
  const c = A.costas(m);
  assert(c.length >= 2 && c.every(p => p.length >= 8));
});
t('ejemplo: sin los puentes, cada base queda aislada', () => {
  const m = A.ejemplo();
  m.lineas = m.lineas.filter(l => l.t !== 'camino');
  assert.strictEqual(A.derivar(m).hayRuta, false);
});
console.log(`\n${n} pruebas pasaron`);
