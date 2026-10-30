"""
Guía «Dónde va cada pieza» de CardioValveAI v4 (PDF A4, 4 páginas) a partir de las vistas de Blender y las miniaturas.
Uso: python guia_piezas4.py   (después de blender4.py y guia_thumbs4.py)
Salida: out_v4/Guia/CardioValveAI_v4_Donde_va_cada_pieza.pdf
"""
from __future__ import annotations
import html
import os

from PIL import Image, ImageFont

import config4 as C
import registry4 as R

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', C.OUT_DIR))
G = os.path.join(OUT, 'Guia')
FONTS = os.path.abspath(os.path.join(HERE, '..', '..', 'pendon', 'fuentes'))
W, H, M = 210.0, 297.0, 14.0
NAVY, INK, TEAL, ACC, LINE, SOFT = '#0B2545', '#33475E', '#0E8F95', '#E2553B', '#C9D6DE', '#EEF3F5'
PT = 0.3528
FAM = {'m': ('Inter Medium', 'Inter-Medium.ttf'), 'sb': ('Inter SemiBold', 'Inter-SemiBold.ttf'), 'b': ('Inter', 'Inter-Bold.ttf'),
       'd': ('Inter Display ExtraBold', 'InterDisplay-ExtraBold.ttf')}
_f = {}
f1 = lambda x: f'{x:.1f}'.replace('.', ',')


def tw(t, k, pt):
    if k not in _f:
        _f[k] = ImageFont.truetype(os.path.join(FONTS, FAM[k][1]), 1000)
    return _f[k].getlength(t) / 1000 * pt * PT


def wrap(t, k, pt, w):
    out = []
    for para in t.split('\n'):
        cur = ''
        for word in para.split(' '):
            n = (cur + ' ' + word).strip()
            if tw(n, k, pt) <= w or not cur:
                cur = n
            else:
                out.append(cur); cur = word
        out.append(cur)
    return out


class Page:
    def __init__(self):
        self.el = []

    def text(self, x, y, s, k='m', pt=9.5, fill=NAVY, w=None, lh=1.35, anchor='start'):
        lines = wrap(s, k, pt, w) if w else s.split('\n')
        fs = pt * PT
        wt = '700' if k == 'b' else '400'
        tsp = ''.join(f'<tspan x="{x:.2f}" dy="{0 if i == 0 else fs * lh:.2f}">{html.escape(l)}</tspan>' for i, l in enumerate(lines))
        self.el.append(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{FAM[k][0]}" font-weight="{wt}" font-size="{fs:.3f}" fill="{fill}" text-anchor="{anchor}">{tsp}</text>')
        return y + fs * lh * (len(lines) - 1)

    def rect(self, x, y, w, h, fill='none', stroke='none', sw=0.3, r=2.5):
        self.el.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def circle(self, cx, cy, r, fill):
        self.el.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r}" fill="{fill}"/>')

    def image(self, path, x, y, w=None, h=None, crop=True):
        im = Image.open(path)
        if crop and im.mode == 'RGBA':
            bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
            im = im.crop(bb)
            path = path.replace('.png', '_rec.png'); im.save(path)
        pw, ph = im.size
        if w and h:
            s = min(w / pw, h / ph); w2, h2 = pw * s, ph * s
            x, y = x + (w - w2) / 2, y + (h - h2) / 2
        elif w:
            w2, h2 = w, w * ph / pw
        else:
            w2, h2 = h * pw / ph, h
        self.el.append(f'<image x="{x:.2f}" y="{y:.2f}" width="{w2:.2f}" height="{h2:.2f}" href="{path}"/>')
        return h2

    def header(self, title, sub, n):
        self.rect(0, 0, W, 24, fill=NAVY, r=0)
        self.text(M, 11.5, title, 'b', 15, 'white')
        self.text(M, 18.5, sub, 'm', 8.5, '#B9DDE0')
        self.text(W - M, H - 7, f'CardioValveAI v4 · Dónde va cada pieza · {n}/4', 'm', 7, INK, anchor='end')

    def svg(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">'
                f'<rect width="{W}" height="{H}" fill="white"/>' + ''.join(self.el) + '</svg>')


def card(p, x, y, w, h, img, num, title, qty, donde, lleva):
    p.rect(x, y, w, h, fill='white', stroke=LINE)
    iw = 52
    p.rect(x + 3, y + 3, iw, h - 6, fill=SOFT, r=2)
    p.image(img, x + 5, y + 5, iw - 4, h - 10)
    tx, tw_ = x + iw + 8, w - iw - 12
    p.circle(tx + 4.2, y + 9, 4.2, NAVY)
    p.text(tx + 4.2, y + 10.6, num, 'b', 8.5, 'white', anchor='middle')
    p.text(tx + 11, y + 11, title, 'b', 12.5, NAVY)
    p.text(tx + 11 + tw(title, 'b', 12.5) + 3, y + 11, qty, 'sb', 10, TEAL)
    yy = p.text(tx, y + 20, 'Dónde va', 'sb', 8, ACC)
    yy = p.text(tx, yy + 4.6, donde, 'm', 9, NAVY, w=tw_)
    yy = p.text(tx, yy + 6.5, 'Qué lleva', 'sb', 8, ACC)
    p.text(tx, yy + 4.6, lleva, 'm', 9, INK, w=tw_)


