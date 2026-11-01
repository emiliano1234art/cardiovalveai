"""
Pendón CardioValveAI · versión 2 (dirección de arte editorial): 800 × 2000 mm.

Lenguaje visual: fondo crema, un solo tono dominante (verde azulado), título gigante, franja en mayúsculas condensadas,
modelo protagonista monocromo con «lupas» circulares de detalle, ciclo de apertura con línea punteada, miniaturas redondas
y caja comparativa final. El acento coral se reserva para el sensor Hall y el imán.

Genera (en pendon/):
  CardioValveAI_Pendon_v2_800x2000.svg                     editable (1 unidad = 1 mm)
  entrega_v2/CardioValveAI_Pendon_v2_800x2000_sin_sangrado.pdf / _sangrado10mm.pdf
  entrega_v2/vista_previa.png, acercamiento_*.png, Texto_final_pendon_v2.md, Notas_fuentes_y_pendientes_v2.md
Uso: python pendon2.py   (después de renders_pendon.py)
Tipografías: Inter / Inter Display y Barlow Condensed (ambas SIL Open Font License).
"""
from __future__ import annotations
import colorsys
import html
import json
import math
import os

import numpy as np
from PIL import Image, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, 'imagenes')
OUT = os.path.join(HERE, 'entrega_v2')
FONTS = os.path.join(HERE, 'fuentes')

W, H, BLEED, M = 800.0, 2000.0, 10.0, 45.0
CW = W - 2 * M
PT = 0.3528

# paleta: un tono dominante + acento
BG = '#EDE7DC'        # crema
LINEART = '#D8CFC1'   # dibujo de fondo (muy tenue)
TEAL_D = '#255F64'    # título y números
TEAL = '#3F8589'      # tecnología, líneas
TEAL_M = '#8DB7B5'
TEAL_L = '#C6DAD5'    # paneles
TEAL_XL = '#DCE8E3'
INK = '#22313A'       # texto principal
INK2 = '#4A5A62'      # texto secundario
ACC = '#C9553E'       # acento único: sensor Hall + imán
WHITE = '#FBF9F4'

FAM = {
    'm': ('Inter Medium', 'Inter-Medium.ttf', '400'),
    'sb': ('Inter SemiBold', 'Inter-SemiBold.ttf', '400'),
    'b': ('Inter', 'Inter-Bold.ttf', '700'),
    'd': ('Inter Display ExtraBold', 'InterDisplay-ExtraBold.ttf', '400'),
    'c': ('Barlow Condensed SemiBold', 'BarlowCondensed-SemiBold.ttf', '400'),
    'cb': ('Barlow Condensed', 'BarlowCondensed-Bold.ttf', '700'),
}
_fonts = {}


def tw(text, k, pt, ls=0.0):
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(os.path.join(FONTS, FAM[k][1]), 1000)
    return _fonts[k].getlength(text) / 1000 * pt * PT + ls * pt * PT * max(len(text) - 1, 0)


def wrap(text, k, pt, width, ls=0.0):
    lines = []
    for para in text.split('\n'):
        cur = ''
        for word in para.split(' '):
            t = (cur + ' ' + word).strip()
            if tw(t, k, pt, ls) <= width or not cur:
                cur = t
            else:
                lines.append(cur); cur = word
        lines.append(cur)
    return lines


TXT = {}


def T(key, value):
    TXT[key] = value
    return value


