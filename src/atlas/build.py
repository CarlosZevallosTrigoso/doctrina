#!/usr/bin/env python3
"""Une atlas.html + mapa.js + editor.js. Salida: atlas.artifact.html (sin esqueleto) y atlas.standalone.html → renombrado a mapa autónomo."""
ui=open('atlas.html',encoding='utf8').read(); a=open('mapa.js',encoding='utf8').read(); b=open('editor.js',encoding='utf8').read()
pag=f'{ui}\n<script>\n{a}\n{b}\n</script>\n'
open('atlas.artifact.html','w',encoding='utf8').write(pag)
t=ui.index('</title>')+8; head,cuerpo=ui[:t],ui[t:]
e=cuerpo.index('</style>')+8; estilo,dom=cuerpo[:e],cuerpo[e:]
auto=f'<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n{head}{estilo}\n<style>body{{margin:0}}[hidden]{{display:none!important}}</style>\n</head>\n<body>{dom}\n<script>\n{a}\n{b}\n</script>\n</body>\n</html>\n'
open('doctrina-atlas.html','w',encoding='utf8').write(auto)
print(len(pag),len(auto))
