# Biblioteca de marcas ficticias · PRL

Abrir `/advertising-library.html` con el juego local activo. La página permite filtrar por categoría y descargar cada SVG, el atlas o el catálogo JSON. También hay un enlace desde la Biblioteca de entornos.

24 marcas de ficción del universo Pocket Racing League, con nombres, símbolos geométricos, eslóganes y paletas propias. Los diseños utilizan colores planos y tramados de puntos o diagonales; no necesitan recursos externos.

| Familia | Marcas |
| --- | --- |
| Refrescos | ZUMVIA, FROZIK, BERRIVA, CITRUNE, ORBLOOM, NUBORA |
| Apps de música | PULSORA, LOOPZI, SONVIO, TEMBLA, RITMEO, AUDRIFT |
| Videojuegos | PIXOVRA, NEXLOFT, QUADRIFT, LEVELUME, BOSSRAY, ARCADRA |
| Piezas de vehículos | TORQIVA, GRIPZEN, BRAKVOLT, APEXORA, PISTORA, RIMNEX |

## Archivos

- `src/advertising-brands.js`: fuente editable con identidad, colores y posición en el atlas.
- `scripts/generate-advertising-brands.mjs`: genera los recursos desde esa fuente.
- `public/assets/advertising/`: 24 SVG individuales de 1024 × 512, `manifest.json` y `atlas.svg`.
- `atlas.svg`: cuatro columnas y seis filas, 1536 × 1152. Cada celda mide 384 × 192.
- `advertising-library.html` y `src/advertising-library.*`: catálogo navegable, incluido en la compilación.

Para modificar o ampliar una marca, editar la fuente y ejecutar:

```sh
npm run brands:generate
npm run build
```

Si se añaden filas al catálogo, actualizar también las dimensiones de `BRAND_ATLAS`. Los tests detectan discrepancias entre catálogo, manifiesto y archivos, verifican las celdas del atlas y el contraste de los colores principales.

## Uso en el circuito

Los paneles triangulares comparten un único material y una textura de atlas, independientemente de la marca. El diseño se elige de forma determinista a partir de la posición de cada panel; recargar no cambia la selección. Los UV tienen margen interior para evitar que una marca invada otra con los mipmaps. Se conservan la geometría y las reglas de colocación existentes.

La rasterización del SVG se realiza al cargar la textura, no cada fotograma. El archivo pequeño de descarga no equivale a su memoria GPU: el atlas RGBA con mipmaps ocupa aproximadamente 9 MiB. No añade luces ni llamadas de dibujo por marca.