class Svg:
    def __init__(self):
        self.el, self.defs, self.checks, self.placed = [], [], [], {}
        self._id = 0

    def uid(self, p='i'):
        self._id += 1
        return f'{p}{self._id}'

    def add(self, s):
        self.el.append(s)

    def text(self, x, y, s, k='m', pt=26, fill=INK, anchor='start', ls=0.0, width=None, lh=1.3, extra='', check=True):
        lines = wrap(s, k, pt, width, ls) if width else s.split('\n')
        fam, _, wt = FAM[k]
        fs = pt * PT
        tsp = ''.join(f'<tspan x="{x:.2f}" dy="{0 if i == 0 else fs * lh:.2f}">{html.escape(l)}</tspan>' for i, l in enumerate(lines))
        self.add(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{fam}" font-weight="{wt}" font-size="{fs:.3f}" fill="{fill}" '
                 f'text-anchor="{anchor}" letter-spacing="{ls * fs:.3f}" {extra}>{tsp}</text>')
        wmax = max(tw(l, k, pt, ls) for l in lines)
        x0 = x - (wmax if anchor == 'end' else wmax / 2 if anchor == 'middle' else 0)
        yl = y + fs * lh * (len(lines) - 1)
        if check:
            self.checks.append((s[:40], (x0, y - fs * 0.75, x0 + wmax, yl + fs * 0.25), width))
        return yl

    def rect(self, x, y, w, h, fill='none', stroke='none', sw=0, r=0, extra=''):
        self.add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def line(self, x1, y1, x2, y2, stroke=TEAL, sw=1.2, extra=''):
        self.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" {extra}/>')

    def circle(self, cx, cy, r, fill='none', stroke='none', sw=0, extra=''):
        self.add(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def path(self, d, fill='none', stroke=INK, sw=1.5, extra=''):
        self.add(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>')

    def image(self, x, y, w, h, href, name, px, clip_circle=None):
        clip = ''
        if clip_circle:
            cid = self.uid('c')
            cx, cy, r = clip_circle
            self.defs.append(f'<clipPath id="{cid}"><circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}"/></clipPath>')
            clip = f' clip-path="url(#{cid})"'
        self.add(f'<image id="{name}" x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" href="{href}" preserveAspectRatio="xMidYMid meet"{clip}/>')
        vis_w = (2 * clip_circle[2]) if clip_circle else w
        vis_px = px[0] * vis_w / w
        self.placed[name] = {'archivo': href, 'px': list(px), 'mm_visible': round(vis_w, 1), 'ppp': round(vis_px / (vis_w / 25.4))}

    def arc_text(self, cx, cy, r, s, k='cb', pt=30, fill=TEAL_D, bottom=True, ls=0.04):
        """Texto curvo sobre una circunferencia (abajo, leyendo de izquierda a derecha)."""
        pid = self.uid('a')
        if bottom:
            d = f'M{cx - r:.2f},{cy:.2f} A{r:.2f},{r:.2f} 0 0,0 {cx + r:.2f},{cy:.2f}'
        else:
            d = f'M{cx - r:.2f},{cy:.2f} A{r:.2f},{r:.2f} 0 0,1 {cx + r:.2f},{cy:.2f}'
        self.defs.append(f'<path id="{pid}" d="{d}"/>')
        fam, _, wt = FAM[k]
        fs = pt * PT
        self.add(f'<text font-family="{fam}" font-weight="{wt}" font-size="{fs:.3f}" fill="{fill}" letter-spacing="{ls * fs:.3f}">'
                 f'<textPath href="#{pid}" startOffset="50%" text-anchor="middle">{html.escape(s)}</textPath></text>')

    def svg(self, bleed):
        b = bleed
        return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{W + 2 * b}mm" height="{H + 2 * b}mm" viewBox="{-b} {-b} {W + 2 * b} {H + 2 * b}">\n'
                f'<title>CardioValveAI · Pendón 800 × 2000 mm</title>\n<defs>' + ''.join(self.defs) + '</defs>\n'
                f'<rect id="fondo" x="{-b}" y="{-b}" width="{W + 2 * b}" height="{H + 2 * b}" fill="{BG}"/>\n'
                + '\n'.join(self.el) + '\n</svg>\n')


# ───────────────────────────── imágenes: tono único + acento ─────────────────────────────
DARK = np.array([24, 66, 72], float)
LIGHT = np.array([232, 241, 238], float)


def duotone(src, dst, crop_alpha=True, square=None, keep_accent=True):
    """Pasa el render a un solo tono (verde azulado), conserva el acento coral (imán) y recorta.
    square = fracción del lado para un recorte cuadrado centrado (lupas). Devuelve (ruta relativa, px, bbox)."""
    im = Image.open(os.path.join(IMG, src)).convert('RGBA')
    if square:
        s = int(min(im.size) * square)
        cx, cy = im.width // 2, im.height // 2
        im = im.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2))
    a = np.asarray(im).astype(float)
    rgb, al = a[..., :3], a[..., 3:]
    L = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255
    L = np.clip((L - 0.06) / 0.88, 0, 1) ** 0.9
    out = DARK + (LIGHT - DARK) * L[..., None]
    if keep_accent:
        mx, mn = rgb.max(-1), rgb.min(-1)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
        red = (rgb[..., 0] > rgb[..., 1] * 1.35) & (rgb[..., 0] > rgb[..., 2] * 1.35) & (sat > 0.4) & (mx > 90)
        out[red] = rgb[red]
    res = Image.fromarray(np.concatenate([out, al], -1).clip(0, 255).astype(np.uint8), 'RGBA')
    bb = (0, 0, res.width, res.height)
    if crop_alpha and not square:
        bb = res.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        p = int(0.015 * max(res.size))
        bb = (max(bb[0] - p, 0), max(bb[1] - p, 0), min(bb[2] + p, res.width), min(bb[3] + p, res.height))
        res = res.crop(bb)
    if square:  # las lupas llevan fondo claro propio (dentro del círculo)
        bg = Image.new('RGBA', res.size, (*[int(v) for v in LIGHT], 255))
        bg.alpha_composite(res); res = bg
    res.save(os.path.join(IMG, dst), optimize=True)
    return os.path.relpath(os.path.join(IMG, dst), HERE), res.size, bb


# ───────────────────────────── iconos vectoriales ─────────────────────────────
def icon_esp32(s, cx, cy, k=1.0):
    s.rect(cx - 22 * k, cy - 15 * k, 44 * k, 30 * k, fill=WHITE, stroke=TEAL_D, sw=1.8, r=3)
    s.rect(cx - 9 * k, cy - 8 * k, 18 * k, 16 * k, fill=TEAL_D, r=1.5)
    for i in range(5):
        y = cy - 11 * k + i * 5.5 * k
        s.line(cx - 26 * k, y, cx - 22 * k, y, TEAL_D, 1.4); s.line(cx + 22 * k, y, cx + 26 * k, y, TEAL_D, 1.4)


def icon_screen(s, cx, cy, k=1.0):
    s.rect(cx - 26 * k, cy - 18 * k, 52 * k, 33 * k, fill=WHITE, stroke=TEAL_D, sw=1.8, r=3)
    s.line(cx - 8 * k, cy + 21 * k, cx + 8 * k, cy + 21 * k, TEAL_D, 1.8)
    for dy, col in ((-7, TEAL), (0, TEAL_D), (7, ACC)):
        y0 = cy + dy * k
        s.path(f'M{cx - 21 * k},{y0 + 3 * k} L{cx - 12 * k},{y0 + 3 * k} C{cx - 8 * k},{y0 + 3 * k} {cx - 8 * k},{y0 - 3 * k} {cx - 4 * k},{y0 - 3 * k} '
               f'L{cx + 6 * k},{y0 - 3 * k} C{cx + 10 * k},{y0 - 3 * k} {cx + 10 * k},{y0 + 3 * k} {cx + 14 * k},{y0 + 3 * k} L{cx + 21 * k},{y0 + 3 * k}',
               stroke=col, sw=1.5)


def pulse(s, px, py, pw, ph, dx=0.0, amp=1.0, col=TEAL, sw=1.6, extra=''):
    a, b_ = px + pw * (0.16 + dx), px + pw * (0.62 + dx)
    top, base = py + ph * (1 - 0.86 * amp), py + ph * 0.94
    s.path(f'M{px},{base} L{a},{base} C{a + pw * 0.06},{base} {a + pw * 0.04},{top} {a + pw * 0.12},{top} '
           f'L{b_ - pw * 0.08},{top} C{b_ - pw * 0.02},{top} {b_ - pw * 0.04},{base} {b_ + pw * 0.04},{base} L{px + pw},{base}',
           stroke=col, sw=sw, extra=extra)


def lineart(s):
    """Dibujo de fondo muy tenue: líneas de campo de un imán (dipolo) y la «Y» de coaptación de tres valvas."""
    g = []
    def dipole(cx, cy, scale, rot):
        for k in (0.35, 0.55, 0.8, 1.1, 1.45):
            pts = []
            for i in range(0, 181, 4):
                th = math.radians(i)
                r = k * scale * math.sin(th) ** 2
                x, y = r * math.sin(th), r * math.cos(th)
                c, sn = math.cos(rot), math.sin(rot)
                pts.append((cx + c * x - sn * y, cy + sn * x + c * y))
            for sign in (1, -1):
                d = 'M' + ' L'.join(f'{cx + sign * (px - cx) * 1:.1f},{py:.1f}' if False else f'{px if sign > 0 else 2 * cx - px:.1f},{py:.1f}' for px, py in pts)
                g.append(f'<path d="{d}" fill="none" stroke="{LINEART}" stroke-width="0.9"/>')
    dipole(690, 300, 230, 0.0)
    dipole(120, 1560, 200, 0.0)
    for r in (95, 140, 185):
        g.append(f'<circle cx="640" cy="1280" r="{r}" fill="none" stroke="{LINEART}" stroke-width="0.9"/>')
    cx, cy, r = 400, 690, 330
    for ang in (90, 210, 330):
        a = math.radians(ang)
        g.append(f'<line x1="{cx}" y1="{cy}" x2="{cx + r * math.cos(a):.1f}" y2="{cy - r * math.sin(a):.1f}" stroke="{LINEART}" stroke-width="0.9"/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{LINEART}" stroke-width="0.9"/>')
    s.add('<g id="fondo_dibujo" opacity="0.9">' + ''.join(g) + '</g>')


