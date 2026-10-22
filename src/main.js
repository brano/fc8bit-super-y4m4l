/* FC8Bit Super Y4M4L - game bootstrap. */
window.FC8 = window.FC8 || {};

(function () {
  'use strict';

  if (!window.Phaser) {
    document.getElementById('fallback').style.display = 'block';
    return;
  }

  var debug = /[?&]debug=1/.test(window.location.search);

  var config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: FC8.W,
    height: FC8.H,
    backgroundColor: '#07040f',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: { activePointers: 4, keyboard: true, gamepad: false },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 800 },
        tileBias: 24,
        debug: debug
      }
    },
    scene: [FC8.BootScene, FC8.TitleScene, FC8.GameScene, FC8.VictoryScene, FC8.GameOverScene]
  };

  FC8.game = new Phaser.Game(config);

  // Stop the arrows and space from scrolling the page -- but let PHASER do it.
  //
  // Do not preventDefault these in our own listener: Phaser's key handler
  // begins `if (!event.defaultPrevented)`, and because this file registers on
  // window before Phaser's manager attaches, ours ran first and every arrow
  // and space keydown was dropped before the game ever saw it. The keyups
  // still arrived, so the keys looked dead while WASD worked fine.
  FC8.game.events.once('ready', function () {
    var kb = FC8.game.input && FC8.game.input.keyboard;
    if (kb && kb.addCapture) kb.addCapture([37, 38, 39, 40, 32]);  // arrows + space
  });

  function unlock() { FC8.audio.unlock(); }
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // Phaser measures its parent once at boot; make sure it re-measures after
  // the page has settled and whenever the stage box changes.
  function refit() {
    if (FC8.game && FC8.game.scale) FC8.game.scale.refresh();
  }
  window.addEventListener('resize', refit);
  window.addEventListener('load', refit);
  setTimeout(refit, 60);
  setTimeout(refit, 400);
  if (window.ResizeObserver) {
    new window.ResizeObserver(refit).observe(document.getElementById('stage'));
  }

  var fs = document.getElementById('fullscreen');
  if (fs) {
    fs.addEventListener('click', function () {
      var el = document.getElementById('shell');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
    });
  }
})();
