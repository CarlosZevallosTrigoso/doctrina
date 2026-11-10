// Recorrido en navegador real: cada paso usa la interfaz como la usaría una persona.
const { chromium } = require('playwright');
const url = 'file://' + require('path').resolve(__dirname, 'doctrina.html'), O = process.env.O || '/tmp';
let fallos = 0;
const ok = (n, v, x = '') => { if (!v) fallos++; console.log((v ? 'ok    ' : 'FALLA ') + n, x); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.stack)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(300);
  await p.click('#pegarMapa'); await p.fill('#jsonMapa', '{mal'); await p.click('#usarPegado'); await p.waitForTimeout(30);
  ok('JSON roto muestra error', (await p.textContent('#msgMapa')).length > 0);
  await p.click('#rolInicio button:has-text("campaña")');
  await p.click('#empezar'); await p.waitForTimeout(300);
  const E = (f, a) => p.evaluate(f, a);
  // Despliegue: el reloj espera; se coloca tropa a mano y luego se empieza.
  ok('la partida abre en despliegue', await E(() => !document.getElementById('despliegue').hidden && window.doctrina.partida.st.despliegue));
  await p.click('#pausa'); await p.waitForTimeout(300);
  ok('el reloj no corre en despliegue', await E(() => window.doctrina.partida.st.t) === 0);
  {
    const r = await E(() => { const d = window.doctrina, s = d.partida.st, u = s.unidades.find(q => q.s === 0 && q.c === 0), c = s.urbes.filter(q => q.dueno > 0 && !q.capital).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]; return { u: { x: u.x, y: u.y, id: u.id }, c: { x: c.x, y: c.y } }; });
    let q = await E(([x, y]) => { window.doctrina.centrar(x, y); return 0; }, [r.u.x, r.u.y]); await p.waitForTimeout(80);
    q = await E(([x, y]) => window.doctrina.aPantalla(x, y), [r.u.x, r.u.y]); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(100);
    ok('se selecciona una compañía de la reserva', await E(() => window.doctrina.seleccion.length) >= 1);
    await E(([x, y]) => { window.doctrina.centrar(x, y); }, [r.c.x, r.c.y]); await p.waitForTimeout(80);
    q = await E(([x, y]) => window.doctrina.aPantalla(x, y), [r.c.x + 40, r.c.y + 30]); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(120);
    await p.click('#menu .op[data-a="colocar"]'); await p.waitForTimeout(120);
    ok('colocar la lleva al instante a la ciudad', await E(([id, c]) => { const u = window.doctrina.partida.st.unidades.find(q => q.id === id); return Math.hypot(u.x - c.x, u.y - c.y) < 90; }, [r.u.id, r.c]));
  }
  await p.click('#despAuto'); await p.waitForTimeout(100); await p.click('#despIniciar'); await p.waitForTimeout(200);
  ok('empezar la guerra arranca el reloj y cierra el despliegue', await E(() => document.getElementById('despliegue').hidden && window.doctrina.partida.st.t > 0));
  const pausa = () => E(() => { document.getElementById('pausa').textContent === 'pausa' && document.getElementById('pausa').click(); });
  await pausa();
  const clic = async (x, y) => { await E(([x, y]) => window.doctrina.centrar(x, y), [x, y]); await p.waitForTimeout(60); const q = await E(([x, y]) => window.doctrina.aPantalla(x, y), [x, y]); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(90); };
  const menu = () => E(() => { const m = document.getElementById('menu'); return { abierto: !m.hidden, txt: m.textContent }; });
  const esc = () => p.keyboard.press('Escape').then(() => p.waitForTimeout(40));
  const st = f => p.evaluate(f);
  const miCiudad = await st(() => { const g = window.doctrina.partida, s = g.st, u = s.urbes.filter(c => c.dueno > 0 && !c.capital).sort((a, b) => Math.hypot(a.x - s.bases[0].x, a.y - s.bases[0].y) - Math.hypot(b.x - s.bases[0].x, b.y - s.bases[0].y))[0]; return { x: u.x, y: u.y, id: u.id, n: u.nombre }; });
  const enemiga = await st(() => { const s = window.doctrina.partida.st, u = s.urbes.filter(c => c.dueno < 0 && !c.capital).sort((a, b) => Math.hypot(a.x - s.bases[0].x, a.y - s.bases[0].y) - Math.hypot(b.x - s.bases[0].x, b.y - s.bases[0].y))[0]; return { x: u.x, y: u.y, id: u.id, n: u.nombre }; });

  await clic(miCiudad.x, miCiudad.y); let m = await menu();
  ok('clic en ciudad propia abre su menú', m.abierto && m.txt.includes(miCiudad.n), m.txt.slice(0, 80));
  ok('ofrece áreas y misiones; reclutar ya no', !m.txt.includes('Reclutar') && m.txt.includes('Designar área de control') && m.txt.includes('Misión'));
  await esc();
  const cap = await st(() => { const u = window.doctrina.partida.st.urbes.find(c => c.capital && c.dueno > 0); return { x: u.x, y: u.y }; });
  await clic(cap.x, cap.y); m = await menu(); ok('la capital ofrece reclutar', m.txt.includes('Reclutar'), m.txt.slice(0, 60));
  const cr0 = await st(() => window.doctrina.partida.st.creditos[0]);
  await p.click('#menu .op[data-a="reclutar"][data-c="0"]'); await p.waitForTimeout(80);
  ok('reclutar cobra y encola', await st(() => window.doctrina.partida.st.colas[0].length) === 1 && (await st(() => window.doctrina.partida.st.creditos[0])) < cr0, '');
  ok('el panel de fuerzas muestra el cupo', (await p.textContent('#fuerzas')).includes('cupo de tierra'));

  await clic(miCiudad.x, miCiudad.y); await p.click('#menu .op[data-a="zona-1"]'); await p.waitForTimeout(80);
  ok('designar área de control', await st(() => window.doctrina.partida.st.zonas.filter(z => z.s === 0).length) === 1);
  await clic(miCiudad.x, miCiudad.y); m = await menu(); ok('el área aparece en el menú con prioridad y quitar', m.txt.includes('Quitar esta área'));
  await p.click('#menu .op[data-a="zona-quitar"]'); await p.waitForTimeout(60);
  ok('quitar área', await st(() => window.doctrina.partida.st.zonas.filter(z => z.s === 0).length) === 0);

  const b0 = await st(() => { const b = window.doctrina.partida.st.bases[0]; return { x: b.x + 150, y: b.y - 50 }; });
  await clic(b0.x, b0.y); m = await menu(); ok('terreno propio ofrece construir', m.txt.includes('Construir') && m.txt.includes('antiaérea'));
  const n0 = await st(() => window.doctrina.partida.st.defensas.length);
  await p.click('#menu .op[data-a="construir"][data-d="0"]'); await p.waitForTimeout(100);
  ok('construir crea la obra', await st(() => window.doctrina.partida.st.defensas.length) === n0 + 1);
  ok('la orden aparece en el panel', (await p.textContent('#misiones')).length > 0, (await p.textContent('#misiones')).slice(0, 80));
  const cx = await p.locator('#misiones button.x').count();
  if (cx) { await p.locator('#misiones button.x').last().click(); await p.waitForTimeout(100); ok('cancelar desde el panel', await st(() => window.doctrina.partida.st.defensas.length) === n0); }
  else ok('hay botón de cancelar en el panel', false);

  await clic(enemiga.x, enemiga.y); m = await menu();
  ok('ciudad enemiga ofrece asalto y bombardeo', m.txt.includes('asalto') && m.txt.includes('bombardeo'), m.txt.slice(0, 100));
  await p.click('#menu .op[data-a="mision-golpe"]'); await p.waitForTimeout(120);
  ok('el planificador se abre', await st(() => !document.getElementById('plan').hidden));
  ok('lanzar deshabilitado sin aparatos', await st(() => document.getElementById('lanzarPlan').disabled));
  const mas = p.locator('#plan .pfila button[aria-label^="Más"]');
  const nb = await mas.count(); ok('filas de clases en el plan', nb >= 2, nb);
  await mas.nth(0).click(); await p.waitForTimeout(40); await p.locator('#plan .pfila button[aria-label^="Más"]').nth(1).click(); await p.waitForTimeout(40);
  await p.screenshot({ path: O + '/plan.png' });
  await p.click('#lanzarPlan'); await p.waitForTimeout(100);
  ok('la misión se lanza', await st(() => window.doctrina.partida.st.misiones.filter(m => m.s === 0).length) === 1);
  ok('el plan se cierra', await st(() => document.getElementById('plan').hidden));

  // Selección y orden a camiones
  const inf = await st(() => { const s = window.doctrina.partida.st, u = s.unidades.find(q => q.s === 0 && q.c === 0 && q.camion); return { x: u.x, y: u.y, id: u.id }; });
  await clic(inf.x, inf.y);
  ok('clic en una compañía la selecciona', await st(() => window.doctrina.seleccion.length) === 1);
  await clic(inf.x + 120, inf.y + 20); m = await menu();
  ok('con selección: mover y ver todas las opciones', m.txt.includes('Mover aquí') && m.txt.includes('ver todas'));
  await p.click('#menu .op[data-a="mover"]'); await p.waitForTimeout(80);
  ok('el camión embarca', await st(() => window.doctrina.partida.st.unidades.find(q => q.c === 0 && q.s === 0 && q.tx !== q.x).st === 0));
  await esc();

  // Control del juego, guardado y minimapa
  await st(() => window.doctrina.flechas && 0);
  await p.click('#pausa'); await p.waitForTimeout(40);
  const t1 = await st(() => window.doctrina.partida.st.t); await p.waitForTimeout(700); const t2 = await st(() => window.doctrina.partida.st.t);
  ok('el tiempo corre', t2 > t1, `${t1}→${t2}`);
  // Tiempo inteligente
  await p.click('#vel'); await p.click('#vel'); await p.waitForTimeout(40);
  ok('la velocidad sube a ×16', (await p.textContent('#vel')) === '×16');
  await st(() => { const s = window.doctrina.partida.st; s.ev.push({ k: 'revuelta', id: s.urbes.find(u => u.dueno > 0).id, x: 0, y: 0, s: 0, t: s.t }); });
  await p.waitForTimeout(150);
  ok('un evento grave la devuelve a ×1', (await p.textContent('#vel')) === '×1', await p.textContent('#vel'));
  await p.keyboard.press('n'); await p.waitForTimeout(300);
  const ta = await st(() => window.doctrina.partida.st.t); await p.waitForTimeout(500); const tb = await st(() => window.doctrina.partida.st.t);
  ok('salto al próximo evento corre rápido', tb - ta > 300 || (await p.textContent('#pausa')) === 'seguir', `${tb - ta} ticks en medio segundo`);
  await st(() => { const s = window.doctrina.partida.st; s.ev.push({ k: 'revuelta', id: s.urbes.find(u => u.dueno > 0).id, x: 0, y: 0, s: 0, t: s.t }); });
  await p.waitForTimeout(150);
  ok('el salto termina en pausa al llegar el evento', (await p.textContent('#pausa')) === 'seguir' && (await p.textContent('#vel')) === '×1');
  await p.click('#pausa'); await p.waitForTimeout(40);
  await p.click('#guardar'); await p.waitForTimeout(120);
  ok('guardar escribe en el navegador', await st(() => !!localStorage.getItem('doctrina.partida')));
  await p.click('#pausa'); await p.waitForTimeout(30); await p.screenshot({ path: O + '/juego.png' });
  await p.reload(); await p.waitForTimeout(300);
  ok('al recargar se ofrece continuar', await st(() => !document.getElementById('continuar').hidden));
  await p.click('#continuar'); await p.waitForTimeout(300);
  ok('continuar restaura la partida', await st(() => window.doctrina.partida.st.t) >= t2 && await st(() => window.doctrina.partida.st.misiones.filter(m => m.s === 0).length) === 1);

  // Cuadros por segundo
  const fps = await st(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) r(n / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  ok('cuadros por segundo razonables en este equipo sin GPU', fps > 15, fps);
  ok('sin errores en consola', errs.length === 0, errs.slice(0, 3).join(' | ').slice(0, 400));
  await b.close();

  // Táctil
  const b2 = await chromium.launch(); const c = await b2.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const t = await c.newPage(); const err2 = []; t.on('pageerror', e => err2.push(e.message));
  await t.goto(url); await t.waitForTimeout(300); await t.tap('#rolInicio button:has-text("campaña")'); await t.tap('#empezar'); await t.waitForTimeout(400); await t.tap('#despAuto'); await t.tap('#despIniciar'); await t.waitForTimeout(200);
  await t.evaluate(() => { const b = document.getElementById('pausa'); if (b.textContent === 'pausa') b.click(); });
  const s0 = await t.evaluate(() => { const g = window.doctrina.partida.st, u = g.urbes.find(c => c.dueno > 0 && !c.capital); window.doctrina.centrar(u.x, u.y); return window.doctrina.aPantalla(u.x, u.y); });
  await t.waitForTimeout(100); await t.touchscreen.tap(s0[0], s0[1]); await t.waitForTimeout(500);
  ok('móvil: tocar ciudad abre el menú', await t.evaluate(() => !document.getElementById('menu').hidden));
  ok('móvil: el menú cabe en pantalla', await t.evaluate(() => { const r = document.getElementById('menu').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1; }));
  await t.screenshot({ path: O + '/movil.png' });
  ok('móvil: sin errores', err2.length === 0, err2[0] || '');
  await b2.close();
  console.log(fallos ? `\n${fallos} FALLARON` : '\ntodo correcto');
  process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });
