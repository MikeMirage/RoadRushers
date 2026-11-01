# Biblioteca de arte de entornos

36 recursos gratuitos descargados: **16 modelos texturizados y 20 materiales PBR**. Todos son de [Poly Haven](https://polyhaven.com), bajo [CC0](https://polyhaven.com/license), con uso comercial, modificación y redistribución permitidos. No requieren cuenta ni una compra. La descarga se hizo el 1 de noviembre de 2026.

Abrir **[Biblioteca 3D](http://127.0.0.1:5188/asset-library.html)** con el servidor local activo. En otro puerto, usar `/asset-library.html`. Permite orbitar cada modelo, comparar sus dos niveles de detalle, ver la malla, inspeccionar los materiales y activar agua animada. El recurso se puede seleccionar por URL: `asset-library.html?asset=rock_moss_set_01`.

## Dirección visual

Miniaturas de calidad con materiales naturales: siluetas orgánicas, corteza y roca con relieve, rugosidad creíble y luz suave. Las copas deben conservar las hojas al reducir polígonos; aumentar subdivisiones a las primitivas actuales no resolvería su aspecto. El color de una textura de albedo no debe multiplicarse por el antiguo verde o marrón plano del material.

| Entorno | Vegetación y props descargados | Materiales principales |
| --- | --- | --- |
| Bosque | Pino, abeto, frondoso, helecho, hierba, tocón, roca con musgo | Suelo de bosque, hojarasca, musgo |
| Circuito | Dos barreras Jersey, valla modular, neumático y farola | Asfalto de pista, pit lane, grava, hormigón, chapa |
| Desierto | Granito erosionado | Arena de dunas, roca |
| Invierno | Abeto, pino, bolos de roca | Dos nieves, roca de montaña |
| Costa | Árbol insular, roca costera | Arena costera, estuco blanco, roca |
| Pirineos | Abeto, tocón y roca | Acantilado, nieve irregular |
| Reunión | Árbol insular, helechos y rocas con musgo | Barro, suelo de selva, roca oscura |
| Tokio / Bund | Barreras, valla, farola | Hormigón de viaducto, chapa, ladrillo histórico |

## Archivos y trazabilidad

- `art/environment-selection.json`: selección concreta y uso previsto.
- `art/source/polyhaven/`: glTF originales con todas sus variantes, texturas originales y metadatos de descarga. Es la biblioteca de autoría; no se copia a la distribución web.
- `art/source/polyhaven/provenance.json`: URL de origen y de cada descarga, bytes, MD5 del proveedor y SHA-256 local.
- `public/assets/environment/`: versiones de juego: dos LOD por modelo, texturas WebP locales y manifiesto.
- `art/reports/`: comprobación de geometría y medidas por modelo y LOD, con los hallazgos originales conservados.
- `art/reviews/`: vistas de topología y contacto; `public/assets/environment/previews/`: renders con materiales.

Los originales conservan variantes que no se cargan en la carrera. La versión de juego del set de rocas y de cada planta utiliza una variante. La valla se ensambla con un panel y dos postes; el kit completo sigue disponible en la fuente. Las máscaras de transparencia de las hojas se descargan por separado y se conectan antes de exportar.

Los LOD son archivos independientes para no descargar la geometría cercana en el perfil móvil. Los cuatro árboles conservan una malla cercana detallada; el LOD lejano usa **dos imágenes recortadas del árbol completo sobre planos cruzados: cuatro triángulos por árbol**. Las imágenes se renderizan desde dos ángulos con transparencia. Así la copa no desaparece al simplificar. El perfil móvil usa esos impostores; equilibrado limita a tres árboles cercanos y alta a siete. La vegetación se repite mediante `InstancedMesh`, con límites diferentes por calidad; los LOD se asignan por proximidad al circuito al construir el paisaje. El manifiesto registra los triángulos realmente exportados.

## Primera integración en el juego

El asfalto, la grava, la tierra y el barro usan los mapas PBR locales. El hielo conserva su material específico. Los suelos de los biomas proyectan los mapas en metros del mundo para evitar estirar una textura sobre todo el terreno.

Los pinos, abetos y frondosos registrados en el paisaje se sustituyen por versiones texturizadas al terminar la carga; si falla un recurso, queda la geometría de respaldo. Una carga de un entorno abandonado no se añade al mundo nuevo. Se añaden rocas y helechos junto al circuito, fuera de la calzada. Los materiales y las geometrías de cada paisaje son propios, para poder liberar un entorno sin invalidar la caché de modelos.

El agua usa un material físico con IOR 1,333, reflejo del entorno, dos escalas de ondulación y normales animadas en el espacio correcto de la cámara. Es un efecto ligero sin refracción por profundidad ni reflejos planares. No se ha descargado código de shaders de terceros.

La biblioteca también contiene props de circuito y materiales arquitectónicos preparados para siguientes pasadas. **No todos esos recursos están colocados automáticamente en cada circuito**. Las casas, palmeras, tribunas y parte del relieve conservan su geometría procedural; esta entrega no supone reconstruir los nueve entornos completos. El catálogo del editor manual mantiene sus prefabs actuales.

## Reproducir

```sh
python3 scripts/fetch-environment-assets.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/prepare-environment-models.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/bake-environment-impostors.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/review-environment-assets.py
python3 scripts/finalize-environment-assets.py
npm test
npm run build
```

La preparación requiere Blender y los helpers locales `blender-asset-qa` en `~/.codex/skills`; la descarga y el empaquetado requieren Python con Pillow. El juego y la biblioteca no consultan la API ni necesitan estos programas al ejecutarse. La herramienta de descarga identifica sus peticiones como `RoadRushers-Asset-Curation/1.0` y conserva los checksums.

## Límites de verificación

Las hojas y agujas contienen superficies abiertas e islas independientes intencionales, y sus UV se apilan para compartir un atlas. El informe conserva esos avisos. Algunos materiales de ramas usan una segunda capa UV: la primera puede tener área cero en esas caras. Eso no implica que falte la capa que usa el material; no deben eliminarse esas caras basándose solo en el comprobador genérico de UV0. Los restos de escaneado desconectados de las rocas sí se eliminan.

Los presupuestos móviles son límites de contenido, no una medición de FPS en teléfonos físicos. La comprobación visual de la página web quedó pendiente porque el navegador local estaba deshabilitado y el Mac bloqueado; se utilizan renders de Blender para revisar los modelos.
