"""Ferramentas para editar o deck gamificado (um único HTML com imagens embutidas).

O deck tem linhas com centenas de milhares de caracteres (imagens e fontes em
base64), então ler e editar "na mão" é lento e arriscado. Estes comandos fazem
o trabalho pesado:

  python deck_tools.py outline  deck.html               # lista os slides
  python deck_tools.py strip    deck.html -o leve.html   # cópia sem base64, para ler
  python deck_tools.py check    deck.html                # problemas conhecidos
  python deck_tools.py apply    deck.html edicoes.json   # trocas de texto conferidas
  python deck_tools.py embed    foto.png                  # imagem -> data URI webp
  python deck_tools.py place    deck.html __IMG_X__ foto.png   # troca um marcador pela imagem
  python deck_tools.py collage  saida.png a.png b.png c.png d.png
  python deck_tools.py fit-logos ilustracao.webp saida.png logo1.png logo2.png ...

Requer Python 3.9+ e Pillow (pip install pillow) para os comandos de imagem.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import shutil
import sys
from pathlib import Path

DATA_RE = re.compile(r"data:[a-z]+/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+")
SLIDE_RE = re.compile(r'<section class="slide([^"]*)"[^>]*?data-world="(\d+)"[^>]*?data-title="([^"]*)">(.*?)</section>', re.S)


def read(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str | Path, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8", newline="\n")


# ------------------------------------------------------------------- leitura

def cmd_strip(a):
    """Cópia do deck com cada base64 trocado por DATA: fica com ~100 KB e dá para ler."""
    out = DATA_RE.sub("DATA", read(a.deck))
    dest = a.output or str(Path(a.deck).with_suffix(".leve.html"))
    write(dest, out)
    print(f"{dest} ({len(out.encode()) // 1024} KB)")


def cmd_outline(a):
    html = read(a.deck)
    for i, m in enumerate(SLIDE_RE.finditer(html), 1):
        cls, world, title, body = m.groups()
        steps = re.findall(r'data-step="(\d+)"', body)
        notes = "notas" if '<aside class="notes">' in body else "SEM NOTAS"
        live = []
        if "data-cloud" in body:
            live.append("nuvem")
        if "data-vote" in body:
            live.append("votação")
        if 'data-qr="game"' in body:
            live.append("QR jogo")
        extra = f" · {'/'.join(live)}" if live else ""
        print(f"{i:>2}. [mundo {world}] {title}  ({max(map(int, steps)) if steps else 0} passos, {notes}{extra})")


# ---------------------------------------------------------------- verificação

def cmd_check(a):
    """Problemas que já aconteceram de verdade neste formato."""
    html = read(a.deck)
    head = html[:600].lower()
    problems, notes = [], []
    if not head.lstrip().startswith("<!doctype html"):
        problems.append("Falta <!doctype html> no início: sem ele o navegador usa o modo de compatibilidade antigo.")
    if '<meta charset="utf-8">' not in head:
        problems.append('Falta <meta charset="utf-8"> no início: aberto direto do computador, acentos e ◀ ▶ podem quebrar.')
    slides = list(SLIDE_RE.finditer(html))
    titles = [m.group(3) for m in slides]
    if len(set(titles)) != len(titles):
        problems.append("Há slides com data-title repetido (o menu de fases fica confuso).")
    for i, m in enumerate(slides, 1):
        body = m.group(4)
        if '<aside class="notes">' not in body:
            notes.append(f"Slide {i} ({m.group(3)}) sem notas do professor.")
        # a fonte pixelada (var(--hud)) dos chips e rótulos não tem setas e alguns símbolos
        for frag in re.findall(r'class="(?:chip|label|lv|live)[^"]*"[^>]*>([^<]*)<', body):
            bad = [c for c in frag if c in "→←↑↓⇒✦★•"]
            msg = f"Slide {i}: '{frag.strip()}' usa {''.join(sorted(set(bad)))} numa fonte que não tem esse símbolo (troque por texto ou ':')."
            if bad and msg not in problems:
                problems.append(msg)
    if "IMAGEM AQUI" in html:
        notes.append(f"{html.count('IMAGEM AQUI') // 1} marcador(es) de imagem do modelo ainda no deck.")
    for mid in sorted(set(re.findall(r'data-(?:cloud|vote)="(\d+)"', html))):
        if f'data-qr="m{mid}"' not in html and not (mid == "1" and 'data-qr="missao"' in html):
            notes.append(f"Missão {mid} aparece no deck sem QR (data-qr=\"m{mid}\").")
    size = len(html.encode()) / 1e6
    if size > 12:
        problems.append(f"Deck com {size:.1f} MB: reduza imagens (embed --max-width 1400 --quality 75).")
    print(f"{len(slides)} slides · {size:.2f} MB")
    for p in problems:
        print("PROBLEMA:", p)
    for n in notes:
        print("aviso:", n)
    if not problems:
        print("Nenhum problema conhecido encontrado.")
    sys.exit(1 if problems else 0)


# -------------------------------------------------------------------- edição

def cmd_apply(a):
    """Aplica trocas [{"old": "...", "new": "..."}]. Cada "old" precisa aparecer UMA vez,
    senão nada é gravado: evita trocar o trecho errado num arquivo de 4 MB."""
    html = read(a.deck)
    edits = json.loads(read(a.edits))
    bad = []
    for e in edits:
        n = html.count(e["old"])
        if n != 1:
            bad.append(f"{n}x: {e['old'][:90]!r}")
    if bad:
        print("Nada gravado. Trechos que não bateram exatamente uma vez:\n" + "\n".join(bad))
        sys.exit(1)
    if not a.no_backup:
        shutil.copyfile(a.deck, a.deck + ".bak")
    for e in edits:
        html = html.replace(e["old"], e["new"])
    write(a.deck, html)
    print(f"OK: {len(edits)} trocas" + ("" if a.no_backup else f" (backup em {a.deck}.bak)"))


# -------------------------------------------------------------------- imagens

def _pil():
    try:
        from PIL import Image, ImageChops, ImageOps  # noqa: F401
        return Image, ImageChops, ImageOps
    except ImportError:
        sys.exit("Instale o Pillow: pip install pillow")


def to_data_uri(path: str, max_width: int = 1600, quality: int = 80) -> str:
    Image, _, _ = _pil()
    im = Image.open(path)
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
    if im.width > max_width:
        im = im.resize((max_width, round(im.height * max_width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def cmd_embed(a):
    uri = to_data_uri(a.image, a.max_width, a.quality)
    if a.output:
        write(a.output, uri)
        print(f"{a.output} ({len(uri) // 1024} KB)")
    else:
        print(uri)


def cmd_place(a):
    """Troca um marcador (ex.: __IMG_STANLEY__) no deck pela imagem embutida."""
    html = read(a.deck)
    n = html.count(a.token)
    if n != 1:
        sys.exit(f"O marcador {a.token} aparece {n}x no deck (precisa ser 1).")
    uri = to_data_uri(a.image, a.max_width, a.quality)
    write(a.deck, html.replace(a.token, uri))
    print(f"OK: {a.token} -> {Path(a.image).name} ({len(uri) // 1024} KB)")


def cmd_collage(a):
    """Colagem 4:3 de 2 a 6 imagens. Uma imagem em retrato vai inteira à esquerda e as
    outras empilhadas à direita; sem retrato, vira uma grade."""
    Image, ImageChops, ImageOps = _pil()
    W, H, GAP = a.width, round(a.width * 3 / 4), 14
    canvas = Image.new("RGB", (W, H), tuple(int(a.bg[i:i + 2], 16) for i in (1, 3, 5)))
    ims = [Image.open(p).convert("RGB") for p in a.images]
    tall = [im for im in ims if im.height > im.width * 1.15]
    if tall and len(ims) > 1:
        t = tall[0]
        bgc = t.getpixel((3, 3))
        box = ImageChops.difference(t, Image.new("RGB", t.size, bgc)).convert("L").point(lambda v: 255 if v > 18 else 0).getbbox()
        t = t.crop(box) if box else t
        lw = round(W * 0.29)
        tile = Image.new("RGB", (lw, H), (245, 245, 247))
        c = ImageOps.contain(t, (lw - 28, H - 28), Image.LANCZOS)
        tile.paste(c, ((lw - c.width) // 2, (H - c.height) // 2))
        canvas.paste(tile, (0, 0))
        rest = [im for im in ims if im is not tall[0]]
        x, w = lw + GAP, W - lw - GAP
        h = (H - GAP * (len(rest) - 1)) // len(rest)
        for i, im in enumerate(rest):
            canvas.paste(ImageOps.fit(im, (w, h), Image.LANCZOS, centering=(0.5, 0.3)), (x, i * (h + GAP)))
    else:
        cols = 2 if len(ims) <= 4 else 3
        rows = -(-len(ims) // cols)
        w, h = (W - GAP * (cols - 1)) // cols, (H - GAP * (rows - 1)) // rows
        for i, im in enumerate(ims):
            r, c = divmod(i, cols)
            canvas.paste(ImageOps.fit(im, (w, h), Image.LANCZOS, centering=(0.5, 0.3)), (c * (w + GAP), r * (h + GAP)))
    canvas.save(a.output)
    print(f"{a.output} {canvas.size}")


def cmd_fit_logos(a):
    """Encaixa logos nas molduras BRANCAS de uma ilustração (ex.: telas vazias de pixel art).
    As molduras são achadas sozinhas e preenchidas da esquerda para a direita."""
    Image, _, _ = _pil()
    from collections import deque

    bg = Image.open(a.illustration).convert("RGB")
    k = a.scale
    if k > 1:
        bg = bg.resize((bg.width * k, bg.height * k), Image.NEAREST)  # pixel art: sem borrar
    W, H = bg.size
    px = bg.load()
    white = lambda x, y: all(c > 228 for c in px[x, y])
    seen = bytearray(W * H)
    boxes = []
    step = 3 * k
    for x in range(0, W, step):
        for y in range(0, H, step):
            if seen[y * W + x] or not white(x, y):
                continue
            q = deque([(x, y)])
            seen[y * W + x] = 1
            xs, ys = [], []
            while q:
                u, v = q.popleft()
                xs.append(u)
                ys.append(v)
                for nu, nv in ((u + 1, v), (u - 1, v), (u, v + 1), (u, v - 1)):
                    if 0 <= nu < W and 0 <= nv < H and not seen[nv * W + nu] and white(nu, nv):
                        seen[nv * W + nu] = 1
                        q.append((nu, nv))
            if len(xs) > a.min_area * k * k:
                boxes.append((min(xs), min(ys), max(xs), max(ys)))
    boxes.sort()
    print(f"{len(boxes)} molduras brancas encontradas")
    if len(boxes) < len(a.logos):
        print("Aviso: há mais logos que molduras; sobram logos.")
    for (x0, y0, x1, y1), path in zip(boxes, a.logos):
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        w, h = int((x1 - x0) * 0.62 / 2), int((y1 - y0) * 0.58 / 2)  # margem dentro do quadro inclinado
        logo = Image.open(path).convert("RGBA")
        logo = logo.crop(logo.getbbox())
        logo.thumbnail((2 * w, 2 * h), Image.LANCZOS)
        bg.paste(logo, (cx - logo.width // 2, cy - logo.height // 2), logo)
        print(f"  {Path(path).name} -> moldura em ({x0},{y0})")
    if a.max_width and bg.width > a.max_width:
        bg = bg.resize((a.max_width, round(bg.height * a.max_width / bg.width)), Image.LANCZOS)
    bg.save(a.output)
    print(f"{a.output} {bg.size}")


def main():
    # O terminal do Windows usa cp1252 e quebra ao imprimir ◀ → etc.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("strip", help="cópia leve, sem base64, para ler o deck")
    s.add_argument("deck"); s.add_argument("-o", "--output"); s.set_defaults(fn=cmd_strip)
    s = sub.add_parser("outline", help="lista os slides"); s.add_argument("deck"); s.set_defaults(fn=cmd_outline)
    s = sub.add_parser("check", help="procura problemas conhecidos"); s.add_argument("deck"); s.set_defaults(fn=cmd_check)
    s = sub.add_parser("apply", help="aplica trocas de texto conferidas")
    s.add_argument("deck"); s.add_argument("edits", help='JSON: [{"old": "...", "new": "..."}]')
    s.add_argument("--no-backup", action="store_true"); s.set_defaults(fn=cmd_apply)
    for name, fn in (("embed", cmd_embed), ("place", cmd_place)):
        s = sub.add_parser(name)
        if name == "place":
            s.add_argument("deck"); s.add_argument("token")
        s.add_argument("image")
        s.add_argument("--max-width", type=int, default=1600); s.add_argument("--quality", type=int, default=80)
        if name == "embed":
            s.add_argument("-o", "--output")
        s.set_defaults(fn=fn)
    s = sub.add_parser("collage"); s.add_argument("output"); s.add_argument("images", nargs="+")
    s.add_argument("--width", type=int, default=1440); s.add_argument("--bg", default="#0B0A1A"); s.set_defaults(fn=cmd_collage)
    s = sub.add_parser("fit-logos"); s.add_argument("illustration"); s.add_argument("output"); s.add_argument("logos", nargs="+")
    s.add_argument("--scale", type=int, default=2); s.add_argument("--min-area", type=int, default=3000)
    s.add_argument("--max-width", type=int, default=2000); s.set_defaults(fn=cmd_fit_logos)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
