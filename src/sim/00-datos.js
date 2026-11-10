/* doctrina · núcleo puro: datos, simulación e IA. Sin DOM. Generado desde sim/*.js con build.py */
const DOCTRINA = (() => {
  'use strict';
  const A = typeof ATLAS !== 'undefined' ? ATLAS : require('./atlas/mapa.js');
  const DT = 1 / 30;
  const seg = s => Math.round(s / DT);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Clases. Un punto es una compañía o un aparato: pocos y valiosos.
  const INF = 0, BLI = 1, CAZA = 2, ATAQUE = 3, DRON = 4, ESPIA = 5, MISIL = 6, ART = 7, AAM = 8;
  const NOMBRES = ['infantería', 'blindado', 'caza', 'ataque', 'dron', 'avión espía', 'misil', 'artillería', 'antiaérea móvil'];
  const esSuelo = c => c === INF || c === BLI || c === ART || c === AAM;
  // Estados en tierra.
  const EMBARCANDO = 0, MARCHA = 1, DESEMBARCANDO = 2, DESPLEGADA = 3;
  // Estados en el aire.
  const IDA = 10, ORBITA = 11, REGRESO = 12;
  // Tipos de instalación.
  const AA = 0, AM = 1, FORTIN = 2, RADAR = 3, PISTA = 4, DEPOSITO = 5;

  const DATOS = {
    dRef: 900, umbralTerreno: 0.34,
    clases: [
      { cruce: 180, fuerza: 10, vis: 95, idr: 70, rango: 48, cd: 2.6, costo: 60, obra: 90, peso: 1 },
      { cruce: 140, fuerza: 5, vis: 115, idr: 85, rango: 72, cd: 3, costo: 140, obra: 150, peso: 2.4 },
      { cruce: 30, vis: 170, idr: 130, rango: 90, tiros: 4, cd: 2, aguante: 240, costo: 180, obra: 240, rearme: 240, alcance: 3500 },
      { cruce: 42, vis: 120, idr: 95, costo: 200, obra: 280, rearme: 300, alcance: 3000, r: 36, dano: 5, aguante: 200, bombas: 2 },
      { cruce: 110, vis: 210, idr: 175, costo: 50, obra: 90, rearme: 120, alcance: 5000, r: 18, dano: 1.5, aguante: 900, bombas: 2 },
      { cruce: 45, vis: 300, idr: 250, costo: 140, obra: 300, rearme: 300, alcance: 6600, aguante: 300 },
      { cruce: 20, vis: 40, idr: 30, costo: 110, obra: 300, alcance: 4500, r: 40 },
      // Artillería: fuego indirecto de largo alcance sobre lo que su bando ve; casi inútil de cerca. Disparar la delata.
      { cruce: 170, fuerza: 6, vis: 80, idr: 60, rango: 420, directo: 70, cd: 7, costo: 170, obra: 200, peso: 0.5, r: 30, dano: 2.4 },
      // Antiaérea móvil: viaja con la columna y, emplazada, dispara a lo que vuela cerca.
      { cruce: 150, fuerza: 5, vis: 150, idr: 110, rango: 150, directo: 40, cd: 5, costo: 150, obra: 180, peso: 0.5, pk: { 2: 0.25, 3: 0.35, 4: 0.5, 5: 0.3 } },
    ],
    artilleria: { delata: 25, guarnicion: 0.5 },
    // Abastos: cada unidad carga munición y combustible; los gasta al pelear y al moverse y los repone dentro de la red.
    abastos: { tiro: { 0: 0.02, 1: 0.02, 7: 0.04, 8: 0.06 }, batalla: 0.0025, autonomia: 3200, sinMunicion: 0.3,
      repone: { mun: 0.02, comb: 0.03, estirado: 0.075 }, costo: { mun: 1, comb: 0.5, fuerza: 0.1 },
      reserva: { inicio: 40, base: 60, porDeposito: 20, ingreso: 0.02, porCiudad: 0.004 }, aviso: 0.25 },
    // Escala declarada: una celda es 1 km y un segundo de juego es un minuto. La guerra empieza a las 06:00 del día 1.
    reloj: { inicio: 360, amanece: 360, anochece: 1200, visNoche: 0.6 },
    clima: { cada: 60, prob: 0.04, dura: [240, 480], vis: 0.8, aire: 0.5 },
    // Dar una orden lleva tiempo, más si la unidad está lejos de su red.
    orden: { enlace: 4, lejos: 12 },
    ingenieros: { radio: 60, ritmo: 3 },
    // Doctrina: decisiones generales de un bando. Cambiarla tarda en llegar a las unidades.
    doctrina: { demora: 20, audacia: { ofensiva: 0.8, equilibrada: 1, defensiva: 1.5 }, radarAmenaza: 520, radarSigue: 60,
      inicial: { postura: 'equilibrada', preservar: 0, emisiones: 'siempre', artilleria: 'libre', riesgo: 'asumir', ciudades: true, objetivos: [], nivel: 'manual' } },
    // Niveles de automatización: qué secciones del estado mayor deciden solas.
    niveles: { manual: [], baja: ['log'], media: ['log', 'def'], alta: ['log', 'def', 'fue', 'man'], total: ['log', 'def', 'fue', 'man'] },
    // Una unidad muy castigada se quiebra: deja de pelear, se retira sola y se rehace en retaguardia.
    quiebre: { umbral: 0.35, recupera: 0.6, tasa: 0.012, descanso: 0.005, moral: 0.1 },
    // La tropa que no se mueve se atrinchera; la montaña también protege.
    fortificacion: { segundos: 120, max: 0.4, montana: 0.75 },
    // Desembarcar y volver a subir expone a la compañía.
    embarque: { subir: 18, bajar: 15 },
    combate: { perdida: 0.05, blindadoVsInf: 1.6, infVsBlindado: 0.5, sinSuministro: 0.6, emboscada: 55, bosque: 0.7 },
    // Efecto de un ataque aéreo según lo que encuentra: la columna en marcha es el blanco ideal.
    expuesto: { marcha: 2.6, maniobra: 1.5, desplegada: 0.45, ciudad: 0.35, bosque: 0.6, blindado: 0.6, camion: 0.25 },
    pkAire: { 2: { 2: 0.45, 3: 0.7, 4: 0.8, 5: 0.55 } },
    relieve: { vel: [[1, 0, 0.7, 0.45, 1], [1, 0, 0.45, 0.25, 0.9]], camino: [1.5, 1.6], via: 4 },   // via: un camino en territorio propio y abastecido es vía logística
    terreno: { tasa: 0.04, provincia: 0.006, radio: 5 },
    ciudad: { rZona: 130, guarnicion: 24, ocupada: 12, regenera: 0.06, perdida: 0.002, bonusCapital: 1.6, avance: 1 / 55, libre: 1 / 14, bonus: 1.45, tiros: 5,
      ingreso: 5, capital: 3, bono: 60, dolor: { golpe: 0.05, guar: 3, moral: 0.05 }, repara: 0.0008, antiguedad: 180 },
    resistencia: { sube: 0.008, porDano: 0.03, baja: 0.002, guardia: 8, golpe: 6, cada: 10 },
    suministro: { alcance: 8, cada: 150, desgaste: 0.012 },
    // Agotamiento de guerra: 0 es moral intacta, 1 es el colapso del país.
    agotamiento: { tiempo: 0.00002, tierra: 0.0045, avion: 0.002, dron: 0.0005, ciudad: 0.04, ingreso: 0.4, moral: 0.5, avisos: [0.5, 0.75, 0.9] },
    // Cerco: lo que queda cortado del suministro avisa, y si nadie lo socorre, se rinde.
    cerco: { aviso: 45, unidad: 300, ciudad: 360, linea: 30, gracia: 300 },
    creditos: { inicio: 900 },
    // Compañías que un bando puede sostener: el territorio da la logística.
    ejercito: { base: 12, porCiudad: 1 },
    fuerzasIniciales: { inf: 8, bli: 3, art: 1, aam: 1, hangar: { 2: 10, 3: 8, 4: 10, 5: 3, 6: 14 } },
    instalaciones: {
      tope: 34, separacion: 18,
      tipos: [
        { nombre: 'antiaérea', costo: 150, obra: 30, hp: 2, rango: 110, cd: 2.4, vis: 5, blanco: 'aire', pk: { 2: 0.3, 3: 0.5, 4: 0.6, 5: 0.35 } },
        { nombre: 'antimisil', costo: 200, obra: 45, hp: 2, rango: 130, cd: 1.4, vis: 4, blanco: 'misil', pk: 0.55 },
        { nombre: 'fortín', costo: 120, obra: 30, hp: 6, rango: 48, cd: 1.8, vis: 5, blanco: 'tierra', dano: 0.9 },
        { nombre: 'radar', costo: 100, obra: 20, hp: 1, rango: 0, cd: 0, vis: 16, idr: 170, blanco: null },
        { nombre: 'pista', costo: 260, obra: 120, hp: 8, rango: 0, cd: 0, vis: 6, blanco: null },
        { nombre: 'depósito', costo: 160, obra: 60, hp: 4, rango: 0, cd: 0, vis: 4, blanco: null },
      ],
      enCapital: [{ t: AA, ang: 22, r: 120 }, { t: AA, ang: 68, r: 120 }, { t: AM, ang: 45, r: 80 }, { t: PISTA, ang: 45, r: 30 }],
    },
    zonas: { radios: [160, 320, 560], maxInt: 4, maxCas: 2, cadencia: 30, cooldownCas: 20 },
    misiones: {
      golpe: { nombre: 'golpe', clases: [ATAQUE, MISIL, CAZA] },
      bombardeo: { nombre: 'bombardeo', clases: [ATAQUE, CAZA] },
      supresion: { nombre: 'supresión antiaérea', clases: [ATAQUE, MISIL, CAZA] },
      interdiccion: { nombre: 'interdicción', clases: [ATAQUE, DRON, CAZA] },
      reconocimiento: { nombre: 'reconocimiento', clases: [ESPIA, DRON] },
      asalto: { nombre: 'asalto', clases: [ATAQUE, CAZA], tierra: true },
      refuerzo: { nombre: 'refuerzo', clases: [], tierra: true },
    },
    alerta: { vida: 25 },
    vigilancia: { frontera: 3, ciudad: 5 },
    base: { rVision: 340, rIdent: 130 },
    bosque: { rDeteccion: 48 },
    victoria: { fraccion: 2 / 3, segundos: 300 },
    satelites: [
      { id: 'optico', nombre: 'óptico', periodo: 240, transito: 40, ancho: 420, dir: [0.94, 0.34], fase: 30, vida: 90 },
      { id: 'radar', nombre: 'radar', periodo: 360, transito: 60, ancho: 1140, dir: [0.5, 0.87], fase: 120, vida: 75 },
      { id: 'escucha', nombre: 'escucha', periodo: 180, transito: 50, ancho: 780, dir: [-0.71, 0.71], fase: 0, vida: 45 },
    ],
    puente: { pk: 0.5, reparacion: 180 },
    nombresCiudad: ['Alameda', 'Barranca', 'Cantera', 'Dársena', 'Encina', 'Fragua', 'Galera', 'Hondonada', 'Isla Verde', 'Jaral', 'Laguna', 'Molinos', 'Naranjal', 'Olivar', 'Pedregal', 'Quebrada', 'Rincón', 'Salinas', 'Tejar', 'Umbría', 'Vado', 'Yesera', 'Zarzal', 'Alcázar', 'Bosquecillo', 'Cumbre', 'Delta', 'Estero', 'Portachuelo', 'Granja', 'Huerta', 'Ladera', 'Mesa', 'Nogal', 'Puerto Viejo', 'Ribera', 'Sauce', 'Trapiche', 'Valle Alto', 'Cañada'],
  };