# ───────────────────────────── composición ─────────────────────────────
def build():
    s = Svg()
    anc = json.load(open(os.path.join(IMG, 'anclas.json')))
    lineart(s)

    # ── A · encabezado ──────────────────────────────────────────────
    s.add('<g id="A_encabezado">')
    pt = math.floor(CW / tw('CardioValveAI', 'd', 1.0, -0.02))
    fs = pt * PT
    yt = 58 + fs * 0.74
    s.add(f'<text x="{M - 2:.2f}" y="{yt:.2f}" font-family="{FAM["d"][0]}" font-size="{fs:.3f}" letter-spacing="{-0.02 * fs:.3f}" fill="{TEAL_D}">'
          f'{T("nombre", "CardioValveAI")}</text>')
    s.checks.append(('nombre', (M - 2, yt - fs * 0.72, M - 2 + tw('CardioValveAI', 'd', pt, -0.02), yt), None))
    TXT['_nombre_pt'] = pt
    # franja
    ys = yt + 22
    strip = T('franja', 'MODELO DE VÁLVULA AÓRTICA DE TRES VALVAS')
    sp = 56
    sw_ = tw(strip, 'cb', sp, 0.05) + 26
    s.rect(-BLEED, ys, BLEED + M + sw_, 30, fill=TEAL_L)
    s.text(M, ys + 21.6, strip, 'cb', sp, TEAL_D, ls=0.05)
    # texto vertical
    vt = T('vertical', 'PROTOTIPO DE BANCO')
    vx, vy = W - M + 2, ys - 4
    s.add(f'<text transform="translate({vx:.2f},{vy:.2f}) rotate(90)" font-family="{FAM["cb"][0]}" font-weight="700" font-size="{30 * PT:.3f}" '
          f'fill="{TEAL}" letter-spacing="{0.18 * 30 * PT:.3f}">{vt}</text>')
    # frase principal y pregunta
    yi = ys + 30 + 36
    y1 = s.text(M, yi, T('frase', 'Convertimos el movimiento de una válvula en datos medibles.'), 'b', 46, INK, width=360, lh=1.16)
    s.line(M + 380, yi - 13, M + 380, y1 + 4, TEAL_M, 1.0)
    s.text(M + 398, yi, T('pregunta', '¿Qué puede contarnos el movimiento de una válvula?'), 'c', 46, TEAL, width=CW - 398 - 22, lh=1.1)
    s.add('</g>')
    y = y1 + 26

    # ── B · protagonista con lupas ─────────────────────────────────
    s.add('<g id="B_protagonista">')
    href, px, bb = duotone('protagonista.png', 'p2_protagonista.png')
    hw = 450.0
    hh = hw * px[1] / px[0]
    hx, hy = (W - hw) / 2 + 6, y + 28
    s.image(hx, hy, hw, hh, href, 'img_protagonista', px)
    full = Image.open(os.path.join(IMG, 'protagonista.png')).size

    def at(key):
        u, v = anc['protagonista'][key]['uv']
        return hx + (u * full[0] - bb[0]) / px[0] * hw, hy + (v * full[1] - bb[1]) / px[1] * hh

    s.add(f'<text transform="translate({hx + hw * 0.50:.1f},{hy + 6:.1f}) rotate(-6)" font-family="{FAM["cb"][0]}" font-weight="700" '
          f'font-size="{50 * PT:.3f}" fill="{TEAL}" text-anchor="middle" letter-spacing="{0.03 * 50 * PT:.3f}">{T("rotulo_modelo", "El prototipo")}</text>')
    R_ = 64.0
    lupas = [  # (render, anchor, centro, etiqueta, subetiqueta, color del aro)
        ('lupa_valva.png', 'valva1', (M + R_ - 6, hy + 70), T('lupa_valva', 'VALVA'), T('lupa_valva_sub', '3 móviles'), TEAL),
        ('lupa_hall.png', 'portasensor3', (W - M - R_ + 6, hy + 140), T('lupa_hall', 'SENSOR HALL'), T('lupa_hall_sub', 'fijo · uno por valva'), ACC),
        ('lupa_iman.png', None, (W - M - R_ + 6, hy + 140 + 2 * R_ + 52), T('lupa_iman', 'IMÁN'), T('lupa_iman_sub', 'gira con la valva'), ACC),
        ('lupa_servo.png', 'servo', (M + R_ - 6, hy + hh - 110), T('lupa_servo', 'SERVOMOTOR'), T('lupa_servo_sub', 'mueve las tres valvas'), TEAL),
    ]
    for src, key, (cx, cy), lab, sub, col in lupas:
        href_l, pxl, _ = duotone(src, 'p2_' + src, square=0.72)
        if key:
            ax, ay = at(key)
            d = math.hypot(ax - cx, ay - cy)
            ex, ey = cx + (ax - cx) / d * R_, cy + (ay - cy) / d * R_
            s.line(ex, ey, ax, ay, col, 1.4)
            s.circle(ax, ay, 3.4, fill=col, stroke=WHITE, sw=1.2)
            if key == 'portasensor3':
                s.circle(ax, ay, 12, stroke=ACC, sw=1.8)
        s.circle(cx, cy, R_ + 3.2, fill=WHITE)
        s.image(cx - R_, cy - R_, 2 * R_, 2 * R_, href_l, 'img_' + src[:-4], pxl, clip_circle=(cx, cy, R_))
        s.circle(cx, cy, R_ + 1.6, stroke=col, sw=2.2)
        s.arc_text(cx, cy, R_ + 9.5, lab, 'cb', 30, col if col == ACC else TEAL_D, bottom=True, ls=0.08)
        s.text(cx, cy + R_ + 25, sub, 'm', 21, INK2, anchor='middle')
    # unión imán ↔ sensor (son un par)
    (_, _, (c1x, c1y), *_), (_, _, (c2x, c2y), *_) = lupas[1], lupas[2]
    s.line(c1x, c1y + R_ + 30, c2x, c2y - R_ - 4, ACC, 1.2, 'stroke-dasharray="3 3"')
    s.text(hx + 6, hy + hh + 14, T('pie_protagonista', 'Imágenes generadas a partir del modelo 3D del prototipo actual. En la lupa del imán, el portasensor se muestra separado; en la del servomotor, la estructura está oculta.'),
           'm', 18, INK2, width=hw + 30, lh=1.25)
    s.add('</g>')
    y = hy + hh + 52

    # ── cifras de diseño ───────────────────────────────────────────
    s.add('<g id="B_cifras">')
    facts = [(T('cifra1', '90 mm'), T('cifra1_txt', 'diámetro del anillo impreso en 3D')),
             (T('cifra2', '3 × 3'), T('cifra2_txt', 'valvas, imanes y sensores Hall: uno de cada uno por valva')),
             (T('cifra3', '0°–80°'), T('cifra3_txt', 'apertura de diseño, con un solo servomotor'))]
    fw = CW / 3
    for i, (num, txt) in enumerate(facts):
        x = M + i * fw
        s.line(x + 2, y - 30, x + 2, y + 40, TEAL, 2.0)
        s.line(x + 2, y - 30, x + 9, y - 30, TEAL, 2.0); s.line(x + 2, y + 40, x + 9, y + 40, TEAL, 2.0)
        s.text(x + 16, y + 2, num, 'cb', 104, TEAL_D, ls=0.0)
        s.text(x + 16, y + 20, txt, 'm', 22, INK, width=fw - 26, lh=1.22)
    s.add('</g>')
    y += 92

    # ── C · necesidad + panel del ciclo ─────────────────────────────
    s.add('<g id="C_necesidad">')
    lw = 352
    s.text(M, y, T('t_necesidad', '¿Por qué mirar una válvula?'), 'cb', 60, TEAL_D)
    yy = s.text(M, y + 26, T('necesidad_1', 'En cada latido, las válvulas del corazón abren y cierran. Cuánto se abren, cuándo y con qué coordinación es parte de cómo funciona el corazón.'),
                'm', 25, INK, width=lw, lh=1.32)
    yy = s.text(M, yy + 16, T('necesidad_2', 'Queremos saber si ese movimiento puede medirse de forma simple y, más adelante, relacionarse con la respuesta funcional de una persona.'),
                'm', 25, INK, width=lw, lh=1.32)
    qy = yy + 20
    ql = wrap(T('pregunta_investigacion', '¿Puede un sistema simple de sensores describir el movimiento valvular con datos comparables?'), 'sb', 27, lw - 24)
    qh = 22 + len(ql) * 27 * PT * 1.28 + 6
    s.rect(M, qy, lw, qh, fill=WHITE, stroke=TEAL, sw=1.4, r=8)
    s.text(M + 12, qy + 12, T('t_pregunta_investigacion', 'PREGUNTA DE INVESTIGACIÓN'), 'cb', 24, TEAL, ls=0.06)
    s.text(M + 12, qy + 25, TXT['pregunta_investigacion'], 'sb', 27, INK, width=lw - 24, lh=1.28)
    yl_end = qy + qh
    # panel del ciclo (derecha, hasta el sangrado)
    px0 = M + lw + 26
    ph_ = max(yl_end - y + 40, 300)
    s.rect(px0, y - 42, W + BLEED - px0, ph_, fill=TEAL_L)
    s.text(px0 + 20, y - 4, T('t_ciclo', 'Un ciclo: abrir y cerrar'), 'cb', 46, TEAL_D)
    cxp, cyp = px0 + (W - px0) / 2 + 2, y - 42 + ph_ / 2 + 22
    rx, ry = (W - px0) / 2 - 62, ph_ / 2 - 70
    s.add(f'<ellipse cx="{cxp:.1f}" cy="{cyp:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="none" stroke="{TEAL}" stroke-width="2.2" stroke-dasharray="7 6"/>')
    views = [('superior_cerrada.png', 'cerrada · 0°', 180), ('superior_30.png', '30°', 90), ('superior_60.png', '60°', 0), ('superior_abierta.png', 'abierta · 80°', 270)]
    rv = 40.0
    for src, lab, ang in views:
        a = math.radians(ang)
        vx_, vy_ = cxp + rx * math.cos(a), cyp - ry * math.sin(a)
        href_v, pxv, _ = duotone(src, 'p2_' + src)
        s.circle(vx_, vy_, rv + 4, fill=BG)
        s.image(vx_ - rv, vy_ - rv, 2 * rv, 2 * rv * pxv[1] / pxv[0], href_v, 'img_' + src[:-4], pxv)
        ly = vy_ + rv + 15 if ang != 90 else vy_ - rv - 8
        s.text(vx_, ly, lab, 'c', 26, TEAL_D, anchor='middle')
    # flechas de sentido sobre la elipse
    for ang in (135, 45, 315, 225):
        a = math.radians(ang)
        x0, y0 = cxp + rx * math.cos(a), cyp - ry * math.sin(a)
        tx, ty = -rx * math.sin(a), -ry * math.cos(a)        # tangente (sentido horario en pantalla)
        n = math.hypot(tx, ty); tx, ty = tx / n, ty / n
        s.path(f'M{x0 - 5 * tx - 4 * ty:.1f},{y0 - 5 * ty + 4 * tx:.1f} L{x0 + 3 * tx:.1f},{y0 + 3 * ty:.1f} L{x0 - 5 * tx + 4 * ty:.1f},{y0 - 5 * ty - 4 * tx:.1f}',
               stroke=TEAL_D, sw=2.0)
    s.text(cxp, cyp + 4, T('ciclo_centro', 'vista\nsuperior'), 'c', 24, TEAL, anchor='middle', lh=1.05)
    s.add('</g>')
    y = max(yl_end, y - 42 + ph_) + 60

    # ── D · del movimiento a los datos ─────────────────────────────
    s.add('<g id="D_funcionamiento">')
    s.text(M, y, T('t_funcionamiento', 'Del movimiento a los datos'), 'cb', 60, TEAL_D)
    y += 22
    steps = [('iman', T('paso1', 'La valva se mueve'), T('paso1_sub', 'El imán gira con ella.')),
             ('hall', T('paso2', 'El campo cambia'), T('paso2_sub', 'El sensor Hall, fijo, lo detecta.')),
             ('esp', T('paso3', 'El ESP32 registra'), T('paso3_sub', 'Lee los 3 sensores y controla el servo.')),
             ('pc', T('paso4', 'Vemos y analizamos'), T('paso4_sub', 'Una señal por valva en el computador.'))]
    sw4 = CW / 4
    rc = 44.0
    cyc = y + rc + 4
    for i, (kind, t1, t2) in enumerate(steps):
        cx = M + sw4 * i + sw4 / 2
        if i < 3:
            s.line(cx + rc + 6, cyc, cx + sw4 - rc - 8, cyc, TEAL, 1.8, 'stroke-dasharray="5 5"')
            x2 = cx + sw4 - rc - 6
            s.path(f'M{x2 - 6},{cyc - 4.5} L{x2},{cyc} L{x2 - 6},{cyc + 4.5}', stroke=TEAL, sw=1.8)
        if kind in ('iman', 'hall'):
            src = 'lupa_iman.png' if kind == 'iman' else 'lupa_hall.png'
            hr, pxx, _ = duotone(src, 'p2_paso_' + src, square=0.6)
            s.circle(cx, cyc, rc + 2.8, fill=WHITE)
            s.image(cx - rc, cyc - rc, 2 * rc, 2 * rc, hr, f'img_paso{i + 1}', pxx, clip_circle=(cx, cyc, rc))
            s.circle(cx, cyc, rc + 1.4, stroke=ACC, sw=2.0)
        else:
            s.circle(cx, cyc, rc, fill=TEAL_XL, stroke=TEAL, sw=2.0)
            (icon_esp32 if kind == 'esp' else icon_screen)(s, cx, cyc, 1.15)
        s.circle(cx - rc * 0.74, cyc - rc * 0.74, 8.5, fill=TEAL_D)
        s.text(cx - rc * 0.74, cyc - rc * 0.74 + 3.6, str(i + 1), 'b', 27, WHITE, anchor='middle')
        s.text(cx, cyc + rc + 22, t1, 'sb', 27, INK, anchor='middle')
        for j, l in enumerate(wrap(t2, 'm', 22, sw4 - 14)):
            s.text(cx, cyc + rc + 35 + j * 9.6, l, 'm', 22, INK2, anchor='middle')
    y = cyc + rc + 62
    nt = T('nota_calibracion', 'La señal del sensor no es un ángulo: para expresarla en grados, cada valva se calibra con posiciones conocidas.')
    s.rect(M, y - 12, CW, 18, fill=TEAL_XL, r=9)
    s.text(M + 16, y, nt, 'm', 22, INK, width=CW - 32)
    s.add('</g>')
    y += 52

    # ── E · qué observamos ──────────────────────────────────────────
    s.add('<g id="E_observamos">')
    s.text(M, y, T('t_observamos', 'Qué observamos'), 'cb', 60, TEAL_D)
    s.text(W - M, y, T('nota_esquemas', 'esquemas ilustrativos, no son resultados'), 'c', 24, INK2, anchor='end')
    y += 16
    cw4 = (CW - 3 * 12) / 4
    obs = [('ap', T('obs1', 'Apertura y cierre')), ('coord', T('obs2', 'Coordinación de las 3 valvas')),
           ('t', T('obs3', 'Tiempos del movimiento')), ('ref', T('obs4', 'Cambios frente a un patrón de referencia'))]
    for i, (kind, label) in enumerate(obs):
        x = M + i * (cw4 + 12)
        s.rect(x, y, cw4, 54, fill=WHITE, r=6)
        px_, py_, pw_, ph2 = x + 8, y + 8, cw4 - 16, 38
        s.line(px_, py_ + ph2, px_ + pw_, py_ + ph2, TEAL_M, 0.8)
        if kind == 'ap':
            pulse(s, px_, py_, pw_, ph2, 0.0, 1.0, TEAL_D, 1.8)
        elif kind == 'coord':
            pulse(s, px_, py_, pw_, ph2, -0.03, 1.0, TEAL, 1.7); pulse(s, px_, py_, pw_, ph2, 0.01, 0.93, TEAL_D, 1.7); pulse(s, px_, py_, pw_, ph2, 0.07, 0.85, ACC, 1.7)
        elif kind == 't':
            pulse(s, px_, py_, pw_, ph2, 0.0, 0.9, TEAL, 1.8)
            a_, b2 = px_ + pw_ * 0.16, px_ + pw_ * 0.66
            s.line(a_, py_ + 1, b2, py_ + 1, TEAL_D, 1.2); s.line(a_, py_ - 2, a_, py_ + 4, TEAL_D, 1.2); s.line(b2, py_ - 2, b2, py_ + 4, TEAL_D, 1.2)
        else:
            pulse(s, px_, py_, pw_, ph2, 0.0, 1.0, INK2, 1.4, 'stroke-dasharray="3 2.5"'); pulse(s, px_, py_, pw_, ph2, 0.03, 0.7, ACC, 1.8)
        s.text(x + 22, y + 77, str(i + 1), 'cb', 64, TEAL_M, anchor='middle')
        s.text(x + 38, y + 68, label, 'sb', 24, INK, width=cw4 - 40, lh=1.2)
    y += 54 + 56
    s.add('</g>')

    # ── F · hoy / a futuro (caja comparativa) ───────────────────────
    s.add('<g id="F_hoy_futuro">')
    cols = [(T('hoy_t', 'Hoy · prototipo'), T('hoy', 'Modelo de banco que mueve tres valvas y registra una señal por valva. Sin fluido ni pacientes.')),
            (T('estudio_t', 'Lo que estudiamos'), T('estudio', 'Qué variables del movimiento son medibles, repetibles y comparables.')),
            (T('futuro_t', 'A futuro'), T('futuro', 'Tras una validación adecuada: apoyo al seguimiento funcional y a la rehabilitación cardiorrespiratoria personalizada, con inteligencia artificial.'))]
    c3 = (CW - 40) / 3
    hs = []
    for t1, t2 in cols:
        hs.append(len(wrap(t2, 'm', 22, c3 - 12)))
    bh = 28 + max(hs) * 22 * PT * 1.3 + 32
    s.rect(M, y, CW, bh, fill=TEAL_L, r=10)
    s.text(W / 2, y - 6, T('t_futuro', 'Hoy y a futuro'), 'cb', 40, TEAL_D, anchor='middle')
    for i, (t1, t2) in enumerate(cols):
        x = M + 14 + i * (c3 + 6)
        if i:
            s.line(x - 6, y + 12, x - 6, y + bh - 30, TEAL, 1.2)
        mk = ('●', '◐', '○')[i]
        s.text(x, y + 20, f'{mk} {t1}', 'sb', 26, TEAL_D)
        s.text(x, y + 32, t2, 'm', 22, INK, width=c3 - 12, lh=1.3)
    s.text(M + 14, y + bh - 10, T('nota_ia', 'La inteligencia artificial es una línea de desarrollo futuro; hoy, el software compara cada ciclo con un patrón de referencia. '
                                            'Prototipo académico: no es un dispositivo médico ni entrega diagnósticos.'), 'm', 17, INK2, width=CW - 28)
    s.add('</g>')
    yend = y + bh
    TXT['_y_fin_contenido'] = round(yend, 1)

    # ── G · invitación ──────────────────────────────────────────────
    s.add('<g id="G_invitacion">')
    gy = max(yend + 26, 1880.0)
    s.rect(-BLEED, gy, W + 2 * BLEED, 66, fill=TEAL_D)
    s.text(M, gy + 30, T('invitacion', 'Acércate: mira el mecanismo en movimiento y conversemos.'), 'b', 40, WHITE, width=CW)
    s.text(M, gy + 51, 'CardioValveAI', 'cb', 30, TEAL_L, ls=0.05)
    s.add('</g>')
    TXT['_banda'] = (round(gy, 1), round(gy + 66, 1))
    return s, gy