def main():
    V = os.path.join(OUT, 'Vistas')
    L = {it.num: it for it in R.ITEMS}
    pages = []

    # 1 · vista general
    p = Page(); p.header('Dónde va cada pieza', 'CardioValveAI v4 · 10 piezas impresas (+ probeta) · varilla de latón, 3 imanes, 3 sensores Hall y un servo', 1)
    y = 32
    p.text(M, y, 'Despiece: cada pieza se separa en la dirección en que se monta', 'b', 11.5, NAVY)
    h = p.image(os.path.join(V, 'Despiece_numerado.png'), M, y + 4, w=W - 2 * M, crop=False)
    y += 4 + h + 9
    p.text(M, y, 'Los números 1–6 son piezas impresas; R1–R9, piezas compradas o que vienen con el servo.', 'm', 9, INK, w=W - 2 * M)
    y += 11
    p.text(M, y, 'Cómo funciona, en una línea', 'b', 11.5, NAVY)
    p.text(M, y + 6, 'El servo gira la manivela (5) → la manivela sube y baja el yugo (4) → el yugo mueve el pistón (3) → el pistón empuja las colas de las 3 valvas (2), '
                     'que giran sobre sus pasadores de bisagra. En la punta de cada bisagra, un imán gira con la valva frente a un sensor Hall fijo (6).',
           'm', 9.5, NAVY, w=W - 2 * M)
    y += 28
    p.text(M, y, 'Orden de armado (detalle en la guía de armado)', 'b', 11.5, NAVY)
    steps = ['Imanes pegados en el extremo del barril de cada valva.', 'Valvas unidas al pistón con los pasadores R2 (en las horquillas).',
             'Yugo pasado por el pistón y trabado con el pasador R4.', 'Todo el conjunto baja por arriba al cuerpo, con las valvas abiertas.',
             'Pasadores de bisagra R1 desde afuera, uno por valva.', 'Prueba a mano: empujar el yugo; las 3 valvas abren y cierran juntas.',
             'Portasensores con su Hall por los túneles laterales, hasta tocar el barril.', 'Servo por la ventana, con la manivela (5) y su pasador R3 en la ranura del yugo.']
    for i, s in enumerate(steps):
        yy = y + 7 + i * 6.3
        p.circle(M + 2.6, yy - 1.2, 2.6, TEAL)
        p.text(M + 2.6, yy, str(i + 1), 'b', 7, 'white', anchor='middle')
        p.text(M + 8, yy, s, 'm', 9, NAVY)
    pages.append(p)

    # 2 y 3 · piezas impresas
    printed = [
        ('mini_Cuerpo.png', '1', 'Cuerpo', '×1',
         'Es la base: el anillo exterior que apoya en la mesa. Todo lo demás va dentro de él o fijo a él.',
         'Los 3 pasadores de bisagra (R1), por los rebajes planos de un lado de cada valva; los 3 portasensores (6), por los túneles del lado opuesto; '
         'el servo, atornillado detrás de la ventana. En la cara de arriba, 1, 2 o 3 puntos marcan cada valva.'),
        ('mini_Valva.png', '2', 'Valva', '×3',
         'Dentro del anillo, arriba. Cada una gira sobre su pasador de bisagra (R1), que atraviesa su tubo (barril).',
         'Un imán en el extremo del barril, el que queda frente al portasensor. La cola de abajo entra entre las dos mejillas de una horquilla del pistón, unida con un pasador R2.'),
        ('mini_Piston.png', '3', 'Pistón', '×1',
         'Dentro del cuerpo, debajo de las valvas. Sube y baja: al subir abre las valvas, al bajar las cierra.',
         'Sus 3 brazos corren por las 3 ranuras verticales del cuerpo (entre valva y valva). Sus 3 horquillas reciben las colas con los pasadores R2. '
         'La espiga del yugo pasa por su ranura central.'),
        ('mini_Yugo.png', '4', 'Yugo', '×1',
         'Cuelga debajo del pistón, frente a la ventana del servo.',
         'Su espiga atraviesa el pistón y se traba encima del disco con el pasador R4. Por su ranura horizontal corre el pasador de la manivela (R3).'),
        ('mini_Manivela.png', '5', 'Manivela', '×1',
         'Pegada sobre el brazo (horn) del servo, con 2 gotas de cianoacrilato.',
         'El pasador R3 a presión. Ese pasador entra en la ranura del yugo: cuando el servo gira, el yugo sube y baja.'),
        ('mini_Portasensor.png', '6', 'Portasensor', '×3',
         'Entra desde afuera por el túnel lateral de cada valva y se empuja hasta que su punta toca el barril.',
         'El sensor Hall, con la cara plana mirando al centro de la válvula y las patas hacia afuera. La pestaña se fija a la pared con cinta o pegamento caliente.'),
    ]
    for k, chunk in enumerate((printed[:3], printed[3:])):
        p = Page(); p.header('Piezas impresas', f'Archivo {"01–03" if k == 0 else "04–06"} del ZIP de impresión · el número coincide con el despiece', 2 + k)
        y = 32
        for img, num, title, qty, donde, lleva in chunk:
            card(p, M, y, W - 2 * M, 76, os.path.join(G, img), num, title, qty, donde, lleva)
            y += 82
        if k == 1:
            p.rect(M, y, W - 2 * M, 14, fill=SOFT)
            p.text(M + 4, y + 6, '00 · Probeta ×1 — no va en el modelo.', 'sb', 9.5, NAVY)
            p.text(M + 4, y + 11, 'Se imprime primero para comprobar los ajustes de los agujeros en tu impresora.', 'm', 8.5, INK)
        pages.append(p)

    # 4 · piezas compradas
    p = Page(); p.header('Piezas compradas', 'Latón, imanes, sensores y servo: dónde va cada una', 4)
    y = 32
    p.text(M, y, 'Pasadores de latón Ø3 mm (una varilla, cortada en 8)', 'b', 11.5, NAVY)
    p.image(os.path.join(G, 'mini_Pasadores.png'), W - M - 50, y + 3, 50, 34)
    rows = [('R1', f'3 × {f1(R.HINGE_L)} mm', 'Bisagras: entran desde afuera por el rebaje plano, atraviesan la pared y el barril de cada valva.'),
            ('R2', f'3 × {f1(R.LUG_L)} mm', 'Horquillas del pistón: atraviesan las dos mejillas y la ranura de la cola de cada valva.'),
            ('R3', f'1 × {f1(R.CRANK_L)} mm', 'Manivela: a presión en ella; su punta corre por la ranura del yugo.'),
            ('R4', f'1 × {f1(R.LOCK_L)} mm', 'Traba: atraviesa la espiga del yugo, encima del disco del pistón.')]
    yy = y + 9
    for code, qty, txt in rows:
        p.text(M, yy, code, 'b', 10, TEAL)
        p.text(M + 10, yy, qty, 'sb', 9.5, NAVY)
        yy = p.text(M + 36, yy, txt, 'm', 9, INK, w=W - 2 * M - 36 - 56) + 7
    y = max(yy, y + 42) + 6
    p.text(M, y, 'Imanes y sensores', 'b', 11.5, NAVY)
    det = os.path.abspath(os.path.join(HERE, '..', '..', 'pendon', 'imagenes', 'pendon_detalle_hall_iman.png'))
    p.rect(M, y + 4, W - 2 * M, 62, fill=SOFT)
    h = p.image(det, M + 50, y + 7, W - 2 * M - 100, 50, crop=False)
    p.text(M + 4, y + 62, 'Valva 1 sola, vista desde adentro. El portasensor se dibujó separado para que se vea el imán (en coral, en el extremo del barril).', 'm', 8, INK)
    p.text(M + 4, y + 34, 'sensor Hall\n(fijo)', 'sb', 9.5, NAVY)
    p.text(W - M - 4, y + 34, 'imán\n(gira con la valva)', 'sb', 9.5, ACC, anchor='end')
    y += 4 + 62 + 8
    for code, title, txt in (('R5', 'Imán Ø4 × 2 mm ×3', 'En la ranura del extremo del barril de cada valva (el lado del portasensor), de canto, hasta el fondo, con una gota de cianoacrilato. '
                                                         'Gira con la valva. Una vez armado no se ve: queda dentro de la pared.'),
                             ('R6', 'Sensor Hall ×3', 'En el canal de cada portasensor (6). Queda fijo, alineado con la bisagra, a unos 5 mm del imán.'),
                             ('R7–R9', 'Servo MG90S, su horn y 2 tornillos', 'Acostado detrás de la ventana del cuerpo; las 2 orejas se atornillan al tabique desde afuera. '
                                                                             'El horn (con la manivela pegada) va en su eje.')):
        p.text(M, y, code, 'b', 10, TEAL)
        p.text(M + 16, y, title, 'sb', 10, NAVY)
        y = p.text(M + 16, y + 5, txt, 'm', 9, INK, w=W - 2 * M - 16) + 8
    pages.append(p)

    import cairosvg
    import pymupdf
    out = pymupdf.open()
    for i, pg in enumerate(pages):
        f = os.path.join(G, f'_p{i}.pdf')
        cairosvg.svg2pdf(bytestring=pg.svg().encode(), write_to=f, unsafe=True)
        out.insert_pdf(pymupdf.open(f)); os.remove(f)
    dst = os.path.join(G, 'CardioValveAI_v4_Donde_va_cada_pieza.pdf')
    out.set_metadata({'title': 'CardioValveAI v4 · Dónde va cada pieza'})
    out.save(dst, garbage=3, deflate=True)
    for i in range(len(out)):
        out[i].get_pixmap(dpi=60).save(os.path.join(G, f'pagina_{i + 1}.png'))
    print(dst, len(out), 'páginas')


if __name__ == '__main__':
    main()
