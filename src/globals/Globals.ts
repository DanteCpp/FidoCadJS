export class Globals {
    static readonly lineWidthDefault = 0.5;
    static lineWidth = Globals.lineWidthDefault;

    static readonly lineWidthCirclesDefault = 0.35;
    static lineWidthCircles = Globals.lineWidthCirclesDefault;

    static readonly diameterConnectionDefault = 2.0;
    static diameterConnection = Globals.diameterConnectionDefault;

    static readonly version = '0.24.9 gamma';
    static readonly isBeta = true;

    static readonly DEFAULT_EXTENSION = 'fcd';
    static readonly defaultTextFont = 'Courier New';

    static readonly dashNumber = 5;
    // Dash style patterns: [dash length, gap length, ...]  (0 gap = solid)
    static readonly dash: number[][] = [
        [10, 0],
        [5, 5],
        [2, 2],
        [2, 5],
        [2, 5, 5, 5],
    ];

    static readonly textSizeLimit = 4;
    static readonly maxZoomFactor = 4000;
    static readonly minZoomFactor = 10;

    static prettifyPath(s: string, len: number): string {
        const l = Math.max(len, 10);
        if (s.length < l) return s;
        return s.substring(0, l / 2 - 5) + '...  ' + s.substring(s.length - l / 2);
    }

    static adjustExtension(p: string, ext: string): string {
        const s = p.replace(/"/g, '');
        const dot = s.lastIndexOf('.');
        const sep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (dot > sep && dot >= 0) {
            return s.substring(0, dot) + '.' + ext;
        }
        return s + '.' + ext;
    }

    static checkExtension(p: string, ext: string): boolean {
        const s = p.replace(/"/g, '');
        const dot = s.lastIndexOf('.');
        const sep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (dot > sep && dot >= 0) {
            return s.substring(dot + 1) === ext;
        }
        return false;
    }

    static getFileNameOnly(s: string): string {
        const sep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        const dot = s.lastIndexOf('.');
        const start = sep >= 0 ? sep + 1 : 0;
        const end = dot >= 0 ? dot : s.length;
        return s.substring(start, end);
    }

    static roundTo(n: number, ch?: number): string {
        if (ch !== undefined) {
            return String(Math.trunc(n * 10 ** ch) / 10 ** ch);
        }
        return String(Math.round(n * 100) / 100);
    }

    static substituteBizarreChars(p: string, bc: Map<string, string>): string {
        const parts: string[] = [];
        for (const ch of p) {
            parts.push(bc.get(ch) ?? ch);
        }
        return parts.join('');
    }

    private constructor() {}
}
