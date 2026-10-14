#!/usr/bin/env python3
"""Toolkit for reading and writing FidoCadJ (.fcd) drawings and (.fcl) libraries.

Self-contained: standard library only, Python 3.8+.  See SKILL.md for usage.
"""

import argparse
import math
import os
import re
import sys

# --------------------------------------------------------------------------
# Constants from the FCD specification
# --------------------------------------------------------------------------

MAX_COORD = 1000000
MAX_LAYERS = 16
MAX_VERTICES = 10000
MAX_MACRO_DEPTH = 16
DEFAULT_FONT = "Courier New"

LAYER_NAMES = [
    "Circuit", "Bottom copper", "Top copper", "Silkscreen",
    "Other 1", "Other 2", "Other 3", "Other 4", "Other 5", "Other 6",
    "Other 7", "Other 8", "Other 9", "Other 10", "Other 11", "Other 12",
]
LAYER_COLORS = [
    (0, 0, 0), (0, 0, 128), (255, 0, 0), (0, 128, 128),
    (255, 200, 0), (127, 255, 0), (0, 255, 255), (0, 128, 0),
    (154, 205, 50), (255, 20, 147), (181, 155, 12), (1, 128, 255),
    (225, 225, 225), (162, 162, 162), (95, 95, 95), (0, 0, 0),
]
LAYER_ALPHA = [1.0] * 12 + [0.95, 0.90, 0.90, 1.0]

DASH_PATTERNS = [None, "5,5", "2,2", "2,5", "2,5,5,5"]

# Libraries bundled with FidoCadJS and the prefix each is loaded under.
# The standard library uses the empty prefix: its macros are referenced by
# bare key (`MC 100 100 0 0 080`).
LIBRARIES = [
    ("FCDstdlib_en.fcl", ""),
    ("elettrotecnica_en.fcl", "elettrotecnica"),
    ("EY_Libraries.fcl", "EY_Libraries"),
    ("IHRAM_en.fcl", "IHRAM"),
    ("PCB_en.fcl", "PCB"),
]

# Primitives that take an FCJ line with arrow data, vs. dash-only data.
ARROW_PRIMS = {"LI", "BE", "CV", "CP"}
DASH_PRIMS = {"RV", "RP", "EV", "EP", "PV", "PP"}
# Primitives that may carry name/value TY lines but never an FCJ line.
NO_FCJ_PRIMS = {"SA", "PL", "PA", "MC"}

MIN_TOKENS = {
    "LI": 5, "BE": 9, "RV": 5, "RP": 5, "EV": 5, "EP": 5,
    "PV": 6, "PP": 6, "CV": 6, "CP": 6, "SA": 3, "PL": 6,
    "PA": 7, "MC": 6, "TY": 9, "TE": 4,
}


def die(msg):
    sys.stderr.write("error: %s\n" % msg)
    sys.exit(1)


# --------------------------------------------------------------------------
# Locating the FidoCadJS library bundle
# --------------------------------------------------------------------------

def find_lib_dir():
    """Resolve the directory holding the bundled .fcl libraries.

    Order: $FIDOCAD_LIB_DIR, then <repo>/public/lib relative to this script's
    real location (the skill lives at <repo>/skills/fidocad/scripts/), then
    a few common checkout paths.
    """
    env = os.environ.get("FIDOCAD_LIB_DIR")
    if env:
        if os.path.isdir(env):
            return env
        die("FIDOCAD_LIB_DIR=%s is not a directory" % env)

    here = os.path.dirname(os.path.realpath(__file__))
    candidates = [
        os.path.normpath(os.path.join(here, "..", "..", "..", "public", "lib")),
        os.path.normpath(os.path.join(here, "..", "libs")),
        os.path.expanduser("~/projects/FidoCadJS/public/lib"),
        os.path.expanduser("~/FidoCadJS/public/lib"),
    ]
    for c in candidates:
        if os.path.isfile(os.path.join(c, "FCDstdlib_en.fcl")):
            return c
    die(
        "cannot find the FidoCadJS library bundle (FCDstdlib_en.fcl).\n"
        "  Looked in:\n    %s\n"
        "  Set FIDOCAD_LIB_DIR to the directory holding the .fcl files."
        % "\n    ".join(candidates)
    )


# --------------------------------------------------------------------------
# Number formatting (mirrors the writer's roundIntelligently)
# --------------------------------------------------------------------------

def fmt_num(v):
    """Print integral floats without a decimal point, else up to 3 decimals."""
    if isinstance(v, int):
        return str(v)
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return ("%.3f" % v).rstrip("0").rstrip(".")


def parse_num(tok, default=0.0):
    try:
        return float(tok)
    except (TypeError, ValueError):
        return default


def parse_coord(tok):
    """Parse a coordinate, clamping to [0, MAX_COORD] as the lexer does."""
    v = parse_num(tok, 0.0)
    return max(0.0, min(float(MAX_COORD), v))


def parse_layer(tok):
    try:
        v = int(float(tok))
    except (TypeError, ValueError):
        return 0
    return v if 0 <= v < MAX_LAYERS else 0


def decode_font(tok):
    if tok == "*":
        return DEFAULT_FONT
    return tok.replace("++", " ")


def encode_font(name):
    if name == DEFAULT_FONT or not name:
        return "*"
    return name.replace(" ", "++")


# --------------------------------------------------------------------------
# Drawing model
# --------------------------------------------------------------------------

class Prim(object):
    """One graphic primitive plus its FCJ attributes and name/value labels."""

    __slots__ = ("code", "coords", "layer", "extra", "fcj", "name", "value",
                 "text", "lineno", "raw")

    def __init__(self, code, lineno=0, raw=""):
        self.code = code
        self.coords = []      # flat [x1, y1, x2, y2, ...]
        self.layer = 0
        self.extra = {}       # per-code fields (width, style, closed, macro...)
        self.fcj = None       # dict with arrows/dash/textFlag when present
        self.name = None      # (text, TY fields) attached label
        self.value = None
        self.text = None      # for TY/TE standalone text
        self.lineno = lineno
        self.raw = raw

    @property
    def dash(self):
        return (self.fcj or {}).get("dash", 0)

    def points(self):
        c = self.coords
        return [(c[i], c[i + 1]) for i in range(0, len(c) - 1, 2)]

    def __repr__(self):
        return "<Prim %s %s L%d>" % (self.code, self.coords, self.layer)


class Drawing(object):
    def __init__(self):
        self.prims = []
        self.config = {
            "diameterConnection": 2.0,
            "lineWidth": 0.5,
            "lineWidthCircles": 0.35,
            "layerColors": {},
            "layerNames": {},
            "image": None,
        }
        self.warnings = []

    def warn(self, lineno, msg):
        self.warnings.append((lineno, msg))


# --------------------------------------------------------------------------
# Parser
# --------------------------------------------------------------------------

