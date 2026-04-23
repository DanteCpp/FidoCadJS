export interface PolygonInterface {
    addPoint(x: number, y: number): void;
    getNpoints(): number;
    reset(): void;
    getXpoints(): number[];
    getYpoints(): number[];
    contains(x: number, y: number): boolean;
}
