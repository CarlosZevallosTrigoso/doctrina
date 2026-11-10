// Recorrido de los grupos del 1 al 10: formar con punto de reunión, listas con distancia, migrar, seleccionar y editar.
const { chromium } = require('playwright');
const URL = 'file://' + require('path').resolve(__dirname, 'doctrina.html');
const O = process.env.O || '/tmp'; let fallos = 0;
const ok = (n, v, x = '') => { if (!v) fallos++; console.log((v ? 'ok    ' : 'FALLA ') + n, x); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.stack));
  const E = (f, a) => p.evaluate(f, a);
  await p.goto(URL); await p.waitForTimeout(300);
  await p.click('#rolInicio button:has-text("campaña")'); await p.click('#empezar'); await p.waitForTimeout(300); await p.click('#despAuto'); await p.click('#despIniciar'); await p.waitForTimeout(200);
  await E(() => { const b = document.getElementById('pausa'); if (b.textContent === 'pausa') b.click(); });
  const c = await E(() => { const d = window.doctrina, s = d.partida.st, u = s.urbes.filter(q => q.dueno > 0 && !q.capital)[3]; d.centrar(u.x, u.y); return { x: u.x, y: u.y }; }); await p.waitForTimeout(150);
  await p.keyboard.press('1'); await p.waitForTimeout(100);
  ok('pulsar 1 con el grupo vacío pide el punto de reunión', (await p.textContent('#aviso')).includes('punto de reunión'), await p.textContent('#aviso'));
  const q = await E(([x, y]) => window.doctrina.aPantalla(x, y), [c.x + 60, c.y + 40]); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(200);
  ok('el clic abre la lista', await E(() => !document.getElementById('grupoPanel').hidden));
  const filas = await p.locator('#grupoPanel .gfila').count(); ok('lista todas las unidades de tierra', filas === 13, filas);
  const kms = await p.locator('#grupoPanel .gfila b').allTextContents(); const nums = kms.map(t => parseInt(t, 10));
  ok('cada fila lleva su distancia en km, de menor a mayor', kms.every(t => /^\d+ km$/.test(t)) && nums.every((n, i) => !i || n >= nums[i - 1]), kms.slice(0, 5).join(', '));
  ok('sin grupos previos, todas figuran como libres', (await p.textContent('#grupoPanel')).includes('Libres · 13'));
  for (let i = 0; i < 4; i++) await p.locator('#grupoPanel .gfila input').nth(i).check();
  ok('el pie resume lo marcado', (await p.textContent('#grupoTotal')).startsWith('4 unidades'), await p.textContent('#grupoTotal'));
  await p.screenshot({ path: O + '/grupo1.png' });
  await p.click('#formarGrupo'); await p.waitForTimeout(200);
  const g1 = await E(() => window.doctrina.partida.st.unidades.filter(u => u.s === 0 && u.grupo === 1).map(u => ({ id: u.id, st: u.st, tx: u.tx, ty: u.ty })));
  ok('las cuatro quedan en el grupo 1', g1.length === 4);
  ok('y marchan al punto de reunión', g1.filter(u => Math.hypot(u.tx - (c.x + 60), u.ty - (c.y + 40)) < 80).length >= 3, JSON.stringify(g1.map(u => u.st)));
  ok('el panel de grupos lo muestra', (await p.textContent('#grupos')).includes('4 · fuerza'), await p.textContent('#grupos'));
  await p.keyboard.press('Escape'); await p.keyboard.press('1'); await p.waitForTimeout(100);
  ok('pulsar 1 selecciona el grupo', await E(() => window.doctrina.seleccion.length) === 4);
  // Grupo 2 migrando una del grupo 1
  await p.keyboard.press('2'); await p.waitForTimeout(100); await p.mouse.click(q[0] - 200, q[1] - 120); await p.waitForTimeout(200);
  ok('la lista separa las de otros grupos', (await p.textContent('#grupoPanel')).includes('En otros grupos (se migran) · 4') && (await p.textContent('#grupoPanel')).includes('grupo 1'));
  await p.locator('#grupoPanel .gfila:has-text("grupo 1") input').first().check(); await p.locator('#grupoPanel .gfila:not(:has-text("grupo 1")) input').first().check();
  await p.click('#formarGrupo'); await p.waitForTimeout(200);
  ok('migrar saca la unidad del grupo 1', await E(() => { const s = window.doctrina.partida.st, n = k => s.unidades.filter(u => u.s === 0 && u.grupo === k).length; return n(1) === 3 && n(2) === 2; }));
  await p.keyboard.press('Shift+Digit1'); await p.waitForTimeout(100); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(200);
  ok('Mayúsculas+1 reabre el grupo con sus miembros marcados', (await p.textContent('#grupoPanel')).includes('En este grupo · 3') && await p.locator('#grupoPanel .gfila input:checked').count() === 3);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); ok('Esc cancela', await E(() => document.getElementById('grupoPanel').hidden));
  // El estado mayor no toca los grupos
  const mov = await E(() => { const d = window.doctrina, g = d.partida, s = g.st; d.S.estadoMayor(g, 'total'); const ids = s.unidades.filter(u => u.s === 0 && u.grupo).map(u => u.id); for (const u of s.unidades) if (ids.includes(u.id)) u.manual = 0; for (let i = 0; i < 30 * 600; i++) d.S.avanzar(g); return s.unidades.filter(u => ids.includes(u.id) && !u.dead).every(u => !s.misiones.some(m => m.id === u.m && m.s === 0)); });
  ok('en automatización total, el estado mayor no usa unidades de tus grupos', mov);
  await p.click('#guardar'); await p.waitForTimeout(150); await p.reload(); await p.waitForTimeout(300); await p.click('#continuar'); await p.waitForTimeout(400);
  ok('guardar y continuar conserva los grupos', await E(() => window.doctrina.partida.st.unidades.filter(u => u.s === 0 && u.grupo === 1).length) >= 1 && (await p.textContent('#grupos')).length > 0);
  ok('sin errores', errs.length === 0, (errs[0] || '').slice(0, 300));
  await b.close(); console.log(fallos ? `\n${fallos} FALLARON` : '\ntodo correcto'); process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });
