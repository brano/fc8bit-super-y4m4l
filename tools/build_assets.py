"""FC8Bit Super Y4M4L - asset pipeline.

Turns the hand-supplied reference art in assets/source/ into game-ready
spritesheets in assets/.

The source art is AI-rendered "pixel art": it looks like 2x2 pixel blocks but
every pixel is slightly different (~29k distinct colours, soft alpha edges) and
a third of the opaque pixels are thick black outline. Dropped straight into a
pixelArt:true canvas at 64px it also dwarfs the 16px tiles. So we:

  1. box-downscale by 2 (64px cells -> 32px cells, character ~25px tall,
     which is Mega Man proportions against a 16px tile),
  2. quantise to a small palette built from the OPAQUE pixels only - including
     the transparent area would hand most palette slots to black and drag
     every colour toward mud,
  3. hard-threshold alpha so there is no semi-transparent halo,
  4. trim each frame and re-seat it centred on a shared bottom baseline, so the
     feet do not jitter through the run cycle,
  5. derive the SUPER and GOLDEN BOOT variants by recolouring, so all three
     power states stay the same artwork.

Source sheet layout (8 cols x 4 rows of 64px cells):
    row 0  run cycle, side on
    row 1  front-facing jog (shirt number visible)
    row 2  upright walk / stand
    row 3  dribble - ball at the feet

Run:  python tools/build_assets.py
"""

import os
import math
import collections
from collections import deque
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets')

ALPHA_CUT = 110
QUANT_COLORS = 16
CELL = 32                      # output cell size
GOLD = (0xed, 0xbb, 0x00)
GOLD_LIGHT = (0xff, 0xf2, 0x9a)


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def boost(im, gamma=0.80, sat=1.10):
    """The reference art is shaded for a 64px canvas; at 25px the shadows and
    the thick outline swallow it against a bright Mario-blue sky.

    A gamma lift (<1) opens up the darks - the blaugrana stripes and the kit -
    without blowing out the skin, which a flat brightness multiply does.
    Values were picked by eye from a side-by-side over the game's sky colour.
    """
    import colorsys
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            vv = min(1.0, vv ** gamma)
            ss = min(1.0, ss * sat)
            r2, g2, b2 = colorsys.hsv_to_rgb(hh, ss, vv)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return out


def quantize(im, colors=QUANT_COLORS):
    """Adaptive palette built from the opaque pixels only; alpha stays binary."""
    alpha = im.getchannel('A')
    opaque = [p[:3] for p in im.get_flattened_data() if p[3] > ALPHA_CUT]
    strip = Image.new('RGB', (len(opaque), 1))
    strip.putdata(opaque)
    palette = strip.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    out = im.convert('RGB').quantize(palette=palette, dither=Image.NONE).convert('RGBA')
    out.putalpha(alpha.point(lambda v: 255 if v > ALPHA_CUT else 0))
    return out