def verify(s, gy):
    issues = []
    for label, (x0, y0, x1, y1), width in s.checks:
        if x0 < M - 3 or x1 > W - M + 2:
            issues.append(f'fuera del margen lateral: «{label}» ({x0:.1f}–{x1:.1f} mm)')
        if width and x1 - x0 > width + 1.5:
            issues.append(f'más ancho que su caja: «{label}»')
    if gy + 66 > H - 30:
        issues.append(f'la banda final ({gy:.0f}–{gy + 66:.0f} mm) invade la zona inferior de seguridad')
    for k, v in s.placed.items():
        if v['ppp'] < 150:
            issues.append(f'resolución baja: {k} {v["ppp"]} ppp')
    return issues


def words():
    skip = {'nombre', 'franja', 'vertical', 'rotulo_modelo', 'ciclo_centro'}
    return sum(len(str(v).split()) for k, v in TXT.items() if not k.startswith('_') and k not in skip)


def export(svg_path):
    import cairosvg
    import pymupdf
    src = open(svg_path, encoding='utf-8').read()
    base = os.path.join(OUT, 'CardioValveAI_Pendon_v2_800x2000')
    mm = 72 / 25.4
    pdf_b = base + '_sangrado10mm.pdf'
    cairosvg.svg2pdf(bytestring=src.encode(), write_to=pdf_b, url=svg_path, unsafe=True)
    d = pymupdf.open(pdf_b); pg = d[0]
    trim = pymupdf.Rect(BLEED * mm, BLEED * mm, (BLEED + W) * mm, (BLEED + H) * mm)
    pg.set_trimbox(trim); pg.set_bleedbox(pg.rect)
    d.set_metadata({'title': 'CardioValveAI · Pendón 800 × 2000 mm (v2)'})
    d.save(pdf_b + '.tmp', garbage=3, deflate=True); d.close(); os.replace(pdf_b + '.tmp', pdf_b)
    src0 = src.replace(f'width="{W + 2 * BLEED}mm" height="{H + 2 * BLEED}mm" viewBox="{-BLEED} {-BLEED} {W + 2 * BLEED} {H + 2 * BLEED}"',
                       f'width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}"')
    assert src0 != src
    cairosvg.svg2pdf(bytestring=src0.encode(), write_to=base + '_sin_sangrado.pdf', url=svg_path, unsafe=True)
    p = pymupdf.open(base + '_sin_sangrado.pdf')[0]
    print('PDF sin sangrado:', round(p.rect.width / mm, 1), '×', round(p.rect.height / mm, 1), 'mm · fuentes:', sorted({f[3].split('+')[-1] for f in p.get_fonts()}))
    text = p.get_text().lower()
    bad = [w for w in ('micrófono', 'microfono', 'piezo', 'inmp') if w in text]
    print('palabras prohibidas en el PDF:', bad or 'ninguna')
    p.get_pixmap(dpi=40).save(os.path.join(OUT, 'vista_previa.png'))
    for name, a, b in (('acercamiento_1_encabezado_modelo', 0, 1060), ('acercamiento_2_cifras_ciclo', 1000, 1500),
                       ('acercamiento_3_funcionamiento', 1440, 1800), ('acercamiento_4_observamos_futuro', 1700, 2000)):
        p.get_pixmap(dpi=60, clip=pymupdf.Rect(0, a * mm, W * mm, b * mm)).save(os.path.join(OUT, name + '.png'))


