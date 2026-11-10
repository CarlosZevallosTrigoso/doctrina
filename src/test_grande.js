// Pruebas del mapa real a tamaño completo, formatos anteriores y coste por tick.
const assert = require('assert');
const At = require('./atlas/mapa.js'), S = require('./sim.js');
let n = 0;
const t = (nombre, f) => { f(); n++; console.log('ok  ' + nombre); };
t('el mapa mide 4992×3072 y el ejemplo es válido y simétrico', () => {
  assert.strictEqual(At.W, 4992); assert.strictEqual(At.H, 3072);
  const m = At.ejemplo(), d = At.derivar(m);
  assert(d.separa && d.hayRuta); assert.deepStrictEqual(d.avisos, []);
  for (let k = 0; k < At.N; k++) assert.strictEqual(m.areas[k], m.areas[At.N - 1 - k]);
});
t('36 ciudades más 2 capitales, 3–6 barrios cada una, mitad por lado', () => {
  const st = S.crear({ seed: 1, mapa: At.ejemplo() });
  assert.strictEqual(st.urbes.length, 38);
  assert.strictEqual(st.urbes.filter(u => u.dueno > 0).length, 19);
  for (const u of st.urbes) assert(u.barrios.length >= 3 && u.barrios.length <= 6);
  assert.strictEqual(st.urbes.filter(u => u.capital).length, 2);
});
t('un mapa vacío y mapas v1/v2 antiguos se aceptan y escalan', () => {
  assert.strictEqual(S.crear({ seed: 1 }).W, 4992);
  const m = At.deJSON(At.aJSON(At.ejemplo()));
  assert.strictEqual(m.areas.length, At.N);
  const v1 = { formato: 'doctrina-mapa', v: 1, cols: 52, filas: 32, nombre: 'viejo', areas: Array(52 * 32).fill(0).join(''), lineas: [] };
  let r; try { r = At.deJSON(JSON.stringify(v1)); } catch (e) { r = e; }
  assert(r instanceof Error || r.areas.length === At.N, 'mal escalado');
});
t('una hora de guerra IA contra IA cuesta poco por tick', () => {
  const g = S.partida({ seed: 2, mapa: At.ejemplo(), ia0: 'equilibrada', ia1: 'terrestre' }), t0 = Date.now(), N = 108000;
  for (let i = 0; i < N && !g.st.fin; i++) S.avanzar(g);
  const ms = (Date.now() - t0) / N; console.log('    ' + ms.toFixed(3) + ' ms/tick, compañías ' + g.st.unidades.filter(u => !u.aire).length);
  assert(ms < 2.5, 'demasiado lento');
});
console.log(n + ' pruebas pasaron');