def downscale2(im):
    """Box-average 2x2 -> 1px over opaque pixels only, so edges do not bleed
    the transparent background inward."""
    w, h = im.size
    out = Image.new('RGBA', (w // 2, h // 2), (0, 0, 0, 0))
    sp, op = im.load(), out.load()
    for y in range(h // 2):
        for x in range(w // 2):
            r = g = b = n = 0
            for dy in (0, 1):
                for dx in (0, 1):
                    p = sp[x * 2 + dx, y * 2 + dy]
                    if p[3] > ALPHA_CUT:
                        r += p[0]; g += p[1]; b += p[2]; n += 1
            op[x, y] = (0, 0, 0, 0) if n < 2 else (r // n, g // n, b // n, 255)
    return out


def frames_of(im, cols, rows):
    w, h = im.size
    cw, ch = w // cols, h // rows
    return [im.crop((c * cw, r * ch, c * cw + cw, r * ch + ch))
            for r in range(rows) for c in range(cols)]


def pack(frames, cols, path=None):
    """Bottom-align and centre every frame inside a CELL x CELL box."""
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new('RGBA', (CELL * cols, CELL * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        bb = f.getchannel('A').getbbox()
        if bb is None:
            continue
        cut = f.crop(bb)
        if cut.size[0] > CELL or cut.size[1] > CELL:
            # NB: cropping here would silently saw the feet off anything taller
            # than the cell - scale it to fit instead.
            k = min(CELL / cut.size[0], CELL / cut.size[1])
            cut = cut.resize((max(1, int(cut.size[0] * k)),
                              max(1, int(cut.size[1] * k))), Image.BOX)
            cut.putalpha(cut.getchannel('A').point(lambda v: 255 if v > 100 else 0))
        ox = (i % cols) * CELL + (CELL - cut.size[0]) // 2
        oy = (i // cols) * CELL + (CELL - cut.size[1])
        sheet.alpha_composite(cut, (ox, oy))
    if path:
        sheet.save(path)
    return sheet


def aura(im, color, cell=CELL):
    """Add a one-pixel glow ring AROUND the sprite for the power states.

    Recolouring the sprite's own edge pixels instead would eat most of a 25px
    character - it ends up reading as a solid gold blob - so the ring is grown
    into the transparent margin of the cell.
    """
    out = im.copy()
    src, dst = im.load(), out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            near = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                # stay inside the frame's own cell so the glow cannot bleed
                # into the neighbouring frame of the sheet
                if (nx // cell != x // cell) or (ny // cell != y // cell):
                    continue
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3]:
                    near = True
                    break
            if near:
                dst[x, y] = color + (255,)
    return out


def recolor_boots(im, cell=CELL):
    """Swap the white boots for golden ones (bottom third of each cell)."""
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        if (y % cell) < cell * 0.62:          # only the feet
            continue
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r > 150 and g > 150 and b > 140:
                px[x, y] = GOLD_LIGHT + (255,) if r > 215 else GOLD + (255,)
    return out


def flood_key(im, tol=16, gtol=55, bg_extra=()):
    """Magic-wand the background in from the border.

    A neighbour joins the background only if it is close to the pixel we
    reached it from (so smooth sky/grass/crowd gradients are followed) AND
    still close to a colour actually sampled on the border (so the fill cannot
    walk down a shadow into a navy suit, which is what happened at looser
    settings - the coaches came out as floating heads).
    """
    im = im.convert('RGBA').copy()
    w, h = im.size
    orig = im.copy().load()
    px = im.load()

    bg = []
    def note(c):
        c = tuple(c[:3])
        if not any((c[0]-u[0])**2 + (c[1]-u[1])**2 + (c[2]-u[2])**2 < 400 for u in bg):
            bg.append(c)
    for c in bg_extra:
        note(c)
    for x in range(0, w, max(1, w // 30)):
        note(orig[x, 0][:3]); note(orig[x, h - 1][:3])
    for y in range(0, h, max(1, h // 30)):
        note(orig[0, y][:3]); note(orig[w - 1, y][:3])

    g2 = gtol * gtol
    def near_bg(c):
        return any((c[0]-u[0])**2 + (c[1]-u[1])**2 + (c[2]-u[2])**2 < g2 for u in bg)

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x]:
                seen[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x]:
                seen[y * w + x] = 1; q.append((x, y))

    t2 = tol * tol
    while q:
        x, y = q.popleft()
        c = orig[x, y]
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                n = orig[nx, ny]
                if (n[0]-c[0])**2 + (n[1]-c[1])**2 + (n[2]-c[2])**2 < t2 and near_bg(n):
                    seen[ny * w + nx] = 1
                    q.append((nx, ny))
    return im


def keep_blobs(im, min_ratio=0.06):
    """Keep every component that is at least `min_ratio` of the biggest one.

    largest_blob() alone is too blunt for props: the trophy's plinth is cut off
    from the bowl by the dark shadow under the stem, so it counts as its own
    component and the cup came out with no base.
    """
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or px[x0, y0][3] == 0:
                continue
            stack, cells = [(x0, y0)], []
            seen[y0][x0] = True
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            comps.append(cells)
    if not comps:
        return im
    biggest = max(len(c) for c in comps)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()
    for cells in comps:
        if len(cells) >= biggest * min_ratio:
            for x, y in cells:
                op[x, y] = px[x, y]
    return out


def lift(img, box, height, colors=14, blob=True, tol=16, gtol=55, drop_green=False,
         pad=0, bg_extra=(), strip=0, strip_colors=None):
    """Crop a figure out of a reference scene and scale it to game height.

    `pad` frames the crop in a synthetic border of `bg_extra[0]` first. That
    matters whenever the subject runs to the edge of its reference: the border
    is what the flood samples as "background", so a figure touching the edge
    teaches the fill that its own navy trousers are background - which is
    exactly how THE SPECIAL ONE lost a leg and H4NSI lost both.
    """
    im = img.crop(box)
    if pad:
        frame_col = tuple(bg_extra[0]) if bg_extra else tuple(im.getpixel((1, 1))[:3])
        canvas = Image.new('RGBA', (im.size[0] + pad * 2, im.size[1] + pad * 2),
                           frame_col + (255,))
        canvas.alpha_composite(im, (pad, pad))
        im = canvas
    im = flood_key(im, tol, gtol, bg_extra)
    if strip:
        # Second pass: the blurred stand leaves a halo the flood cannot reach
        # (enclosed pockets between an arm and a leg). Anything still sitting
        # on a known background colour goes, connected or not. Safe because the
        # coaches' navy is ~110 away from the stand blue.
        px = im.load()
        s2 = strip * strip
        # Only the colours that cannot be confused with the subject: the dark
        # end of the stand palette sits ~18 away from a navy suit, and stripping
        # against it turned both coaches into black silhouettes.
        pal = strip_colors if strip_colors is not None else bg_extra
        for yy in range(im.size[1]):
            for xx in range(im.size[0]):
                r, g, b, a = px[xx, yy]
                if not a:
                    continue
                for u in pal:
                    if (r-u[0])**2 + (g-u[1])**2 + (b-u[2])**2 < s2:
                        px[xx, yy] = (0, 0, 0, 0)
                        break
    if drop_green:
        # the cup stands on grass; whatever survives the flood around its
        # plinth is turf, and turf is the one thing on it that is green
        px = im.load()
        for yy in range(im.size[1]):
            for xx in range(im.size[0]):
                r, g, b, a = px[xx, yy]
                if a and g > r + 26 and g > b + 26:
                    px[xx, yy] = (0, 0, 0, 0)
    if blob == 'keep':
        im = keep_blobs(im)
    elif blob:
        im = largest_blob(im)
    bb = im.getchannel('A').getbbox()
    if bb is None:
        raise ValueError('nothing left after keying %s' % (box,))
    im = im.crop(bb)
    scale = height / im.size[1]
    im = im.resize((max(1, round(im.size[0] * scale)), height), Image.BOX)
    # A low threshold keeps thin details - Flick's raised fist is one pixel
    # wide after the downscale and vanished at 120, leaving him short.
    im.putalpha(im.getchannel('A').point(lambda v: 255 if v > 96 else 0))
    im = quantize(im, colors)
    bb2 = im.getchannel('A').getbbox()
    if bb2:
        im = im.crop(bb2)
        if im.size[1] != height:
            k = height / im.size[1]
            im = im.resize((max(1, round(im.size[0] * k)), height), Image.BOX)
            im.putalpha(im.getchannel('A').point(lambda v: 255 if v > 96 else 0))
    return im


def add_pole(flag, pole_w=2):
    """The keyed flag is just the cloth - give it a mast to fly from."""
    w, h = flag.size
    out = Image.new('RGBA', (w + pole_w, h + 6), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.rectangle([0, 0, pole_w - 1, h + 5], fill=(0x8a, 0x5a, 0x2b, 255))
    d.rectangle([0, 0, 0, h + 5], fill=(0xb9, 0x80, 0x3f, 255))
    d.rectangle([0, 0, pole_w - 1, 1], fill=(0xed, 0xbb, 0x00, 255))
    out.alpha_composite(flag, (pole_w - 1, 1))
    return out


def wave(im, phase, amp=1.0, period=7.0):
    """Shift each column on a sine to fake a flag rippling in the wind."""
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    w, h = im.size
    for x in range(w):
        dy = int(round(math.sin(x / period + phase) * amp))
        col = im.crop((x, 0, x + 1, h))
        out.alpha_composite(col, (x, max(0, dy)) if dy >= 0 else (x, 0))
        if dy < 0:
            out.paste((0, 0, 0, 0), (x, 0, x + 1, h))
            out.alpha_composite(col.crop((0, -dy, 1, h)), (x, 0))
    return out


# Background colours sampled out of the reference scenes, so the flood knows
# what is stand/sky/grass and what is a coach.
BG_STAND = [(25, 84, 184), (22, 80, 177), (27, 66, 156), (62, 154, 238),
            (94, 87, 169), (100, 192, 62), (35, 67, 86)]
BG_FLICK = [(60, 140, 232), (75, 153, 228), (42, 138, 231), (52, 52, 52),
            (150, 190, 200), (63, 164, 240)]
BG_FLAG = [(34, 103, 204), (66, 152, 235), (31, 91, 180), (255, 201, 8),
           (117, 230, 66)]

# Safe-to-strip subsets: bright background tones only, well clear of navy kit.
STRIP_STAND = [(25, 84, 184), (22, 80, 177), (27, 66, 156), (62, 154, 238),
               (94, 87, 169), (100, 192, 62)]
STRIP_FLICK = [(60, 140, 232), (75, 153, 228), (42, 138, 231), (150, 190, 200),
               (63, 164, 240)]
STRIP_FLAG = [(34, 103, 204), (66, 152, 235), (31, 91, 180), (255, 201, 8),
              (117, 230, 66)]


# ---------------------------------------------------------------- opponents
# Boxes into assets/source/3.jpg, which has its cast isolated on flat black.
REF3 = {
    'mushroom': (784, 836, 944, 996),
    'mbappe':   (1108, 824, 1288, 1004),
    'trophy':   (1424, 252, 1660, 644),
}


def cut(img, box, target_h, thresh=95, drop_glow=False):
    """Crop one figure off the black reference sheet and scale it to the height
    the game wants, keeping alpha binary."""
    im = img.crop(box).copy()
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r + g + b < thresh:
                px[x, y] = (0, 0, 0, 0)
            elif drop_glow and b > r + 24 and r + g + b < 430:
                px[x, y] = (0, 0, 0, 0)      # the halo painted behind the cup
    bb = im.getchannel('A').getbbox()
    im = im.crop(bb)
    scale = target_h / im.size[1]
    im = im.resize((max(1, round(im.size[0] * scale)), target_h), Image.BOX)
    im.putalpha(im.getchannel('A').point(lambda v: 255 if v > 120 else 0))
    return quantize(im, 10)


def bob(im, dy=1):
    """One-pixel hop, the classic 8-bit walk tell."""
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.alpha_composite(im.crop((0, dy, im.size[0], im.size[1])), (0, 0))
    return out


def squash(im, height):
    """Stomped pose: flatten the sprite onto the floor."""
    w, h = im.size
    flat = im.resize((w + 2, height), Image.BOX)
    flat.putalpha(flat.getchannel('A').point(lambda v: 255 if v > 110 else 0))
    return flat


def key_backdrop(im):
    """The coaches are painted over a bright blue stand (and grass/confetti).
    Both wear dark navy, so we cut anything that is bright-and-blue or
    green-dominant, then keep only the largest blob - that drops the leftover
    confetti and grass specks."""
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            v = max(r, g, b)
            if (b > r + 40 and v > 70) or (g > r + 34 and g > b + 18):
                px[x, y] = (0, 0, 0, 0)
    return largest_blob(out)


def largest_blob(im):
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    best, best_n = None, 0
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or px[x0, y0][3] == 0:
                continue
            stack, cells = [(x0, y0)], []
            seen[y0][x0] = True
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(cells) > best_n:
                best, best_n = cells, len(cells)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()
    for x, y in (best or []):
        op[x, y] = px[x, y]
    return out


def tint_red(im):
    out = im.copy()
    px = out.load()
    for y in range(out.size[1]):
        for x in range(out.size[0]):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (min(255, int(r * 1.15 + 70)), int(g * 0.55), int(b * 0.55), a)
    return out


def add_clipboard(im):
    """Boss blocking pose: hold a clipboard up across the chest."""
    out = im.copy()
    d = ImageDraw.Draw(out)
    w, h = out.size
    bb = out.getchannel('A').getbbox()
    cx = (bb[0] + bb[2]) // 2
    top = bb[1] + int((bb[3] - bb[1]) * 0.30)
    d.rectangle([cx - 8, top, cx + 7, top + 10], fill=(0xb9, 0x80, 0x3f, 255))
    d.rectangle([cx - 7, top + 1, cx + 6, top + 9], fill=(0xff, 0xff, 0xff, 255))
    for ly in range(top + 3, top + 9, 2):
        d.line([cx - 5, ly, cx + 4, ly], fill=(0x39, 0x42, 0x4c, 255))
    return out


def build_coaches():
    """THE SPECIAL ONE and H4NSI FL1CK, from their own reference portraits.

    Both were previously lifted from the wide scene mock-ups; these dedicated
    references carry far more detail, so the boss now stands a head taller than
    Y4M4L10 - as a final boss should.
    """
    boss = lift(load('6.png'), (36, 4, 232, 272), 32, pad=10, gtol=85,
                bg_extra=BG_STAND, strip=46, strip_colors=STRIP_STAND)
    # H4NSI has his own portrait now; pad it so his own navy is never sampled
    # as background (that is what ate his legs).
    flick = lift(load('13.png'), (2, 2, 158, 224), 32, tol=14, gtol=85, pad=10,
                 bg_extra=BG_FLICK, strip=46, strip_colors=STRIP_FLICK)
    # Badge goes in the gap the downscale leaves in his chest. Measured on the
    # sprite (x12,y20 of 23x32); auto-detection kept finding the leg gaps too.
    stamp(boss, CREST_SUIT, round(boss.size[0] * 0.52), round(boss.size[1] * 0.625))
    fix_fist(flick)
    stamp(flick, CREST_FCB, int(flick.size[0] * 0.46), int(flick.size[1] * 0.46))
    frames = [boss, boss, add_clipboard(boss), tint_red(boss), flick, bob(flick)]
    sheet = pack(frames, 8, os.path.join(OUT, 'coaches.png'))
    print('coach sheet -> %s (boss %s, flick %s)' % (sheet.size, boss.size, flick.size))
    return sheet


BG_FACE = [(39, 112, 207), (46, 129, 225), (49, 129, 224), (39, 111, 209)]


def build_face(height=17):
    """Y4M4L10's head for the title card and the HUD.

    The eye is four source pixels wide; at a fifth of the size it averages into
    the surrounding outline and the portrait goes blank-faced, so it is put
    back by hand after the downscale.
    """
    src = load('17.png')
    keyed = largest_blob(flood_key(src, 16, 85, BG_FACE))
    bb = keyed.getchannel('A').getbbox()
    cut = keyed.crop(bb)
    k = height / cut.size[1]
    face = cut.resize((max(1, round(cut.size[0] * k)), height), Image.BOX)
    face.putalpha(face.getchannel('A').point(lambda v: 255 if v > 96 else 0))
    face = quantize(face, 12)

    # eye: sclera at (44..46, 45..51) in the reference
    ex = int(round((45 - bb[0]) * k))
    ey = int(round((48 - bb[1]) * k))
    px = face.load()
    if 0 <= ex < face.size[0] and 0 <= ey < face.size[1]:
        px[ex, ey] = (255, 255, 255, 255)
        if ey + 1 < face.size[1]:
            px[ex, ey + 1] = (255, 255, 255, 255)
        if ex + 1 < face.size[0]:
            px[ex + 1, ey] = (20, 14, 28, 255)      # pupil
    face.save(os.path.join(OUT, 'face.png'))
    print('face        -> %s (eye at %d,%d)' % (face.size, ex, ey))
    return face


ICON_BG = (0x0b, 0x07, 0x14, 255)      # --ink, the page background

# Y4M4L10's head at 16x16, placed by hand off assets/source/17.png.
#
# Everything else in this file is a downscale of the reference, but the head
# will not survive one at this size: it is a dark curly mass with a single
# narrow eye, and both the box average and a modal reduction turn the gold
# highlights into brown mud (the 18px HUD portrait from build_face has the
# same problem - it gets away with it because nothing looks at it directly).
# A favicon is looked at directly, in isolation, at 16px, so it is drawn
# instead: same palette sampled from the reference, same three-quarter pose
# looking right, gold crown read as a band rather than as speckle.
#
#   .  transparent   K  navy outline   D  hair shadow   H  hair
#   G  gold tips     S  skin           s  skin shadow   W/P  eye
ICON_PALETTE = {
    '.': None,
    'K': (0x04, 0x12, 0x29), 'D': (0x17, 0x07, 0x05), 'H': (0x3e, 0x1c, 0x11),
    'G': (0xdd, 0xa9, 0x45), 'S': (0xc7, 0x6f, 0x3f), 's': (0x98, 0x52, 0x2c),
    'W': (0xff, 0xff, 0xff), 'P': (0x06, 0x02, 0x04),
}

ICON_GRID = [
    '......KKKK......',
    '....KKGGGGKK....',
    '...KGGGGGGGGK...',
    '..KHGGHGGHGGHK..',
    '..KHHGHHGHHHHK..',
    '.KDDHHHHHHHHHDK.',
    '.KDDDHHHHHHHSSK.',
    '.KDDDHHSSSSSSSK.',
    '.KDDsSSSPPPSSSK.',
    '.KDDsSSSWPPSSSK.',
    '..KsSSSSSSSSSK..',
    '..KsSSSSSSSSSK..',
    '...KSSSSSSSSK...',
    '....KSSSSSSK....',
    '.....KKKKKK.....',
    '................',
]


def build_favicon():
    """The page icon: one 16x16 master, then integer NEAREST upscales.

    Nearest and whole multiples throughout. Any other filter puts soft grey
    between the pixels, which is the one thing an 8-bit icon must not have,
    and Pillow's ICO writer resamples with LANCZOS unless it is handed a
    frame whose size already matches exactly - hence append_images.
    """
    master = len(ICON_GRID)
    icon = Image.new('RGBA', (master, master), (0, 0, 0, 0))
    px = icon.load()
    for y, row in enumerate(ICON_GRID):
        for x, ch in enumerate(row):
            rgb = ICON_PALETTE[ch]
            if rgb:
                px[x, y] = rgb + (255,)

    def up(n):
        return icon.resize((master * n, master * n), Image.NEAREST)

    icon.save(os.path.join(OUT, 'favicon-16.png'))
    up(2).save(os.path.join(OUT, 'favicon-32.png'))

    # Largest first: Pillow skips any requested size bigger than the base.
    up(3).save(os.path.join(ROOT, 'favicon.ico'), format='ICO',
               sizes=[(16, 16), (32, 32), (48, 48)],
               append_images=[up(2), icon])

    # iOS ignores the alpha and composites on black, so this one is flattened
    # onto the page background. 176 = 16 x 11, centred in the 180 Apple asks
    # for, so the upscale stays on whole pixels.
    touch = Image.new('RGBA', (180, 180), ICON_BG)
    big = up(11)
    touch.paste(big, (2, 2), big)
    touch.save(os.path.join(OUT, 'apple-touch-icon.png'))

    print('favicon     -> %dx%d master, ico 16/32/48, touch 180'
          % (master, master))
    return icon


def build_props():
    """Club furniture: the cup, the senyera flag, the pennant, the board."""
    trophy = lift(load('8.png'), (8, 158, 283, 442), 32, colors=12, blob='keep', drop_green=True)

    flag = add_pole(lift(load('12.png'), (46, 38, 236, 278), 26, colors=14,
                         blob='keep', pad=8, bg_extra=BG_FLAG, gtol=80,
                         strip=48, strip_colors=STRIP_FLAG))
    flags = [flag, wave(flag, 1.1, amp=1.6), wave(flag, 2.2, amp=1.6),
             wave(flag, 3.3, amp=1.6)]

    pennant = lift(load('9.png'), (8, 8, 244, 348), 30, colors=12)

    frames = [trophy] + flags + [pennant]
    sheet = pack(frames, 8, os.path.join(OUT, 'props.png'))

    # The stadium board is a wide strip, so it gets its own texture rather than
    # a 32px cell: keyed, trimmed, then scaled to a tidy 64x14.
    board = flood_key(load('10.png').crop((8, 10, 593, 118)), 18, 70)
    bb = board.getchannel('A').getbbox()
    board = board.crop(bb).resize((96, 16), Image.BOX)
    board.putalpha(board.getchannel('A').point(lambda v: 255 if v > 120 else 0))
    quantize(board, 12).save(os.path.join(OUT, 'board.png'))

    print('prop sheet  -> %s (trophy %s, flag %s, pennant %s)'
          % (sheet.size, trophy.size, flag.size, pennant.size))
    return sheet


# Tiny emblems, re-stamped after the downscale. A club crest is four or five
# source pixels of fine detail; at a fifth of the size it averages into a blob
# (or a hole), so the shape is drawn back on by hand.
STAMP_PAL = {
    '.': None,
    'g': (0xed, 0xbb, 0x00), 'y': (0xa8, 0x82, 0x00), 'w': (0xff, 0xff, 0xff),
    'W': (0xdc, 0xe2, 0xea), 'b': (0x1b, 0x2a, 0x5b), 'r': (0xa5, 0x00, 0x44),
    'k': (0x14, 0x0d, 0x1c),
}

# Merengue crest: gold crown over a white shield
CREST_RM = [
    '..g..',
    '.ggg.',
    'gwwwg',
    'gwbwg',
    'gwbwg',
    '.gyg.',
]
# smaller version for the kit
CREST_RM_S = [
    '.g.',
    'gwg',
    'gbg',
    '.g.',
]
# Blaugrana crest: gold rim, garnet and blue quarters
# small white club badge for a dark suit
CREST_SUIT = [
    'www',
    'wgw',
    'wgw',
]
CREST_FCB = [
    'gggg',
    'gwrg',
    'grbg',
    'gbrg',
    '.gg.',
]


def fix_fist(im):
    """H4NSI's raised hand keeps two stray skin pixels above the knuckles after
    the downscale, which read as one extended finger rather than a fist. Find
    where the hand actually has mass and clear anything thinner above it."""
    px = im.load()
    w, h = im.size
    left = max(4, int(w * 0.45))

    def is_skin(c):
        return c[3] and c[0] > 150 and c[1] > 95 and c[2] > 60 and c[0] > c[2] + 45

    mass_row = None
    for y in range(h):
        if sum(1 for x in range(left) if is_skin(px[x, y])) >= 3:
            mass_row = y
            break
    if mass_row is None:
        return im
    for y in range(mass_row):
        for x in range(left):
            if is_skin(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    return im


def stamp(im, pattern, x, y, pal=STAMP_PAL):
    px = im.load()
    for dy, row in enumerate(pattern):
        for dx, ch in enumerate(row):
            c = pal.get(ch)
            if c is None:
                continue
            tx, ty = x + dx, y + dy
            if 0 <= tx < im.size[0] and 0 <= ty < im.size[1]:
                px[tx, ty] = c + (255,)
    return im


def build_world():
    """Merengue mushroom + MB4PPE, lifted straight off the reference sheet.

    The reference only gives one pose each, so the second walk frame is the
    mirrored sprite (how the 8-bit originals did it) and the stomped pose is a
    vertical squash. The trophy is left to the procedural art: its reference is
    painted over a blue glow that cannot be keyed off cleanly.
    """
    # dedicated references, isolated on black and far more detailed
    # 23px is the point where the crest stops being a blob; stamping a
    # synthetic one at 20px just read as a giant eye.
    mush = cut(load('24.png'), (0, 0, 124, 117), 23, thresh=100)
    mb = cut(load('26.png'), (0, 0, 133, 124), 23, thresh=100)
    frames = [
        mush, mush.transpose(Image.FLIP_LEFT_RIGHT), squash(mush, 11),
        mb, bob(mb.transpose(Image.FLIP_LEFT_RIGHT)), bob(mb), squash(mb, 12)
    ]
    sheet = pack(frames, 8, os.path.join(OUT, 'world.png'))
    print('world sheet -> %s (%d frames)' % (sheet.size, len(frames)))
    return sheet


def build_player():
    sheet = pack(frames_of(quantize(boost(downscale2(load('4.png')))), 8, 4), 8,
                 os.path.join(OUT, 'y4m4l10.png'))
    # SUPER: same artwork, gold glow
    aura(sheet, GOLD).save(os.path.join(OUT, 'y4m4l10_super.png'))
    # GOLDEN BOOT: brighter glow + golden boots
    aura(recolor_boots(sheet), GOLD_LIGHT).save(os.path.join(OUT, 'y4m4l10_boot.png'))

    colours = collections.Counter(p for p in sheet.get_flattened_data() if p[3])
    print('player sheets -> %s (%d frames, %d colours)'
          % (sheet.size, 32, len(colours)))
    return sheet


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    build_player()
    build_world()
    build_coaches()
    build_props()
    build_face()
    build_favicon()
    print('done')
