---
name: fidocad
description: Read, write, validate and render FidoCad / FidoCadJ circuit drawings (.fcd) and macro libraries (.fcl). Use whenever a schematic or PCB drawing in the FidoCad text format must be understood, authored, edited, checked, or turned into a picture - including finding the right library symbol for a component and working out where its pins land once placed.
---

# FidoCad circuits

An `.fcd` drawing is plain text, one command per line, tokens separated by
**single spaces**. Each line either declares a primitive, attaches attributes
to the previous primitive (`FCJ`, `TY`), or sets global config (`FJC`).

```
[FIDOCAD]
MC 60 30 1 0 080          <- a resistor from the standard library
FCJ                       <- marker: the next two TY lines are its labels
TY 66 34 4 3 0 0 0 * R1
TY 66 38 4 3 0 0 0 * 100k
LI 60 40 60 70 0          <- a wire
SA 60 45 0                <- a junction dot
```

`scripts/fcd.py` does the mechanical work. Use it rather than reasoning about
coordinates by hand — **never guess a macro key or a pin location.**

```bash
FCD=<skill dir>/scripts/fcd.py     # resolve once, reuse below
python3 "$FCD" --help
```

## Reading a drawing

```bash
python3 "$FCD" info circuit.fcd --nets    # summary + traced connectivity
python3 "$FCD" render circuit.fcd -o /tmp/c.svg   # look at it
```

`info` resolves every `MC` to its real component name and reference designator;
`--nets` walks the wires and reports which component pins share a node. Read
that before answering any question about what a circuit *does*. When a rendered
picture would help, convert the SVG to PNG with
`qlmanage -t -s 900 -o <dir> /tmp/c.svg` and view it.

## Writing a drawing

Work in this order. Skipping step 2 is the main source of broken drawings.

**1. Find the symbols.** The bundled libraries hold ~950 macros.

```bash
python3 "$FCD" search resistor          # by name, key or category
python3 "$FCD" search npn transistor
python3 "$FCD" libs                     # what libraries exist, and their prefixes
```

Standard-library macros are referenced by bare key (`080`, `280`). Every other
library uses a lowercase `prefix.key` (`ihram.res`, `pcb.dil08`). Macro keys in
an `MC` line **must be lowercase**; an unknown key is silently dropped by
readers, so a typo produces a missing component rather than an error.

**2. Place each part and record where its pins land.**

```bash
python3 "$FCD" place 080 --at 60,30 --rot 1 --name R1 --value 100k
```

This prints the `MC` + `FCJ` + `TY` lines to paste into the file, **and** the
drawing coordinates of every pin after rotation and mirroring. Route wires to
those numbers. `--rot` is 0–3 in 90° steps; add `--mirror` to flip.

Use `show <key>` to inspect a symbol before committing to it — it prints the
body, the extent, and the pin offsets relative to the anchor.

**3. Wire it.** A wire is a plain `LI` on layer 0 between two pin coordinates.
Keep runs orthogonal: go horizontal then vertical, never diagonal. Where three
or more wires meet, add `SA x y 0` — without it the crossing reads as two
unconnected wires.

**4. Validate, then look at it.**

```bash
python3 "$FCD" validate circuit.fcd     # exits non-zero on real errors
python3 "$FCD" render circuit.fcd -o /tmp/c.svg
```

`validate` catches unknown macros, negative coordinates, tabs, bad pad styles,
malformed lines, and non-idempotent serialization. Always render and actually
look at the result before calling a drawing finished — a file can be perfectly
valid and still be a nonsense schematic.

## The rules that bite

- **Coordinates are non-negative.** Anything negative is clamped to `0` on
  read, silently deforming the drawing. Origin is top-left, y grows *down*.
- **Only `U+0020` separates tokens.** A tab breaks the line.
- **`MC x y` puts the macro's anchor there.** Inside a macro body the anchor is
  the point `(100,100)`, so a body coordinate `(bx,by)` lands at
  `(x + bx-100, y + by-100)` when unrotated. `place` does this for you.
- **A `TY` line is a label only when an `FCJ` line precedes it.** With no `FCJ`
  it is a free-standing text primitive. `MC`/`SA`/`PL`/`PA` use a *bare* `FCJ`
  with no arguments as that marker; `LI`/`BE`/`RV`/`EV`/`PV`/`CV` put the
  marker in the last field of their own `FCJ` (`... 1`). Name and value are
  always written as a pair.
- **Layer 0 is the schematic layer.** 1 = bottom copper, 2 = top copper,
  3 = silkscreen. Use `PL` (track) and `PA` (pad) for PCB work, `LI` for
  schematic wires.
- Snap everything to integers. Fractional coordinates are a FidoCadJS
  extension that stock FidoCadJ cannot read.

## Editing an existing drawing

Append or edit lines directly — the format is line-oriented and order is
document order. `python3 "$FCD" normalize file.fcd --in-place` reparses and
rewrites in canonical form (this upgrades legacy `TE` to `TY`, drops
no-op primitives, and normalizes number formatting). Re-run `validate` after
any hand edit.

## Reference

- `references/format.md` — the complete FCD/FCL specification: every
  instruction code, argument shape, the `FCJ`/`FJC` extensions, macro library
  syntax, and the writer's serialization rules. Read it when you need a
  primitive this file does not cover, or when implementing a parser/writer.
- `references/authoring.md` — drawing conventions: grid sizing, symbol
  geometry, layout and routing patterns, arrows, dashes, text styling, and
  worked examples.
- `scripts/fcd.py` — `libs`, `search`, `show`, `place`, `info`, `validate`,
  `render`, `normalize`. Every subcommand takes `--help`.

The libraries are read from the FidoCadJS checkout the skill lives in; set
`FIDOCAD_LIB_DIR` to override if the `.fcl` files are elsewhere.