def split_lines(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.split("\n")


def parse_fcd(text, strict=False):
    """Parse an FCD document into a Drawing.

    Follows the deferred-commit model: a primitive is held pending until the
    next line is seen, because that line may be an FCJ extension, and after an
    FCJ with textFlag=1 the next one or two TY lines are its name and value.
    """
    d = Drawing()
    pending = None          # Prim awaiting a possible FCJ / TY follow-up
    ty_slots = 0            # how many name/value TY lines are still expected

    def flush():
        nonlocal pending, ty_slots
        if pending is not None:
            d.prims.append(pending)
        pending = None
        ty_slots = 0

    for lineno, line in enumerate(split_lines(text), start=1):
        toks = [t for t in line.split(" ") if t != ""]
        if not toks:
            continue
        code = toks[0]

        if code == "FCJ":
            if pending is None:
                d.warn(lineno, "FCJ with no preceding primitive - ignored")
                continue
            fcj = parse_fcj(toks, pending.code)
            pending.fcj = fcj
            # MC / PL / PA / SA write a bare `FCJ` line purely as a label
            # marker, so its presence alone means two TY lines follow.  Every
            # other primitive encodes the marker as the FCJ's last token.
            if pending.code in NO_FCJ_PRIMS:
                ty_slots = 2
            else:
                ty_slots = 2 if fcj.get("text") else 0
            if ty_slots == 0:
                flush()
            continue

        if code in ("TY", "TE") and ty_slots > 0 and pending is not None:
            label = parse_text(toks, code)
            if label is None:
                d.warn(lineno, "malformed %s label - ignored" % code)
            elif pending.name is None:
                pending.name = label
            else:
                pending.value = label
            ty_slots -= 1
            if ty_slots == 0:
                flush()
            continue

        flush()

        if code == "FJC":
            apply_fjc(d, toks, lineno)
            continue

        p = parse_primitive(toks, lineno, line, d)
        if p is not None:
            pending = p
        elif strict and code != "[FIDOCAD]":
            d.warn(lineno, "unknown or malformed command %r - ignored" % code)

    flush()
    return d


def parse_fcj(toks, owner_code):
    args = toks[1:]
    f = {"arrows": 0, "arrowStyle": 0, "arrowLength": 3.0,
         "arrowHalfWidth": 1.0, "dash": 0, "text": 0}
    if owner_code in ARROW_PRIMS and len(args) >= 6:
        f["arrows"] = int(parse_num(args[0]))
        f["arrowStyle"] = int(parse_num(args[1]))
        f["arrowLength"] = parse_num(args[2], 3.0)
        f["arrowHalfWidth"] = parse_num(args[3], 1.0)
        f["dash"] = max(0, min(4, int(parse_num(args[4]))))
        f["text"] = int(parse_num(args[5]))
        return f
    if len(args) >= 2:
        # dash-only form (rectangles, ellipses, polygons) or a truncated
        # arrow form: the last token is always the text flag.
        f["dash"] = max(0, min(4, int(parse_num(args[0]))))
        f["text"] = int(parse_num(args[-1]))
        return f
    if len(args) == 1:
        f["text"] = int(parse_num(args[0]))
    return f


def parse_text(toks, code):
    """Parse TY / TE into a dict of text-primitive fields."""
    if code == "TE":
        if len(toks) < MIN_TOKENS["TE"]:
            return None
        return {
            "x": parse_coord(toks[1]), "y": parse_coord(toks[2]),
            "sizeY": 4.0, "sizeX": 3.0, "orient": 0, "style": 0,
            "layer": 0, "font": DEFAULT_FONT,
            "text": " ".join(toks[3:]),
        }
    if len(toks) < MIN_TOKENS["TY"]:
        return None
    return {
        "x": parse_coord(toks[1]), "y": parse_coord(toks[2]),
        "sizeY": parse_num(toks[3], 4.0), "sizeX": parse_num(toks[4], 3.0),
        "orient": int(parse_num(toks[5])), "style": int(parse_num(toks[6])),
        "layer": parse_layer(toks[7]), "font": decode_font(toks[8]),
        "text": " ".join(toks[9:]),
    }


def parse_primitive(toks, lineno, raw, d):
    code = toks[0]
    n = len(toks)
    if code not in MIN_TOKENS:
        return None
    if n < MIN_TOKENS[code]:
        d.warn(lineno, "%s needs at least %d tokens, got %d - skipped"
               % (code, MIN_TOKENS[code], n))
        return None

    p = Prim(code, lineno, raw)

    if code in ("LI",):
        p.coords = [parse_coord(t) for t in toks[1:5]]
        p.layer = parse_layer(toks[5]) if n > 5 else 0
    elif code == "BE":
        p.coords = [parse_coord(t) for t in toks[1:9]]
        p.layer = parse_layer(toks[9]) if n > 9 else 0
    elif code in ("RV", "RP", "EV", "EP"):
        p.coords = [parse_coord(t) for t in toks[1:5]]
        p.layer = parse_layer(toks[5]) if n > 5 else 0
    elif code in ("PV", "PP", "CV", "CP"):
        # Vertices are consumed in pairs while a token other than the last one
        # remains; whatever is left over is the layer.  Library macro bodies
        # routinely omit the layer, which this parity rule handles.
        j = 1
        if code in ("CV", "CP"):
            p.extra["closed"] = int(parse_num(toks[1]))
            j = 2
        vals = []
        while j < n - 1 and len(vals) < MAX_VERTICES * 2:
            vals.append(parse_coord(toks[j]))
            vals.append(parse_coord(toks[j + 1]))
            j += 2
        p.coords = vals
        p.layer = parse_layer(toks[j]) if j < n else 0
    elif code == "SA":
        p.coords = [parse_coord(toks[1]), parse_coord(toks[2])]
        p.layer = parse_layer(toks[3]) if n > 3 else 0
    elif code == "PL":
        p.coords = [parse_coord(t) for t in toks[1:5]]
        p.extra["width"] = parse_num(toks[5], 1.0)
        p.layer = parse_layer(toks[6]) if n > 6 else 0
    elif code == "PA":
        p.coords = [parse_coord(toks[1]), parse_coord(toks[2])]
        p.extra["rx"] = parse_num(toks[3], 1.0)
        p.extra["ry"] = parse_num(toks[4], 1.0)
        p.extra["ri"] = parse_num(toks[5], 0.0)
        p.extra["style"] = int(parse_num(toks[6]))
        p.layer = parse_layer(toks[7]) if n > 7 else 0
    elif code == "MC":
        p.coords = [parse_coord(toks[1]), parse_coord(toks[2])]
        p.extra["orient"] = int(parse_num(toks[3])) % 4
        p.extra["mirror"] = int(parse_num(toks[4])) != 0
        p.extra["macro"] = " ".join(toks[5:]).lower()
        p.layer = 0
    elif code in ("TY", "TE"):
        t = parse_text(toks, code)
        if t is None:
            return None
        p.text = t
        p.coords = [t["x"], t["y"]]
        p.layer = t["layer"]
    return p


def apply_fjc(d, toks, lineno):
    if len(toks) < 2:
        return
    sub = toks[1]
    c = d.config
    if sub == "C" and len(toks) >= 3:
        v = parse_num(toks[2])
        if v > 0:
            c["diameterConnection"] = v
    elif sub == "A" and len(toks) >= 3:
        v = parse_num(toks[2])
        if v > 0:
            c["lineWidth"] = v
    elif sub == "B" and len(toks) >= 3:
        v = parse_num(toks[2])
        if v > 0:
            c["lineWidthCircles"] = v
    elif sub == "L" and len(toks) >= 5:
        layer = parse_layer(toks[2])
        rgb = int(parse_num(toks[3]))
        c["layerColors"][layer] = ((rgb >> 16) & 255, (rgb >> 8) & 255,
                                   rgb & 255, parse_num(toks[4], 1.0))
    elif sub == "N" and len(toks) >= 4:
        c["layerNames"][parse_layer(toks[2])] = " ".join(toks[3:])
    elif sub == "IMG" and len(toks) >= 6:
        c["image"] = tuple(parse_num(t) for t in toks[2:6])
    else:
        d.warn(lineno, "unknown FJC sub-code %r - ignored" % sub)


# --------------------------------------------------------------------------
# Serializer
# --------------------------------------------------------------------------

def write_text_line(t):
    return "TY %s %s %s %s %s %s %s %s %s" % (
        fmt_num(t["x"]), fmt_num(t["y"]), fmt_num(t["sizeY"]),
        fmt_num(t["sizeX"]), fmt_num(t["orient"]), fmt_num(t["style"]),
        fmt_num(t["layer"]), encode_font(t["font"]), t["text"])


def write_prim(p):
    """Serialize one primitive (with its FCJ and label lines) to FCD text."""
    out = []
    c = [fmt_num(v) for v in p.coords]
    L = fmt_num(p.layer)
    code = p.code

    if code == "TE" or (code == "TY" and p.text is not None):
        return [write_text_line(p.text)]     # TE is always upgraded to TY

    if code == "LI":
        if p.coords[0] == p.coords[2] and p.coords[1] == p.coords[3] \
                and p.name is None and p.value is None:
            return []                        # degenerate line is dropped
        out.append("LI %s %s" % (" ".join(c), L))
    elif code == "BE":
        out.append("BE %s %s" % (" ".join(c), L))
    elif code in ("RV", "RP", "EV", "EP"):
        out.append("%s %s %s" % (code, " ".join(c), L))
    elif code in ("PV", "PP"):
        out.append("%s %s %s" % (code, " ".join(c), L))
    elif code in ("CV", "CP"):
        out.append("%s %s %s %s" % (code, fmt_num(p.extra.get("closed", 0)),
                                    " ".join(c), L))
    elif code == "SA":
        out.append("SA %s %s" % (" ".join(c), L))
    elif code == "PL":
        out.append("PL %s %s %s" % (" ".join(c),
                                    fmt_num(p.extra["width"]), L))
    elif code == "PA":
        out.append("PA %s %s %s %s %s %s" % (
            " ".join(c), fmt_num(p.extra["rx"]), fmt_num(p.extra["ry"]),
            fmt_num(p.extra["ri"]), fmt_num(p.extra["style"]), L))
    elif code == "MC":
        out.append("MC %s %s %s %s" % (
            " ".join(c), fmt_num(p.extra["orient"]),
            "1" if p.extra["mirror"] else "0", p.extra["macro"]))
    else:
        return [p.raw]

    has_text = p.name is not None or p.value is not None
    f = p.fcj or {}

    if code in NO_FCJ_PRIMS:
        # These carry a bare `FCJ` line as a pure label marker.
        if has_text:
            out.append("FCJ")
    elif (has_text or p.dash != 0
            or (code in ARROW_PRIMS and f.get("arrows", 0) != 0)):
        flag = "1" if has_text else "0"
        if code in ARROW_PRIMS:
            out.append("FCJ %s %s %s %s %s %s" % (
                fmt_num(f.get("arrows", 0)), fmt_num(f.get("arrowStyle", 0)),
                fmt_num(f.get("arrowLength", 3)),
                fmt_num(f.get("arrowHalfWidth", 1)),
                fmt_num(f.get("dash", 0)), flag))
        else:
            out.append("FCJ %s %s" % (fmt_num(f.get("dash", 0)), flag))

    # Name and value are always written as a pair once either is present.
    if has_text:
        blank = {"x": p.coords[0], "y": p.coords[1], "sizeY": 4, "sizeX": 3,
                 "orient": 0, "style": 0, "layer": p.layer,
                 "font": DEFAULT_FONT, "text": ""}
        out.append(write_text_line(p.name if p.name else blank))
        out.append(write_text_line(p.value if p.value else blank))
    return out


def write_fcd(d, extensions=True):
    out = ["[FIDOCAD]"]
    if extensions:
        c = d.config
        if c["diameterConnection"] != 2.0:
            out.append("FJC C %s" % fmt_num(c["diameterConnection"]))
        if c["lineWidth"] != 0.5:
            out.append("FJC A %s" % fmt_num(c["lineWidth"]))
        if c["lineWidthCircles"] != 0.35:
            out.append("FJC B %s" % fmt_num(c["lineWidthCircles"]))
        for layer, (r, g, b, a) in sorted(c["layerColors"].items()):
            out.append("FJC L %d %d %s" % (layer, (r << 16) | (g << 8) | b,
                                           fmt_num(a)))
        for layer, name in sorted(c["layerNames"].items()):
            out.append("FJC N %d %s" % (layer, name))
        if c["image"]:
            out.append("FJC IMG %s" % " ".join(fmt_num(v) for v in c["image"]))
    for p in d.prims:
        if extensions:
            out.extend(write_prim(p))
        else:
            out.extend(l for l in write_prim(p) if not l.startswith("FCJ"))
    return "\n".join(out) + "\n"


# --------------------------------------------------------------------------
# Library model
# --------------------------------------------------------------------------

class Macro(object):
    __slots__ = ("key", "longname", "category", "library", "libfile", "body")

    def __init__(self, key, longname, category, library, libfile, body):
        self.key = key                  # fully-qualified, lowercased
        self.longname = longname
        self.category = category
        self.library = library          # library display name
        self.libfile = libfile
        self.body = body                # list of body lines (FCD text)


def parse_fcl(path, prefix):
    """Parse a .fcl library into a list of Macro objects."""
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    macros = []
    category = ""
    libname = os.path.basename(path)
    cur = None
    body = []

    def commit():
        if cur is not None:
            key, longname, cat = cur
            full = ("%s.%s" % (prefix, key)).lower() if prefix else key.lower()
            macros.append(Macro(full, longname, cat, libname_holder[0],
                                libname, list(body)))

    libname_holder = [libname]
    for line in split_lines(text):
        s = line.strip()
        if len(s) <= 1:
            continue
        if s.startswith("{"):
            category = s[1:].split("}")[0].strip()
            continue
        if s.startswith("["):
            head = s[1:]
            head = head.split("]")[0]
            parts = head.split(" ", 1)
            key = parts[0].strip()
            longname = parts[1].strip() if len(parts) > 1 else ""
            if key.upper() == "FIDOLIB":
                libname_holder[0] = longname or libname
                cur = None
                body = []
                continue
            commit()
            cur = (key, longname, category)
            body = []
            continue
        if cur is not None:
            body.append(s)
    commit()
    return macros


_LIB_CACHE = None


def load_libraries():
    global _LIB_CACHE
    if _LIB_CACHE is not None:
        return _LIB_CACHE
    libdir = find_lib_dir()
    index = {}
    order = []
    for fname, prefix in LIBRARIES:
        path = os.path.join(libdir, fname)
        if not os.path.isfile(path):
            continue
        for m in parse_fcl(path, prefix):
            if m.key not in index:
                order.append(m)
            index[m.key] = m
    _LIB_CACHE = (index, order, libdir)
    return _LIB_CACHE


# --------------------------------------------------------------------------
# Macro geometry: transform, expansion, pin detection
# --------------------------------------------------------------------------

def macro_transform(x, y, orient, mirror):
    """Return f(bx, by) -> (X, Y) mapping macro-body coords to world coords.

    The macro body's anchor is (100, 100); it lands on the MC position.
    Derived from MapCoordinates.mapXr/mapYr with unit magnification.
    """
    def f(bx, by):
        u = bx - 100.0
        v = by - 100.0
        if mirror:
            if orient == 0:
                return (x - u, y + v)
            if orient == 1:
                return (x + v, y + u)
            if orient == 2:
                return (x + u, y - v)
            return (x - v, y - u)
        if orient == 0:
            return (x + u, y + v)
        if orient == 1:
            return (x - v, y + u)
        if orient == 2:
            return (x - u, y - v)
        return (x + v, y - u)
    return f


def expand_macro(key, index, depth=0):
    """Parse a macro body into primitives, recursively inlining nested MCs.

    Returns primitives in macro-body coordinates (anchor at 100,100).
    """
    if depth > MAX_MACRO_DEPTH:
        return []
    m = index.get(key)
    if m is None:
        return []
    sub = parse_fcd("\n".join(m.body))
    out = []
    for p in sub.prims:
        if p.code == "MC":
            inner = expand_macro(p.extra["macro"], index, depth + 1)
            f = macro_transform(p.coords[0], p.coords[1],
                                p.extra["orient"], p.extra["mirror"])
            for q in inner:
                r = Prim(q.code, q.lineno, q.raw)
                r.layer = q.layer
                r.extra = dict(q.extra)
                r.fcj = q.fcj
                r.coords = []
                for i in range(0, len(q.coords) - 1, 2):
                    nx, ny = f(q.coords[i], q.coords[i + 1])
                    r.coords.extend([nx, ny])
                out.append(r)
        else:
            out.append(p)
    return out


def bezier_points(c, n=16):
    pts = []
    for i in range(n + 1):
        t = i / float(n)
        mt = 1 - t
        x = (mt ** 3 * c[0] + 3 * mt * mt * t * c[2]
             + 3 * mt * t * t * c[4] + t ** 3 * c[6])
        y = (mt ** 3 * c[1] + 3 * mt * mt * t * c[3]
             + 3 * mt * t * t * c[5] + t ** 3 * c[7])
        pts.append((x, y))
    return pts


def dist_point_seg(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = ((px - x1) * dx + (py - y1) * dy) / float(dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def bbox_of(prim):
    pts = prim.points()
    if prim.code == "BE":
        pts = bezier_points(prim.coords)
    if not pts:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def covers(prim, px, py, tol=0.3):
    """True if `prim` geometry touches (px, py) - used to reject non-pins."""
    code = prim.code
    c = prim.coords
    if code in ("LI", "PL"):
        return dist_point_seg(px, py, c[0], c[1], c[2], c[3]) <= tol
    if code == "BE":
        pts = bezier_points(c, 24)
        for i in range(len(pts) - 1):
            if dist_point_seg(px, py, pts[i][0], pts[i][1],
                              pts[i + 1][0], pts[i + 1][1]) <= tol:
                return True
        return False
    if code in ("RV", "RP", "EV", "EP", "PV", "PP", "CV", "CP"):
        bb = bbox_of(prim)
        if bb is None:
            return False
        return (bb[0] - tol <= px <= bb[2] + tol
                and bb[1] - tol <= py <= bb[3] + tol)
    if code == "SA":
        return math.hypot(px - c[0], py - c[1]) <= 1.5
    if code == "PA":
        return (abs(px - c[0]) <= prim.extra["rx"] / 2.0 + tol
                and abs(py - c[1]) <= prim.extra["ry"] / 2.0 + tol)
    return False


def macro_pins(key, index):
    """Detect a macro's connection points, in macro-body coordinates.

    A pin is one of:
      * an explicit connection dot (SA) or PCB pad (PA);
      * the free end of a lead - a segment with exactly one endpoint that no
        other primitive in the body touches (the other end attaches to the
        symbol body);
      * both ends of a segment that runs straight *through* the body, i.e. a
        closed shape in the symbol contains part of its interior (a LED's
        anode-to-cathode line, for instance).

    Free endpoints that sit inside the symbol's outline - a transistor's base
    bar, a capacitor plate, the tail of a light-emission arrow - are rejected
    by requiring a pin to lie on the symbol's bounding box.
    """
    prims = expand_macro(key, index)
    pins = []
    seen = set()

    def add(x, y, kind):
        k = (round(x, 3), round(y, 3))
        if k in seen:
            return
        seen.add(k)
        pins.append((x, y, kind))

    for p in prims:
        if p.code == "SA":
            add(p.coords[0], p.coords[1], "connection")
        elif p.code == "PA":
            add(p.coords[0], p.coords[1], "pad")

    # Bounding box of the drawn shape - text anchors do not count.
    boxes = [bbox_of(p) for p in prims if p.code not in ("TY", "TE")]
    boxes = [b for b in boxes if b]
    if boxes:
        bx0 = min(b[0] for b in boxes)
        by0 = min(b[1] for b in boxes)
        bx1 = max(b[2] for b in boxes)
        by1 = max(b[3] for b in boxes)
    else:
        bx0 = by0 = bx1 = by1 = 0.0

    def on_border(x, y, tol=0.3):
        return (abs(x - bx0) <= tol or abs(x - bx1) <= tol
                or abs(y - by0) <= tol or abs(y - by1) <= tol)

    def straddled(seg, others):
        """True if a closed shape covers a point strictly inside `seg`."""
        x1, y1, x2, y2 = seg
        for t in (0.25, 0.5, 0.75):
            mx, my = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            for q in others:
                if q.code in ("RV", "RP", "EV", "EP", "PV", "PP", "CV", "CP") \
                        and covers(q, mx, my):
                    return True
        return False

    candidates = []
    for i, p in enumerate(prims):
        if p.code not in ("LI", "PL", "BE"):
            continue
        ends = [(p.coords[0], p.coords[1])]
        if p.code == "BE":
            ends.append((p.coords[6], p.coords[7]))
        else:
            ends.append((p.coords[2], p.coords[3]))
        # Leads run horizontally or vertically in every FidoCad symbol;
        # diagonal strokes are decoration (arrows, ground hatching, the kinks
        # on a Zener bar) and their loose ends are not terminals.
        if p.code != "BE":
            axis_aligned = (abs(p.coords[0] - p.coords[2]) < 0.3
                            or abs(p.coords[1] - p.coords[3]) < 0.3)
            if not axis_aligned:
                continue
        others = [q for j, q in enumerate(prims) if j != i]
        free = [e for e in ends
                if not any(covers(q, e[0], e[1]) for q in others)]
        if len(free) == 1:
            candidates.extend(free)
        elif len(free) == 2 and p.code != "BE" and straddled(p.coords[:4], others):
            candidates.extend(free)

    for (ex, ey) in candidates:
        if on_border(ex, ey):
            add(ex, ey, "terminal")

    # Safety nets for symbols the rules above cannot classify.
    if not pins:
        for (ex, ey) in candidates:
            add(ex, ey, "terminal")
    if not pins:
        for i, p in enumerate(prims):
            if p.code in ("LI", "PL"):
                add(p.coords[0], p.coords[1], "terminal?")
                add(p.coords[2], p.coords[3], "terminal?")

    pins.sort(key=lambda t: (round(t[1], 3), round(t[0], 3)))
    return pins, prims


def macro_bbox(key, index):
    prims = expand_macro(key, index)
    boxes = [bbox_of(p) for p in prims]
    boxes = [b for b in boxes if b]
    if not boxes:
        return None
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


# --------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------

def cmd_libs(args):
    index, order, libdir = load_libraries()
    print("library bundle: %s\n" % libdir)
    seen = {}
    for m in order:
        seen.setdefault(m.libfile, {"name": m.library, "n": 0, "cats": []})
        e = seen[m.libfile]
        e["n"] += 1
        if m.category and m.category not in e["cats"]:
            e["cats"].append(m.category)
    for fname, prefix in LIBRARIES:
        if fname not in seen:
            continue
        e = seen[fname]
        pfx = prefix.lower() + "." if prefix else "(no prefix - bare key)"
        print("%s  [%d macros]" % (e["name"], e["n"]))
        print("  file   : %s" % fname)
        print("  keys   : %s" % pfx)
        print("  topics : %s" % ", ".join(e["cats"]))
        print()


def cmd_search(args):
    index, order, _ = load_libraries()
    terms = [t.lower() for t in args.query]
    rows = []
    for m in order:
        hay = ("%s %s %s %s" % (m.key, m.longname, m.category, m.library)).lower()
        if all(t in hay for t in terms):
            score = 0
            if any(t == m.key for t in terms):
                score -= 100
            if any(m.longname.lower().startswith(t) for t in terms):
                score -= 10
            rows.append((score, m))
    if not rows:
        print("no macro matches %r" % " ".join(args.query))
        return
    rows.sort(key=lambda r: (r[0], r[1].key))
    for _, m in rows[: args.limit]:
        print("%-28s %-42s %s / %s" % (m.key, m.longname[:42], m.library,
                                       m.category))
    if len(rows) > args.limit:
        print("... %d more (use --limit)" % (len(rows) - args.limit))


def cmd_show(args):
    index, _, _ = load_libraries()
    key = args.key.lower()
    m = index.get(key)
    if m is None:
        near = [k for k in index if key in k][:8]
        die("no macro %r%s" % (args.key,
            ("\n  did you mean: %s" % ", ".join(near)) if near else ""))
    pins, prims = macro_pins(key, index)
    bb = macro_bbox(key, index)
    print("key      : %s" % m.key)
    print("name     : %s" % m.longname)
    print("library  : %s  (%s)" % (m.library, m.libfile))
    print("category : %s" % m.category)
    if bb:
        print("extent   : x %s..%s  y %s..%s   (anchor at 100,100 -> MC x y)"
              % (fmt_num(bb[0]), fmt_num(bb[2]),
                 fmt_num(bb[1]), fmt_num(bb[3])))
        print("           relative to the anchor: dx %s..%s  dy %s..%s"
              % (fmt_num(bb[0] - 100), fmt_num(bb[2] - 100),
                 fmt_num(bb[1] - 100), fmt_num(bb[3] - 100)))
    print("pins     : %d" % len(pins))
    for i, (px, py, kind) in enumerate(pins, 1):
        print("  P%-2d  body(%s,%s)  offset(%+s,%+s)  %s"
              % (i, fmt_num(px), fmt_num(py),
                 fmt_num(px - 100), fmt_num(py - 100), kind))
    print("\nbody (%d lines):" % len(m.body))
    for line in m.body:
        print("  " + line)


def cmd_place(args):
    index, _, _ = load_libraries()
    key = args.key.lower()
    if key not in index:
        die("no macro %r (try: fcd.py search %s)" % (args.key, args.key))
    try:
        xs, ys = args.at.split(",")
        x, y = float(xs), float(ys)
    except ValueError:
        die("--at must be X,Y (e.g. --at 100,50)")
    orient = args.rot % 4
    mirror = bool(args.mirror)
    f = macro_transform(x, y, orient, mirror)

    print("MC %s %s %d %d %s" % (fmt_num(x), fmt_num(y), orient,
                                 1 if mirror else 0, key))
    if args.name or args.value:
        # The bare FCJ marker is what makes the next two TY lines the macro's
        # name and value rather than two free-standing text primitives.
        print("FCJ")
        for text, dy in ((args.name or "", -6), (args.value or "", -2)):
            print(write_text_line({
                "x": x + 2, "y": y + dy, "sizeY": 4, "sizeX": 3, "orient": 0,
                "style": 0, "layer": 0, "font": DEFAULT_FONT, "text": text}))

    pins, _ = macro_pins(key, index)
    bb = macro_bbox(key, index)
    print("\n# pins in drawing coordinates:")
    for i, (px, py, kind) in enumerate(pins, 1):
        wx, wy = f(px, py)
        print("#   P%-2d  (%s, %s)   %s" % (i, fmt_num(wx), fmt_num(wy), kind))
    if bb:
        cs = [f(bb[0], bb[1]), f(bb[2], bb[1]), f(bb[0], bb[3]), f(bb[2], bb[3])]
        ox0, ox1 = min(c[0] for c in cs), max(c[0] for c in cs)
        oy0, oy1 = min(c[1] for c in cs), max(c[1] for c in cs)
        print("# occupies x %s..%s  y %s..%s"
              % (fmt_num(ox0), fmt_num(ox1), fmt_num(oy0), fmt_num(oy1)))
        if ox0 < 0 or oy0 < 0 or min(y - 6, y - 2) < 0:
            print("# WARNING: part of this placement is at a negative "
                  "coordinate and will be clamped to 0 - move it right/down")


def read_input(path):
    if path == "-":
        return sys.stdin.read()
    if not os.path.isfile(path):
        die("no such file: %s" % path)
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def cmd_validate(args):
    text = read_input(args.file)
    lines = split_lines(text)
    d = parse_fcd(text, strict=True)
    problems = []

    if not lines or lines[0].strip() != "[FIDOCAD]":
        problems.append((1, "warn", "first line should be [FIDOCAD]"))

    for lineno, line in enumerate(lines, 1):
        if "\t" in line:
            problems.append((lineno, "error",
                             "tab character: only U+0020 separates tokens"))
        toks = [t for t in line.split(" ") if t]
        if len(toks) > 10000:
            problems.append((lineno, "error", "more than 10000 tokens"))
        if toks and toks[0] not in MIN_TOKENS \
                and toks[0] not in ("FCJ", "FJC", "[FIDOCAD]") and lineno > 1:
            problems.append((lineno, "warn",
                             "unrecognized command %r (ignored by readers)"
                             % toks[0]))
        for t in toks[1:]:
            if re.match(r"^-\d", t):
                problems.append((lineno, "error",
                                 "negative value %s: coordinates are clamped "
                                 "to 0" % t))
                break

    for lineno, msg in d.warnings:
        problems.append((lineno, "warn", msg))

    index = None
    try:
        index, _, _ = load_libraries()
    except SystemExit:
        pass

    frac = 0
    for p in d.prims:
        for v in p.coords:
            if abs(v - round(v)) > 1e-9:
                frac += 1
        if p.code == "MC" and index is not None:
            if p.extra["macro"] not in index:
                local = p.extra["macro"].split(".")[-1]
                near = []
                for cut in range(len(local), 2, -1):
                    stem = local[:cut]
                    near = sorted(k for k in index if stem in k)[:4]
                    if near:
                        break
                hint = ("; did you mean: %s" % ", ".join(near)) if near else \
                    "; run `fcd.py search <term>` to find the right key"
                problems.append((p.lineno, "error",
                                 "unknown macro %r - the MC line will be "
                                 "silently skipped%s"
                                 % (p.extra["macro"], hint)))
            if p.extra["macro"] != p.extra["macro"].lower():
                problems.append((p.lineno, "error", "macro key must be lowercase"))
        if p.code == "LI" and p.coords[0] == p.coords[2] \
                and p.coords[1] == p.coords[3] and p.name is None:
            problems.append((p.lineno, "warn",
                             "zero-length LI is dropped on save"))
        if p.code in ("PV", "PP") and len(p.coords) < 4:
            problems.append((p.lineno, "error", "polygon needs >= 2 vertices"))
        if p.code == "PA" and p.extra["style"] not in (0, 1, 2):
            problems.append((p.lineno, "error",
                             "PA style must be 0, 1 or 2"))
        if p.dash not in range(5):
            problems.append((p.lineno, "error", "dash style must be 0..4"))

    if frac:
        problems.append((0, "note",
                         "%d fractional coordinate(s): a FidoCadJS extension, "
                         "not readable by stock FidoCadJ" % frac))

    # Round-trip check: re-serializing must be idempotent.
    once = write_fcd(d)
    twice = write_fcd(parse_fcd(once))
    if once != twice:
        problems.append((0, "error", "serialization is not idempotent"))

    # The parser emits a generic "unknown or malformed command" note for the
    # same line a specific check already explained; keep only the specific one.
    specific = set(pr[0] for pr in problems
                   if not pr[2].startswith("unknown or malformed command"))
    problems = [pr for pr in problems
                if pr[0] not in specific
                or not pr[2].startswith("unknown or malformed command")]
    problems.sort(key=lambda p: (p[0], p[1]))
    errs = sum(1 for p in problems if p[1] == "error")
    for lineno, sev, msg in problems:
        loc = ("line %d" % lineno) if lineno else "file"
        print("%-7s %-9s %s" % (sev.upper(), loc, msg))
    print("\n%d primitive(s), %d error(s), %d other note(s)"
          % (len(d.prims), errs, len(problems) - errs))
    if args.fix:
        out = write_fcd(d)
        if args.file != "-":
            with open(args.file, "w", encoding="utf-8") as fh:
                fh.write(out)
            print("rewrote %s in canonical form" % args.file)
        else:
            sys.stdout.write(out)
    sys.exit(1 if errs else 0)


def text_bbox(t):
    """Approximate the box a TY occupies - monospace-ish, sizeX per glyph."""
    w = t["sizeX"] * max(1, len(t["text"]))
    h = t["sizeY"]
    if t["orient"] % 180 == 0:
        return (t["x"], t["y"], t["x"] + w, t["y"] + h)
    return (t["x"] - h, t["y"] - w, t["x"] + h, t["y"] + w)


def drawing_bbox(d, index):
    boxes = []
    for p in d.prims:
        for label in (p.name, p.value, p.text):
            if label and label.get("text"):
                boxes.append(text_bbox(label))
        if p.code == "MC" and index is not None:
            bb = macro_bbox(p.extra["macro"], index)
            if bb:
                f = macro_transform(p.coords[0], p.coords[1],
                                    p.extra["orient"], p.extra["mirror"])
                cs = [f(bb[0], bb[1]), f(bb[2], bb[1]),
                      f(bb[0], bb[3]), f(bb[2], bb[3])]
                boxes.append((min(c[0] for c in cs), min(c[1] for c in cs),
                              max(c[0] for c in cs), max(c[1] for c in cs)))
                continue
            boxes.append((p.coords[0], p.coords[1], p.coords[0], p.coords[1]))
            continue
        bb = bbox_of(p)
        if bb:
            boxes.append(bb)
    if not boxes:
        return (0, 0, 0, 0)
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def cmd_info(args):
    text = read_input(args.file)
    d = parse_fcd(text)
    try:
        index, _, _ = load_libraries()
    except SystemExit:
        index = None

    counts = {}
    layers = {}
    for p in d.prims:
        counts[p.code] = counts.get(p.code, 0) + 1
        layers.setdefault(p.layer, 0)
        layers[p.layer] += 1

    bb = drawing_bbox(d, index)
    print("file      : %s" % args.file)
    print("primitives: %d  (%s)" % (len(d.prims), ", ".join(
        "%s x%d" % (k, v) for k, v in sorted(counts.items()))))
    print("extent    : x %s..%s  y %s..%s"
          % (fmt_num(bb[0]), fmt_num(bb[2]), fmt_num(bb[1]), fmt_num(bb[3])))
    print("layers    : %s" % ", ".join(
        "%d %s (%d)" % (k, d.config["layerNames"].get(
            k, LAYER_NAMES[k] if k < len(LAYER_NAMES) else "?"), v)
        for k, v in sorted(layers.items())))
    cfg = []
    if d.config["diameterConnection"] != 2.0:
        cfg.append("connection dia %s" % fmt_num(d.config["diameterConnection"]))
    if d.config["lineWidth"] != 0.5:
        cfg.append("line width %s" % fmt_num(d.config["lineWidth"]))
    if d.config["lineWidthCircles"] != 0.35:
        cfg.append("circle width %s" % fmt_num(d.config["lineWidthCircles"]))
    if cfg:
        print("config    : %s" % "; ".join(cfg))

    macs = [p for p in d.prims if p.code == "MC"]
    if macs:
        print("\ncomponents (%d):" % len(macs))
        for p in macs:
            m = index.get(p.extra["macro"]) if index else None
            label = m.longname if m else "*** UNKNOWN MACRO ***"
            ref = p.name["text"] if p.name else "-"
            val = p.value["text"] if p.value else ""
            rot = "  rot %d%s" % (p.extra["orient"] * 90,
                                  " mirrored" if p.extra["mirror"] else "")
            print("  %-6s %-14s at (%s,%s)%s  %s %s"
                  % (ref, val, fmt_num(p.coords[0]), fmt_num(p.coords[1]),
                     rot, p.extra["macro"], "- " + label))

    texts = [p for p in d.prims if p.code in ("TY", "TE") and p.text]
    if texts:
        print("\ntext (%d):" % len(texts))
        for p in texts:
            print("  (%s,%s) L%d  %r" % (fmt_num(p.coords[0]),
                                         fmt_num(p.coords[1]), p.layer,
                                         p.text["text"]))
    if args.nets and index is not None:
        print_nets(d, index)
    if d.warnings:
        print("\nparse warnings:")
        for lineno, msg in d.warnings:
            print("  line %d: %s" % (lineno, msg))


class UF(object):
    def __init__(self):
        self.p = {}

    def find(self, a):
        self.p.setdefault(a, a)
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[ra] = rb


def print_nets(d, index):
    """Trace connectivity: wires (LI/PL) joining macro pins and SA dots."""
    uf = UF()
    wires = [p for p in d.prims if p.code in ("LI", "PL")]
    terminals = []   # (point, label)

    for i, p in enumerate(d.prims):
        if p.code != "MC":
            continue
        pins, _ = macro_pins(p.extra["macro"], index)
        f = macro_transform(p.coords[0], p.coords[1],
                            p.extra["orient"], p.extra["mirror"])
        ref = p.name["text"] if p.name else ("?%d" % i)
        for n, (px, py, _k) in enumerate(pins, 1):
            wx, wy = f(px, py)
            terminals.append(((round(wx, 2), round(wy, 2)),
                              "%s.P%d" % (ref, n)))
    for p in d.prims:
        if p.code == "SA":
            terminals.append(((round(p.coords[0], 2), round(p.coords[1], 2)),
                              "node"))

    nodes = [t[0] for t in terminals]
    for w in wires:
        a = (round(w.coords[0], 2), round(w.coords[1], 2))
        b = (round(w.coords[2], 2), round(w.coords[3], 2))
        uf.union(a, b)
        nodes.extend([a, b])
        for pt in list(nodes):
            if dist_point_seg(pt[0], pt[1], w.coords[0], w.coords[1],
                              w.coords[2], w.coords[3]) <= 0.3:
                uf.union(pt, a)

    groups = {}
    for pt, label in terminals:
        groups.setdefault(uf.find(pt), []).append((label, pt))
    print("\nnets (%d):" % len(groups))
    for n, (_root, members) in enumerate(sorted(
            groups.items(), key=lambda kv: sorted(m[0] for m in kv[1])), 1):
        labels = sorted(set(m[0] for m in members))
        print("  N%-3d %s" % (n, ", ".join(labels)))


# --------------------------------------------------------------------------
# SVG rendering
# --------------------------------------------------------------------------

def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def layer_style(d, layer, fill=False, width=None):
    rgba = d.config["layerColors"].get(layer)
    if rgba:
        r, g, b, a = rgba
    else:
        idx = layer if layer < len(LAYER_COLORS) else 0
        r, g, b = LAYER_COLORS[idx]
        a = LAYER_ALPHA[idx]
    col = "#%02x%02x%02x" % (r, g, b)
    if fill:
        return 'fill="%s" fill-opacity="%s" stroke="none"' % (col, a)
    w = width if width is not None else d.config["lineWidth"]
    return ('fill="none" stroke="%s" stroke-opacity="%s" stroke-width="%s" '
            'stroke-linecap="round"' % (col, a, fmt_num(w)))


def dash_attr(dash):
    pat = DASH_PATTERNS[dash] if 0 <= dash < len(DASH_PATTERNS) else None
    return ' stroke-dasharray="%s"' % pat if pat else ""


def svg_prims(d, prims, out, index, depth=0):
    for p in prims:
        c = p.coords
        code = p.code
        if code == "MC":
            if index is None or depth > MAX_MACRO_DEPTH:
                continue
            inner = expand_macro(p.extra["macro"], index)
            f = macro_transform(c[0], c[1], p.extra["orient"],
                                p.extra["mirror"])
            moved = []
            for q in inner:
                r = Prim(q.code, q.lineno, q.raw)
                r.layer = q.layer
                r.extra = dict(q.extra)
                r.fcj = q.fcj
                r.text = dict(q.text) if q.text else None
                r.coords = []
                for i in range(0, len(q.coords) - 1, 2):
                    nx, ny = f(q.coords[i], q.coords[i + 1])
                    r.coords.extend([nx, ny])
                if r.text:
                    r.text["x"], r.text["y"] = r.coords[0], r.coords[1]
                moved.append(r)
            svg_prims(d, moved, out, index, depth + 1)
        elif code == "LI":
            out.append('<line x1="%s" y1="%s" x2="%s" y2="%s" %s%s/>' % (
                fmt_num(c[0]), fmt_num(c[1]), fmt_num(c[2]), fmt_num(c[3]),
                layer_style(d, p.layer), dash_attr(p.dash)))
        elif code == "PL":
            out.append('<line x1="%s" y1="%s" x2="%s" y2="%s" %s/>' % (
                fmt_num(c[0]), fmt_num(c[1]), fmt_num(c[2]), fmt_num(c[3]),
                layer_style(d, p.layer, width=p.extra["width"])))
        elif code == "BE":
            out.append('<path d="M %s %s C %s %s %s %s %s %s" %s%s/>' % (
                fmt_num(c[0]), fmt_num(c[1]), fmt_num(c[2]), fmt_num(c[3]),
                fmt_num(c[4]), fmt_num(c[5]), fmt_num(c[6]), fmt_num(c[7]),
                layer_style(d, p.layer), dash_attr(p.dash)))
        elif code in ("RV", "RP"):
            x, y = min(c[0], c[2]), min(c[1], c[3])
            w, h = abs(c[2] - c[0]), abs(c[3] - c[1])
            out.append('<rect x="%s" y="%s" width="%s" height="%s" %s%s/>' % (
                fmt_num(x), fmt_num(y), fmt_num(w), fmt_num(h),
                layer_style(d, p.layer, fill=(code == "RP")),
                dash_attr(p.dash)))
        elif code in ("EV", "EP"):
            cx, cy = (c[0] + c[2]) / 2.0, (c[1] + c[3]) / 2.0
            rx, ry = abs(c[2] - c[0]) / 2.0, abs(c[3] - c[1]) / 2.0
            out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" %s%s/>' % (
                fmt_num(cx), fmt_num(cy), fmt_num(rx), fmt_num(ry),
                layer_style(d, p.layer, fill=(code == "EP"),
                            width=d.config["lineWidthCircles"]),
                dash_attr(p.dash)))
        elif code in ("PV", "PP", "CV", "CP"):
            pts = " ".join("%s,%s" % (fmt_num(x), fmt_num(y))
                           for x, y in p.points())
            tag = "polygon" if code in ("PP", "PV") or p.extra.get("closed") \
                else "polyline"
            out.append('<%s points="%s" %s%s/>' % (
                tag, pts, layer_style(d, p.layer,
                                      fill=(code in ("PP", "CP"))),
                dash_attr(p.dash)))
        elif code == "SA":
            r = d.config["diameterConnection"] / 2.0
            out.append('<circle cx="%s" cy="%s" r="%s" %s/>' % (
                fmt_num(c[0]), fmt_num(c[1]), fmt_num(r),
                layer_style(d, p.layer, fill=True)))
        elif code == "PA":
            e = p.extra
            if e["style"] == 0:
                out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" %s/>' % (
                    fmt_num(c[0]), fmt_num(c[1]), fmt_num(e["rx"] / 2.0),
                    fmt_num(e["ry"] / 2.0), layer_style(d, p.layer, fill=True)))
            else:
                rr = ' rx="%s"' % fmt_num(min(e["rx"], e["ry"]) / 4.0) \
                    if e["style"] == 2 else ""
                out.append('<rect x="%s" y="%s" width="%s" height="%s"%s %s/>'
                           % (fmt_num(c[0] - e["rx"] / 2.0),
                              fmt_num(c[1] - e["ry"] / 2.0),
                              fmt_num(e["rx"]), fmt_num(e["ry"]), rr,
                              layer_style(d, p.layer, fill=True)))
            if e["ri"] > 0:
                out.append('<circle cx="%s" cy="%s" r="%s" fill="#ffffff"/>'
                           % (fmt_num(c[0]), fmt_num(c[1]),
                              fmt_num(e["ri"] / 2.0)))
        elif code in ("TY", "TE") and p.text:
            svg_text(d, p.text, out)

        for label in (p.name, p.value):
            if label is not None:
                svg_text(d, label, out)


