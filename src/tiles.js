/* FC8Bit Super Y4M4L - procedural tileset + stadium backdrops. */
window.FC8 = window.FC8 || {};

FC8.tiles = (function () {
  'use strict';

  var T = 16; // tile size

  // Tile indices (index 0 must stay empty for the tilemap).
  var ID = {
    EMPTY: 0, TURF: 1, DIRT: 2, BRICK: 3, BALLBLOCK: 4, USED: 5, METAL: 6,
    STAND: 7, TUNNEL_TL: 8, TUNNEL_TR: 9, TUNNEL_BL: 10, TUNNEL_BR: 11,
    GIRDER: 12, SPIKES: 13, NET: 14, STONE: 15, STONE_TOP: 16
  };
  var COUNT = 17;

  // Tiles that never collide.
  var NO_COLLIDE = [ID.EMPTY, ID.NET];

  /* Deterministic little RNG so the art looks the same every run. */
  function rng(seed) {
    var s = seed || 1;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  function buildTileset(scene, key) {
    key = key || 'tiles';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    var tex = scene.textures.createCanvas(key, T * COUNT, T);
    var c = tex.getContext();
    var r = rng(7);

    function box(ox, x, y, w, h, col) { c.fillStyle = col; c.fillRect(ox + x, y, w, h); }

    var ox, i;

    /* ---- TURF: bright grass cap over brick earth (see assets/source refs) */
    ox = ID.TURF * T;
    function earth(o, y0) {
      box(o, 0, y0, T, T - y0, '#a2551f');
      for (var ey = y0; ey < T; ey += 4) {
        var stagger = ((ey / 4) | 0) % 2 ? 4 : 0;
        box(o, 0, ey, T, 1, '#6d3410');                  // mortar line
        for (var ex = 0; ex < T; ex += 8) {
          // NB: clamp to the tile - drawing outside it bleeds into the
          // neighbouring tile of the atlas strip (tile 0 is the empty one).
          var jx = ex + stagger;
          if (jx >= 0 && jx < T) box(o, jx, ey, 1, 4, '#6d3410');
        }
        box(o, 0, ey + 1, T, 1, '#bd6b2c');              // brick highlight
      }
    }
    earth(ox, 5);
    box(ox, 0, 0, T, 5, '#3fae3c');
    box(ox, 0, 0, T, 2, '#68d94f');
    box(ox, 0, 0, T, 1, '#93f06a');
    for (i = 0; i < T; i += 2) {                          // grass fringe
      box(ox, i, 5, 1, 1, '#3fae3c');
      box(ox, i + 1, 5, 1, 1, '#2a7c2b');
      if (i % 6 === 0) box(ox, i, 4, 1, 2, '#68d94f');
    }
    box(ox, 0, 6, T, 1, '#2a7c2b');

    /* ---- DIRT: the brick earth below the surface */
    ox = ID.DIRT * T;
    earth(ox, 0);
    for (i = 0; i < 6; i++) {
      box(ox, Math.floor(r() * T), Math.floor(r() * T), 1, 1, '#8a4517');
    }

    /* ---- BRICK: classic stadium brick block */
    ox = ID.BRICK * T;
    box(ox, 0, 0, T, T, '#7a2f0d');
    function brick(bx, by, bw) {
      box(ox, bx, by, bw, 6, '#d2691e');
      box(ox, bx, by, bw, 1, '#f09a4a');
      box(ox, bx, by + 5, bw, 1, '#9c440f');
    }
    brick(0, 1, 7); brick(8, 1, 7);
    brick(0, 9, 3); brick(4, 9, 7); brick(12, 9, 3);

    /* ---- BALLBLOCK: hit it for a football */
    ox = ID.BALLBLOCK * T;
    box(ox, 0, 0, T, T, '#7a4a05');
    box(ox, 1, 1, 14, 14, '#e5a614');
    box(ox, 1, 1, 14, 1, '#ffd45e');
    box(ox, 1, 1, 1, 14, '#ffd45e');
    box(ox, 1, 14, 14, 1, '#a86f06');
    box(ox, 14, 1, 1, 14, '#a86f06');
    [[2, 2], [12, 2], [2, 12], [12, 12]].forEach(function (p) {
      box(ox, p[0], p[1], 2, 2, '#fff29a');
    });
    // little football glyph
    box(ox, 5, 5, 6, 6, '#ffffff');
    box(ox, 4, 6, 8, 4, '#ffffff');
    box(ox, 6, 4, 4, 8, '#ffffff');
    box(ox, 7, 7, 2, 2, '#191a21');
    box(ox, 5, 5, 1, 1, '#191a21');
    box(ox, 10, 10, 1, 1, '#191a21');
    box(ox, 10, 5, 1, 1, '#191a21');
    box(ox, 5, 10, 1, 1, '#191a21');

    /* ---- USED block */
    ox = ID.USED * T;
    box(ox, 0, 0, T, T, '#3a2a18');
    box(ox, 1, 1, 14, 14, '#7c5a33');
    box(ox, 1, 1, 14, 1, '#9d7645');
    box(ox, 1, 14, 14, 1, '#553c22');
    [[3, 3], [11, 3], [3, 11], [11, 11]].forEach(function (p) {
      box(ox, p[0], p[1], 2, 2, '#b08a55');
    });

    /* ---- METAL block */
    ox = ID.METAL * T;
    box(ox, 0, 0, T, T, '#242c36');
    box(ox, 1, 1, 14, 14, '#6d7885');
    box(ox, 1, 1, 14, 2, '#98a4b1');
    box(ox, 1, 12, 14, 3, '#4b5563');
    [[3, 3], [11, 3], [3, 11], [11, 11]].forEach(function (p) {
      box(ox, p[0], p[1], 2, 2, '#c3ccd6');
    });

    /* ---- STAND: seating block */
    ox = ID.STAND * T;
    box(ox, 0, 0, T, T, '#141c33');
    for (var row = 0; row < 4; row++) {
      var y = row * 4;
      box(ox, 0, y, T, 3, row % 2 ? '#7b0b34' : '#01346a');
      for (var sx = 0; sx < T; sx += 3) {
        box(ox, sx, y, 2, 2, row % 2 ? '#a50044' : '#004d98');
      }
      box(ox, 0, y + 3, T, 1, '#0b1226');
    }

    /* ---- TUNNEL: players' tunnel (2x2 tiles) */
    function tunnel(id, left, top) {
      var o = id * T;
      box(o, 0, 0, T, T, '#59636f');
      box(o, 0, 0, T, T, '#59636f');
      // inner bore
      var ix = left ? 4 : 0, iw = 12;
      box(o, ix, top ? 5 : 0, iw, top ? 11 : T, '#1b2028');
      if (top) {
        box(o, 0, 0, T, 4, '#78838f');
        box(o, 0, 0, T, 1, '#9ba6b2');
        box(o, 0, 4, T, 1, '#39424c');
      }
      if (left) {
        box(o, 0, top ? 5 : 0, 4, T, '#6c7784');
        box(o, 0, top ? 5 : 0, 1, T, '#8d98a5');
        box(o, 3, top ? 5 : 0, 1, T, '#39424c');
      } else {
        box(o, 12, top ? 5 : 0, 4, T, '#6c7784');
        box(o, 15, top ? 5 : 0, 1, T, '#39424c');
        box(o, 12, top ? 5 : 0, 1, T, '#39424c');
      }
    }
    tunnel(ID.TUNNEL_TL, true, true);
    tunnel(ID.TUNNEL_TR, false, true);
    tunnel(ID.TUNNEL_BL, true, false);
    tunnel(ID.TUNNEL_BR, false, false);

    /* ---- GIRDER: floodlight gantry platform */
    ox = ID.GIRDER * T;
    box(ox, 0, 0, T, 5, '#8b96a3');
    box(ox, 0, 0, T, 1, '#c3ccd6');
    box(ox, 0, 4, T, 1, '#39424c');
    box(ox, 0, 5, T, 8, '#4d5764');
    for (i = 0; i < T; i += 4) {
      box(ox, i, 6, 1, 1, '#7b8694'); box(ox, i + 1, 7, 1, 1, '#7b8694');
      box(ox, i + 2, 8, 1, 1, '#7b8694'); box(ox, i + 3, 9, 1, 1, '#7b8694');
      box(ox, i + 3, 6, 1, 1, '#7b8694'); box(ox, i + 2, 7, 1, 1, '#7b8694');
      box(ox, i + 1, 8, 1, 1, '#7b8694'); box(ox, i, 9, 1, 1, '#7b8694');
    }
    box(ox, 0, 13, T, 3, '#2f3944');

    /* ---- SPIKES: turnstile studs */
    ox = ID.SPIKES * T;
    box(ox, 0, 11, T, 5, '#39424c');
    box(ox, 0, 11, T, 1, '#6c7784');
    for (var s = 0; s < 4; s++) {
      var bx = s * 4;
      box(ox, bx, 8, 4, 3, '#aab4c0');
      box(ox, bx + 1, 5, 2, 3, '#c3ccd6');
      box(ox, bx + 1, 2, 2, 3, '#eff5fa');
      box(ox, bx + 3, 5, 1, 6, '#5d6875');
    }

    /* ---- NET: decorative goal netting (never collides) */
    ox = ID.NET * T;
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 1;
    for (i = 0; i <= T; i += 4) {
      c.beginPath(); c.moveTo(ox + i + 0.5, 0); c.lineTo(ox + i + 0.5, T); c.stroke();
      c.beginPath(); c.moveTo(ox, i + 0.5); c.lineTo(ox + T, i + 0.5); c.stroke();
    }

    /* ---- STONE / STONE_TOP: the final tower */
    function stone(id, top) {
      var o = id * T;
      box(o, 0, 0, T, T, '#221d33');
      function blk(bx, by, bw, bh) {
        box(o, bx, by, bw, bh, '#3b3557');
        box(o, bx, by, bw, 1, '#4f4772');
        box(o, bx, by + bh - 1, bw, 1, '#2a2440');
      }
      blk(0, 1, 7, 6); blk(8, 1, 7, 6);
      blk(0, 8, 3, 7); blk(4, 8, 7, 7); blk(12, 8, 3, 7);
      for (i = 0; i < 10; i++) box(o, Math.floor(r() * T), Math.floor(r() * T), 1, 1, '#4a4270');
      if (top) {
        box(o, 0, 0, T, 3, '#6b5f9c');
        box(o, 0, 0, T, 1, '#8f81c7');
        box(o, 0, 3, T, 1, '#241f38');
        for (i = 0; i < 6; i++) box(o, Math.floor(r() * T), 1 + Math.floor(r() * 2), 1, 1, '#b7a8ef');
      }
    }
    stone(ID.STONE, false);
    stone(ID.STONE_TOP, true);

    tex.refresh();
    return key;
  }

  /* ------------------------------------------------------------- backdrops */
  function buildSky(scene, key, stops, stars) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    // Full width: a narrow canvas would smear the stars into long streaks.
    var H = 240, W = stars ? 416 : 8;
    var tex = scene.textures.createCanvas(key, W, H);
    var c = tex.getContext();
    var grad = c.createLinearGradient(0, 0, 0, H);
    stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);
    if (stars) {
      var r = rng(19);
      for (var i = 0; i < 70; i++) {
        c.fillStyle = r() > 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(190,200,255,0.55)';
        c.fillRect(Math.floor(r() * W), Math.floor(r() * (H * 0.75)), 1, 1);
      }
    }
    tex.refresh();
    return key;
  }

  /** Tileable crowd texture: seat rows packed with supporters. */
  function buildCrowd(scene, key, colors, seed, dark) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    var W = 128, H = 56;
    var tex = scene.textures.createCanvas(key, W, H);
    var c = tex.getContext();
    var r = rng(seed || 3);
    c.fillStyle = dark ? '#0a0d1a' : '#131a2c';
    c.fillRect(0, 0, W, H);
    for (var row = 0; row < H; row += 7) {
      c.fillStyle = dark ? '#151a2e' : '#1d2740';
      c.fillRect(0, row + 5, W, 2);
      for (var x = 0; x < W; x += 4) {
        var col = colors[Math.floor(r() * colors.length)];
        c.fillStyle = col;
        c.fillRect(x, row, 3, 4);        // body
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(x + 3, row, 1, 5);    // gap shading
        if (r() > 0.55) {                // raised scarf / flag
          c.fillStyle = col;
          c.fillRect(x, row - 2, 3, 2);
        }
      }
    }
    // barrier at the bottom
    c.fillStyle = '#39424c';
    c.fillRect(0, H - 4, W, 4);
    c.fillStyle = '#6c7784';
    c.fillRect(0, H - 4, W, 1);
    tex.refresh();
    return key;
  }

  /** Pitch-side advertising hoardings, tileable. */
  function buildBoards(scene, key) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    var W = 96, H = 14;
    var tex = scene.textures.createCanvas(key, W, H);
    var c = tex.getContext();
    c.fillStyle = '#0d1020'; c.fillRect(0, 0, W, H);
    var panels = [
      ['#a50044', '#edbb00'], ['#004d98', '#ffffff'],
      ['#101a44', '#edbb00'], ['#7b0b34', '#ffffff']
    ];
    for (var i = 0; i < 4; i++) {
      var x = i * 24, p = panels[i];
      c.fillStyle = p[0]; c.fillRect(x + 1, 2, 22, 10);
      c.fillStyle = p[1];
      for (var b = 0; b < 4; b++) c.fillRect(x + 4 + b * 5, 5, 3, 4);
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x + 1, 11, 22, 1);
    }
    c.fillStyle = '#39424c'; c.fillRect(0, 0, W, 2);
    c.fillStyle = '#1b2028'; c.fillRect(0, H - 2, W, 2);
    tex.refresh();
    return key;
  }

  /** Tifo banner strung across the stand: blaugrana flags and club colours. */
  function buildBanner(scene, key) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    var W = 104, H = 20;
    var tex = scene.textures.createCanvas(key, W, H);
    var c = tex.getContext();
    var r = rng(23);
    c.clearRect(0, 0, W, H);
    // hanging flags
    for (var f = 0; f < 4; f++) {
      var x = f * 26 + 2;
      c.fillStyle = '#7a1030'; c.fillRect(x, 0, 22, 2);
      for (var st = 0; st < 22; st += 4) {
        c.fillStyle = (st / 4) % 2 ? '#a50044' : '#004d98';
        c.fillRect(x + st, 2, 4, 13);
      }
      c.fillStyle = '#edbb00';
      c.fillRect(x + 8, 6, 6, 5);
      c.fillStyle = '#7a1030';
      c.fillRect(x + 9, 7, 4, 3);
      // ragged bottom edge
      for (var bx = 0; bx < 22; bx += 2) {
        c.clearRect(x + bx, 15 - (r() > 0.5 ? 0 : 1), 2, 3);
      }
    }
    tex.refresh();
    return key;
  }

  return {
    T: T, ID: ID, COUNT: COUNT, NO_COLLIDE: NO_COLLIDE,
    buildTileset: buildTileset, buildSky: buildSky, buildCrowd: buildCrowd,
    buildBoards: buildBoards, buildBanner: buildBanner
  };
})();
