const { chromium } = require('playwright');
const url='file://' + require('path').resolve(__dirname, 'doctrina-atlas.html'), O=process.env.O;
const ok=(n,v,x='')=>console.log((v?'ok  ':'FALLA ')+n,x);
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(url); await p.waitForTimeout(350);
  await p.screenshot({path:O+'/a0.png'});
  const est=()=>p.evaluate(()=>{const {mapa:m,der:d}=window.atlas;return {l:m.lineas.length,puentes:d.puentes,separa:d.separa,ruta:d.hayRuta,avisos:d.avisos,val:[...document.querySelectorAll('#valida li')].map(x=>x.textContent)}});
  let e=await est(); ok('abre con el ejemplo válido', e.separa&&e.ruta&&e.avisos.length===0, JSON.stringify(e.val));
  const box=await p.locator('#lienzo').boundingBox();
  const px=(x,y)=>p.evaluate(([x,y])=>{const r=document.getElementById('lienzo').getBoundingClientRect(),A=window.atlas.A;const s=Math.min(r.width/A.W,r.height/A.H);return [(r.width-A.W*s)/2+x*s,(r.height-A.H*s)/2+y*s]},[x,y]);
  // limpiar y dibujar con el ratón
  await p.click('#limpiar'); e=await est(); ok('limpiar', e.l===0);
  await p.keyboard.press('8');
  const pts=[[1020,16],[1380,540],[1800,1020],[2484,1524]];
  let q=await px(...pts[0]); await p.mouse.move(...q); await p.mouse.down();
  for(const w of pts.slice(1)){q=await px(...w); await p.mouse.move(...q,{steps:12});}
  await p.mouse.up(); await p.waitForTimeout(60);
  e=await est(); ok('la frontera dibujada con reflejo separa', e.l===2&&e.separa, JSON.stringify(e.avisos));
  // río sin cruces corta la ruta; camino lo abre
  await p.keyboard.press('6');
  const r=[[600,0],[900,1080],[1320,1800],[1560,3048]];
  q=await px(...r[0]); await p.mouse.move(...q); await p.mouse.down(); for(const w of r.slice(1)){q=await px(...w); await p.mouse.move(...q,{steps:12});} await p.mouse.up(); await p.waitForTimeout(60);
  e=await est(); ok('el río corta la ruta', !e.ruta);
  await p.keyboard.press('7');
  const c=[[660,2520],[1500,2280],[2400,1980]];
  q=await px(...c[0]); await p.mouse.move(...q); await p.mouse.down(); for(const w of c.slice(1)){q=await px(...w); await p.mouse.move(...q,{steps:12});} await p.mouse.up(); await p.waitForTimeout(60);
  e=await est(); ok('el camino crea puentes y abre la ruta', e.puentes>=2&&e.ruta, 'puentes '+e.puentes);
  // pincel y deshacer
  await p.keyboard.press('4'); await p.keyboard.press(']');
  q=await px(2520,720); await p.mouse.move(...q); await p.mouse.down(); await p.mouse.move(q[0]+90,q[1]+40,{steps:8}); await p.mouse.up();
  const mont=()=>p.evaluate(()=>window.atlas.der.cuenta[window.atlas.A.MONTANA]);
  const n1=await mont(); ok('pincel pinta montaña en espejo', n1>6, n1);
  await p.keyboard.press('Control+z'); ok('deshacer', await mont()===0);
  await p.keyboard.press('Control+Shift+z'); ok('rehacer', await mont()===n1);
  // borrar línea
  // zoom y desplazamiento no pintan ni cambian el mapa
  const lin0=(await est()).l;
  const q0=await px(2400,1500); await p.mouse.move(...q0); await p.mouse.wheel(0,-100); await p.waitForTimeout(220);
  await p.keyboard.down('Space'); await p.mouse.down(); await p.mouse.move(q0[0]-120,q0[1]-60,{steps:6}); await p.mouse.up(); await p.keyboard.up('Space'); await p.waitForTimeout(60);
  await p.mouse.move(q0[0]-120,q0[1]-60); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(40);
  ok('zoom y desplazamiento no alteran el dibujo', (await est()).l===lin0);
  await p.screenshot({path:O+'/a_zoom.png'});
  await p.mouse.wheel(0,100); await p.waitForTimeout(220);
  await p.keyboard.press('9'); const antes=(await est()).l; q=await px(1500,2280); await p.mouse.click(...q); await p.waitForTimeout(40);
  ok('borrar quita la línea y su reflejo', (await est()).l===antes-2);
  // JSON
  await p.click('#abrirJson'); await p.waitForTimeout(40);
  const texto=await p.inputValue('#json'); ok('exporta JSON', texto.includes('doctrina-mapa'));
  await p.fill('#json','{mal'); await p.click('#cargar'); await p.waitForTimeout(30);
  ok('JSON roto muestra error', (await p.textContent('#msgJson')).includes('JSON válido'));
  ok('descarga visible fuera de marco', await p.isVisible('#bajar'));
  await p.fill('#json',texto); await p.click('#cargar'); await p.waitForTimeout(40);
  ok('carga el JSON', await p.evaluate(()=>document.getElementById('hojaJson').hidden));
  // persistencia
  await p.waitForTimeout(700); await p.reload(); await p.waitForTimeout(1200);
  ok('se conserva al recargar', await mont()===n1);
  await p.click('#ejemplo'); await p.waitForTimeout(60);
  await p.keyboard.press('j'); await p.waitForTimeout(80);
  await p.screenshot({path:O+'/a1.png'});
  await p.keyboard.press('j');
  // tablet y móvil
  const t=await b.newPage({viewport:{width:1180,height:820},hasTouch:true}); t.on('pageerror',x=>errs.push('T:'+x.message));
  await t.goto(url); await t.waitForTimeout(250); await t.keyboard.press('4');
  const mt=()=>t.evaluate(()=>window.atlas.der.cuenta[window.atlas.A.MONTANA]); const m0=await mt();
  await t.evaluate(()=>{const c=document.getElementById('lienzo');const r=c.getBoundingClientRect();const ev=(ty,x,y)=>c.dispatchEvent(new PointerEvent(ty,{clientX:r.left+x,clientY:r.top+y,pointerId:7,pointerType:'touch',button:0,bubbles:true}));ev('pointerdown',300,500);for(let i=1;i<12;i++)ev('pointermove',300+i*12,500+i*5);ev('pointerup',444,560)});
  await t.waitForTimeout(80); ok('tablet: el pincel responde a eventos táctiles', await mt()>m0, `${m0} → ${await mt()}`);
  const m=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}); m.on('pageerror',x=>errs.push('M:'+x.message));
  await m.goto(url); await m.waitForTimeout(300); await m.screenshot({path:O+'/am.png'});
  ok('móvil sin scroll lateral', await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const al=await m.evaluate(()=>({c:document.getElementById('lienzo').getBoundingClientRect().height,a:document.querySelector('aside').getBoundingClientRect().bottom,h:innerHeight}));
  ok('móvil: el mapa gira y el panel llega al fondo', al.c>480&&Math.abs(al.a-al.h)<2, JSON.stringify(al));
  console.log('errores',errs);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
