"""
Pendón CardioValveAI · 800 × 2000 mm (vertical, proporción 2:5).

Genera:
  pendon/CardioValveAI_Pendon_800x2000.svg          editable (1 unidad = 1 mm; textos, iconos y diagramas vectoriales; imágenes enlazadas)
  pendon/entrega/CardioValveAI_Pendon_800x2000_sin_sangrado.pdf     tamaño final exacto
  pendon/entrega/CardioValveAI_Pendon_800x2000_sangrado10mm.pdf     820 × 2020 mm con TrimBox/BleedBox
  pendon/entrega/vista_previa.png y acercamientos
Uso: python pendon.py [--prueba]   (--prueba usa los renders *_prueba.png de baja resolución)
Fuente tipográfica: Inter / Inter Display (SIL Open Font License), una sola familia.
"""
from __future__ import annotations
import html
import json
import os
import sys

from PIL import Image, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, 'imagenes')
OUT = os.path.join(HERE, 'entrega')
TEST = '--prueba' in sys.argv
FONTS = os.path.join(HERE, 'fuentes')

W, H = 800.0, 2000.0          # tamaño final (mm)
BLEED = 10.0
M = 45.0                      # margen de contenido (zona segura ≥ 30 mm)
CW = W - 2 * M

# paleta
BG = '#FBFAF7'      # blanco cálido
NAVY = '#0B2545'    # títulos y texto principal
INK = '#33475E'     # texto secundario
TEAL = '#0E8F95'    # tecnología y conexiones
TEAL_L = '#DDF0F0'
ACC = '#E2553B'     # acento único (imán / pregunta clave)
LINE = '#C9D6DE'
SOFT = '#EEF3F5'

PT = 0.3528           # 1 pt en mm
FAM = {  # nombre de familia (fontconfig) → archivo, para medir y para el SVG
    'r': ('Inter Medium', 'Inter-Medium.ttf'),     # texto corrido: Medium (mejor lectura a distancia)
    'm': ('Inter Medium', 'Inter-Medium.ttf'),
    'sb': ('Inter SemiBold', 'Inter-SemiBold.ttf'),
    'b': ('Inter', 'Inter-Bold.ttf'),
    'd': ('Inter Display ExtraBold', 'InterDisplay-ExtraBold.ttf'),
    'ds': ('Inter Display SemiBold', 'InterDisplay-SemiBold.ttf'),
}
_fonts = {}


def font(k):
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(os.path.join(FONTS, FAM[k][1]), 1000)
    return _fonts[k]


def tw(text, k, pt):
    """Ancho del texto en mm."""
    return font(k).getlength(text) / 1000 * pt * PT


def wrap(text, k, pt, width):
    lines = []
    for para in text.split('\n'):
        cur = ''
        for word in para.split(' '):
            t = (cur + ' ' + word).strip()
            if tw(t, k, pt) <= width or not cur:
                cur = t
            else:
                lines.append(cur); cur = word
        lines.append(cur)
    return lines


