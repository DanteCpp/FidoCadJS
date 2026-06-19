# Minimal FidoCad Drawing Format

A FidoCad drawing is a UTF-8 plain-text file made of one command per line. Each command is split into tokens using spaces.

A file should start with:

```fidocad id="yfxuky"
[FIDOCAD]
```

Example:

```fidocad id="uf5p6s"
[FIDOCAD]
LI 10 10 80 10 0
RV 20 20 80 60 0
TY 25 70 4 3 0 0 0 * Hello
```

## Coordinates

Coordinates are non-negative integers.

The origin is at the top-left. The x axis grows to the right, and the y axis grows downward.

Floating-point numbers are not used.

## Layers

Each drawable primitive ends with a layer number.

Layers are integers from `0` to `15`. Use layer `0` by default.

## Commands

### Line

```fidocad id="yqegrt"
LI x1 y1 x2 y2 layer
```

Draws a line from `(x1,y1)` to `(x2,y2)`.

Example:

```fidocad id="n1e0zs"
LI 10 10 80 10 0
```

### Rectangle

```fidocad id="6ep1xr"
RV x1 y1 x2 y2 layer
RP x1 y1 x2 y2 layer
```

`RV` draws an outline rectangle.
`RP` draws a filled rectangle.

Example:

```fidocad id="rb2qik"
RV 20 20 80 60 0
```

### Ellipse

```fidocad id="hq8o26"
EV x1 y1 x2 y2 layer
EP x1 y1 x2 y2 layer
```

`EV` draws an outline ellipse.
`EP` draws a filled ellipse.

The ellipse is drawn inside the bounding box from `(x1,y1)` to `(x2,y2)`.

Example:

```fidocad id="6lvi3d"
EV 20 20 80 60 0
```

### Polygon

```fidocad id="udip6y"
PV x1 y1 x2 y2 ... xn yn layer
PP x1 y1 x2 y2 ... xn yn layer
```

`PV` draws an outline polygon.
`PP` draws a filled polygon.

The last number is the layer.

Example:

```fidocad id="qev4dg"
PV 20 60 50 25 80 60 0
```

### Text

```fidocad id="jnt08x"
TY x y sizeY sizeX orientation style layer font text
```

Fields:

```text id="b3a0re"
x y          text position
sizeY sizeX  text size
orientation  rotation in degrees
style        0 plain, 1 bold, 2 italic, 3 bold italic
layer        layer number
font         font name, or * for the default font
text         remaining text on the line
```

Example:

```fidocad id="3yblf8"
TY 20 80 4 3 0 0 0 * Hello world
```

A simpler legacy text form is also allowed:

```fidocad id="h14d3o"
TE x y text
```

Example:

```fidocad id="8lqmx0"
TE 20 80 Hello world
```

## Grammar

```text id="5olwzp"
file        ::= "[FIDOCAD]"? command*

command     ::= line
              | rectangle
              | ellipse
              | polygon
              | text

line        ::= "LI" int int int int layer

rectangle   ::= ("RV" | "RP") int int int int layer

ellipse     ::= ("EV" | "EP") int int int int layer

polygon     ::= ("PV" | "PP") point point point* layer

text        ::= "TY" int int int int int int layer font text
              | "TE" int int text

point       ::= int int
layer       ::= int
font        ::= "*" | font_name
text        ::= remaining characters on the line
```

## Complete example

```fidocad id="9r9a6e"
[FIDOCAD]
PV 20 60 50 25 80 60 0
RV 25 60 75 105 0
RV 45 80 55 105 0
RV 32 70 42 82 0
RV 58 70 68 82 0
LI 10 105 90 105 0
TY 28 112 4 3 0 0 0 * Little house
```
