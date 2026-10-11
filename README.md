# tv-colombia

Guía para abrir las señales oficiales de la televisión colombiana. La aplicación no aloja ni retransmite contenido.

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
ares-install --device NOMBRE_TV webos/dist/com.alejomoncada.tvcolombia_1.0.0_all.ipk
```

El paquete ya generado está en `webos/dist/com.alejomoncada.tvcolombia_1.0.0_all.ipk`.