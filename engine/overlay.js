/* revlens · engine/overlay.js — capa de revisión (se inyecta en el producto por el motor).
   Flujo FRANCOTIRADOR: clic en un punto → escribes tu inquietud/comentario → guardas directo, o
   consultas al asesor IA (que conoce el producto y te sugiere el comentario) → queda anclado con un
   pin numerado + panel lateral (ver/editar/borrar, autoguardado, a prueba de cierres). Genérico:
   el título y qué cuenta como «punto» los da /_rev/config. */
(function () {
  fetch('/_rev/config').then(function (r) { return r.json(); })
    .then(function (c) { init(c.titulo || 'REVISIÓN', c.puntos || 'p,li,h1,h2,h3,h4,figcaption,td,blockquote'); })
    .catch(function () { init('REVISIÓN', 'p,li,h1,h2,h3,h4,figcaption,td,blockquote'); });

  function init(TITULO, PUNTOS) {
    var sid = null, activo = false, punto = null, COMS = [];
    var norm = function (s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
    var qsa = function () { return document.querySelectorAll(PUNTOS); };
    function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    var css = document.createElement('style');
    css.textContent = [
      '#rev-bar{position:fixed;top:0;left:0;right:0;height:40px;background:#0b0e16;color:#fff;display:flex;align-items:center;gap:12px;padding:0 16px;z-index:100001;font:13px/1 -apple-system,system-ui,sans-serif}',
      '#rev-bar b{font-weight:700;letter-spacing:.08em}#rev-bar .sp{flex:1}',
      '#rev-bar button{background:#1a2030;color:#fff;border:1px solid #33405c;border-radius:7px;padding:7px 12px;font:inherit;cursor:pointer}',
      '#rev-bar button.on{background:#00b2d6;color:#0b0e16;border-color:#00b2d6;font-weight:700}',
      'body.rev-pad{padding-top:40px!important}',
      'body.rev-aim,body.rev-aim *{cursor:crosshair!important}',
      'body.rev-aim #rev-bar *,body.rev-aim #rev-panel *,body.rev-aim #rev-pop *{cursor:auto!important}',
      'body.rev-aim #rev-bar button,body.rev-aim #rev-panel button,body.rev-aim #rev-pop button,body.rev-aim .ver{cursor:pointer!important}',
      'body.rev-aim #rev-panel textarea,body.rev-aim #rev-pop textarea{cursor:text!important}',
      'body.rev-aim ' + PUNTOS.split(',').map(function (s) { return s.trim() + ':hover'; }).join(',') + '{background:rgba(0,178,214,.16);outline:1px solid #00b2d6}',
      '.rev-anc{background:#fff3b0!important;border-bottom:2px solid #e0a800}',
      '.rev-hascom{outline:1px solid rgba(224,168,0,.55);outline-offset:2px;position:relative}',
      '.rev-pin{position:absolute;top:-11px;left:-11px;min-width:22px;height:22px;padding:0 4px;box-sizing:border-box;border-radius:11px;background:#0b0e16;color:#fff;font:700 12px/22px -apple-system,system-ui,sans-serif;text-align:center;z-index:60;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.4);border:2px solid #fff;user-select:none}',
      '.rev-pin:hover{background:#00b2d6;color:#0b0e16;transform:scale(1.12)}',
      '.rev-flash{animation:revflash 1.4s ease}@keyframes revflash{0%,100%{background:transparent}30%{background:#fff3b0}}',
      '#rev-pop{position:absolute;z-index:99999;background:#fff;color:#111;border:1px solid #0b0e16;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.25);width:380px;max-width:92vw;display:none;font:14px/1.5 -apple-system,system-ui,sans-serif}',
      '#rev-pop .hd,#rev-panel .hd{background:#0b0e16;color:#fff;padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.06em;display:flex;align-items:center;gap:8px}',
      '#rev-pop .hd{border-radius:12px 12px 0 0}#rev-pop .hd .x,#rev-panel .hd .x{margin-left:auto;cursor:pointer;color:#aab6cc;font-weight:400}',
      '#rev-panel .hd .x{margin-left:0}',
      '#rev-pop .bd{padding:12px 14px;max-height:70vh;overflow:auto}',
      '.rev-frag{font-size:12.5px;color:#555;background:#f5f5f5;border-left:3px solid #00b2d6;padding:7px 9px;border-radius:0 6px 6px 0;margin-bottom:10px;max-height:88px;overflow:auto}',
      '#rev-pop label{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:2px 0 4px}',
      '#rev-pop textarea,#rev-panel textarea{width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:8px;padding:8px;font:inherit;resize:vertical}',
      '#rev-pop .aiv{background:#f2f4f7;border-radius:8px;padding:9px 11px;margin:10px 0;font-size:13px;white-space:pre-wrap;display:none}',
      '#rev-pop .row,#rev-panel .row{display:flex;gap:8px;margin-top:10px}',
      '#rev-pop button,#rev-panel button{border-radius:8px;padding:9px 12px;font:inherit;cursor:pointer;border:1px solid #ccc;background:#fff}',
      '#rev-pop button.pri,#rev-panel button.pri{background:#0b0e16;color:#fff;border-color:#0b0e16;font-weight:700}',
      '#rev-panel button.del{color:#8a1f1f;border-color:#e3b0b0}',
      '#rev-pop button:disabled{opacity:.5;cursor:default}',
      '#rev-panel{position:fixed;top:40px;right:0;bottom:0;width:400px;max-width:94vw;background:#fbfbfc;border-left:1px solid #d9d9d9;z-index:100000;display:none;flex-direction:column;font:14px/1.5 -apple-system,system-ui,sans-serif}',
      '#rev-panel.open{display:flex}body.rev-panel-open{padding-right:400px}',
      '#rev-panel .hd button.cp{margin-left:auto;margin-right:8px;background:#1a2030;color:#fff;border:1px solid #33405c;border-radius:6px;padding:5px 9px;cursor:pointer;font:inherit;font-size:12px}',
      '#rev-list{flex:1;overflow:auto;padding:12px}',
      '.rev-card{background:#fff;border:1px solid #e3e3e3;border-radius:10px;padding:11px 12px;margin-bottom:10px}',
      '.rev-card .sec{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#00819c;display:flex;align-items:center;gap:8px}',
      '.rev-card .num{display:inline-block;min-width:20px;height:20px;line-height:20px;text-align:center;background:#0b0e16;color:#fff;border-radius:10px;font-size:11px;padding:0 3px}',
      '.rev-card .sec .ver{margin-left:auto;font-weight:400;text-transform:none;letter-spacing:0;color:#0b0e16;text-decoration:underline;cursor:pointer;font-size:12px}',
      '.rev-card .inq{font-size:12px;color:#888;font-style:italic;margin:5px 0}',
      '#rev-empty{color:#999;font-size:13px;text-align:center;padding:30px 12px}',
      '#rev-toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#0b0e16;color:#fff;padding:9px 16px;border-radius:8px;z-index:100002;font:13px system-ui;opacity:0;transition:opacity .2s}#rev-toast.show{opacity:1}'
    ].join('');
    document.head.appendChild(css);
    document.body.classList.add('rev-pad');

    var bar = document.createElement('div'); bar.id = 'rev-bar';
    bar.innerHTML = '<b>' + esc(TITULO) + '</b><button id="rev-aim">🎯 Comentar un punto</button>'
      + '<button id="rev-open">📋 Comentarios <span id="rev-count">0</span></button><span class="sp"></span>';
    document.body.appendChild(bar);
    var toast = document.createElement('div'); toast.id = 'rev-toast'; document.body.appendChild(toast);
    function aviso(t) { toast.textContent = t; toast.classList.add('show'); setTimeout(function () { toast.classList.remove('show'); }, 2000); }

    // borrador anti-pérdida
    var BORR = 'revlens-draft::' + location.pathname;
    function snapBorrador() { if (!punto) return; var cw = document.getElementById('rev-cwrap'), av = document.getElementById('rev-aiv');
      try { localStorage.setItem(BORR, JSON.stringify({ seccion: punto.seccion, fragmento: punto.fragmento, inquietud: document.getElementById('rev-inq').value, aiv: av.style.display !== 'none' ? av.textContent : '', comentario: cw.style.display !== 'none' ? document.getElementById('rev-com').value : '' })); } catch (e) {} }
    function limpiarBorrador() { try { localStorage.removeItem(BORR); } catch (e) {} }
    function restaurarBorrador(d) {
      var el = elPorFrag(d.fragmento); punto = { seccion: d.seccion, fragmento: d.fragmento, el: el };
      if (el) { el.classList.add('rev-anc'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      document.getElementById('rev-sec').textContent = d.seccion; document.getElementById('rev-frag').textContent = '“' + d.fragmento + '”';
      document.getElementById('rev-inq').value = d.inquietud || '';
      var av = document.getElementById('rev-aiv'); if (d.aiv) { av.style.display = 'block'; av.textContent = d.aiv; } else av.style.display = 'none';
      var cw = document.getElementById('rev-cwrap'); if (d.comentario) { cw.style.display = 'block'; document.getElementById('rev-com').value = d.comentario; } else cw.style.display = 'none';
      pop.style.top = (window.scrollY + 130) + 'px'; pop.style.left = Math.max(10, (window.innerWidth - 400) / 2) + 'px'; pop.style.display = 'block';
    }
    function ofrecerRecuperar() { var raw; try { raw = localStorage.getItem(BORR); } catch (e) {} if (!raw) return; var d; try { d = JSON.parse(raw); } catch (e) { return; }
      if (!d || (!(d.inquietud || '').trim() && !(d.comentario || '').trim())) { limpiarBorrador(); return; }
      var ban = document.createElement('span'); ban.style.cssText = 'display:flex;gap:8px;align-items:center;color:#ffd24a;font-size:12.5px';
      ban.innerHTML = '📝 comentario a medias sin guardar <button id="rev-rec">Recuperar</button><button id="rev-desc">Descartar</button>';
      document.querySelector('#rev-bar .sp').appendChild(ban);
      document.getElementById('rev-rec').onclick = function () { restaurarBorrador(d); ban.remove(); };
      document.getElementById('rev-desc').onclick = function () { limpiarBorrador(); ban.remove(); }; }

    // popup francotirador
    var pop = document.createElement('div'); pop.id = 'rev-pop';
    pop.innerHTML = '<div class="hd"><span id="rev-sec">Punto</span><span class="x" id="rev-x">✕</span></div><div class="bd">'
      + '<div class="rev-frag" id="rev-frag"></div><label>Tu comentario sobre este punto</label>'
      + '<textarea id="rev-inq" rows="3" placeholder="Escribe tu comentario, o lo que te inquieta si vas a pedir al asesor…"></textarea>'
      + '<div class="row"><button class="pri" id="rev-savedirect" style="flex:1">Guardar ✓</button><button id="rev-ask">Consultar al asesor</button></div>'
      + '<div class="aiv" id="rev-aiv"></div>'
      + '<div id="rev-cwrap" style="display:none"><label>Comentario sugerido por el asesor (editable)</label><textarea id="rev-com" rows="3"></textarea>'
      + '<div class="row"><button class="pri" id="rev-save" style="flex:1">Guardar este ✓</button></div></div></div>';
    document.body.appendChild(pop);

    function seccionDe(el) { var h = el.closest && (el.closest('section,article,[data-seccion]')); if (h) { var t = h.getAttribute && h.getAttribute('data-seccion'); if (t) return t.slice(0, 80); var hh = h.querySelector && h.querySelector('h1,h2,h3'); if (hh) return (hh.textContent || '').trim().slice(0, 80); } return (document.title || 'Documento').slice(0, 80); }
    function elPorFrag(frag) { var a = norm(frag).slice(0, 60), found = null; qsa().forEach(function (x) { if (!found && a && norm(x.innerText).indexOf(a) >= 0) found = x; }); return found; }
    function cerrarPop() { pop.style.display = 'none'; if (punto && punto.el) punto.el.classList.remove('rev-anc'); punto = null; }
    document.getElementById('rev-x').onclick = function () { limpiarBorrador(); cerrarPop(); };
    document.getElementById('rev-inq').addEventListener('input', snapBorrador);
    document.getElementById('rev-com').addEventListener('input', snapBorrador);

    document.getElementById('rev-aim').onclick = function () { activo = !activo; this.classList.toggle('on', activo); document.body.classList.toggle('rev-aim', activo); if (!activo) cerrarPop(); aviso(activo ? '🎯 Clica el punto exacto que quieras comentar' : 'Modo comentar desactivado'); };
    document.addEventListener('click', function (e) {
      if (!activo || e.target.closest('#rev-pop') || e.target.closest('#rev-bar') || e.target.closest('#rev-panel')) return;
      var el = e.target; if (!el.innerText || !el.innerText.trim()) el = el.closest && el.closest(PUNTOS); if (!el) return;
      e.preventDefault(); e.stopPropagation(); if (punto && punto.el) punto.el.classList.remove('rev-anc');
      var frag = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 400); punto = { seccion: seccionDe(el), fragmento: frag, el: el }; el.classList.add('rev-anc');
      document.getElementById('rev-sec').textContent = punto.seccion; document.getElementById('rev-frag').textContent = '“' + frag + '”';
      document.getElementById('rev-inq').value = ''; document.getElementById('rev-aiv').style.display = 'none'; document.getElementById('rev-cwrap').style.display = 'none';
      var b = document.getElementById('rev-ask'); b.disabled = false; b.textContent = 'Consultar al asesor';
      pop.style.top = (window.scrollY + Math.min(e.clientY + 12, window.innerHeight - 340)) + 'px'; pop.style.left = Math.max(10, Math.min(e.clientX, window.innerWidth - 400)) + 'px';
      pop.style.display = 'block'; document.getElementById('rev-inq').focus();
    }, true);

    document.getElementById('rev-ask').onclick = function () {
      var inq = document.getElementById('rev-inq').value.trim(); if (!inq || !punto) return;
      var btn = this; btn.disabled = true; btn.textContent = 'Consultando…';
      var aiv = document.getElementById('rev-aiv'); aiv.style.display = 'block'; aiv.textContent = 'El asesor está revisando tu inquietud sobre este punto…';
      var msg = 'PUNTO DEL DOCUMENTO (sección «' + punto.seccion + '»):\n“' + punto.fragmento + '”\n\nMI INQUIETUD SOBRE ESTE PUNTO:\n' + inq
        + '\n\nRevisa mi inquietud sobre este punto concreto: dime si la compartes o no y por qué (breve), y termina SIEMPRE con la línea 📌 COMENTARIO: <el comentario/instrucción accionable que debería quedar registrado>.';
      fetch('/api/asesor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensaje: msg, sid: sid }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (!j.ok) { aiv.textContent = '⚠ ' + (j.error || 'el asesor no respondió'); btn.disabled = false; btn.textContent = 'Reintentar'; return; }
          sid = j.sid; var m = j.texto.match(/📌\s*COMENTARIO:\s*([\s\S]+)$/);
          aiv.textContent = m ? j.texto.slice(0, m.index).trim() : j.texto;
          document.getElementById('rev-com').value = m ? m[1].trim() : j.texto.trim();
          document.getElementById('rev-cwrap').style.display = 'block'; btn.textContent = 'Volver a consultar'; btn.disabled = false; snapBorrador();
          pop.querySelector('.bd').scrollTop = pop.querySelector('.bd').scrollHeight;
        }).catch(function () { aiv.textContent = '⚠ error de conexión'; btn.disabled = false; btn.textContent = 'Reintentar'; });
    };
    function guardarComentario(inquietud, texto) { if (!texto || !punto) return;
      fetch('/api/comentario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seccion: punto.seccion, ancla: punto.fragmento, inquietud: inquietud, texto: texto, sid: sid }) })
        .then(function (r) { return r.json(); }).then(function () { limpiarBorrador(); cerrarPop(); aviso('Comentario guardado ✓ · en 📋 Comentarios'); cargar(true); }); }
    document.getElementById('rev-savedirect').onclick = function () { guardarComentario('', document.getElementById('rev-inq').value.trim()); };
    document.getElementById('rev-save').onclick = function () { guardarComentario(document.getElementById('rev-inq').value.trim(), document.getElementById('rev-com').value.trim()); };

    // panel
    var panel = document.createElement('div'); panel.id = 'rev-panel';
    panel.innerHTML = '<div class="hd"><span>📋 Comentarios</span><button class="cp" id="rev-copy">Copiar para la IA</button><span class="x" id="rev-px">✕</span></div><div id="rev-list"></div>';
    document.body.appendChild(panel);
    document.getElementById('rev-px').onclick = function () { panel.classList.remove('open'); document.body.classList.remove('rev-panel-open'); document.getElementById('rev-open').classList.remove('on'); };
    document.getElementById('rev-open').onclick = function () { var open = panel.classList.toggle('open'); document.body.classList.toggle('rev-panel-open', open); this.classList.toggle('on', open); if (open) { cerrarPop(); pintar(); } };
    document.getElementById('rev-copy').onclick = function () { if (!COMS.length) { aviso('No hay comentarios que copiar'); return; } navigator.clipboard.writeText(textoParaIA()).then(function () { aviso('✓ ' + COMS.length + ' comentario(s) copiados'); }, function () { aviso('No se pudo copiar'); }); };
    var byId = function (id) { return COMS.filter(function (c) { return c.id === id; })[0]; };
    function pintar() { var list = document.getElementById('rev-list');
      if (!COMS.length) { list.innerHTML = '<div id="rev-empty">Aún no hay comentarios. Pulsa «🎯 Comentar un punto».</div>'; return; }
      list.innerHTML = '';
      COMS.slice().reverse().forEach(function (c) { var n = COMS.indexOf(c) + 1; var card = document.createElement('div'); card.className = 'rev-card'; card.setAttribute('data-card', c.id);
        card.innerHTML = '<div class="sec"><span class="num">' + n + '</span>' + esc(c.seccion || 'Punto') + '<span class="ver" data-ver="' + c.id + '">ver el punto ↩</span></div>'
          + '<div class="rev-frag">“' + esc((c.ancla || '').slice(0, 220)) + '”</div>' + (c.inquietud ? '<div class="inq">Te inquietaba: ' + esc(c.inquietud) + '</div>' : '')
          + '<textarea rows="3" data-com="' + c.id + '">' + esc(c.texto) + '</textarea>'
          + '<div class="row"><button class="pri" data-save="' + c.id + '" style="flex:1">Guardar cambios</button><button class="del" data-del="' + c.id + '">Borrar</button></div>';
        list.appendChild(card); });
      list.querySelectorAll('[data-ver]').forEach(function (b) { b.onclick = function () { verPunto(byId(this.dataset.ver)); }; });
      list.querySelectorAll('[data-save]').forEach(function (b) { b.onclick = function () { var id = this.dataset.save; guardarCambios(id, list.querySelector('[data-com="' + id + '"]').value); }; });
      list.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { borrar(this.dataset.del); }; });
      var timers = {}; list.querySelectorAll('[data-com]').forEach(function (ta) { ta.addEventListener('input', function () { var id = ta.dataset.com; clearTimeout(timers[id]); timers[id] = setTimeout(function () { guardarCambios(id, ta.value, true); }, 600); }); });
    }
    function guardarCambios(id, texto, auto) { var x = byId(id); if (x) x.texto = texto; fetch('/api/comentario/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: texto }) }).then(function () { aviso(auto ? 'Guardado ✓' : 'Cambios guardados ✓'); }); }
    function borrar(id) { fetch('/api/comentario/' + id, { method: 'DELETE' }).then(function () { aviso('Comentario borrado'); cargar(); }); }
    function verPunto(c) { if (!c) return; var el = elPorFrag(c.ancla); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('rev-flash'); void el.offsetWidth; el.classList.add('rev-flash'); } else aviso('No encuentro ese punto en esta página'); }
    function textoParaIA() { return 'COMENTARIOS PARA PROCESAR (' + COMS.length + '):\n\n' + COMS.map(function (c, i) { return '[' + (i + 1) + '] ' + (c.seccion || 'Punto') + ' — «' + (c.ancla || '').slice(0, 160) + '»' + (c.inquietud ? '\n    Inquietud: ' + c.inquietud : '') + '\n    Comentario: ' + c.texto; }).join('\n\n'); }
    function marcar() {
      document.querySelectorAll('.rev-hascom').forEach(function (el) { el.classList.remove('rev-hascom'); });
      document.querySelectorAll('.rev-pin').forEach(function (p) { p.remove(); });
      var usados = new Map();
      COMS.forEach(function (c, i) { var el = elPorFrag(c.ancla); if (!el) return; el.classList.add('rev-hascom'); if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        var k = usados.get(el) || 0; usados.set(el, k + 1); var pin = document.createElement('span'); pin.className = 'rev-pin'; pin.textContent = (i + 1); pin.title = 'Comentario ' + (i + 1) + ': ' + (c.texto || '').slice(0, 90); pin.style.left = (-11 + k * 22) + 'px';
        pin.onclick = function (e) { e.stopPropagation(); e.preventDefault(); abrirEnPanel(c.id); }; el.appendChild(pin); });
    }
    function abrirEnPanel(id) { if (!panel.classList.contains('open')) document.getElementById('rev-open').click(); setTimeout(function () { var card = document.querySelector('[data-card="' + id + '"]'); if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.remove('rev-flash'); void card.offsetWidth; card.classList.add('rev-flash'); } }, 180); }
    function cargar(abrir) { return fetch('/api/comentarios').then(function (r) { return r.json(); }).then(function (a) { COMS = a.filter(function (c) { return c.estado === 'pendiente'; }); document.getElementById('rev-count').textContent = COMS.length; marcar(); if (panel.classList.contains('open') || abrir) pintar(); if (abrir && !panel.classList.contains('open')) document.getElementById('rev-open').click(); }).catch(function () {}); }
    cargar(); ofrecerRecuperar();
  }
})();