def svg_text(d, t, out):
    tr = []
    if t["orient"]:
        tr.append("rotate(%s %s %s)" % (fmt_num(-t["orient"]),
                                        fmt_num(t["x"]), fmt_num(t["y"])))
    if t["style"] & 4:
        tr.append("translate(%s 0) scale(-1 1)" % fmt_num(2 * t["x"]))
    attrs = 'x="%s" y="%s" font-size="%s" font-family="%s"' % (
        fmt_num(t["x"]), fmt_num(t["y"] + t["sizeY"]), fmt_num(t["sizeY"]),
        esc(t["font"]))
    if t["style"] & 1:
        attrs += ' font-weight="bold"'
    if t["style"] & 2:
        attrs += ' font-style="italic"'
    if t["sizeX"] and t["sizeY"]:
        attrs += ' textLength="%s" lengthAdjust="spacingAndGlyphs"' % \
            fmt_num(t["sizeX"] * len(t["text"]))
    if tr:
        attrs += ' transform="%s"' % " ".join(tr)
    out.append('<text %s %s>%s</text>'
               % (attrs, layer_style(d, t["layer"], fill=True),
                  esc(t["text"])))


def cmd_render(args):
    text = read_input(args.file)
    d = parse_fcd(text)
    try:
        index, _, _ = load_libraries()
    except SystemExit:
        index = None

    bb = drawing_bbox(d, index)
    pad = args.pad
    x0, y0 = bb[0] - pad, bb[1] - pad
    w = max(1.0, bb[2] - bb[0] + 2 * pad)
    h = max(1.0, bb[3] - bb[1] + 2 * pad)
    s = args.scale

    body = []
    svg_prims(d, d.prims, body, index)

    out = [
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" '
        'width="%s" height="%s" viewBox="%s %s %s %s">'
        % (fmt_num(w * s), fmt_num(h * s), fmt_num(x0), fmt_num(y0),
           fmt_num(w), fmt_num(h)),
        '<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>'
        % (fmt_num(x0), fmt_num(y0), fmt_num(w), fmt_num(h), args.background),
    ]
    out.extend(body)
    out.append("</svg>")
    svg = "\n".join(out) + "\n"

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(svg)
        sys.stderr.write("wrote %s (%s x %s px)\n"
                         % (args.out, fmt_num(w * s), fmt_num(h * s)))
    else:
        sys.stdout.write(svg)


