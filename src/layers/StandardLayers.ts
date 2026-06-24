import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';
import { LayerDesc } from './LayerDesc.js';
import { getString } from '../i18n/i18n.js';

// Layer colors decoded from Java's StandardLayers.java packed-int Color values.
// Each tuple is [r, g, b, alpha].
const LAYER_DEFAULTS: [number, number, number, number][] = [
    [0, 0, 0, 1.0], // 0  Circuit (black)
    [0, 0, 128, 1.0], // 1  Bottom copper (navy)
    [255, 0, 0, 1.0], // 2  Top copper (red)
    [0, 128, 128, 1.0], // 3  Silkscreen (teal)
    [255, 200, 0, 1.0], // 4  Other 1 (orange)
    [127, 255, 0, 1.0], // 5  Other 2 (chartreuse) -8388864
    [0, 255, 255, 1.0], // 6  Other 3 (cyan) -16711681
    [0, 128, 0, 1.0], // 7  Other 4 (dark green) -16744448
    [154, 205, 50, 1.0], // 8  Other 5 (yellow-green) -6632142
    [255, 20, 147, 1.0], // 9  Other 6 (deep pink) -60269
    [181, 155, 12, 1.0], // 10 Other 7 (olive) -4875508
    [1, 128, 255, 1.0], // 11 Other 8 (medium blue) -16678657
    [225, 225, 225, 0.95], // 12 Other 9 (light gray) -1973791
    [162, 162, 162, 0.9], // 13 Other 10 (medium gray) -6118750
    [95, 95, 95, 0.9], // 14 Other 11 (dark gray) -10526881
    [0, 0, 0, 1.0], // 15 Other 12 (black)
];

const LAYER_KEYS = [
    'Circuit_l',
    'Bottom_copper',
    'Top_copper',
    'Silkscreen',
    'Other_1',
    'Other_2',
    'Other_3',
    'Other_4',
    'Other_5',
    'Other_6',
    'Other_7',
    'Other_8',
    'Other_9',
    'Other_10',
    'Other_11',
    'Other_12',
];

export function createStandardLayers(): LayerDesc[] {
    return LAYER_DEFAULTS.map(
        ([r, g, b, a], i) =>
            new LayerDesc(new ColorCanvas(r, g, b), true, getString(LAYER_KEYS[i] ?? ''), a),
    );
}

export function createEditingLayerArray(): LayerDesc[] {
    return [new LayerDesc(new ColorCanvas(0, 255, 0), true, '', 1.0)];
}
