export class MapCoordinates {
    private xCenter: number = 0;
    private yCenter: number = 0;
    private xMagnitude: number = 1;
    private yMagnitude: number = 1;
    private orientation: number = 0;
    mirror: boolean = false;
    isMacro: boolean = false;
    private snapActive: boolean = true;
    private xGridStep: number = 5;
    private yGridStep: number = 5;

    private xMin: number = Number.MAX_SAFE_INTEGER;
    private xMax: number = Number.MIN_SAFE_INTEGER;
    private yMin: number = Number.MAX_SAFE_INTEGER;
    private yMax: number = Number.MIN_SAFE_INTEGER;

    private readonly stack: MapCoordinates[] = [];

    static readonly MIN_MAGNITUDE = 0.25;
    static readonly MAX_MAGNITUDE = 100.0;

    resetMinMax(): void {
        this.xMin = Number.MAX_SAFE_INTEGER;
        this.yMin = Number.MAX_SAFE_INTEGER;
        this.xMax = Number.MIN_SAFE_INTEGER;
        this.yMax = Number.MIN_SAFE_INTEGER;
    }

    setOrientation(o: number): void {
        this.orientation = Math.max(0, Math.min(3, o));
    }
    getOrientation(): number { return this.orientation; }
    getMirror(): boolean { return this.mirror; }

    push(): void {
        const m = new MapCoordinates();
        m.xCenter = this.xCenter;
        m.yCenter = this.yCenter;
        m.xMagnitude = this.xMagnitude;
        m.yMagnitude = this.yMagnitude;
        m.orientation = this.orientation;
        m.mirror = this.mirror;
        m.isMacro = this.isMacro;
        m.snapActive = this.snapActive;
        m.xMin = this.xMin;
        m.xMax = this.xMax;
        m.yMin = this.yMin;
        m.yMax = this.yMax;
        m.xGridStep = this.xGridStep;
        m.yGridStep = this.yGridStep;
        this.stack.unshift(m);
    }

    pop(): void {
        if (this.stack.length === 0) {
            console.warn('MapCoordinates: cannot pop from empty stack');
            return;
        }
        const m = this.stack.shift()!;
        this.xCenter = m.xCenter;
        this.yCenter = m.yCenter;
        this.xMagnitude = m.xMagnitude;
        this.yMagnitude = m.yMagnitude;
        this.orientation = m.orientation;
        this.mirror = m.mirror;
        this.isMacro = m.isMacro;
        this.snapActive = m.snapActive;
        this.xMin = m.xMin;
        this.xMax = m.xMax;
        this.yMin = m.yMin;
        this.yMax = m.yMax;
        this.xGridStep = m.xGridStep;
        this.yGridStep = m.yGridStep;
    }

    setSnap(s: boolean): void { this.snapActive = s; }
    getSnap(): boolean { return this.snapActive; }
    setXGridStep(xg: number): void { if (xg > 0) this.xGridStep = xg; }
    setYGridStep(yg: number): void { if (yg > 0) this.yGridStep = yg; }
    getXGridStep(): number { return this.xGridStep; }
    getYGridStep(): number { return this.yGridStep; }

    getXMagnitude(): number { return this.xMagnitude; }
    getYMagnitude(): number { return this.yMagnitude; }

    setXMagnitude(xm: number): void {
        const v = Math.abs(xm);
        this.xMagnitude = Math.max(MapCoordinates.MIN_MAGNITUDE, Math.min(MapCoordinates.MAX_MAGNITUDE, v));
    }
    setYMagnitude(ym: number): void {
        const v = Math.abs(ym);
        this.yMagnitude = Math.max(MapCoordinates.MIN_MAGNITUDE, Math.min(MapCoordinates.MAX_MAGNITUDE, v));
    }
    setXMagnitudeNoCheck(xm: number): void { this.xMagnitude = xm; }
    setYMagnitudeNoCheck(ym: number): void { this.yMagnitude = ym; }

    setMagnitudes(xm: number, ym: number): void { this.setXMagnitude(xm); this.setYMagnitude(ym); }
    setMagnitudesNoCheck(xm: number, ym: number): void { this.setXMagnitudeNoCheck(xm); this.setYMagnitudeNoCheck(ym); }

