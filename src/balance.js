// Partidas IA contra IA: duración, decisión y movimiento de ciudades.
const S = require('./sim.js'), At = require('./atlas/mapa.js');
const M = At.ejemplo(), MAX = 30 * 3600 * (+process.argv[4] || 6), N = +process.argv[2] || 2, SOLO = process.argv[3] || '', SEM = +process.argv[5] || 1000;
const P = ['equilibrada', 'aerea', 'terrestre', 'metodica'];
const med = a => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN);
function jugar(seed, a, b) {
  const g = S.partida({ seed, mapa: M, ia0: a, ia1: b }), st = g.st; let prev = st.urbes.map(u => u.dueno), flips = 0, pico = 0;
  while (!st.fin && st.t < MAX) { S.avanzar(g); if (st.t % 900 === 0) { st.urbes.forEach((u, i) => { if (u.dueno !== prev[i]) { prev[i] = u.dueno; flips++; } }); pico = Math.max(pico, st.unidades.length); } }
  return { g: st.fin ? st.fin.ganador : -1, c: st.fin ? st.fin.causa : '', t: st.t / 108000, flips, pico, cuid: st.urbes.filter(u => u.dueno > 0).length, baj: st.stats.bajas.reduce((a, b) => a + b, 0) };
}
for (const a of P) for (const b of P) {
  if (SOLO && SOLO !== a) continue;
  const t0 = Date.now(), R = []; for (let i = 0; i < N; i++) R.push(jugar(SEM + i * 13, a, b));
  const c = k => R.filter(r => r.c === k).length;
  console.log(`${(a + ' / ' + b).padEnd(26)} A ${R.filter(r => r.g === 0).length} B ${R.filter(r => r.g === 1).length} sin ${R.filter(r => r.g < 0).length} · capital ${c('capital')} ciudades ${c('ciudades')} agot ${c('agotamiento')} · duración ${med(R.map(r => r.t)).toFixed(1)} h · cambios ${med(R.map(r => r.flips))} · pico ${med(R.map(r => r.pico))} · bajas ${med(R.map(r => r.baj))} · ${((Date.now() - t0) / N / 1000).toFixed(0)} s/partida`);
}
