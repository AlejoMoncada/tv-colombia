/*
 * TV Colombia live player.
 *
 * A tile on the guide opens `player.html?ch=<key>` and this file mounts the
 * channel's official live signal edge to edge. Sources are official only:
 * the broadcaster's YouTube live, the broadcaster's HLS manifest, the
 * broadcaster's own player embed, or the channel's Dailymotion live.
 */
(function (window, document) {
  'use strict';

  var HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
  var YT_API = 'https://www.youtube.com/iframe_api';
  var HUD_HIDE_MS = 5000;

  // Every source below was verified against the broadcaster itself, see
  // odd/tasks/live-player.md. Never add an unofficial IPTV mirror here.
  var SOURCES = {
    canal1: {
      name: 'Canal 1',
      type: 'dm',
      dm: { owner: 'Canal 1 Colombia', search: 'Canal 1 Se\u00f1al en vivo', fallback: 'x9nvvkc' },
      page: 'https://canal1.com.co/senal-en-vivo/'
    },
    caracol: {
      name: 'Caracol',
      type: 'yt',
      yt: { channel: 'UCcpE1fmG2qBZatj28bak2ng' },
      page: 'https://www.caracoltv.com/senal-vivo'
    },
    senalcolombia: {
      name: 'Se\u00f1al Colombia',
      type: 'hls',
      url: 'https://streaming.rtvc.gov.co/TV_Senal_Colombia_live/smil:live.smil/playlist.m3u8',
      page: 'https://www.rtvcplay.co/en-vivo/senal-colombia'
    },
    institucional: {
      name: 'Institucional',
      type: 'hls',
      url: 'https://streaming.rtvc.gov.co/TV_CanalInstitucional_live/smil:live.smil/playlist.m3u8',
      page: 'https://www.rtvcplay.co/en-vivo/canal-institucional'
    },
    trece: {
      name: 'Canal Trece',
      type: 'frame',
      url: 'https://player.instantvideocloud.net/#/embed/c6bf0e38',
      page: 'https://canaltrece.com.co/canal-trece/'
    }
  };

  var stage = document.getElementById('stage');
  var aviso = document.getElementById('aviso');
  var hud = document.getElementById('hud');
  var hudName = document.getElementById('hud-name');
  var hudHint = document.getElementById('hud-hint');
  var iframe = null;
  var video = null;
  var hudTimer = 0;

  function param(name) {
    var match = new RegExp('[?&]' + name + '=([^&]*)').exec(document.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }

  function showAviso(message) {
    if (!aviso) return;
    aviso.textContent = message;
    aviso.className = 'on';
  }

  function hideAviso() {
    if (aviso) aviso.className = '';
  }

  function clearStage() {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    iframe = null;
    video = null;
  }

  function mountFrame(src, title) {
    iframe = document.createElement('iframe');
    iframe.setAttribute('src', src);
    iframe.setAttribute('title', title);
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.setAttribute('allowfullscreen', 'allowfullscreen');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    stage.appendChild(iframe);
    return iframe;
  }

  function mountVideo(url) {
    video = document.createElement('video');
    video.setAttribute('src', url);
    video.setAttribute('autoplay', 'autoplay');
    video.setAttribute('playsinline', 'playsinline');
    video.setAttribute('controls', 'controls');
    video.setAttribute('preload', 'auto');
    video.className = 'fill';
    stage.appendChild(video);

    if (video.canPlayType('application/vnd.apple.mpegurl')) return;

    loadScript(HLS_CDN, 8000, function () {
      if (!window.Hls || !window.Hls.isSupported()) {
        showAviso('Este televisor no puede reproducir esta se\u00f1al. Pulsa 1 para abrir la p\u00e1gina oficial.');
        return;
      }
      var hls = new window.Hls({ lowLatencyMode: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.ERROR, function (event, data) {
        if (data && data.fatal) {
          showAviso('La se\u00f1al no responde ahora. Pulsa 1 para abrir la p\u00e1gina oficial.');
        }
      });
    }, function () {
      showAviso('No se pudo cargar el reproductor. Pulsa 1 para abrir la p\u00e1gina oficial.');
    });
  }

  function loadScript(url, timeout, done, fail) {
    var script = document.createElement('script');
    var settled = false;
    var timer = window.setTimeout(function () {
      if (settled) return;
      settled = true;
      if (fail) fail();
    }, timeout);
    script.src = url;
    script.onload = function () {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      done();
    };
    script.onerror = function () {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (fail) fail();
    };
    document.head.appendChild(script);
  }

  function dmEmbedUrl(id) {
    return 'https://www.dailymotion.com/embed/video/' + id + '?autoplay=1&api=postMessage&queue-enable=false&ui-logo=false';
  }

  // Canal 1 rotates its Dailymotion live ids, so ask the public API which one is
  // on air and fall back to the last known id when the lookup is unavailable.
  function mountDailymotion(source) {
    var mounted = false;
    function mount(id) {
      if (mounted) return;
      mounted = true;
      mountFrame(dmEmbedUrl(id), source.name);
    }
    mount(source.dm.fallback);

    var query = 'https://api.dailymotion.com/videos?search=' +
      encodeURIComponent(source.dm.search) +
      '&fields=id,owner.screenname,live_status&limit=20';
    var controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 5000);

    fetch(query, controller ? { signal: controller.signal } : undefined)
      .then(function (response) { return response.json(); })
      .then(function (body) {
        var list = (body && body.list) || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].live_status === 'onair' && list[i]['owner.screenname'] === source.dm.owner) {
            window.clearTimeout(timer);
            clearStage();
            mounted = false;
            mount(list[i].id);
            return;
          }
        }
      })
      .catch(function () { /* keep the fallback id */ });
  }

  function mountYoutube(source) {
    mountFrame(
      'https://www.youtube.com/embed/live_stream?channel=' + source.yt.channel +
      '&autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=' +
      encodeURIComponent(document.location.origin),
      source.name
    );
  }

  function mount(source) {
    if (source.type === 'hls') mountVideo(source.url);
    else if (source.type === 'frame') mountFrame(source.url, source.name);
    else if (source.type === 'yt') mountYoutube(source);
    else if (source.type === 'dm') mountDailymotion(source);
  }

  function sendCommand(command) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(JSON.stringify(command), '*');
    } catch (error) { /* cross-origin player refused the command */ }
  }

  function ensureSound() {
    if (video) {
      video.muted = false;
      if (video.paused) video.play();
      return;
    }
    sendCommand({ event: 'command', func: 'unMute', args: [] });
    sendCommand({ event: 'command', func: 'playVideo', args: [] });
    sendCommand({ command: 'unmute' });
    sendCommand({ command: 'play' });
  }

  function showHud() {
    if (!hud) return;
    hud.className = 'on';
    window.clearTimeout(hudTimer);
    hudTimer = window.setTimeout(function () {
      hud.className = '';
    }, HUD_HIDE_MS);
  }

  function back(event) {
    if (event && event.preventDefault) event.preventDefault();
    document.location.replace('index.html');
  }

  function openOfficial(event) {
    var source = SOURCES[param('ch')];
    if (!source) return;
    if (event && event.preventDefault) event.preventDefault();
    document.location.href = source.page;
  }

  function onKeyDown(event) {
    var code = event.keyCode || event.which;
    if (code === 461 || code === 10009 || code === 27 || code === 8) {
      back(event);
      return false;
    }
    if (code === 49) {
      openOfficial(event);
      return false;
    }
    if (code === 13 || code === 32 || code === 48 || code === 50) {
      ensureSound();
      showHud();
      if (event.preventDefault) event.preventDefault();
      return false;
    }
    showHud();
    return true;
  }

  function start() {
    var key = param('ch');
    var source = SOURCES[key];

    document.body.dataset.channel = key || '';
    if (!source) {
      document.title = 'TV Colombia';
      showAviso('Ese canal no tiene reproductor propio todav\u00eda. Pulsa 1 para abrir su p\u00e1gina oficial o Atr\u00e1s para volver a la gu\u00eda.');
      return;
    }

    document.title = source.name + ' \u00b7 TV Colombia';
    document.body.dataset.page = source.page;
    hudName.textContent = source.name;
    hudHint.textContent = 'OK: sonido  \u00b7  1: p\u00e1gina oficial  \u00b7  Atr\u00e1s: gu\u00eda';
    showHud();
    hideAviso();
    mount(source);

    // Keep the remote running against this document: the streaming iframes
    // would otherwise swallow the back key once they take focus.
    window.focus();
    document.body.focus();
  }

  document.onkeydown = onKeyDown;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.TVPlayer = { sources: SOURCES, start: start };
}(window, document));
