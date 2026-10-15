"""Extract the author's PPT images, crops, grids and yellow outlines. Python stdlib only.

Run: python scripts/extract-workshop.py, then node scripts/workshop-assets.mjs.
SVG intermediates stay in .local; only the final WebP files ship with the app.
"""
import base64
import posixpath
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
ET.register_namespace("", "http://www.w3.org/2000/svg")

NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
OUT = Path(".local/workshop-import")
OUT.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile("resources/questions.pptx") as deck:
    for name in deck.namelist():
        if name.startswith("ppt/media/"):
            (OUT / Path(name).name).write_bytes(deck.read(name))
    for number in [1, 8, 11, 17]:
        slide = ET.fromstring(deck.read(f"ppt/slides/slide{number}.xml"))
        rels = {r.get("Id"): posixpath.normpath("ppt/slides/" + r.get("Target"))
                for r in ET.fromstring(deck.read(f"ppt/slides/_rels/slide{number}.xml.rels"))}
        image_shape = next(s for s in slide.findall("p:cSld/p:spTree/p:sp", NS)
                           if s.find(".//a:blip", NS) is not None)
        transform = image_shape.find("p:spPr/a:xfrm", NS)
        off, size = transform.find("a:off", NS), transform.find("a:ext", NS)
        x, y, w, h = int(off.get("x")), int(off.get("y")), int(size.get("cx")), int(size.get("cy"))
        scale = 1800 / w
        fill = image_shape.find(".//a:fillRect", NS)
        l, t, r, b = [int(fill.get(k, 0)) / 100000 if fill is not None else 0 for k in ["l", "t", "r", "b"]]
        media = rels[image_shape.find(".//a:blip", NS).get(R)]
        data = base64.b64encode(deck.read(media)).decode()
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="{round(h*scale)}" viewBox="0 0 {w} {h}">',
               f'<image href="data:image/png;base64,{data}" x="{l*w}" y="{t*h}" width="{w*(1-l-r)}" height="{h*(1-t-b)}" preserveAspectRatio="none"/>']
        for table in slide.findall(".//p:graphicFrame", NS):
            tr = table.find("p:xfrm", NS)
            tx, ty = int(tr.find("a:off", NS).get("x"))-x, int(tr.find("a:off", NS).get("y"))-y
            cols = [int(c.get("w")) for c in table.findall(".//a:gridCol", NS)]
            cy = ty
            for row in table.findall(".//a:tr", NS):
                rh, cx = int(row.get("h")), tx
                for cell, cw in zip(row.findall("a:tc", NS), cols):
                    text = "".join(n.text or "" for n in cell.findall(".//a:t", NS))
                    svg.append(f'<rect x="{cx}" y="{cy}" width="{cw}" height="{rh}" fill="none" stroke="white" stroke-width="38100"/>')
                    svg.append(f'<text x="{cx+cw/2}" y="{cy+rh/2}" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-weight="bold" font-size="260000" fill="white" stroke="#15221b" stroke-width="18000" paint-order="stroke">{text}</text>')
                    cx += cw
                cy += rh
        for group in slide.findall(".//p:grpSp", NS):
            tr = group.find("p:grpSpPr/a:xfrm", NS)
            off, size = tr.find("a:off", NS), tr.find("a:ext", NS)
            svg.append(f'<rect x="{int(off.get("x"))-x}" y="{int(off.get("y"))-y}" width="{size.get("cx")}" height="{size.get("cy")}" fill="none" stroke="#ffde59" stroke-width="90000"/>')
        svg.append("</svg>")
        normalized = ET.fromstring("".join(svg))
        normalized.set("viewBox", f"0 0 1800 {h*scale}")
        for element in list(normalized):
            for key in ["x", "y", "width", "height", "stroke-width", "font-size"]:
                if key in element.attrib:
                    element.set(key, str(float(element.get(key))*scale))
        (OUT/f"slide-{number:02}.svg").write_text(ET.tostring(normalized, encoding="unicode"), encoding="utf8")
