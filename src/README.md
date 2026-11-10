# doctrina · código fuente

El juego que se publica es un solo archivo, `index.html`, en la raíz del repositorio. Ese archivo se genera a partir de lo que hay en esta carpeta.

## Estructura

- `sim/` — la simulación, sin nada de pantalla. Los archivos se unen en orden alfabético:
  - `00-datos.js` clases, costos y todas las constantes de reglas
  - `15-reuso.js` azar determinista, rutas y utilidades
  - `20-estado.js` creación de la partida, ciudades y despliegue
  - `30-tierra.js` visión, suministro, combate terrestre, ciudades y cerco
  - `40-aire.js` aviación, defensas, áreas de control y misiones
  - `50-ordenes.js` órdenes que acepta la simulación
  - `60-ia.js` la IA y el estado mayor por secciones
  - `90-fin.js` el tick, la victoria, la vista con niebla y el guardado
- `atlas/` — el formato de mapa (`mapa.js`, compartido con el juego) y el editor de mapas
- `ui.js`, `ui.html` — la interfaz del juego
- `build.py` — une todo

## Construir

```
python3 build.py            # genera sim.js, doctrina.html y doctrina.artifact.html
cp doctrina.html ../index.html
cd atlas && python3 build.py   # genera doctrina-atlas.html
```

## Probar

```
node test.js          # reglas de la simulación
node test_grande.js   # mapa a tamaño completo y coste por tick
node smoke.js         # recorrido en navegador (necesita Playwright)
node tuto_smoke.js    # recorrido del tutorial (necesita Playwright)
node modo_smoke.js    # recorrido del modo ataque/defensa (necesita Playwright)
node grupos_smoke.js  # recorrido de los grupos del 1 al 10 (necesita Playwright)
node balance.js 4     # partidas IA contra IA
```

Los archivos generados (`sim.js`, `doctrina.html`, `doctrina.artifact.html`) no se guardan aquí.