def cmd_normalize(args):
    text = read_input(args.file)
    d = parse_fcd(text)
    out = write_fcd(d, extensions=not args.no_extensions)
    if args.in_place and args.file != "-":
        with open(args.file, "w", encoding="utf-8") as fh:
            fh.write(out)
        sys.stderr.write("rewrote %s\n" % args.file)
    else:
        sys.stdout.write(out)


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        prog="fcd.py",
        description="Read and write FidoCadJ .fcd drawings.")
    sub = ap.add_subparsers(dest="cmd")

    p = sub.add_parser("libs", help="list the bundled macro libraries")
    p.set_defaults(func=cmd_libs)

    p = sub.add_parser("search", help="find macros by key, name or category")
    p.add_argument("query", nargs="+")
    p.add_argument("--limit", type=int, default=30)
    p.set_defaults(func=cmd_search)

    p = sub.add_parser("show", help="show a macro's body, extent and pins")
    p.add_argument("key")
    p.set_defaults(func=cmd_show)

    p = sub.add_parser(
        "place", help="emit an MC line and the resulting pin coordinates")
    p.add_argument("key")
    p.add_argument("--at", required=True, metavar="X,Y")
    p.add_argument("--rot", type=int, default=0,
                   help="0..3, in 90 degree steps")
    p.add_argument("--mirror", action="store_true")
    p.add_argument("--name", help="reference designator, e.g. R1")
    p.add_argument("--value", help="value, e.g. 10k")
    p.set_defaults(func=cmd_place)

    p = sub.add_parser("validate", help="lint a drawing")
    p.add_argument("file")
    p.add_argument("--fix", action="store_true",
                   help="rewrite the file in canonical form")
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("info", help="summarize a drawing")
    p.add_argument("file")
    p.add_argument("--nets", action="store_true",
                   help="also trace connectivity between component pins")
    p.set_defaults(func=cmd_info)

    p = sub.add_parser("render", help="render a drawing to SVG")
    p.add_argument("file")
    p.add_argument("-o", "--out")
    p.add_argument("--scale", type=float, default=4.0)
    p.add_argument("--pad", type=float, default=5.0)
    p.add_argument("--background", default="#ffffff")
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("normalize",
                       help="reparse and re-serialize in canonical form")
    p.add_argument("file")
    p.add_argument("--in-place", action="store_true")
    p.add_argument("--no-extensions", action="store_true",
                   help="omit FJC/FCJ lines for original-FidoCAD compatibility")
    p.set_defaults(func=cmd_normalize)

    args = ap.parse_args()
    if not getattr(args, "func", None):
        ap.print_help()
        sys.exit(2)
    args.func(args)


if __name__ == "__main__":
    main()
