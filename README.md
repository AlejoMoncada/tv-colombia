# tv-colombia

Guía para abrir las señales oficiales de la televisión colombiana. La aplicación no aloja ni retransmite contenido.

## Cómo funciona

La guía (`index.html`) abre cada canal de dos formas:

- **Con reproductor propio** (`player.html?ch=<canal>`): la señal en vivo se ve a pantalla completa dentro de la app, sin página intermedia. Canales: Caracol, Canal 1, Canal Trece, Señal Colombia y Canal Institucional.
- **Con la página oficial** (`href` directo): los canales que no publican una señal reproducible de forma estable (Canal RCN, Canal Capital, Citytv, Teleantioquia, Telecaribe, Telepacífico, Telemedellín y RTVC Play).

Fuentes del reproductor, todas oficiales del canal:

| Canal | Fuente |
| --- | --- |
| Canal 1 | Dailymotion live de *Canal 1 Colombia* (el id `onair` se resuelve por API; hay uno de respaldo) |
| Caracol | YouTube live del canal del canal `UCcpE1fmG2qBZatj28bak2ng` |
| Canal Trece | Player oficial del canal (`player.instantvideocloud.net`) |
| Señal Colombia | HLS oficial de RTVC |
| Canal Institucional | HLS oficial de RTVC |

No se usan listas IPTV de terceros: dependen de servidores ajenos, cambian sin aviso y no son oficiales.

### Control remoto dentro del reproductor

- `Atrás` (webOS: 461, Tizen: 10009, Escape, Backspace): vuelve a la guía.
- `OK` / `0` / `2`: reactiva el sonido o reintenta la reproducción cuando el navegador bloquea el autoplay.
- `1`: abre la página oficial del canal si la señal no arranca.

Si el televisor no puede reproducir la señal (por ejemplo, un HLS sin soporte nativo y sin `hls.js` disponible), aparece un aviso con la instrucción de abrir la página oficial en lugar de una pantalla negra.

## Pruebas

La suite cubre el contrato público del reproductor con un navegador real (Playwright), sirviendo el repositorio por HTTP local y bloqueando todo pedido externo:

```bash
NODE_PATH="$(npm root -g)" node tests/player.test.mjs
```

Verifica, entre otras cosas, que cada canal resuelve su fuente oficial, que `Atrás` y `1` navegan a donde corresponde, que un canal desconocido explica el problema y que `webos/player.html` y `webos/player.js` son idénticos a los publicados en la raíz.

## Instalar en un televisor LG (webOS)

El paquete de la aplicación está en `webos/`. Para instalarlo se usa **Developer Mode** en el televisor y `ares-cli` (`@webos-tools/cli`) en el computador.

1. Instale **Developer Mode** desde LG Content Store, inicie sesión con su cuenta de desarrollador de LG y active el modo de desarrollador. Anote la dirección IP del televisor y la frase de acceso (key).
2. Instale la herramienta y registre el televisor (nombre, IP, usuario `prisoner` y la frase de acceso):

```bash
npm install -g @webos-tools/cli
ares-setup-device
```

3. Empaquete la carpeta `webos/` e instale el `.ipk` en el televisor. `NOMBRE_TV` es el nombre que eligió en `ares-setup-device`.

```bash
ares-package webos -o webos/dist
ares-install --device NOMBRE_TV webos/dist/com.alejomoncada.tvcolombia_1.0.3_all.ipk
```

El paquete ya generado está en `webos/dist/com.alejomoncada.tvcolombia_1.0.3_all.ipk`.

`player.html` y `player.js` existen duplicados en la raíz (sitio publicado) y en `webos/` (paquete de la app). La suite de pruebas falla si dejan de ser idénticos.
