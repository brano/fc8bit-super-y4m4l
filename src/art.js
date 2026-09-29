/* FC8Bit Super Y4M4L - procedural 8-bit art. Every sprite is a pixel grid,
   baked into canvas textures at boot. No external image assets. */
window.FC8 = window.FC8 || {};

FC8.art = (function () {
  'use strict';

  /* ------------------------------------------------------------------ palette */
  var PAL = {
    '.': null,
    'o': '#140d1c', // outline / black
    'O': '#2b2436', // soft outline
    's': '#f6c793', // skin
    'S': '#d1945f', // skin shade
    'a': '#8d5a34', // skin (deep)
    'A': '#653b20', // skin (deep shade)
    'h': '#2f1d10', // hair dark
    'H': '#4d3018', // hair light
    'b': '#004d98', // FCB blue
    'B': '#1673d2', // FCB blue light
    'r': '#a50044', // FCB garnet
    'R': '#d4246a', // garnet light
    'd': '#0d1436', // dark navy (shorts)
    'g': '#edbb00', // gold
    'G': '#fff29a', // gold light
    'y': '#c98f00', // gold shade
    'w': '#ffffff',
    'W': '#c3ccd6', // white shade
    'V': '#8e99a6', // white deep shade
    'k': '#191a21', // boot black
    'K': '#3b3f4c',
    'n': '#9aa6b3', // silver mid
    'N': '#eff5fa', // silver light
    'm': '#5d6875', // silver dark
    'e': '#2eb857', // green
    'E': '#7ef08a', // green light
    'f': '#155e2c', // green dark
    't': '#8b1020', // tie / deep red
    'T': '#c62a3c',
    'z': '#23252f', // suit dark
    'Z': '#3c404f', // suit light
    'u': '#8a5a2b', // brown / leather
    'U': '#b9803f',
    'p': '#ffd9c2', // pale
    'l': '#67d3ff', // ice blue
    'x': '#7b3fa0', // purple
    'c': '#ff5a3c'  // flame
  };

  /* ------------------------------------------------------------------ helpers */
  function grid(str) {
    var rows = str.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
    var w = 0, i;
    for (i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    for (i = 0; i < rows.length; i++) {
      while (rows[i].length < w) rows[i] += '.';
    }
    return rows;
  }

  /** Bake a pixel grid into a canvas texture. */
  function bake(scene, key, rows, pal) {
    pal = pal || PAL;
    var w = rows[0].length, h = rows.length;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    var tex = scene.textures.createCanvas(key, w, h);
    var ctx = tex.getContext();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var col = pal[rows[y][x]];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
      }
    }
    tex.refresh();
    return tex;
  }

  /** Swap characters across a grid (recolour), e.g. {k:'g'} = golden boots. */
  function recolor(rows, map) {
    return rows.map(function (row) {
      var out = '';
      for (var i = 0; i < row.length; i++) out += (map[row[i]] || row[i]);
      return out;
    });
  }

  /** Duplicate rows (ascending indices) to grow a sprite without redrawing it. */
  function stretch(rows, dupIdx) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      out.push(rows[i]);
      if (dupIdx.indexOf(i) !== -1) out.push(rows[i]);
    }
    return out;
  }

  /** Set a single pixel (row, col) to a palette char. */
  function poke(rows, y, x, ch) {
    var r = rows[y];
    rows[y] = r.substring(0, x) + ch + r.substring(x + 1);
    return rows;
  }

  function mirror(rows) {
    return rows.map(function (r) { return r.split('').reverse().join(''); });
  }

  /* ============================================================ Y4M4L10 ==== */
  /* 12 x 15, facing right. Rows 0-10 = head + torso, 11-14 = legs. */
  var Y4_TOP = grid([
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hhhhhhhhh.',
    '..hsssssss..',
    '..hsswosss..',
    '..hsssooS...',
    '...SSssSS...',
    '..sbbrrbbs..',
    '..sbbrrbbs..',
    '...bbrrbb...',
    '...bbrrbb...'
  ].join('\n'));

  var LEGS = {
    stand: ['...dddddd...', '...dd..dd...', '...rr..rr...', '..kkk..kkk..'],
    runA: ['...dddddd...', '..dd....dd..', '.rr......rr.', 'kkk......kkk'],
    runB: ['...dddddd...', '....dddd....', '....rrrr....', '...kkkkkk...'],
    runC: ['...dddddd...', '...dd.dd....', '...rr.rr....', '..kkk.kkk...'],
    duck: ['..dddddddd..', '..rr....rr..', '.kkk....kkk.', '............']
  };

  var Y4_JUMP = grid([
    '...hhhhhh.s.',
    '..hhhhhhhhs.',
    '..hhhhhhhhh.',
    '..hsssssss..',
    '..hsswosss..',
    '..hsssooS...',
    '...SSssSS...',
    '.sbbrrbbs...',
    '.sbbrrbb....',
    '...bbrrbb...',
    '...bbrrbb...',
    '...dddddd...',
    '..dd....dd..',
    '.rr......rr.',
    'kkk......kkk'
  ].join('\n'));

  var Y4_KICK = grid([
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hhhhhhhhh.',
    '..hsssssss..',
    '..hsswosss..',
    '..hsssooS...',
    '...SSssSS...',
    '..sbbrrbbss.',
    '..sbbrrbb.s.',
    '...bbrrbb...',
    '...bbrrbb...',
    '...dddddd...',
    '...dd..ddd..',
    '...rr...rrr.',
    '..kkk....kkk'
  ].join('\n'));

  var Y4_HURT = grid([
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hhhhhhhhh.',
    '..hsssssss..',
    '..hsoosoos..',
    '..hsssoos...',
    '...SSssSS...',
    '.sbbrrbbs.s.',
    '..sbbrrbbs..',
    '...bbrrbb...',
    '...bbrrbb...',
    '...dddddd...',
    '..dd....dd..',
    '..rr....rr..',
    '.kkk....kkk.'
  ].join('\n'));

  function y4Frame(legsKey) {
    return Y4_TOP.concat(LEGS[legsKey]);
  }

  /* ====================================================== MERENGUE MUSHROOM  */
  /* Enemy: mushroom in a white kit. 16 x 14. */
  var MUSH_A = grid([
    '.....wwwwww.....',
    '...wwwwwwwwww...',
    '..wwwwWwwwwwww..',
    '.wwgwwwwwwwwgww.',
    '.wwwwwwwwwwwwww.',
    'wwwwwwwwwwwwwwww',
    'wwWWwwwwwwwwWWww',
    'woooWwwwwwWooooW',
    '.wwwwwwwwwwwwww.',
    '..ppppppppppppp.',
    '..pwwwwwwwwwwwp.',
    '..pwwggggggwwwp.',
    '..ppppppppppppp.',
    '.kkkk......kkkk.'
  ].join('\n'));

  var MUSH_B = grid([
    '.....wwwwww.....',
    '...wwwwwwwwww...',
    '..wwwwwwwWwwww..',
    '.wwgwwwwwwwwgww.',
    '.wwwwwwwwwwwwww.',
    'wwwwwwwwwwwwwwww',
    'wwWWwwwwwwwwWWww',
    'wooooWwwwwwWooow',
    '.wwwwwwwwwwwwww.',
    '..ppppppppppppp.',
    '..pwwwwwwwwwwwp.',
    '..pwwggggggwwwp.',
    '..ppppppppppppp.',
    '..kkkk....kkkk..'
  ].join('\n'));

  /* Flattened (stomped) mushroom */
  var MUSH_FLAT = grid([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..wwwwwwwwwwww..',
    '.wwwgwwwwwwgwww.',
    'wwwwwwwwwwwwwwww',
    'woooowwwwwwoooow',
    '.pppppppppppppp.',
    '.kkkk......kkkk.'
  ].join('\n'));

  /* ============================================================== MB4PPE ==== */
  /* Fast striker enemy in a white kit, number 9. 14 x 17. */
  var MB_TOP = grid([
    '....hhhhhh....',
    '...hhhhhhhh...',
    '...haaaaaah...',
    '...haawoaaa...',
    '...haaaooA....',
    '....AAaaAA....',
    '...wwwwwwww...',
    '..awwwggwwwa..',
    '..awwwgwgwwwa.',
    '..awwwggwwwwa.',
    '...wwwgwwwww..',
    '...wwwggwwww..'
  ].join('\n'));

  var MB_LEGS = {
    a: ['...wwwwwwww...', '...ww....ww...', '...ww....ww...', '..kkk....kkk..'],
    b: ['...wwwwwwww...', '..ww......www.', '.ww.........ww', 'kkk.......kkkk'],
    c: ['...wwwwwwww...', '....wwwwww....', '....wwwwww....', '...kkkkkkk....']
  };

  function mbFrame(k) { return MB_TOP.concat(MB_LEGS[k]); }

  var MB_FLAT = grid([
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '...hhhhhhhh...',
    '..haaaaaaaah..',
    '..aoooaaaooo..',
    '.awwwwggwwwwa.',
    '.wwwwwwwwwwww.',
    'kkkk......kkkk'
  ].join('\n'));

  /* ========================================================= THE SPECIAL ONE */
  /* Boss: 24 x 30. Dark suit, white shirt, blood-red tie, silver hair. */
  var BOSS_IDLE = grid([
    '.......nnnnnnnnnn.......',
    '......nnnnnnnnnnnn......',
    '.....nnnnnnnnnnnnnn.....',
    '.....nnsssssssssnn......',
    '.....nsssssssssssn......',
    '.....nsswoosssoows......',
    '.....nsssssssssssS......',
    '.....nSssssooossS.......',
    '......SSsssssssSS.......',
    '.......SSSssSSS.........',
    '....zzzzzwwwwzzzzz......',
    '...zzzzzzwtwwzzzzzz.....',
    '..zzzzzzzwttwzzzzzzz....',
    '..zzzzzzzzwttwzzzzzzz...',
    '..zzzzzzzzZttZzzzzzzz...',
    '..zzzzzzzzZttZzzzzzzz...',
    '..szzzzzzzZtZzzzzzzzs...',
    '..szzzzzzzzZZzzzzzzzs...',
    '..sszzzzzzzzzzzzzzzss...',
    '...szzzzzzzzzzzzzzzs....',
    '....zzzzzzzzzzzzzz......',
    '....zzzzzzzzzzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....ZZZZZZ..ZZZZZZ......',
    '...kkkkkkk..kkkkkkk.....',
    '..kkkkkkkk..kkkkkkkk....'
  ].join('\n'));

  var BOSS_THROW = grid([
    '.......nnnnnnnnnn...ww..',
    '......nnnnnnnnnnnn.wllw.',
    '.....nnnnnnnnnnnnnnwllw.',
    '.....nnsssssssssnn.wllw.',
    '.....nsssssssssssn.swws.',
    '.....nsswoosssoows.ss...',
    '.....nsssssssssssss.....',
    '.....nSsssoooossSs......',
    '......SSsssssssSS.......',
    '.......SSSssSSS.........',
    '....zzzzzwwwwzzzzz......',
    '...zzzzzzwtwwzzzzz......',
    '..zzzzzzzwttwzzzzzz.....',
    '..zzzzzzzzwttwzzzzz.....',
    '..zzzzzzzzZttZzzzzz.....',
    '..zzzzzzzzZttZzzzzz.....',
    '..szzzzzzzZtZzzzzzz.....',
    '..szzzzzzzzZZzzzzzz.....',
    '..sszzzzzzzzzzzzzz......',
    '...szzzzzzzzzzzzzz......',
    '....zzzzzzzzzzzzzz......',
    '....zzzzzzzzzzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....ZZZZZZ..ZZZZZZ......',
    '...kkkkkkk..kkkkkkk.....',
    '..kkkkkkkk..kkkkkkkk....'
  ].join('\n'));

  /* Clipboard raised: invulnerable stance */
  var BOSS_SHIELD = grid([
    '.......nnnnnnnnnn.......',
    '......nnnnnnnnnnnn......',
    '.....nnnnnnnnnnnnnn.....',
    '.....nnsssssssssnn......',
    '.....nsssssssssssn......',
    '.....nsswoosssoows......',
    '.UUUUUUUUUUUUUUUUUU.....',
    '.UwwwwwwwwwwwwwwwwU.....',
    '.UwooooowwooooowwwU.....',
    '.UwooowwwwooowwwwwU.....',
    '.UwwwwwwwwwwwwwwwwU.....',
    '.UUUUUUUUUUUUUUUUUU.....',
    '..szzzzzzwttwzzzzzs.....',
    '..szzzzzzzwttwzzzzs.....',
    '..szzzzzzzZttZzzzzs.....',
    '..szzzzzzzZttZzzzzs.....',
    '..szzzzzzzZtZzzzzzs.....',
    '..szzzzzzzzZZzzzzzs.....',
    '..sszzzzzzzzzzzzzss.....',
    '...szzzzzzzzzzzzzs......',
    '....zzzzzzzzzzzzzz......',
    '....zzzzzzzzzzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....zzzzzz..zzzzzz......',
    '....ZZZZZZ..ZZZZZZ......',
    '...kkkkkkk..kkkkkkk.....',
    '..kkkkkkkk..kkkkkkkk....'
  ].join('\n'));

  var BOSS_HURT = recolor(BOSS_IDLE, { 's': 'T', 'S': 't' });

  /* ================================================================ FLICK === */
  /* Friendly coach at the trophy. 14 x 21. */
  var FLICK_A = grid([
    '...nnnnnnnn...',
    '..nnnnnnnnnn..',
    '..nnssssssnn..',
    '..nssowsswsn..',
    '..nssssssssn..',
    '..nssoooooss..',
    '...SSssssSS...',
    '..rrbbrrbbrr..',
    '.zzzzzzzzzzzz.',
    'zzzzzrrbbzzzzz',
    'zzzzzbbrrzzzzz',
    '.zzzzrrbbzzzz.',
    '.zzzzzbbzzzzz.',
    '..zzzzzzzzzz..',
    '..zzzzzzzzzz..',
    '..zzzz..zzzz..',
    '..zzzz..zzzz..',
    '..zzzz..zzzz..',
    '..ZZZZ..ZZZZ..',
    '.kkkkk..kkkkk.',
    'kkkkkk..kkkkkk'
  ].join('\n'));

  var FLICK_B = grid([
    '.s.nnnnnnnn.s.',
    '.snnnnnnnnnns.',
    '.snnssssssnns.',
    '.snssowsswsns.',
    '..nssssssssn..',
    '..nssoooooss..',
    '...SSssssSS...',
    '.srrbbrrbbrrs.',
    '.zzzzzzzzzzzz.',
    'zzzzzrrbbzzzzz',
    'zzzzzbbrrzzzzz',
    '.zzzzrrbbzzzz.',
    '.zzzzzbbzzzzz.',
    '..zzzzzzzzzz..',
    '..zzzzzzzzzz..',
    '..zzzz..zzzz..',
    '..zzzz..zzzz..',
    '..zzzz..zzzz..',
    '..ZZZZ..ZZZZ..',
    '.kkkkk..kkkkk.',
    'kkkkkk..kkkkkk'
  ].join('\n'));

  /* ====================================================== CHAMPIONS TROPHY == */
  /* The big-eared cup. 26 x 30. */
  var TROPHY = grid([
    '.........NNNNNNNN.........',
    '.......NNwwwwwwwwNN.......',
    '.....NNwwwwwwwwwwwwNN.....',
    '...NNnwwwwwwwwwwwwwwnNN...',
    '..NnnNwwwwwwwwwwwwwwNnnN..',
    '.Nnn.NNwwwwwwwwwwwwNN.nnN.',
    'Nnn..mNNwwwwwwwwwwNNm..nnN',
    'Nnn..mmNNNwwwwwwNNNmm..nnN',
    'Nnn...mmmNNNNNNNNmmm...nnN',
    'Nnn....mmmmmmmmmmmm....nnN',
    '.Nnn....mmmNNNNmmm....nnN.',
    '..Nnn....NNNNNNNN....nnN..',
    '...NnnnnnNNnnnnNNnnnnnN...',
    '.....NNNNNnnnnnnNNNNN.....',
    '.........Nnnnnnn N........',
    '.........NnnnnnnN.........',
    '.........mNnnnnNm.........',
    '.........mmNnnNmm.........',
    '........mmmNnnNmmm........',
    '.......NNNNNnnNNNNN.......',
    '......NNNNNNNNNNNNNN......',
    '.....gggggggggggggggg.....',
    '....gGGGGGGGGGGGGGGGGg....',
    '....gGyyyyyyyyyyyyyyGg....',
    '....gGyGGGGGGGGGGGyyGg....',
    '...ggGyyyyyyyyyyyyyyGgg...',
    '...gGGGGGGGGGGGGGGGGGGg...',
    '..gggggggggggggggggggggg..',
    '..oooooooooooooooooooooo..',
    '...oooooooooooooooooooo...'
  ].join('\n'));

  /* ================================================== HUD PORTRAIT + LIFE == */
  /* Y4M4L10's head for the title card and the HUD. Drawn rather than scaled
     down from the reference: a 16px portrait made by shrinking a 300px head
     turns to mush, while this stays on-model and crisp. */
  var FACE = grid([
    '....hhhhhh....',
    '..hhgghhgghh..',
    '.hhgghhgghhgh.',
    '.hgghhgghhggh.',
    'hhhssssssshhh.',
    'hhsssssssssh..',
    '.hssssssssss..',
    '.hsswossssss..',
    '.hsswossssss..',
    '.hsssssssoss..',
    '..Ssssssss...',
    '..SSsssssSS...',
    '...SSsssSS....',
    '...bbrrbbrr...',
    '..bbrrbbrrbb..',
    '.bbrrbbrrbbrr.'
  ].join('\n'));

  /* Life pip */
  var HEART = grid([
    '.oo.oo.',
    'oTToTTo',
    'oTwTTTo',
    'oTTTTTo',
    '.oTTTo.',
    '..oTo..',
    '...o...'
  ].join('\n'));

  /* ================================================================== BALL == */
  /* Collectible football: one 10x10 grid, spun by rotating it 90 degrees a
     frame. The patch layout is deliberately off-centre so the rotation reads
     as rolling rather than sitting still. */
  var BALL_BASE = grid([
    '...oooo...',
    '..owwwwo..',
    '.owwwwooo.',
    'owwoooWwwo',
    'owwooooWwo',
    'owwoooWWWo',
    'owwwwWWWWo',
    '.owwWWWWo.',
    '..oWWWWo..',
    '...oooo...'
  ].join('\n'));

  /** Rotate a square grid 90 degrees clockwise. */
  function rot90(rows) {
    var h = rows.length, w = rows[0].length, out = [], y, x;
    for (y = 0; y < w; y++) {
      var line = '';
      for (x = 0; x < h; x++) line += rows[h - 1 - x][y];
      out.push(line);
    }
    return out;
  }

  var BALL = [BALL_BASE];
  for (var bi = 1; bi < 4; bi++) BALL.push(rot90(BALL[bi - 1]));

  /* =============================================================== ITEMS ==== */
  /* BALLON D'OR - grow */
  var ITEM_BALLON = grid([
    '..gGGGg..',
    '.gGyyyGg.',
    'gGyGGGyGg',
    'gyGwwwGyg',
    'GyGwwwGyG',
    'gyGwwwGyg',
    'gGyGGGyGg',
    '.gGyyyGg.',
    '..gGGGg..'
  ].join('\n'));

  /* GOLDEN BOOT - shoot balls */
  var ITEM_BOOT = grid([
    '....ggg...',
    '...gGGGg..',
    '...gGyyg..',
    '..ggGyyg..',
    '.gGGGyyyg.',
    'gGyyyyyyyg',
    'gyyyyyyyyg',
    '.gggggggg.',
    '..oooooo..'
  ].join('\n'));

  /* MAGIC SPRAY - extra life */
  var ITEM_SPRAY = grid([
    '...ww...',
    '..wEEw..',
    '..eEEe..',
    '.eeEEee.',
    '.eEwwEe.',
    '.eEwwEe.',
    '.eEEEEe.',
    '.eeeeee.',
    '.eEEEEe.',
    '..oooo..'
  ].join('\n'));

  /* Water bottle thrown by the boss */
  var BOTTLE = grid([
    '..ll..',
    '.lwwl.',
    'llwwll',
    'lwllwl',
    'lwllwl',
    'llwwll',
    '.lwwl.',
    '..ll..'
  ].join('\n'));

  /* ================================================================= BUS ==== */
  /* "Parked bus" - the Special One's signature. 46 x 22 */
  var BUS = grid([
    '...wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww...',
    '..wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww..',
    '.wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.',
    'wwwWWWWwwwWWWWwwwWWWWwwwWWWWwwwWWWWwwwwwwwww',
    'wwWllllWwWllllWwWllllWwWllllWwWllllWwwWlllWw',
    'wwWllllWwWllllWwWllllWwWllllWwWllllWwwWlllWw',
    'wwWllllWwWllllWwWllllWwWllllWwWllllWwwWlllWw',
    'wwWllllWwWllllWwWllllWwWllllWwWllllWwwWlllWw',
    'wwwWWWWwwwWWWWwwwWWWWwwwWWWWwwwWWWWwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'wggggggggggggggggggggggggggggggggggggggggggw',
    'wggggggggggggggggggggggggggggggggggggggggggw',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'oooooooooooooooooooooooooooooooooooooooooooo',
    '..ooooo..................ooooo..............',
    '.ooKKKoo................ooKKKoo.............',
    '.oKKKKKo................oKKKKKo.............',
    '.oKKKKKo................oKKKKKo.............',
    '.ooKKKoo................ooKKKoo.............',
    '..ooooo..................ooooo..............'
  ].join('\n'));

  /* ================================================================ GOAL ==== */
  /* End-of-level goal: posts, net and a pennant. 28 x 44 */
  var GOAL = grid([
    '....rrrrrrrr................',
    '....rrrrrrrrrr..............',
    '....rrbbrrbbrrr.............',
    '....rrbbrrbbrr..............',
    '....rrrrrrrr................',
    '....rrrr....................',
    'NNNNNNNNNNNNNNNNNNNNNNNNNNNN',
    'NNNNNNNNNNNNNNNNNNNNNNNNNNNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NwwwwwwwwwwwwwwwwwwwwwwwwwNN',
    'Nw..w..w..w..w..w..w..w..wNN',
    'NNNNNNNNNNNNNNNNNNNNNNNNNNNN',
    'NNNNNNNNNNNNNNNNNNNNNNNNNNNN',
    '............................'
  ].join('\n'));

  /* ============================================================= EXTRAS ===== */
  var CLOUD = grid([
    '.....wwwww......',
    '...wwwwwwwww....',
    '..wwwwwwwwwwww..',
    '.wwwwwwwwwwwwww.',
    'wwwwwwwwwwwwwwww',
    '.WWWWWWWWWWWWWW.',
    '..WWWWWWWWWWW...'
  ].join('\n'));

  var FLOODLIGHT = grid([
    'GGGGGGGGGGGG',
    'GwwwwwwwwwwG',
    'GwGGwwGGwwGG',
    'GwwwwwwwwwwG',
    'GGGGGGGGGGGG',
    '.....mm.....',
    '.....mm.....',
    '.....mm.....',
    '.....mm.....',
    '.....mm.....',
    '....mmmm....',
    '...mmmmmm...'
  ].join('\n'));

  var CONFETTI = grid(['gg', 'gg'].join('\n'));

  return {
    PAL: PAL, grid: grid, bake: bake, recolor: recolor, stretch: stretch,
    poke: poke, mirror: mirror, rot90: rot90,
    LEGS: LEGS, Y4_TOP: Y4_TOP,
    y4Frame: y4Frame, Y4_JUMP: Y4_JUMP, Y4_KICK: Y4_KICK, Y4_HURT: Y4_HURT,
    MUSH_A: MUSH_A, MUSH_B: MUSH_B, MUSH_FLAT: MUSH_FLAT,
    mbFrame: mbFrame, MB_FLAT: MB_FLAT,
    BOSS_IDLE: BOSS_IDLE, BOSS_THROW: BOSS_THROW, BOSS_SHIELD: BOSS_SHIELD,
    BOSS_HURT: BOSS_HURT,
    FLICK_A: FLICK_A, FLICK_B: FLICK_B,
    TROPHY: TROPHY, BALL: BALL,
    ITEM_BALLON: ITEM_BALLON, ITEM_BOOT: ITEM_BOOT, ITEM_SPRAY: ITEM_SPRAY,
    BOTTLE: BOTTLE, BUS: BUS, GOAL: GOAL, FACE: FACE, HEART: HEART,
    CLOUD: CLOUD, FLOODLIGHT: FLOODLIGHT, CONFETTI: CONFETTI
  };
})();
