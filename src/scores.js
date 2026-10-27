/* FC8Bit Super Y4M4L - online scoreboard client.
   Talks to the .NET API in server/. Everything here degrades quietly: if the
   API is not running the game carries on with its localStorage high score. */
window.FC8 = window.FC8 || {};

FC8.scores = (function () {
  'use strict';

  /* Where the API lives. Served from a dev host we talk to the local server,
     anywhere else to the deployed one - otherwise a published game would call
     localhost on the player's own machine and the board would always be empty.
     Point API_PROD at your own Fly app, or override at runtime with
     FC8.scores.configure({ base: '...' }). */
  var API_PROD = 'https://superyamal.fly.dev';
  var DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/i;

  var CFG = {
    base: DEV_HOST.test(window.location.hostname) ? 'http://localhost:5090' : API_PROD,

    /* Shared with the server so a score cannot simply be POSTed by hand.
       Worth being honest about what this is: the key ships inside this file,
       so anyone who opens devtools can sign their own payload. It stops casual
       fake posts, not a determined player. The checks that actually hold are
       server-side - score ceiling, name rules, rate limit, single-use nonce. */
    secret: 'f941077338c4f341b71989160ded80b4ea5a240b59fef49751a773e4d63b3652',

    /* Generous because the API is deployed with auto_stop_machines: the first
       request after an idle spell has to boot the machine as well as answer,
       which 4s did not reliably cover. Nothing waits on this - the title card
       draws regardless and the board panel only appears if rows arrive - so a
       longer ceiling costs nothing and just stops a cold start looking like
       an empty leaderboard. */
    timeout: 8000
  };

  function configure(opts) {
    if (opts && opts.base) CFG.base = opts.base.replace(/\/+$/, '');
    if (opts && opts.secret) CFG.secret = opts.secret;
    return CFG;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, ms);
      promise.then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
                   function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } });
    });
  }

  function hex(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
    return s;
  }

  /* How long one signing bucket lasts. Must match SigningWindowSeconds on the
     server; the two derive the same key from the same timestamp. */
  var WINDOW = 120;

  function hmacHex(keyText, payload) {
    var enc = new TextEncoder();
    return window.crypto.subtle
      .importKey('raw', enc.encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return window.crypto.subtle.sign('HMAC', k, enc.encode(payload)); })
      .then(hex);
  }

  /** HMAC-SHA256 over the canonical payload, under a key derived from the
      timestamp rather than CFG.secret itself.

      Be clear about what this is for: it is obfuscation, not secrecy. The
      derivation sits right here in a file the browser downloads, so anyone
      reading it can reproduce the key for any moment they like. What it does
      buy is that a key copied out of this file is not enough on its own - a
      signature, or a key, scraped from a request stops working once the bucket
      rolls. It moves forging a score from 'copy the string' to 'read the code
      and re-run it', and no further. The checks that actually hold are all
      server-side: score ceiling, timestamp window, single-use nonce, rate
      limit. */
  function sign(canonical, ts) {
    return hmacHex(CFG.secret, 'fc8-w' + Math.floor(ts / WINDOW))
      .then(function (windowKey) { return hmacHex(windowKey, canonical); });
  }

  function nonce() {
    var a = new Uint8Array(16);
    window.crypto.getRandomValues(a);
    return hex(a.buffer);
  }

  /** Top scores, newest board first. Resolves to [] when the API is down. */
  function top(limit) {
    return withTimeout(fetch(CFG.base + '/api/scores?limit=' + (limit || 10)), CFG.timeout)
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  /** Submit a run. Resolves to {ok, rank} or {ok:false, error}. */
  function submit(entry) {
    var name = String(entry.name || '').trim().toUpperCase().slice(0, 12);
    var score = Math.max(0, Math.round(entry.score || 0));
    var balls = Math.max(0, Math.round(entry.balls || 0));
    var level = Math.max(0, Math.round(entry.level || 0));
    var ts = Math.floor(Date.now() / 1000);
    var nc = nonce();
    var canonical = [name, score, balls, level, ts, nc].join('|');

    return sign(canonical, ts).then(function (hash) {
      return withTimeout(fetch(CFG.base + '/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, score: score, balls: balls, level: level, ts: ts, nonce: nc, hash: hash })
      }), CFG.timeout);
    }).then(function (r) {
      return r.json().then(function (body) {
        return r.ok ? { ok: true, rank: body.rank, name: body.name }
                    : { ok: false, error: body.error || ('http ' + r.status) };
      });
    }).catch(function (e) {
      return { ok: false, error: e.message || 'offline' };
    });
  }

  /* ------------------------------------------------------------ name entry */
  /* A DOM overlay rather than an in-canvas widget: it gets a real keyboard on
     phones, and it can be read by a screen reader. */
  function askName(defaultName) {
    return new Promise(function (resolve) {
      var host = document.getElementById('shell') || document.body;
      var wrap = document.createElement('div');
      wrap.className = 'fc8-modal';
      wrap.innerHTML =
        '<form class="fc8-card" novalidate>' +
        '  <h2>ENTER YOUR NAME</h2>' +
        '  <p>Your score goes on the online board.</p>' +
        '  <input type="text" maxlength="12" autocomplete="off" spellcheck="false" ' +
        '         aria-label="Your name" />' +
        '  <div class="fc8-actions">' +
        '    <button type="submit" class="fc8-go">SUBMIT</button>' +
        '    <button type="button" class="fc8-skip">SKIP</button>' +
        '  </div>' +
        '</form>';
      host.appendChild(wrap);

      var form = wrap.querySelector('form');
      var input = wrap.querySelector('input');
      input.value = defaultName || '';
      setTimeout(function () { input.focus(); input.select(); }, 30);

      function close(value) {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        document.removeEventListener('keydown', onKey, true);
        resolve(value);
      }
      function onKey(e) {
        // the game listens on window for Enter/Space; keep those to ourselves
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
      }
      document.addEventListener('keydown', onKey, true);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value.trim();
        close(v ? v : null);
      });
      wrap.querySelector('.fc8-skip').addEventListener('click', function () { close(null); });
    });
  }

  function remember(name) {
    try { window.localStorage.setItem('fc8-name', name); } catch (e) { /* private mode */ }
  }
  function lastName() {
    try { return window.localStorage.getItem('fc8-name') || ''; } catch (e) { return ''; }
  }

  return {
    configure: configure, top: top, submit: submit,
    askName: askName, remember: remember, lastName: lastName, CFG: CFG
  };
})();