def write_docs(s):
    t = TXT
    L = ['# CardioValveAI · Texto final del pendón v2 (800 × 2000 mm)', '', 'Texto en orden de lectura. Se corrige en `pendon2.py` (cada `T(\'clave\', \'texto\')`) y se regenera con `python pendon2.py`.', '',
         f'Palabras de texto (sin título, franja ni rótulos decorativos): {words()}', '',
         '## Encabezado', f"- Nombre: {t['nombre']}", f"- Franja: {t['franja']}", f"- Texto vertical: {t['vertical']}", f"- Frase principal: {t['frase']}", f"- Pregunta: {t['pregunta']}", '',
         '## Modelo y lupas', f"- Rótulo: {t['rotulo_modelo']}"]
    L += [f"- Lupa: {t[k]} — {t[k + '_sub']}" for k in ('lupa_valva', 'lupa_hall', 'lupa_iman', 'lupa_servo')]
    L += [f"- Pie: {t['pie_protagonista']}", '', '## Cifras de diseño'] + [f"- **{t[f'cifra{i}']}** — {t[f'cifra{i}_txt']}" for i in (1, 2, 3)]
    L += ['', f"## {t['t_necesidad']}", t['necesidad_1'], '', t['necesidad_2'], '', f"**{t['t_pregunta_investigacion']}:** {t['pregunta_investigacion']}", '',
          f"## {t['t_ciclo']}", 'Vistas superiores del modelo en 0°, 30°, 60° y 80° (ángulos de diseño).', '', f"## {t['t_funcionamiento']}"]
    L += [f"{i}. **{t[f'paso{i}']}** — {t[f'paso{i}_sub']}" for i in range(1, 5)]
    L += ['', f"Nota: {t['nota_calibracion']}", '', f"## {t['t_observamos']} ({t['nota_esquemas']})"] + [f"{i}. {t[f'obs{i}']}" for i in range(1, 5)]
    L += ['', f"## {t['t_futuro']}", f"- **{t['hoy_t']}:** {t['hoy']}", f"- **{t['estudio_t']}:** {t['estudio']}", f"- **{t['futuro_t']}:** {t['futuro']}", '',
          f"Nota: {t['nota_ia']}", '', '## Invitación', t['invitacion'], '']
    open(os.path.join(OUT, 'Texto_final_pendon_v2.md'), 'w', encoding='utf-8').write('\n'.join(L))
    ppp = '\n'.join(f"| {k} | {v['px'][0]} × {v['px'][1]} px | {v['mm_visible']:.0f} mm | **{v['ppp']} ppp** |" for k, v in s.placed.items())
    n = f"""# CardioValveAI · Pendón v2: fuentes, estado y datos por confirmar

Rediseño con la dirección de arte del póster de referencia (fondo crema, un tono dominante, título gigante, franja condensada,
modelo protagonista monocromo con lupas circulares, ciclo con línea punteada, miniaturas redondas y caja comparativa).
El contenido, el rigor y las fuentes son los mismos de la versión 1 (`pendon/entrega/Notas_fuentes_y_pendientes.md`).

## Archivos
- `CardioValveAI_Pendon_v2_800x2000_sin_sangrado.pdf` — 800 × 2000 mm exactos.
- `CardioValveAI_Pendon_v2_800x2000_sangrado10mm.pdf` — 820 × 2020 mm, TrimBox 800 × 2000 mm.
- `../CardioValveAI_Pendon_v2_800x2000.svg` — editable (1 unidad = 1 mm), capas por sección, imágenes en `imagenes/p2_*.png`.
- `Texto_final_pendon_v2.md` — texto separado del diseño.

## Imágenes
Renders del CAD v4 (sin texto grabado), pasados a un solo tono verde azulado. El imán conserva el coral (acento) para que se distinga.
No hay fotografías del prototipo. Lupas: vistas cercanas renderizadas aparte (no ampliaciones de la imagen grande).
Las cifras (90 mm, 3 × 3, 0°–80°) son medidas de diseño del CAD v4, no mediciones.

| Imagen | Píxeles | Tamaño visible | Resolución efectiva |
|---|---|---|---|
{ppp}

## Tipografías
Inter / Inter Display (título y texto) y Barlow Condensed (franja, títulos de sección, cifras y rótulos). Dos familias, ambas SIL OFL (`fuentes/`).

## Datos por confirmar antes de imprimir
1. Estado del prototipo el día de la feria («Hoy · prototipo»: mueve tres valvas y registra una señal por valva). Si aún no funciona, cambiar a «diseñado para…».
2. Redacción de la pregunta de investigación y del enfoque funcional, con el profesor guía.
3. Imprenta: sangrado (se entregan 10 mm), zona oculta del soporte (el contenido termina a {TXT['_y_fin_contenido']:.0f} mm; banda de invitación {TXT['_banda'][0]:.0f}–{TXT['_banda'][1]:.0f} mm), perfil de color (PDF en RGB; pedir conversión CMYK y prueba del verde azulado y del coral) y si exigen PDF/X.
4. Si se consigue una fotografía real del prototipo (≥ 3000 px de ancho), puede reemplazar la imagen principal.
"""
    open(os.path.join(OUT, 'Notas_fuentes_y_pendientes_v2.md'), 'w', encoding='utf-8').write(n)


def main():
    os.makedirs(OUT, exist_ok=True)
    s, gy = build()
    issues = verify(s, gy)
    svg_path = os.path.join(HERE, 'CardioValveAI_Pendon_v2_800x2000.svg')
    open(svg_path, 'w', encoding='utf-8').write(s.svg(BLEED))
    export(svg_path)
    write_docs(s)
    print('palabras:', words(), '· fin del contenido:', TXT['_y_fin_contenido'], '· banda:', TXT['_banda'])
    print('imágenes:', {k: v['ppp'] for k, v in s.placed.items()})
    print('problemas:', issues or 'ninguno')


if __name__ == '__main__':
    main()
