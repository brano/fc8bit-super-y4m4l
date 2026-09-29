/* FC8Bit Super Y4M4L - boot scene: bakes every texture and animation. */
window.FC8 = window.FC8 || {};

/* Hand-drawn Y4M4L10 sheets (8 cols x 4 rows of 32px cells), built from the
   reference art by tools/build_assets.py. One sheet per power state. */
FC8.SHEETS = [
  { key: 'sheet-y4s', prefix: 'y4s', file: 'assets/y4m4l10.png' },
  { key: 'sheet-y4g', prefix: 'y4g', file: 'assets/y4m4l10_super.png' },
  { key: 'sheet-y4b', prefix: 'y4b', file: 'assets/y4m4l10_boot.png' }
];
/* Source rows: 0 run, 1 front jog, 2 upright walk, 3 dribble. */
FC8.SHEET_POSES = { idle: 16, jump: 4, kick: 27, hurt: 12 };
FC8.SHEET_RUN = [0, 1, 2, 3, 4, 5, 6, 7];
FC8.usingSheet = false;

/* Opponents and coaches lifted off the reference art, same 32px cells. */
FC8.WORLD_SHEET = { key: 'sheet-world', file: 'assets/world.png' };
FC8.WORLD_POSES = {
  'mush-a': 0, 'mush-b': 1, 'mush-flat': 2,
  'mb-a': 3, 'mb-b': 4, 'mb-c': 5, 'mb-flat': 6
};
FC8.PROP_SHEET = { key: 'sheet-props', file: 'assets/props.png' };
FC8.PROP_POSES = {
  'trophy': 0,
  'fcb-flag-0': 1, 'fcb-flag-1': 2, 'fcb-flag-2': 3, 'fcb-flag-3': 4,
  'pennant': 5
};
FC8.COACH_SHEET = { key: 'sheet-coaches', file: 'assets/coaches.png' };
FC8.COACH_POSES = {
  'boss-idle': 0, 'boss-throw': 1, 'boss-shield': 2, 'boss-hurt': 3,
  'flick-a': 4, 'flick-b': 5
};

