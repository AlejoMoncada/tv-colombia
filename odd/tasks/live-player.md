# Live player for tv-colombia

In-app fullscreen player so a tile plays the channel's live signal instead of opening its web page. Sources are official (YouTube live, broadcaster HLS, broadcaster player embed).

## Specs

S1. Al pulsar un canal en la app, la señal en vivo se despliega a pantalla completa dentro de la app, sin barra del navegador ni página intermedia.
User wording: "lo del canal 1 en vivo me parece mas adecuado inclusive que cuadno de click despliegue en pantlal completa"

S2. Para los canales con fuente reproducible, la app debe mostrar la transmisión en vivo, no la página del canal.
User wording: "Igual que uno me aparece en Canal Trce veo la pagina pero no una transmisión en Vivo"

S3. El reproductor se maneja con el control remoto: `Atrás` vuelve a la guía, `OK` reintenta/silencia el sonido, `1` abre la fuente oficial como salida de emergencia.

S4. Si una señal no se puede reproducir, se muestra un aviso legible y la opción de abrir la página oficial; nunca una pantalla negra muda.

S5. Los canales que ya funcionaban (RCN por su sitio) siguen igual: esta entrega no rompe lo que ya andaba.

S6. Fuentes verificadas (HTTP 200 + contenido válido al momento de implementar):

| key | canal | fuente | verificación |
| --- | --- | --- | --- |
| `canal1` | Canal 1 | Dailymotion live de "Canal 1 Colombia" (`live_status=onair`, hoy `x9nvvkc`) con respaldo fijo | API `api.dailymotion.com` devuelve `onair` |
| `caracol` | Caracol | YouTube live del canal `UCcpE1fmG2qBZatj28bak2ng` | `/@caracoltv/live` → `watch?v=HyuGqSkoeJg` |
| `senalcolombia` | Señal Colombia | HLS oficial `streaming.rtvc.gov.co/TV_Senal_Colombia_live/smil:live.smil/playlist.m3u8` | respuesta `#EXTM3U` |
| `institucional` | Canal Institucional | HLS oficial `streaming.rtvc.gov.co/TV_CanalInstitucional_live/smil:live.smil/playlist.m3u8` | respuesta `#EXTM3U` |
| `trece` | Canal Trece | embed oficial del canal `player.instantvideocloud.net/#/embed/c6bf0e38` | referenciado por `canaltrece.com.co/canal-trece/` |

Canales sin fuente reproducible propia (Capital, Citytv, Teleantioquia, Telecaribe, Telepacífico, Telemedellín, RTVC Play): siguen abriendo su página oficial; el reproductor no los inventa.

## Tasks

| ID | Spec | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2, S3, S4, S6 | tests Playwright + `player.js`/`player.html` | `feat: play channel live signals in an in-app player` |
| T2 | S1, S2, S5 | cablear tiles de `index.html` (raíz y `webos/`) | `feat: open channels through the live player` |
| T3 | S6 | versión 1.0.3, `README.md`, ipk | `build: package release 1.0.3` |

## Log

L1 (usuario): "SI está perfecto RCN, y lo del canal 1 en vivo me parece mas adecuado inclusive que cuadno de click despliegue en pantlal completa"

L2 (usuario): "Igual que uno me aparece en Canal Trce veo la pagina pero no una transmisión en Vivo"

L3 (evidencia, 2026-10-27): Canal Trece no transmite en YouTube (`/@canaltrececo/live` resuelve al canal, sin `watch?v=`), su señal web vive en el embed de instantvideocloud. Canal 1 usa Dailymotion (`x9nvvkc` onair, con ids de respaldo `xbjnkui`, `xbjni86`, `xbjnk3m`, `xbmd2nu`). RTVC publica HLS oficial para Señal Colombia e Institucional.

L4 (decisión): no se usan listas IPTV de terceros (`138.121.15.230:9002`, `190.109.2.92:8000`, etc.): no son oficiales, dependen de IPs residenciales y se caen sin aviso.
