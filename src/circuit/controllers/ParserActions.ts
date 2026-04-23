import { DrawingModel } from '../model/DrawingModel.js';
import { Globals } from '../../globals/Globals.js';
import { LayerDesc } from '../../layers/LayerDesc.js';
import { StandardLayers } from '../../layers/StandardLayers.js';
import { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';
import { PrimitiveAdvText } from '../../primitives/PrimitiveAdvText.js';
import { PrimitiveBezier } from '../../primitives/PrimitiveBezier.js';
import { PrimitiveComplexCurve } from '../../primitives/PrimitiveComplexCurve.js';
import { PrimitiveConnection } from '../../primitives/PrimitiveConnection.js';
import { PrimitiveLine } from '../../primitives/PrimitiveLine.js';
import { PrimitiveMacro } from '../../primitives/PrimitiveMacro.js';
import { PrimitivePCBLine } from '../../primitives/PrimitivePCBLine.js';
import { PrimitivePCBPad } from '../../primitives/PrimitivePCBPad.js';
import { PrimitiveRectangle } from '../../primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from '../../primitives/PrimitiveOval.js';
import { PrimitivePolygon } from '../../primitives/PrimitivePolygon.js';
import { MacroDesc } from '../../primitives/MacroDesc.js';

const MAX_TOKENS = 10000;

export class ParserActions {
    private readonly model: DrawingModel;
    openFileName: string | null = null;

    constructor(pp: DrawingModel) {
        this.model = pp;
        // Inject the macro parser callback to break circular dependency.
        PrimitiveMacro.parserFn = (model, description) => {
            const pa = new ParserActions(model);
            pa.addString(description, false);
        };
    }

    /** Parse the circuit string, clearing the primitive database first. */
    parseString(s: string): void {
        this.model.getPrimitiveVector().length = 0;
        this.addString(s, false);
        this.model.setChanged(true);
    }

    /** Get the drawing as FidoCadJ text. */
    getText(extensions: boolean): string {
        let s = this.registerConfiguration(extensions);
        for (const g of this.model.getPrimitiveVector()) {
            s += g.toString(extensions);
        }
        return s;
    }

    /** Build the configuration header for the file. */
    registerConfiguration(extensions: boolean): string {
        if (!extensions) return '';
        let s = '';
        if (Math.abs(Globals.diameterConnectionDefault - Globals.diameterConnection) > 1e-5)
            s += `FJC C ${Globals.diameterConnection}\n`;
        s += this.checkAndRegisterLayers();
        if (Math.abs(Globals.lineWidth - Globals.lineWidthDefault) > 1e-5)
            s += `FJC A ${Globals.lineWidth}\n`;
        if (Math.abs(Globals.lineWidthCircles - Globals.lineWidthCirclesDefault) > 1e-5)
            s += `FJC B ${Globals.lineWidthCircles}\n`;
        return s;
    }

    private checkAndRegisterLayers(): string {
        let s = '';
        const layerV = this.model.getLayers();
        const standardLayers = StandardLayers.createStandardLayers();
        for (let i = 0; i < layerV.length; i++) {
            const l = layerV[i]!;
            if (l.isModified()) {
                const rgb = l.getColor()!.getRGB();
                const alpha = l.getAlpha();
                s += `FJC L ${i} ${rgb} ${alpha}\n`;
                const defaultName = standardLayers[i]!.getDescription();
                if (l.getDescription() !== defaultName) {
                    s += `FJC N ${i} ${l.getDescription()}\n`;
                }
            }
        }
        return s;
    }

    /** Add circuit string to the current primitive database. */
    addString(s: string, selectNew: boolean): void {
        const layerV = this.model.getLayers();
        const macroFont = this.model.getTextFont();
        const macroFontSize = this.model.getTextFontSize();

        let hasFCJ = false;
        let macroCounter = 0;
        let g: GraphicPrimitive = new PrimitiveLine(macroFont, macroFontSize);

        const tokens: string[] = new Array(MAX_TOKENS);
        let name: string[] | null = null;
        let value: string[] | null = null;
        let vn = 0, vv = 0;
        const oldTokens: string[] = new Array(MAX_TOKENS);
        let oldJ = 0;

        let lineNum = 1;
        const lines = s.split(/\r?\n/);

        for (const rawLine of lines) {
            lineNum++;
            const line = rawLine;
            // Tokenize the line
            let j = 0;
            let tokenBuf = '';
            let lineTooLong = false;
            for (let ci = 0; ci <= line.length; ci++) {
                const c = ci < line.length ? line[ci]! : ' '; // treat end as space
                if (c === ' ' || ci === line.length) {
                    if (tokenBuf.length > 0 || (ci === line.length && j === 0)) {
                        tokens[j] = tokenBuf;
                        j++;
                        tokenBuf = '';
                        if (j >= MAX_TOKENS) {
                            console.warn(`Too many tokens at line ${lineNum}`);
                            lineTooLong = true;
                            break;
                        }
                    }
                } else {
                    if (!lineTooLong) tokenBuf += c;
                }
            }
            // Last token not terminated by space
            if (tokenBuf.length > 0 && !lineTooLong) {
                tokens[j] = tokenBuf;
                j++;
            }

            if (j === 0) continue; // empty line

            try {
                if (hasFCJ && tokens[0] !== 'FCJ') {
                    hasFCJ = this.registerPrimitivesWithFCJ(hasFCJ, tokens, g,
                        oldTokens, oldJ, selectNew);
                }

                if (tokens[0] === 'FCJ') {
                    if (hasFCJ && oldTokens[0] === 'MC') {
                        macroCounter = 2;
                        g = new PrimitiveMacro(this.model.getLibrary(), layerV,
                            macroFont, macroFontSize);
                        g.parseTokens(oldTokens, oldJ + 1);
                    } else if (hasFCJ && oldTokens[0] === 'LI') {
                        g = new PrimitiveLine(macroFont, macroFontSize);
                        for (let l = 0; l < j; l++) oldTokens[l + oldJ + 1] = tokens[l]!;
                        oldJ += j;
                        g.parseTokens(oldTokens, oldJ + 1);
                        g.setSelected(selectNew);
                        if (oldJ > 5 && oldTokens[oldJ] === '1') {
                            macroCounter = 2;
                        } else {
                            this.model.addPrimitive(g, false, null);
                        }
                    } else if (hasFCJ && oldTokens[0] === 'BE') {
                        g = new PrimitiveBezier(macroFont, macroFontSize);
                        for (let l = 0; l < j; l++) oldTokens[l + oldJ + 1] = tokens[l]!;
                        oldJ += j;
                        g.parseTokens(oldTokens, oldJ + 1);
                        g.setSelected(selectNew);
                        if (oldJ > 5 && oldTokens[oldJ] === '1') {
                            macroCounter = 2;
                        } else {
                            this.model.addPrimitive(g, false, null);
                        }
                    } else if (hasFCJ && (oldTokens[0] === 'RV' || oldTokens[0] === 'RP')) {
                        g = new PrimitiveRectangle(macroFont, macroFontSize);
                        for (let l = 0; l < j; l++) oldTokens[l + oldJ + 1] = tokens[l]!;
                        oldJ += j;
                        g.parseTokens(oldTokens, oldJ + 1);
                        g.setSelected(selectNew);
                        if (oldJ > 2 && oldTokens[oldJ] === '1') {
                            macroCounter = 2;
                        } else {
                            this.model.addPrimitive(g, false, null);
                        }
                    } else if (hasFCJ && (oldTokens[0] === 'EV' || oldTokens[0] === 'EP')) {
                        g = new PrimitiveOval(macroFont, macroFontSize);
                        for (let l = 0; l < j; l++) oldTokens[l + oldJ + 1] = tokens[l]!;
                        oldJ += j;
                        g.parseTokens(oldTokens, oldJ + 1);
                        g.setSelected(selectNew);
                        if (oldJ > 2 && oldTokens[oldJ] === '1') {
                            macroCounter = 2;
                        } else {
                            this.model.addPrimitive(g, false, null);
                        }
                    } else if (hasFCJ && (oldTokens[0] === 'PV' || oldTokens[0] === 'PP')) {
                        g = new PrimitivePolygon(macroFont, macroFontSize);
                        for (let l = 0; l < j; l++) oldTokens[l + oldJ + 1] = tokens[l]!;
                        oldJ += j;
                        g.parseTokens(oldTokens, oldJ + 1);
                        g.setSelected(selectNew);
                        if (oldJ > 2 && oldTokens[oldJ] === '1') {
                            macroCounter = 2;
                        } else {
                            this.model.addPrimitive(g, false, null);
                        }
                    } else if (hasFCJ && (oldTokens[0] === 'CV' || oldTokens[0] === 'CP')) {
                        g = new PrimitiveComplexCurve(macroFont, macroFontSize);
                        for (let l = 0; l < j; l++) oldTokens[l + oldJ + 1] = tokens[l]!;
                        oldJ += j;
                        g.parseTokens(oldTokens, oldJ + 1);
                        g.setSelected(selectNew);
                        if (oldJ > 2 && oldTokens[oldJ] === '1') {
                            macroCounter = 2;
                        } else {
                            this.model.addPrimitive(g, false, null);
                        }
                    } else if (hasFCJ && oldTokens[0] === 'PL') {
                        macroCounter = 2;
                    } else if (hasFCJ && oldTokens[0] === 'PA') {
                        macroCounter = 2;
                    } else if (hasFCJ && oldTokens[0] === 'SA') {
                        macroCounter = 2;
                    }
                    hasFCJ = false;

                } else if (tokens[0] === 'FJC') {
                    this.fidoConfig(tokens, j, layerV);
                } else if (tokens[0] === 'LI') {
                    macroCounter = 0;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    hasFCJ = true;
                } else if (tokens[0] === 'BE') {
                    macroCounter = 0;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    hasFCJ = true;
                } else if (tokens[0] === 'MC') {
                    macroCounter = 0;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    hasFCJ = true;
                } else if (tokens[0] === 'TE') {
                    hasFCJ = false;
                    macroCounter = 0;
                    g = new PrimitiveAdvText();
                    g.parseTokens(tokens, j);
                    g.setSelected(selectNew);
                    this.model.addPrimitive(g, false, null);
                } else if (tokens[0] === 'TY') {
                    hasFCJ = false;
                    if (macroCounter === 2) {
                        macroCounter--;
                        name = new Array(j);
                        for (let l = 0; l < j; l++) name[l] = tokens[l]!;
                        vn = j - 1;
                    } else if (macroCounter === 1) {
                        value = new Array(j);
                        for (let l = 0; l < j; l++) value[l] = tokens[l]!;
                        vv = j - 1;
                        if (name !== null) g.setName(name, vn + 1);
                        g.setValue(value, vv + 1);
                        g.setSelected(selectNew);
                        this.model.addPrimitive(g, false, null);
                        macroCounter = 0;
                    } else {
                        g = new PrimitiveAdvText();
                        g.parseTokens(tokens, j);
                        g.setSelected(selectNew);
                        this.model.addPrimitive(g, false, null);
                    }
                } else if (tokens[0] === 'PL') {
                    hasFCJ = true;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    macroCounter = 0;
                    oldJ = j - 1;
                    g = new PrimitivePCBLine(macroFont, macroFontSize);
                    g.parseTokens(tokens, j);
                    g.setSelected(selectNew);
                } else if (tokens[0] === 'PA') {
                    hasFCJ = true;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    macroCounter = 0;
                    oldJ = j - 1;
                    g = new PrimitivePCBPad(macroFont, macroFontSize);
                    g.parseTokens(tokens, j);
                    g.setSelected(selectNew);
                } else if (tokens[0] === 'SA') {
                    hasFCJ = true;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    macroCounter = 0;
                    g = new PrimitiveConnection(macroFont, macroFontSize);
                    g.parseTokens(tokens, j);
                    g.setSelected(selectNew);
                } else if (tokens[0] === 'EV' || tokens[0] === 'EP') {
                    macroCounter = 0;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    hasFCJ = true;
                } else if (tokens[0] === 'RV' || tokens[0] === 'RP') {
                    macroCounter = 0;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    hasFCJ = true;
                } else if (tokens[0] === 'PV' || tokens[0] === 'PP') {
                    macroCounter = 0;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    hasFCJ = true;
                } else if (tokens[0] === 'CV' || tokens[0] === 'CP') {
                    macroCounter = 0;
                    for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                    oldJ = j - 1;
                    hasFCJ = true;
                }
            } catch (e) {
                console.error(`Error at line ${lineNum}: ${e}`);
                hasFCJ = true;
                macroCounter = 0;
                for (let l = 0; l < j; l++) oldTokens[l] = tokens[l]!;
                oldJ = j - 1;
            }
        }

        // Process last pending line
        try {
            this.registerPrimitivesWithFCJ(hasFCJ, tokens, g, oldTokens, oldJ, selectNew);
        } catch (e) {
            console.error(`Error processing last line: ${e}`);
        }

        this.model.sortPrimitiveLayers();
    }

    private fidoConfig(tokens: string[], ntokens: number, layerV: LayerDesc[]): void {
        if (tokens[1] === 'C') {
            const v = parseFloat(tokens[2]!);
            if (v > 0) Globals.diameterConnection = v;
        } else if (tokens[1] === 'L') {
            const layerNum = parseInt(tokens[2]!, 10);
            if (layerNum >= 0 && layerNum < layerV.length) {
                const rgb = parseInt(tokens[3]!, 10);
                const alpha = parseFloat(tokens[4]!);
                const ll = layerV[layerNum]!;
                ll.getColor()!.setRGB(rgb);
                ll.setAlpha(alpha);
                ll.setModified(true);
            }
        } else if (tokens[1] === 'N') {
            const layerNum = parseInt(tokens[2]!, 10);
            if (layerNum >= 0 && layerNum < layerV.length) {
                const parts: string[] = [];
                for (let t = 3; t < ntokens + 1; t++) {
                    parts.push(tokens[t]!);
                    parts.push(' ');
                }
                const ll = layerV[layerNum]!;
                ll.setDescription(parts.join(''));
                ll.setModified(true);
            }
        } else if (tokens[1] === 'A') {
            const v = parseFloat(tokens[2]!);
            if (v > 0) Globals.lineWidth = v;
        } else if (tokens[1] === 'B') {
            const v = parseFloat(tokens[2]!);
            if (v > 0) Globals.lineWidthCircles = v;
        }
    }

    private registerPrimitivesWithFCJ(hasFCJt: boolean, tokens: string[],
        gg: GraphicPrimitive, oldTokens: string[], oldJ: number,
        selectNew: boolean): boolean {
        const macroFont = this.model.getTextFont();
        const macroFontSize = this.model.getTextFontSize();
        const layerV = this.model.getLayers();

        let g = gg;
        let hasFCJ = hasFCJt;
        let addPrimitive = false;

        if (hasFCJ && tokens[0] !== 'FCJ') {
            if (oldTokens[0] === 'MC') {
                g = new PrimitiveMacro(this.model.getLibrary(), layerV, macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'LI') {
                g = new PrimitiveLine(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'BE') {
                g = new PrimitiveBezier(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'RP' || oldTokens[0] === 'RV') {
                g = new PrimitiveRectangle(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'EP' || oldTokens[0] === 'EV') {
                g = new PrimitiveOval(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'PP' || oldTokens[0] === 'PV') {
                g = new PrimitivePolygon(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'PL') {
                g = new PrimitivePCBLine(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'CP' || oldTokens[0] === 'CV') {
                g = new PrimitiveComplexCurve(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'PA') {
                g = new PrimitivePCBPad(macroFont, macroFontSize);
                addPrimitive = true;
            } else if (oldTokens[0] === 'SA') {
                g = new PrimitiveConnection(macroFont, macroFontSize);
                addPrimitive = true;
            }
        }

        if (addPrimitive) {
            g.parseTokens(oldTokens, oldJ + 1);
            g.setSelected(selectNew);
            this.model.addPrimitive(g, false, null);
            hasFCJ = false;
        }
        return hasFCJ;
    }

    /** Read a library from a text string. */
    readLibraryString(content: string, prefix: string): void {
        let macroName = '';
        let longName = '';
        let categoryName = '';
        let libraryName = '';
        const lines = content.split(/\r?\n/);

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line.length <= 1) continue;

            if (line.charAt(0) === '{') {
                let temp = '';
                for (let i = 1; i < line.length && line.charAt(i) !== '}'; i++)
                    temp += line.charAt(i);
                categoryName = temp.trim();
                continue;
            }

            if (line.charAt(0) === '[') {
                let i = 1;
                let temp = '';
                while (i < line.length && line.charAt(i) !== ' ' && line.charAt(i) !== ']') {
                    temp += line.charAt(i++);
                }
                macroName = temp.trim();
                temp = '';
                let j = i;
                while (j < line.length && line.charAt(j) !== ']') temp += line.charAt(j++);
                longName = temp;

                if (macroName === 'FIDOLIB') {
                    libraryName = longName.trim();
                    continue;
                }
                const key = (prefix !== '' ? prefix + '.' + macroName : macroName).toLowerCase();
                this.model.getLibrary().set(key, new MacroDesc(key, '', '', '', '', prefix));
                macroName = key;
                continue;
            }

            if (macroName !== '') {
                const md = this.model.getLibrary().get(macroName);
                if (!md) { macroName = ''; continue; }
                md.name = longName;
                md.key = macroName;
                md.category = categoryName;
                md.library = libraryName;
                md.filename = prefix;
                md.description = (md.description ? md.description + '\n' : '') + line;
            }
        }
    }
}