class Svg:
    def __init__(self):
        self.el = []
        self.checks = []          # (descripción, caja) para verificar desbordes

    def add(self, s):
        self.el.append(s)

    def text(self, x, y, s, k='r', pt=26, fill=NAVY, anchor='start', ls=0.0, width=None, lh=1.32, extra=''):
        """Texto (y = línea base de la primera línea). Si se da width, se ajusta en líneas. Devuelve la y de la última línea base."""
        lines = wrap(s, k, pt, width) if width else s.split('\n')
        fam, _ = FAM[k]
        fs = pt * PT
        weight = '700' if k == 'b' else '400'
        tsp = ''.join(f'<tspan x="{x:.2f}" dy="{0 if i == 0 else fs * lh:.2f}">{html.escape(l)}</tspan>' for i, l in enumerate(lines))
        self.add(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{fam}" font-weight="{weight}" font-size="{fs:.3f}" fill="{fill}" '
                 f'text-anchor="{anchor}" letter-spacing="{ls * fs:.3f}" {extra}>{tsp}</text>')
        wmax = max(tw(l, k, pt) + ls * fs * (len(l) - 1) for l in lines)
        x0 = x - (wmax if anchor == 'end' else wmax / 2 if anchor == 'middle' else 0)
        y_last = y + fs * lh * (len(lines) - 1)
        self.checks.append((s[:40], (x0, y - fs * 0.75, x0 + wmax, y_last + fs * 0.25), width))
        return y_last

    def rect(self, x, y, w, h, fill='none', stroke='none', sw=0, r=0, extra=''):
        self.add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def line(self, x1, y1, x2, y2, stroke=TEAL, sw=1.2, extra=''):
        self.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" {extra}/>')

    def circle(self, cx, cy, r, fill='none', stroke='none', sw=0, extra=''):
        self.add(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def path(self, d, fill='none', stroke=NAVY, sw=1.5, extra=''):
        self.add(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>')

    def image(self, x, y, w, h, href, name):
        self.add(f'<image id="{name}" x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" href="{href}" preserveAspectRatio="xMidYMid meet"/>')

    def group(self, gid, inner_fn):
        self.add(f'<g id="{gid}">'); inner_fn(); self.add('</g>')

    def svg(self, bleed):
        b = bleed
        return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{W + 2 * b}mm" height="{H + 2 * b}mm" viewBox="{-b} {-b} {W + 2 * b} {H + 2 * b}">\n'
                f'<title>CardioValveAI · Pendón 800 × 2000 mm</title>\n'
                f'<rect id="fondo" x="{-b}" y="{-b}" width="{W + 2 * b}" height="{H + 2 * b}" fill="{BG}"/>\n'
                + '\n'.join(self.el) + '\n</svg>\n')


# ───────────────────────────── imágenes ─────────────────────────────
PLACED = {}


def prep(name, pad=0.02):
    """Recorta el render a su contenido (fondo transparente) y devuelve (archivo, ancho_px, alto_px)."""
    src = os.path.join(IMG, name + ('_prueba' if TEST else '') + '.png')
    im = Image.open(src).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    p = int(pad * max(im.size))
    bb = (max(bb[0] - p, 0), max(bb[1] - p, 0), min(bb[2] + p, im.width), min(bb[3] + p, im.height))
    im = im.crop(bb)
    dst = os.path.join(IMG, 'pendon_' + name + '.png')
    im.save(dst, optimize=True)
    return os.path.relpath(dst, HERE), im.width, im.height, bb


def place(s, name, x, y, w=None, h=None):
    href, pw, ph, _ = prep(name)
    if w is None:
        w = h * pw / ph
    if h is None:
        h = w * ph / pw
    s.image(x, y, w, h, href, 'img_' + name)
    PLACED[name] = {'archivo': href, 'px': (pw, ph), 'mm': (round(w, 1), round(h, 1)), 'ppp': round(pw / (w / 25.4))}
    return w, h


# ───────────────────────────── iconos (vectoriales) ─────────────────────────────
def arrow(s, x1, y, x2, color=TEAL, sw=1.6):
    s.line(x1, y, x2 - 3, y, color, sw)
    s.path(f'M{x2 - 7},{y - 4.5} L{x2},{y} L{x2 - 7},{y + 4.5}', stroke=color, sw=sw)


def icon_leaflet(s, cx, cy, sc=1.0):
    """Valva que gira sobre su bisagra, con el imán (acento) en el extremo."""
    k = sc
    s.circle(cx - 22 * k, cy + 14 * k, 4.2 * k, fill=NAVY)                         # bisagra
    s.path(f'M{cx - 22 * k},{cy + 14 * k} L{cx + 20 * k},{cy + 14 * k}', stroke=LINE, sw=5 * k, extra='stroke-dasharray="0.1 0"')
    s.path(f'M{cx - 22 * k},{cy + 14 * k} L{cx + 14 * k},{cy - 10 * k}', stroke=TEAL, sw=6 * k)   # valva
    s.rect(cx - 30 * k, cy + 8.5 * k, 6 * k, 11 * k, fill=ACC, r=1)              # imán
    s.path(f'M{cx + 22 * k},{cy + 8 * k} A 40 40 0 0 0 {cx + 16 * k},{cy - 16 * k}', stroke=NAVY, sw=1.6 * k)
    s.path(f'M{cx + 11 * k},{cy - 14 * k} L{cx + 16 * k},{cy - 16 * k} L{cx + 18 * k},{cy - 11 * k}', stroke=NAVY, sw=1.6 * k)


def icon_hall(s, cx, cy, sc=1.0):
    """Sensor Hall fijo (TO-92) y líneas de campo del imán."""
    k = sc
    s.rect(cx - 30 * k, cy - 6 * k, 8 * k, 16 * k, fill=ACC, r=1)
    for r_ in (12, 20, 28):
        s.path(f'M{cx - 22 * k},{cy - 2 * k} A {r_ * k} {r_ * 0.8 * k} 0 0 1 {cx - 22 * k + 2 * r_ * k * 0.9},{cy + 2 * k}', stroke=TEAL, sw=1.3,
               extra='stroke-dasharray="2.2 2.2"')
    s.path(f'M{cx + 12 * k},{cy - 12 * k} h{14 * k} v{12 * k} a{7 * k} {4 * k} 0 0 1 -{14 * k} 0 z', fill=NAVY, stroke=NAVY, sw=1)
    for dx in (14.5, 19, 23.5):
        s.line(cx + dx * k, cy + 4 * k, cx + dx * k, cy + 16 * k, NAVY, 1.4)


def icon_esp32(s, cx, cy, sc=1.0):
    k = sc
    s.rect(cx - 24 * k, cy - 17 * k, 48 * k, 34 * k, fill='white', stroke=NAVY, sw=2, r=3)
    s.rect(cx - 10 * k, cy - 9 * k, 20 * k, 18 * k, fill=NAVY, r=1.5)
    for i in range(6):
        y = cy - 13 * k + i * 5.2 * k
        s.line(cx - 28 * k, y, cx - 24 * k, y, NAVY, 1.4); s.line(cx + 24 * k, y, cx + 28 * k, y, NAVY, 1.4)


def icon_screen(s, cx, cy, sc=1.0):
    k = sc
    s.rect(cx - 28 * k, cy - 19 * k, 56 * k, 36 * k, fill='white', stroke=NAVY, sw=2, r=3)
    s.line(cx - 8 * k, cy + 23 * k, cx + 8 * k, cy + 23 * k, NAVY, 2)
    for i, (dy, col) in enumerate(((-8, TEAL), (0, NAVY), (8, ACC))):
        y0 = cy + dy * k
        s.path(f'M{cx - 23 * k},{y0 + 3 * k} L{cx - 14 * k},{y0 + 3 * k} C{cx - 9 * k},{y0 + 3 * k} {cx - 9 * k},{y0 - 4 * k} {cx - 4 * k},{y0 - 4 * k} '
               f'L{cx + 6 * k},{y0 - 4 * k} C{cx + 11 * k},{y0 - 4 * k} {cx + 11 * k},{y0 + 3 * k} {cx + 16 * k},{y0 + 3 * k} L{cx + 23 * k},{y0 + 3 * k}',
               stroke=col, sw=1.5)


def mini_curves(s, x, y, w, h, kind):
    """Esquemas ilustrativos (no son datos)."""
    s.rect(x, y, w, h, fill='white', stroke=LINE, sw=0.8, r=4)
    px, py, pw, ph = x + 8, y + 8, w - 16, h - 16
    s.line(px, py + ph, px + pw, py + ph, LINE, 0.8)

    def pulse(dx=0.0, amp=1.0, col=TEAL, sw=1.6, dash=''):
        a, b_ = px + pw * (0.18 + dx), px + pw * (0.62 + dx)
        top = py + ph * (1 - 0.82 * amp)
        base = py + ph * 0.92
        d = (f'M{px},{base} L{a},{base} C{a + pw * 0.06},{base} {a + pw * 0.04},{top} {a + pw * 0.12},{top} '
             f'L{b_ - pw * 0.08},{top} C{b_ - pw * 0.02},{top} {b_ - pw * 0.04},{base} {b_ + pw * 0.04},{base} L{px + pw},{base}')
        s.path(d, stroke=col, sw=sw, extra=dash)

    if kind == 'coord':
        pulse(-0.02, 1.0, TEAL); pulse(0.015, 0.93, NAVY); pulse(0.07, 0.86, ACC)
    elif kind == 'tiempo':
        pulse(0.0, 1.0, TEAL)
        a, b_ = px + pw * 0.18, px + pw * 0.62
        yy = py + ph * 0.06
        s.line(a, yy, b_ + pw * 0.04, yy, NAVY, 1.2)
        s.line(a, yy - 3, a, yy + 3, NAVY, 1.2); s.line(b_ + pw * 0.04, yy - 3, b_ + pw * 0.04, yy + 3, NAVY, 1.2)
    elif kind == 'ref':
        pulse(0.0, 1.0, INK, 1.4, 'stroke-dasharray="3 2.5"')
        pulse(0.03, 0.72, ACC, 1.8)


# ───────────────────────────── composición ─────────────────────────────
TXT = {}     # texto final (también se exporta aparte)
EXTRA = 0.0  # holgura vertical repartida entre secciones (se calcula en main)


def T(key, value):
    TXT[key] = value
    return value


def build():
    s = Svg()
    anc = json.load(open(os.path.join(IMG, 'anclas.json')))

    # ── A · encabezado ──────────────────────────────────────────────
    def header():
        tag = T('etiqueta', 'Prototipo de banco · válvula aórtica de tres valvas')
        tp = 24
        twd = tw(tag, 'sb', tp) + 22
        s.rect(M, 52, twd, 16, fill=TEAL_L, r=8)
        s.text(M + 11, 63.2, tag, 'sb', tp, TEAL)
        name = T('nombre', 'CardioValveAI')
        # tamaño para ocupar el ancho útil
        pt = round(CW / tw('CardioValve' + 'AI', 'd', 1.0) * 0.985 / (1 - 0.0) - 0.5)
        pt = min(pt, 330)
        fs = pt * PT
        y = 72 + fs * 0.80
        w1 = tw('CardioValve', 'd', pt) - 0.025 * fs * 11
        s.add(f'<text x="{M - 1.5:.2f}" y="{y:.2f}" font-family="{FAM["d"][0]}" font-size="{fs:.3f}" letter-spacing="{-0.025 * fs:.3f}" fill="{NAVY}">'
              f'CardioValve<tspan fill="{TEAL}">AI</tspan></text>')
        s.checks.append(('nombre', (M, y - fs * 0.73, M + tw(name, 'd', pt) - 0.025 * fs * 12, y + fs * 0.05), CW))
        TXT['nombre_pt'] = pt
        y += 64
        y = s.text(M, y, T('frase', 'Convertimos el movimiento de una válvula en datos medibles.'), 'b', 66, NAVY, width=CW, lh=1.14, ls=-0.012)
        y += 40
        s.text(M, y, T('pregunta', '¿Qué puede contarnos el movimiento de una válvula?'), 'm', 40, ACC, width=CW)
        return y
    yq = None
    s.add('<g id="A_encabezado">'); yq = header(); s.add('</g>')

    # ── B · imagen protagonista ─────────────────────────────────────
    s.add('<g id="B_protagonista">')
    y0 = yq + 34 + EXTRA
    # halo suave detrás del modelo
    s.add(f'<defs><radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{TEAL_L}" stop-opacity="1"/>'
          f'<stop offset="1" stop-color="{BG}" stop-opacity="0"/></radialGradient></defs>')
    hw = 520.0
    href, pw, ph, bb = prep('protagonista')
    hh = hw * ph / pw
    hx = M - 18
    s.add(f'<ellipse cx="{hx + hw * 0.5:.1f}" cy="{y0 + hh * 0.55:.1f}" rx="{hw * 0.62:.1f}" ry="{hh * 0.55:.1f}" fill="url(#halo)"/>')
    place(s, 'protagonista', hx, y0, w=hw)
    # anclas: coordenadas normalizadas del render completo → recorte → pendón
    full = Image.open(os.path.join(IMG, 'protagonista' + ('_prueba' if TEST else '') + '.png')).size

    def at(key, dx=0.0, dy=0.0):
        u, v = anc['protagonista'][key]['uv']
        px_, py_ = u * full[0] - bb[0], v * full[1] - bb[1]
        return hx + px_ / pw * hw + dx, y0 + py_ / ph * hh + dy

    # llamadas (columna derecha, sin cruces)
    xl = M + 548
    calls = [
        ('valva1', T('llamada_valvas', '3 valvas móviles'), T('llamada_valvas_sub', 'Abren y cierran juntas'), TEAL, 0, 0),
        ('portasensor3', T('llamada_hall', 'Sensor Hall + imán'), T('llamada_hall_sub', 'Uno por valva'), ACC, 0, 0),
        ('servo', T('llamada_servo', 'Servomotor'), T('llamada_servo_sub', 'Mueve las tres valvas'), NAVY, 0, 0),
        ('cuerpo320', T('llamada_anillo', 'Estructura impresa en 3D'), T('llamada_anillo_sub', 'Anillo de 90 mm'), NAVY, 0, 0),
    ]
    ys = [y0 + 50, y0 + 170, y0 + 290, y0 + 410]
    for (key, t1, t2, col, dx, dy), yy in zip(calls, ys):
        ax, ay = at(key, dx, dy)
        if key == 'portasensor3':
            s.circle(ax, ay, 15, stroke=ACC, sw=2.4)
            s.circle(ax, ay, 2.6, fill=ACC)
            ax2 = ax + 15
        else:
            s.circle(ax, ay, 3.2, fill=col, stroke='white', sw=1.2)
            ax2 = ax
        s.path(f'M{ax2:.1f},{ay:.1f} L{xl - 26:.1f},{yy - 7:.1f} L{xl - 8:.1f},{yy - 7:.1f}', stroke=col, sw=1.3)
        s.text(xl, yy, t1, 'sb', 30, NAVY, width=W - M - xl)
        s.text(xl, yy + 14.5, t2, 'r', 24, INK, width=W - M - xl)
    s.text(M, y0 + hh + 6, T('pie_protagonista', 'Imagen generada a partir del modelo 3D del prototipo actual (valvas abiertas).'), 'r', 20, INK)
    s.add('</g>')
    yb = y0 + hh + 6

    # insertos: mecanismo y detalle del sensor
    s.add('<g id="B_insertos">')
    yi = yb + 26
    bw_, bh_ = (CW - 20) / 2, 186.0
    for i, (img, title, sub, note) in enumerate((
            ('mecanismo', T('inserto1_titulo', 'Por dentro'), T('inserto1_texto', 'El servomotor sube y baja un pistón que abre y cierra las tres valvas.'),
             T('inserto1_nota', 'Estructura oculta para ver el mecanismo')),
            ('detalle_hall_iman', T('inserto2_titulo', 'Un sensor por valva'), T('inserto2_texto', 'El imán gira con la valva. El sensor Hall queda fijo.'),
             T('inserto2_nota', 'Portasensor separado para mostrar el imán')))):
        x = M + i * (bw_ + 20)
        s.rect(x, yi, bw_, bh_, fill='white', stroke=LINE, sw=0.8, r=10)
        s.text(x + 16, yi + 22, title, 'b', 34, NAVY)
        yt = s.text(x + 16, yi + 38, sub, 'r', 24, INK, width=bw_ - 32)
        iy = yt + 8
        ih = yi + bh_ - 22 - iy
        href_, ipw, iph, _ = prep(img)
        iw = min(bw_ - 32, ih * ipw / iph)
        ih2 = iw * iph / ipw
        place(s, img, x + (bw_ - iw) / 2, iy + (ih - ih2) / 2, w=iw)
        s.text(x + 16, yi + bh_ - 9, note, 'r', 20, INK)
        if img == 'detalle_hall_iman':
            _, _, _, dbb = prep(img)
            dfull = Image.open(os.path.join(IMG, img + ('_prueba' if TEST else '') + '.png')).size
            ix0, iy0 = x + (bw_ - iw) / 2, iy + (ih - ih2) / 2
            for key, lab, col, (ox, oy) in (('iman', T('rotulo_iman', 'imán'), ACC, (6, -26)), ('hall', T('rotulo_hall', 'sensor Hall'), NAVY, (-6, -44))):
                u, v = anc['detalle'][key]['uv']
                ax_ = ix0 + (u * dfull[0] - dbb[0]) / ipw * iw
                ay_ = iy0 + (v * dfull[1] - dbb[1]) / iph * ih2
                s.circle(ax_, ay_, 2.4, fill=col, stroke='white', sw=0.8)
                s.line(ax_, ay_, ax_ + ox, ay_ + oy, col, 1.1)
                s.text(ax_ + ox + (2 if ox >= 0 else -2), ay_ + oy + (-2 if oy < 0 else 7), lab, 'sb', 24, col, anchor='start' if ox >= 0 else 'end')
    s.add('</g>')
    yc = yi + bh_ + 22

    # componentes
    s.add('<g id="B_componentes">')
    comps = [T('comp1', 'Estructura impresa en 3D'), T('comp2', '3 valvas'), T('comp3', 'Servomotor'), T('comp4', '3 sensores Hall'),
             T('comp5', '3 imanes de neodimio'), T('comp6', 'ESP32')]
    x = M
    cp = 22
    for c in comps:
        wdt = tw(c, 'm', cp) + 18
        if x + wdt > W - M:
            x = M; yc += 20
        s.rect(x, yc, wdt, 15, fill=SOFT, r=7.5)
        s.text(x + 9, yc + 10.4, c, 'm', cp, NAVY)
        x += wdt + 7
    s.add('</g>')
    y = yc + 15 + 44 + EXTRA

    # ── C · necesidad ───────────────────────────────────────────────
    s.add('<g id="C_necesidad">')
    s.line(M, y - 20, W - M, y - 20, LINE, 0.8)
    s.text(M, y + 4, T('t_necesidad', '¿Por qué mirar una válvula?'), 'b', 46, NAVY)
    y += 26
    col_w = CW * 0.56
    y1 = s.text(M, y + 4, T('necesidad_1', 'En cada latido, las válvulas del corazón abren y cierran. Cuánto se abren, cuándo y con qué coordinación es parte de cómo funciona el corazón.'),
                'r', 28, NAVY, width=col_w)
    y1 = s.text(M, y1 + 18, T('necesidad_2', 'Queremos saber si ese movimiento puede medirse de forma simple y, más adelante, relacionarse con la respuesta funcional de una persona.'),
                'r', 28, NAVY, width=col_w)
    # pregunta de investigación (destacada)
    qx, qw = M + col_w + 24, CW - col_w - 24
    qlines = wrap(T('pregunta_investigacion', '¿Puede un sistema simple de sensores describir el movimiento valvular con datos comparables?'), 'sb', 30, qw - 30)
    qh = 26 + len(qlines) * 30 * PT * 1.3 + 8
    s.rect(qx, y - 6, qw, qh, fill='white', stroke=ACC, sw=1.6, r=10)
    s.text(qx + 15, y + 10, T('t_pregunta_investigacion', 'Pregunta de investigación'), 'sb', 22, ACC)
    s.text(qx + 15, y + 26, TXT['pregunta_investigacion'], 'sb', 30, NAVY, width=qw - 30, lh=1.3)
    y = max(y1, y - 6 + qh) + 46 + EXTRA
    s.add('</g>')

    # ── D · cómo funciona ───────────────────────────────────────────
    s.add('<g id="D_funcionamiento">')
    s.line(M, y - 20, W - M, y - 20, LINE, 0.8)
    s.text(M, y + 4, T('t_funcionamiento', 'Del movimiento a los datos'), 'b', 46, NAVY)
    y += 24
    steps = [
        (icon_leaflet, T('paso1', 'La valva se mueve'), T('paso1_sub', 'El imán gira con ella.')),
        (icon_hall, T('paso2', 'El campo cambia'), T('paso2_sub', 'El sensor Hall, fijo, lo detecta.')),
        (icon_esp32, T('paso3', 'El ESP32 registra'), T('paso3_sub', 'Lee los 3 sensores y controla el servo.')),
        (icon_screen, T('paso4', 'Vemos y analizamos'), T('paso4_sub', 'Una señal por valva en el computador.')),
    ]
    sw_ = CW / 4
    for i, (fn, t1, t2) in enumerate(steps):
        cx = M + sw_ * i + sw_ / 2
        s.circle(cx, y + 42, 38, fill='white', stroke=LINE, sw=0.8)
        fn(s, cx, y + 42, 1.0)
        s.circle(cx - 31, y + 12, 8, fill=NAVY)
        s.text(cx - 31, y + 15.2, str(i + 1), 'b', 26, 'white', anchor='middle')
        if i < 3:
            arrow(s, cx + 44, y + 42, cx + sw_ - 44)
        s.text(cx, y + 100, t1, 'sb', 28, NAVY, anchor='middle')
        for j, l in enumerate(wrap(t2, 'r', 24, sw_ - 12)):
            s.text(cx, y + 113 + j * 11.2, l, 'r', 24, INK, anchor='middle')
    y += 148
    # nota de calibración
    nt = T('nota_calibracion', 'La señal del sensor no es un ángulo: para expresarla en grados, cada valva se calibra con posiciones conocidas.')
    nl = wrap(nt, 'm', 24, CW - 40)
    nh = 12 + len(nl) * 24 * PT * 1.32 + 4
    s.rect(M, y, CW, nh, fill=TEAL_L, r=8)
    s.text(M + 20, y + 13, nt, 'm', 24, NAVY, width=CW - 40)
    y += nh + 46 + EXTRA
    s.add('</g>')

    # ── E · qué observamos ──────────────────────────────────────────
    s.add('<g id="E_observamos">')
    s.line(M, y - 20, W - M, y - 20, LINE, 0.8)
    s.text(M, y + 4, T('t_observamos', 'Qué observamos'), 'b', 46, NAVY)
    s.text(W - M, y + 4, T('nota_esquemas', 'Esquemas ilustrativos, no son resultados'), 'r', 20, INK, anchor='end')
    y += 22
    cw4 = (CW - 3 * 14) / 4
    obs = [('apertura', T('obs1', 'Apertura y cierre')), ('coord', T('obs2', 'Coordinación de las 3 valvas')),
           ('tiempo', T('obs3', 'Tiempos del movimiento')), ('ref', T('obs4', 'Cambios frente a un patrón de referencia'))]
    for i, (kind, label) in enumerate(obs):
        x = M + i * (cw4 + 14)
        if kind == 'apertura':
            s.rect(x, y, cw4, 72, fill='white', stroke=LINE, sw=0.8, r=4)
            iw = 52.0
            gap_ = (cw4 - 2 * iw) / 3
            place(s, 'superior_cerrada', x + gap_, y + 4, w=iw)
            place(s, 'superior_abierta', x + 2 * gap_ + iw, y + 4, w=iw)
            s.text(x + gap_ + iw / 2, y + 66, T('obs1_a', 'cerrada'), 'm', 20, INK, anchor='middle')
            s.text(x + 2 * gap_ + iw * 1.5, y + 66, T('obs1_b', 'abierta'), 'm', 20, INK, anchor='middle')
        else:
            mini_curves(s, x, y, cw4, 72, kind)
        for j, l in enumerate(wrap(label, 'sb', 26, cw4)):
            s.text(x, y + 88 + j * 11.6, l, 'sb', 26, NAVY)
    y += 88 + 2 * 11.6 + 44 + EXTRA
    s.add('</g>')

    # ── F · hoy y a futuro ──────────────────────────────────────────
    s.add('<g id="F_hoy_futuro">')
    s.line(M, y - 20, W - M, y - 20, LINE, 0.8)
    s.text(M, y + 4, T('t_futuro', 'Hoy y a futuro'), 'b', 46, NAVY)
    y += 26
    cols = [
        ('hoy', T('hoy_t', 'Hoy · prototipo'), T('hoy', 'Modelo de banco que mueve tres valvas y registra una señal por valva. Sin fluido ni pacientes.')),
        ('estudio', T('estudio_t', 'Lo que estudiamos'), T('estudio', 'Qué variables del movimiento son medibles, repetibles y comparables.')),
        ('futuro', T('futuro_t', 'A futuro'), T('futuro', 'Tras una validación adecuada: apoyo al seguimiento funcional y a la rehabilitación cardiorrespiratoria personalizada, con inteligencia artificial.')),
    ]
    c3 = (CW - 2 * 20) / 3
    s.line(M + 8, y + 8, W - M - 8, y + 8, LINE, 1.2)
    yend = y
    for i, (kind, t1, t2) in enumerate(cols):
        x = M + i * (c3 + 20)
        if kind == 'hoy':
            s.circle(x + 8, y + 8, 8, fill=TEAL)
        elif kind == 'estudio':
            s.circle(x + 8, y + 8, 8, fill='white', stroke=TEAL, sw=2.2)
            s.path(f'M{x + 8},{y} A8 8 0 0 1 {x + 8},{y + 16} Z', fill=TEAL, stroke='none', sw=0)
        else:
            s.circle(x + 8, y + 8, 8, fill=BG, stroke=TEAL, sw=2.2, extra='stroke-dasharray="3 2.2"')
        s.text(x, y + 34, t1, 'sb', 30, NAVY)
        yend = max(yend, s.text(x, y + 49, t2, 'r', 24, INK, width=c3))
    y = yend + 16
    s.text(M, y, T('nota_ia', 'La inteligencia artificial es una línea de desarrollo futuro; hoy, el software compara cada ciclo con un patrón de referencia. '
                              'Prototipo académico: no es un dispositivo médico ni entrega diagnósticos.'), 'r', 20, INK, width=CW)
    s.add('</g>')

    # ── G · invitación ──────────────────────────────────────────────
    s.add('<g id="G_invitacion">')
    gy = 1885.0
    s.rect(-BLEED, gy, W + 2 * BLEED, 74, fill=NAVY)
    s.text(M, gy + 34, T('invitacion', 'Acércate: mira el mecanismo en movimiento y conversemos.'), 'b', 44, 'white', width=CW)
    s.text(M, gy + 57, 'CardioValveAI', 'sb', 26, '#8FD3D6')
    s.add('</g>')
    TXT['_y_fin_contenido'] = round(y, 1)
    return s, gy


def verify(s, gy):
    issues = []
    for label, (x0, y0, x1, y1), width in s.checks:
        if x0 < M - 2 or x1 > W - M + 1.5:
            issues.append(f'fuera del margen lateral: «{label}» ({x0:.1f}–{x1:.1f} mm)')
        if width and x1 - x0 > width + 1.5:
            issues.append(f'más ancho que su caja: «{label}»')
    if TXT['_y_fin_contenido'] > gy - 15:
        issues.append(f"el contenido ({TXT['_y_fin_contenido']} mm) se acerca a la banda final ({gy} mm)")
    return issues


def words():
    skip = {'nombre', 'etiqueta', 'nombre_pt'}
    main_keys = [k for k in TXT if not k.startswith('_') and k not in skip and not k.startswith('comp') and not k.startswith('obs1_')]
    return sum(len(str(TXT[k]).split()) for k in main_keys)


def export(svg_path):
    """PDF a tamaño real (con y sin sangrado) y PNG de revisión. Texto y vectores quedan como vectores; las imágenes, a su resolución."""
    import cairosvg
    import pymupdf
    src = open(svg_path, encoding='utf-8').read()
    base = os.path.join(OUT, 'CardioValveAI_Pendon_800x2000')
    pdf_b = base + '_sangrado10mm.pdf'
    cairosvg.svg2pdf(bytestring=src.encode(), write_to=pdf_b, url=svg_path, unsafe=True)
    mm = 72 / 25.4
    doc = pymupdf.open(pdf_b)
    pg = doc[0]
    full = pg.rect
    trim = pymupdf.Rect(BLEED * mm, BLEED * mm, (BLEED + W) * mm, (BLEED + H) * mm)
    pg.set_trimbox(trim); pg.set_bleedbox(full)
    doc.set_metadata({'title': 'CardioValveAI · Pendón 800 × 2000 mm', 'subject': 'Pendón vertical 800 × 2000 mm (+10 mm de sangrado)'})
    doc.save(pdf_b + '.tmp', garbage=3, deflate=True); doc.close(); os.replace(pdf_b + '.tmp', pdf_b)
    # sin sangrado: el mismo diseño con la página exactamente en 800 × 2000 mm
    src0 = src.replace(f'width="{W + 2 * BLEED}mm" height="{H + 2 * BLEED}mm" viewBox="{-BLEED} {-BLEED} {W + 2 * BLEED} {H + 2 * BLEED}"',
                       f'width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}"')
    assert src0 != src
    cairosvg.svg2pdf(bytestring=src0.encode(), write_to=base + '_sin_sangrado.pdf', url=svg_path, unsafe=True)
    d0 = pymupdf.open(base + '_sin_sangrado.pdf')
    d0.set_metadata({'title': 'CardioValveAI · Pendón 800 × 2000 mm', 'subject': 'Tamaño final 800 × 2000 mm, sin sangrado'})
    d0.save(base + '_sin_sangrado.tmp', garbage=3, deflate=True); d0.close(); os.replace(base + '_sin_sangrado.tmp', base + '_sin_sangrado.pdf')
    # vista previa y acercamientos (desde el PDF sin sangrado)
    d = pymupdf.open(base + '_sin_sangrado.pdf'); p = d[0]
    r = p.rect
    print('PDF sin sangrado:', round(r.width / mm, 1), '×', round(r.height / mm, 1), 'mm')
    p.get_pixmap(dpi=40).save(os.path.join(OUT, 'vista_previa.png'))
    zooms = [('acercamiento_1_encabezado', 0, 380), ('acercamiento_2_modelo', 360, 1180), ('acercamiento_3_necesidad_funcionamiento', 1150, 1560),
             ('acercamiento_4_observamos_futuro', 1540, 2000)]
    for name, a, b in zooms:
        clip = pymupdf.Rect(0, a * mm, W * mm, b * mm)
        p.get_pixmap(dpi=72, clip=clip).save(os.path.join(OUT, name + '.png'))


ALTERNATIVAS = [
    ('Convertimos el movimiento de una válvula en datos medibles.', 'ELEGIDA: dice qué hace el prototipo, en una sola idea, sin prometer resultados clínicos.'),
    ('Un modelo de válvula aórtica que se mueve, se mide y se estudia.', 'Clara, pero más larga y menos directa a 3 m.'),
    ('Observar cómo se mueve una válvula para entender mejor la respuesta del cuerpo.', 'Apunta al objetivo de investigación, pero puede leerse como un resultado ya demostrado.'),
]


def write_text():
    t = TXT
    L = ['# CardioValveAI · Texto final del pendón (800 × 2000 mm)', '',
         'Texto tal como aparece en el diseño, en orden de lectura. Corregir aquí y volver a generar con `python pendon.py`',
         '(los textos se editan en `pendon.py`, función `build()`, en cada llamada `T(...)`).', '',
         f"Palabras del texto principal (sin etiquetas de componentes): {words()}", '',
         '## Alternativas de frase principal', '']
    L += [f'{i + 1}. «{a}» — {b}' for i, (a, b) in enumerate(ALTERNATIVAS)]
    L += ['', '## A · Encabezado', '', f"- Etiqueta: {t['etiqueta']}", f"- Nombre: {t['nombre']}", f"- Frase principal: {t['frase']}",
          f"- Pregunta: {t['pregunta']}", '', '## B · Modelo', '',
          f"- Llamada: **{t['llamada_valvas']}** — {t['llamada_valvas_sub']}", f"- Llamada: **{t['llamada_hall']}** — {t['llamada_hall_sub']}",
          f"- Llamada: **{t['llamada_servo']}** — {t['llamada_servo_sub']}", f"- Llamada: **{t['llamada_anillo']}** — {t['llamada_anillo_sub']}",
          f"- Pie de imagen: {t['pie_protagonista']}", '',
          f"**{t['inserto1_titulo']}** — {t['inserto1_texto']} _(nota: {t['inserto1_nota']})_", '',
          f"**{t['inserto2_titulo']}** — {t['inserto2_texto']} Rótulos: «{t['rotulo_iman']}», «{t['rotulo_hall']}». _(nota: {t['inserto2_nota']})_", '',
          'Componentes: ' + ' · '.join(t[f'comp{i}'] for i in range(1, 7)), '',
          f"## C · {t['t_necesidad']}", '', t['necesidad_1'], '', t['necesidad_2'], '',
          f"**{t['t_pregunta_investigacion']}:** {t['pregunta_investigacion']}", '',
          f"## D · {t['t_funcionamiento']}", '']
    L += [f"{i}. **{t[f'paso{i}']}** — {t[f'paso{i}_sub']}" for i in range(1, 5)]
    L += ['', f"Nota: {t['nota_calibracion']}", '', f"## E · {t['t_observamos']}", '', f"_{t['nota_esquemas']}_", '']
    L += [f"- {t[f'obs{i}']}" for i in range(1, 5)]
    L += ['', f"## F · {t['t_futuro']}", '', f"- **{t['hoy_t']}:** {t['hoy']}", f"- **{t['estudio_t']}:** {t['estudio']}",
          f"- **{t['futuro_t']}:** {t['futuro']}", '', f"Nota: {t['nota_ia']}", '', '## G · Invitación', '', t['invitacion'], '']
    open(os.path.join(OUT, 'Texto_final_pendon.md'), 'w', encoding='utf-8').write('\n'.join(L))


def write_notes():
    ppp = '\n'.join(f"| {k} | {v['px'][0]} × {v['px'][1]} px | {v['mm'][0]:.0f} × {v['mm'][1]:.0f} mm | **{v['ppp']} ppp** |" for k, v in PLACED.items())
    n = f"""# CardioValveAI · Pendón: fuentes, estado y datos por confirmar

## Archivos
| Archivo | Uso |
|---|---|
| `CardioValveAI_Pendon_800x2000_sin_sangrado.pdf` | Tamaño final exacto 800 × 2000 mm (proporción 2:5). |
| `CardioValveAI_Pendon_800x2000_sangrado10mm.pdf` | 820 × 2020 mm: 10 mm de sangrado por lado, con TrimBox = 800 × 2000 mm y BleedBox. |
| `../CardioValveAI_Pendon_800x2000.svg` | Editable (Illustrator, Inkscape, Affinity): 1 unidad = 1 mm, textos vivos, iconos y diagramas vectoriales, imágenes enlazadas en `imagenes/`, capas por sección (A_encabezado … G_invitacion). Instalar antes las fuentes de `fuentes/`. |
| `../pendon.py` | Genera el SVG y los PDF; los textos están en cada `T('clave', 'texto')`. |
| `Texto_final_pendon.md` | Texto del pendón separado del diseño. |
| `vista_previa.png`, `acercamiento_*.png` | Revisión en pantalla (baja resolución, no imprimir). |

## Fuentes del contenido
- **Modelo:** CardioValveAI **v4** (`hardware/v4/config4.py`, REVISION = v4), la versión más reciente del repositorio. Es la única sin micrófono ni piezoeléctricos (3 sensores Hall + 3 imanes). Las versiones v1–v3.1 no se usaron.
- **Imágenes:** todas son renders generados desde los sólidos del CAD v4 (`hardware/out_v4/_canon/*.stl`) con su cinemática (`assembly4.py`, `kin4.py`); la geometría no se modificó. Los **colores son de presentación** (el color real depende del filamento). En «Un sensor por valva» el portasensor se muestra separado 12 mm a lo largo de su eje para ver el imán (rotulado). En «Por dentro» la estructura está oculta (rotulado).
- **No hay fotografías** del prototipo en los archivos: no se usó ninguna.
- **Textos:** documentación del repositorio (`hardware/README.md`, `hardware/out_v4/Documentacion`, `README.md`). No se usaron cifras, estadísticas ni fuentes externas: no hay referencias bibliográficas que citar.
- **Inteligencia artificial:** el repositorio no documenta un algoritmo entrenado ni validado para el banco. El software de análisis (`hardware/host/cvai_analyze.py`) compara cada ciclo con un patrón de referencia mediante umbrales definidos por el equipo. Por eso la IA aparece solo como desarrollo futuro.
- **Curvas de «Qué observamos»:** esquemas dibujados, rotulados «Esquemas ilustrativos, no son resultados». No hay capturas de dashboard.
- **Tipografía:** una familia, Inter (Inter Display para el nombre). Licencia SIL Open Font License (`fuentes/Inter_LICENSE_OFL.txt`). Fuentes incrustadas como subconjunto en los PDF; el texto queda vectorial.
- **Sin** logos institucionales, nombres de integrantes, facultades, carreras, marcas de herramientas, marcas de agua ni QR (no se entregó un enlace).

## Calidad de las imágenes al tamaño final
| Imagen | Píxeles | Tamaño impreso | Resolución efectiva |
|---|---|---|---|
{ppp}

Ninguna imagen fue ampliada. Texto, iconos, diagramas y curvas son vectoriales.

## Datos por confirmar antes de imprimir
1. **Estado del prototipo el día de la feria.** «Hoy · prototipo» dice: «Modelo de banco que mueve tres valvas y registra una señal por valva». Es correcto solo si el prototipo v4 está impreso, armado y registrando con el ESP32. Hasta esta revisión, el diseño solo está verificado en CAD (no se ha impreso ni probado). Si no está funcionando, cambiar a «Modelo de banco diseñado para mover tres valvas…».
2. **Fotografía real (recomendado).** Cuando el prototipo esté armado, una foto bien iluminada (≥ 3600 px de ancho para 520 mm) puede reemplazar o acompañar el render. Hasta entonces, el pie aclara que es una imagen generada desde el modelo 3D.
3. **Pregunta de investigación y enfoque** («respuesta funcional», «rehabilitación cardiorrespiratoria personalizada»): validar la redacción con el profesor guía.
4. **Logo:** no se adjuntó; se usó el nombre como composición tipográfica (sin emblema).
5. **Imprenta:**
   - **Sangrado:** se entrega con 10 mm; confirmar su valor.
   - **Zona oculta del soporte:** si es un roll-up, confirmar cuánto material queda dentro de la base o del travesaño. Esa reserva debe agregarse fuera de los 2000 mm visibles, sin deformar el diseño. El contenido esencial termina a {TXT['_y_fin_contenido']:.0f} mm desde arriba; la banda de invitación ocupa de 1885 a 1959 mm; deja 41 mm libres abajo.
   - **Color:** los PDF están en **RGB (sRGB)**. No se pudo convertir a CMYK ni aplicar un perfil ICC (p. ej. FOGRA39) desde este entorno: pedir a la imprenta su perfil o que haga la conversión, y una prueba de color del turquesa (#0E8F95) y del coral (#E2553B).
   - **Formato:** los PDF no están certificados como PDF/X. Si la imprenta lo exige, exportar desde el SVG con su configuración (PDF/X-4).
6. **Medida del anillo:** el rótulo dice «Anillo de 90 mm» (diámetro exterior del cuerpo v4). Cambiarlo si se modifica el diseño.

## Revisión realizada
Nombre CardioValveAI (sin espacios, con esas mayúsculas) · ortografía y acentos · tamaño 800 × 2000 mm y proporción 2:5 · márgenes laterales de 45 mm (comprobados automáticamente para cada texto) · sin texto cortado ni superpuesto · sin micrófono ni piezoeléctricos (búsqueda en el texto del PDF) · actual / objetivo / futuro diferenciados · sin resultados, validaciones ni cifras inventadas · {words()} palabras de texto principal.
"""
    open(os.path.join(OUT, 'Notas_fuentes_y_pendientes.md'), 'w', encoding='utf-8').write(n)


def main():
    os.makedirs(OUT, exist_ok=True)
    global EXTRA, TXT
    s, gy = build()
    EXTRA = max(0.0, (gy - 45 - TXT['_y_fin_contenido']) / 5)
    TXT = {}; PLACED.clear()
    s, gy = build()
    print('holgura repartida por sección:', round(EXTRA, 1), 'mm · fin del contenido:', TXT['_y_fin_contenido'], 'mm')
    issues = verify(s, gy)
    svg_path = os.path.join(HERE, 'CardioValveAI_Pendon_800x2000.svg')
    open(svg_path, 'w', encoding='utf-8').write(s.svg(BLEED))
    print('SVG', svg_path)
    export(svg_path)
    write_text()
    write_notes()
    print('palabras (texto principal):', words())
    print('imágenes:', json.dumps(PLACED, ensure_ascii=False))
    print('problemas:', issues or 'ninguno')
    json.dump({'texto': TXT, 'imagenes': PLACED, 'palabras': words(), 'problemas': issues}, open(os.path.join(HERE, 'pendon_meta.json'), 'w'),
              ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