FC8.BootScene = class extends Phaser.Scene {
  constructor() { super('boot'); }

  /* Hand-drawn art (assets/, built by tools/build_assets.py) is optional:
     if it is missing or cannot be decoded, the game falls back to the
     procedural sprites and still runs from a bare file:// open. */
  preload() {
    this.sheetsOk = true;
    this.anthemOk = true;
    // NB: scope the failure. A missing audio file must not disable the
    // sprite sheets, and vice versa.
    this.load.on('loaderror', function (file) {
      if (file && file.type === 'audio') this.anthemOk = false;
      else this.sheetsOk = false;
    }, this);
    FC8.SHEETS.forEach(function (s) {
      this.load.spritesheet(s.key, s.file, { frameWidth: 32, frameHeight: 32 });
    }, this);
    [FC8.WORLD_SHEET, FC8.COACH_SHEET, FC8.PROP_SHEET].forEach(function (s) {
      this.load.spritesheet(s.key, s.file, { frameWidth: 32, frameHeight: 32 });
    }, this);
    this.load.image('fcb-board', 'assets/board.png');
    this.load.image('face-png', 'assets/face.png');
    // the 8-bit anthem: ogg first, mp3 for browsers that prefer it
    this.load.audio('anthem', ['assets/audio/fcb_anthem_8bit.ogg',
                               'assets/audio/fcb_anthem_8bit.mp3']);
  }

  create() {
    var art = FC8.art, tiles = FC8.tiles;

    FC8.font.install(this, 'pxfont', '#ffffff');

    /* ---------------------------------------------------------- Y4M4L10 */
    var small = {
      idle: art.y4Frame('stand'),
      run0: art.y4Frame('runA'),
      run1: art.y4Frame('runB'),
      run2: art.y4Frame('runC'),
      jump: art.Y4_JUMP,
      kick: art.Y4_KICK,
      hurt: art.Y4_HURT
    };

    // SUPER: same art grown by duplicating a face row and two torso rows,
    // plus a gold captain's armband.
    function big(rows) {
      var g = art.stretch(rows, [3, 8, 10]);
      g = g.slice();
      art.poke(g, 9, 2, 'g');
      art.poke(g, 9, 9, 'g');
      return g;
    }

    var key;
    for (key in small) {
      art.bake(this, 'y4s-' + key, small[key]);
      art.bake(this, 'y4g-' + key, big(small[key]));
      art.bake(this, 'y4b-' + key, art.recolor(big(small[key]), { 'k': 'g', 'K': 'y' }));
    }

    // Swap in the hand-drawn Y4M4L10 over the procedural frames when available.
    var runFrames = this.installPlayerSheets();

    ['y4s', 'y4g', 'y4b'].forEach(function (p) {
      var frames = runFrames
        ? runFrames.map(function (n) { return { key: p + '-run' + n }; })
        : [{ key: p + '-run0' }, { key: p + '-run1' }, { key: p + '-run2' }, { key: p + '-run1' }];
      this.anims.create({
        key: p + '-run',
        frames: frames,
        frameRate: runFrames ? 14 : 12,
        repeat: -1
      });
    }, this);

    /* ------------------------------------------------------- enemies */
    art.bake(this, 'mush-a', art.MUSH_A);
    art.bake(this, 'mush-b', art.MUSH_B);
    art.bake(this, 'mush-flat', art.MUSH_FLAT);
    art.bake(this, 'mb-a', art.mbFrame('a'));
    art.bake(this, 'mb-b', art.mbFrame('b'));
    art.bake(this, 'mb-c', art.mbFrame('c'));
    art.bake(this, 'mb-flat', art.MB_FLAT);

    art.bake(this, 'boss-idle', art.BOSS_IDLE);
    art.bake(this, 'boss-throw', art.BOSS_THROW);
    art.bake(this, 'boss-shield', art.BOSS_SHIELD);
    art.bake(this, 'boss-hurt', art.BOSS_HURT);
    art.bake(this, 'flick-a', art.FLICK_A);
    art.bake(this, 'flick-b', art.FLICK_B);

    // reference art wins wherever it exists
    this.installSheet(FC8.WORLD_SHEET, FC8.WORLD_POSES, 'usingWorldSheet');
    this.installSheet(FC8.COACH_SHEET, FC8.COACH_POSES, 'usingCoachSheet');

    this.anims.create({
      key: 'mush-walk',
      frames: [{ key: 'mush-a' }, { key: 'mush-b' }],
      frameRate: 4, repeat: -1
    });
    this.anims.create({
      key: 'mb-walk',
      frames: [{ key: 'mb-a' }, { key: 'mb-b' }, { key: 'mb-c' }, { key: 'mb-b' }],
      frameRate: 9, repeat: -1
    });

    /* ------------------------------------------------- friends & prizes */
    this.anims.create({
      key: 'flick-clap',
      frames: [{ key: 'flick-a' }, { key: 'flick-b' }],
      frameRate: 3, repeat: -1
    });
    art.bake(this, 'trophy', art.TROPHY);

    /* club furniture: cup, senyera flags, pennant (reference art if present) */
    if (this.installSheet(FC8.PROP_SHEET, FC8.PROP_POSES, 'usingPropSheet')) {
      this.anims.create({
        key: 'fcb-flag-wave',
        frames: [{ key: 'fcb-flag-0' }, { key: 'fcb-flag-1' },
                 { key: 'fcb-flag-2' }, { key: 'fcb-flag-3' }],
        frameRate: 5, repeat: -1
      });
    }

    /* ---------------------------------------------------------- balls */
    for (var i = 0; i < art.BALL.length; i++) art.bake(this, 'ball-' + i, art.BALL[i]);
    this.anims.create({
      key: 'ball-spin',
      frames: [{ key: 'ball-0' }, { key: 'ball-1' }, { key: 'ball-2' }, { key: 'ball-3' }],
      frameRate: 8, repeat: -1
    });

    /* ---------------------------------------------------------- items */
    art.bake(this, 'item-ballon', art.ITEM_BALLON);
    art.bake(this, 'item-boot', art.ITEM_BOOT);
    art.bake(this, 'item-spray', art.ITEM_SPRAY);
    art.bake(this, 'bottle', art.BOTTLE);
    art.bake(this, 'bus', art.BUS);
    art.bake(this, 'goal', art.GOAL);
    art.bake(this, 'cloud', art.CLOUD);
    art.bake(this, 'y4-face', art.FACE);
    // the hand-drawn portrait is the fallback; prefer the reference one
    if (this.sheetsOk && this.textures.exists('face-png')) {
      try {
        var fimg = this.textures.get('face-png').getSourceImage();
        if (fimg && fimg.width) {
          if (this.textures.exists('y4-face')) this.textures.remove('y4-face');
          var ftex = this.textures.createCanvas('y4-face', fimg.width, fimg.height);
          ftex.getContext().drawImage(fimg, 0, 0);
          ftex.refresh();
        }
      } catch (e) {
        if (window.console) console.warn('[FC8] keeping the drawn portrait:', e.message);
      }
    }
    art.bake(this, 'heart', art.HEART);
    art.bake(this, 'light', art.FLOODLIGHT);

    /* --------------------------------------------------- tiny particles */
    this.makeDot('spark', 2, '#fff29a');
    this.makeDot('dust', 2, '#cfd6de');
    this.makeDot('conf-b', 3, '#004d98');
    this.makeDot('conf-r', 3, '#a50044');
    this.makeDot('conf-g', 3, '#edbb00');
    this.makeDot('conf-w', 3, '#ffffff');

    /* ------------------------------------------------ tiles & backdrops */
    tiles.buildTileset(this, 'tiles');
    this.cropTile('tile-brick', tiles.ID.BRICK);
    this.cropTile('tile-used', tiles.ID.USED);
    this.cropTile('tile-ballblock', tiles.ID.BALLBLOCK);
    this.cropTile('tile-metal', tiles.ID.METAL);
    this.cropTile('tile-stone', tiles.ID.STONE);
    this.cropTile('tile-girder', tiles.ID.GIRDER);

    tiles.buildBoards(this, 'boards');
    tiles.buildBanner(this, 'banner');
    tiles.buildCrowd(this, 'crowd-home', ['#a50044', '#004d98', '#edbb00', '#ffffff', '#7b0b34', '#01346a'], 5, false);
    tiles.buildCrowd(this, 'crowd-away', ['#ffffff', '#e8e8f0', '#d9c37a', '#b9bec6', '#8e99a6', '#ffffff'], 11, true);

    FC8.levels.all().forEach(function (lv) {
      tiles.buildSky(this, 'sky-' + lv.key, lv.sky, !!lv.stars);
    }, this);

    /* ------------------------------------------------------------ music */
    if (this.anthemOk && this.cache.audio.exists('anthem')) {
      try {
        FC8.audio.attachAnthem(this.sound.add('anthem', { loop: true, volume: 0.55 }));
      } catch (e) {
        if (window.console) console.warn('[FC8] anthem unavailable:', e.message);
      }
    }

    /* -------------------------------------------------------- go on */
    this.registry.set('score', 0);
    this.registry.set('lives', 3);
    this.registry.set('balls', 0);
    this.registry.set('level', 0);
    this.scene.start('title');
  }

  /**
   * Cut the supplied 8x4 sheets into the texture keys the game already uses
   * (y4s-idle, y4s-run0.., y4s-jump, ...), so nothing downstream has to know
   * whether a sprite came from a PNG or from the procedural baker.
   * Returns the run-frame numbers, or null if the sheets were unusable.
   */
  installPlayerSheets() {
    if (!this.sheetsOk) return null;
    var poses = FC8.SHEET_POSES;
    try {
      FC8.SHEETS.forEach(function (s) {
        if (!this.textures.exists(s.key)) throw new Error('missing ' + s.key);
        var img = this.textures.get(s.key).getSourceImage();
        if (!img || !img.width) throw new Error('empty ' + s.key);
        Object.keys(poses).forEach(function (name) {
          this.cropFrame(s.prefix + '-' + name, img, poses[name]);
        }, this);
        FC8.SHEET_RUN.forEach(function (idx, n) {
          this.cropFrame(s.prefix + '-run' + n, img, idx);
        }, this);
      }, this);
    } catch (e) {
      if (window.console) console.warn('[FC8] falling back to procedural sprites:', e.message);
      return null;
    }
    FC8.usingSheet = true;
    return FC8.SHEET_RUN.map(function (_, n) { return n; });
  }

  /** Overlay one reference sheet onto the texture keys it provides. */
  installSheet(sheet, poses, flag) {
    if (!this.sheetsOk || !this.textures.exists(sheet.key)) return false;
    try {
      var img = this.textures.get(sheet.key).getSourceImage();
      if (!img || !img.width) return false;
      Object.keys(poses).forEach(function (name) {
        this.cropFrame(name, img, poses[name]);
      }, this);
      FC8[flag] = true;
      return true;
    } catch (e) {
      if (window.console) console.warn('[FC8] keeping procedural art for ' + sheet.key + ':', e.message);
      return false;
    }
  }

  /** Copy one 32x32 cell out of a loaded sheet into its own canvas texture. */
  cropFrame(key, img, index) {
    var cols = Math.floor(img.width / 32);
    var sx = (index % cols) * 32, sy = Math.floor(index / cols) * 32;
    if (this.textures.exists(key)) this.textures.remove(key);
    var tex = this.textures.createCanvas(key, 32, 32);
    tex.getContext().drawImage(img, sx, sy, 32, 32, 0, 0, 32, 32);
    tex.refresh();
  }

  makeDot(key, size, color) {
    if (this.textures.exists(key)) this.textures.remove(key);
    var tex = this.textures.createCanvas(key, size, size);
    var c = tex.getContext();
    c.fillStyle = color;
    c.fillRect(0, 0, size, size);
    tex.refresh();
  }

  /** Lift a single 16x16 tile out of the tileset so it can be used as a sprite. */
  cropTile(key, index) {
    if (this.textures.exists(key)) this.textures.remove(key);
    var src = this.textures.get('tiles').getSourceImage();
    var tex = this.textures.createCanvas(key, 16, 16);
    tex.getContext().drawImage(src, index * 16, 0, 16, 16, 0, 0, 16, 16);
    tex.refresh();
  }
};
