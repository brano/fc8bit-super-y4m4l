/* FC8Bit Super Y4M4L - touch controls.

   A DOM control deck under the canvas rather than buttons drawn inside it.
   Three reasons it does not live in the canvas, where it used to:

     * The canvas is letterboxed on a phone - 209px of an 812px screen - so
       in-canvas buttons cover the playfield while the page around it goes
       spare. Down here they never occlude the game.
     * They scaled with the canvas. At a 416px base the old 40px buttons came
       out at 35 CSS px on a 375px phone, under both the 44pt iOS and the 48dp
       Material minimum. A DOM button is sized in real pixels and stays put.
     * A pointer leaving a small button mid-run cleared the input, so a thumb
       roll stopped the player dead. Each press here captures its pointer and
       ends only on pointerup.

   Jump is a held button, not a gesture, because jump height is set by how
   long it is held (see Player.update) - a swipe is an impulse and can only
   ever produce one height.
*/
window.FC8 = window.FC8 || {};

FC8.touch = (function () {
  'use strict';

  // `run` is a latch, not a press: both thumbs are already busy on
  // direction and jump, so a held sprint would need a third finger.
  var held = { left: false, right: false, jump: false, fire: false, run: false };
  var taps = { pause: 0, mute: 0 };
  var confirms = [];
  var mounted = false;

  /** Coarse pointer rather than a UA sniff. Phaser's own test is
      `device.input.touch && !device.os.desktop`, and iPadOS reports a
      Macintosh UA, so an iPad matched `desktop` and got no controls at all. */
  function wanted() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function unlockAudio() {
    if (FC8.audio && FC8.audio.unlock) FC8.audio.unlock();
  }

  /** Drop everything held. A press still down when the tab goes away would
      otherwise stick, and the player would run off on his own on return. */
  function release() {
    // the run latch is a setting, not a press - it survives losing focus
    held.left = held.right = held.jump = held.fire = false;
    var pad = document.getElementById('pad');
    if (!pad) return;
    Array.prototype.forEach.call(pad.querySelectorAll('.is-down'), function (b) {
      b.classList.remove('is-down');
    });
  }

  /** Next JUMP or KICK press fires fn once. Returns an unsubscribe, so a
      scene that is left by keyboard does not leave a stale handler behind to
      go off in the next one. */
  function onceConfirm(fn) {
    confirms.push(fn);
    return function () {
      var i = confirms.indexOf(fn);
      if (i >= 0) confirms.splice(i, 1);
    };
  }

  function fireConfirm() {
    var queue = confirms.slice();
    confirms.length = 0;
    queue.forEach(function (fn) { fn(); });
  }

  function bindHold(b) {
    var prop = b.getAttribute('data-hold');

    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      // Capture so the press survives the thumb sliding off the button.
      if (b.setPointerCapture) {
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* older webviews */ }
      }
      held[prop] = true;
      b.classList.add('is-down');
      unlockAudio();
      if (prop === 'jump' || prop === 'fire') fireConfirm();
    });

    var up = function () { held[prop] = false; b.classList.remove('is-down'); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  }

  /** A latch stays on until tapped again, and shows it. */
  function bindLatch(b) {
    var prop = b.getAttribute('data-latch');
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      held[prop] = !held[prop];
      b.classList.toggle('is-on', held[prop]);
      b.setAttribute('aria-pressed', held[prop] ? 'true' : 'false');
      unlockAudio();
    });
  }

  function bindTap(b) {
    var name = b.getAttribute('data-tap');
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      taps[name]++;
      unlockAudio();
      b.classList.add('is-down');
    });
    var up = function () { b.classList.remove('is-down'); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }

  /** Reveals the deck and wires it. No-op on a mouse-driven browser. */
  function mount() {
    var pad = document.getElementById('pad');
    if (!pad || mounted || !wanted()) return false;

    pad.hidden = false;
    mounted = true;

    Array.prototype.forEach.call(pad.querySelectorAll('[data-hold]'), bindHold);
    Array.prototype.forEach.call(pad.querySelectorAll('[data-latch]'), bindLatch);
    Array.prototype.forEach.call(pad.querySelectorAll('[data-tap]'), bindTap);

    pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) release();
    });
    return true;
  }

  return {
    held: held,
    taps: taps,
    mount: mount,
    wanted: wanted,
    release: release,
    onceConfirm: onceConfirm,
    isMounted: function () { return mounted; }
  };
})();
