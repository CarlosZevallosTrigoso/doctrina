#!/usr/bin/env python3
"""Une ui.html + sim.js + ui.js. Salida: doctrina.artifact.html (sin esqueleto) y doctrina.html (autónomo)."""
import glob
open('sim.js', 'w', encoding='utf8').write(''.join(open(f, encoding='utf8').read() for f in sorted(glob.glob('sim/*.js'))))
ui = open('ui.html', encoding='utf8').read()
sim = open('atlas/mapa.js', encoding='utf8').read() + '\n' + open('sim.js', encoding='utf8').read()
js = open('ui.js', encoding='utf8').read()
pag = f'{ui}\n<script>\n{sim}\n{js}\n</script>\n'
open('doctrina.artifact.html', 'w', encoding='utf8').write(pag)
titulo_fin = ui.index('</title>') + len('</title>')
head, cuerpo = ui[:titulo_fin], ui[titulo_fin:]
estilo_fin = cuerpo.index('</style>') + len('</style>')
estilo, dom = cuerpo[:estilo_fin], cuerpo[estilo_fin:]
auto = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{head}{estilo}
<style>body{{margin:0}}[hidden]{{display:none!important}}</style>
</head>
<body>{dom}
<script>
{sim}
{js}
</script>
</body>
</html>
'''
open('doctrina.html', 'w', encoding='utf8').write(auto)
print(len(pag), len(auto))