    getXCenter(): number { return this.xCenter; }
    getYCenter(): number { return this.yCenter; }
    setXCenter(xm: number): void { this.xCenter = xm; }
    setYCenter(ym: number): void { this.yCenter = ym; }

    getXMax(): number { return this.xMax; }
    getYMax(): number { return this.yMax; }
    getXMin(): number { return this.xMin; }
    getYMin(): number { return this.yMin; }

    mapX(xc: number, yc: number): number { return this.mapXi(xc, yc, true); }

    mapXi(xc: number, yc: number, track: boolean): number {
        const v = Math.round(this.mapXr(xc, yc));
        if (track) {
            if (v < this.xMin) this.xMin = v;
            if (v > this.xMax) this.xMax = v;
        }
        return v;
    }

    mapXr(txc: number, tyc: number): number {
        let xc = txc;
        let yc = tyc;
        let vx: number;
        if (this.isMacro) {
            xc -= 100;
            yc -= 100;
            if (this.mirror) {
                switch (this.orientation) {
                    case 0: vx = -xc * this.xMagnitude; break;
                    case 1: vx = yc * this.yMagnitude; break;
                    case 2: vx = xc * this.xMagnitude; break;
                    case 3: vx = -yc * this.yMagnitude; break;
                    default: vx = -xc * this.xMagnitude; break;
                }
            } else {
                switch (this.orientation) {
                    case 0: vx = xc * this.xMagnitude; break;
                    case 1: vx = -yc * this.yMagnitude; break;
                    case 2: vx = -xc * this.xMagnitude; break;
                    case 3: vx = yc * this.yMagnitude; break;
                    default: vx = xc * this.xMagnitude; break;
                }
            }
        } else {
            vx = xc * this.xMagnitude;
        }
        return vx + this.xCenter;
    }

    mapY(xc: number, yc: number): number { return this.mapYi(xc, yc, true); }

    mapYi(xc: number, yc: number, track: boolean): number {
        const v = Math.round(this.mapYr(xc, yc));
        if (track) {
            if (v < this.yMin) this.yMin = v;
            if (v > this.yMax) this.yMax = v;
        }
        return v;
    }

    mapYr(txc: number, tyc: number): number {
        let xc = txc;
        let yc = tyc;
        let vy: number;
        if (this.isMacro) {
            xc -= 100;
            yc -= 100;
            switch (this.orientation) {
                case 0: vy = yc * this.yMagnitude; break;
                case 1: vy = xc * this.xMagnitude; break;
                case 2: vy = -yc * this.yMagnitude; break;
                case 3: vy = -xc * this.xMagnitude; break;
                default: vy = 0; break;
            }
        } else {
            vy = yc * this.yMagnitude;
        }
        return vy + this.yCenter;
    }

    trackPoint(xp: number, yp: number): void {
        if (yp < this.yMin) this.yMin = Math.floor(yp);
        if (yp > this.yMax) this.yMax = Math.ceil(yp);
        if (xp < this.xMin) this.xMin = Math.floor(xp);
        if (xp > this.xMax) this.xMax = Math.ceil(xp);
    }

    unmapXnosnap(x: number): number {
        return Math.round((x - this.xCenter) / this.xMagnitude);
    }
    unmapYnosnap(y: number): number {
        return Math.round((y - this.yCenter) / this.yMagnitude);
    }

    unmapXsnap(x: number): number {
        let xc = this.unmapXnosnap(x);
        if (this.snapActive) {
            xc = Math.round(xc / this.xGridStep) * this.xGridStep;
        }
        return xc;
    }
    unmapYsnap(y: number): number {
        let yc = this.unmapYnosnap(y);
        if (this.snapActive) {
            yc = Math.round(yc / this.yGridStep) * this.yGridStep;
        }
        return yc;
    }

    toString(): string {
        return `[xCenter=${this.xCenter}|yCenter=${this.yCenter}|xMagnitude=${this.xMagnitude}`
            + `|yMagnitude=${this.yMagnitude}|orientation=${this.orientation}|mirror=${this.mirror}`
            + `|isMacro=${this.isMacro}|snapActive=${this.snapActive}`
            + `|xMin=${this.xMin}|xMax=${this.xMax}|yMin=${this.yMin}|yMax=${this.yMax}`
            + `|xGridStep=${this.xGridStep}|yGridStep=${this.yGridStep}]`;
    }
}
