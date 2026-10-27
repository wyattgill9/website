import {
    bodyHalfWidth,
    classify,
    FLAG_ANTLER,
    FLAG_BODY,
    FLAG_DORSAL,
    FLAG_EYE,
    FLAG_HAIR,
    FLAG_LEG,
    FLAG_SPIKE,
    FLAG_WHISKER,
    REACH,
    type ShapeHit,
} from "./shape";
import {
    clamp,
    hash3,
    BITE_LIFE,
    DRAGON_NODES,
    smoothstep,
    type Box,
    type Dragon,
    type Variety,
    type World,
} from "./world";

type Rgb = [number, number, number];

// How visible a dragon stays while it flies under page content.
const DIM_UNDER_CONTENT = 0.15;

interface Palette {
    /** Page background, which tiles are mixed toward. */
    bg: Rgb;
    white: Rgb;
    /** Antlers: bone, whatever the dragon's colour. */
    fin: Rgb;
    eye: Rgb;
    /** Cloud wisps trailing behind the dragons. */
    water: Rgb;
    pellet: Rgb;
    alpha: number;
    /** How much a far-off dragon fades into the haze, as the alpha it keeps at its farthest. */
    depthFloor: number;
    /** Each dragon's scales from deep shadow to a lit highlight, so the body shades across hues. */
    scales: Record<Variety, Rgb[]>;
    /** Mane, tail, whiskers, belly and spine ridge: a contrasting colour per dragon. */
    hair: Record<Variety, Rgb>;
    /** Glyph brightness relative to the tile under it. */
    ink: number;
}

const DARK: Palette = {
    bg: [26, 25, 33],
    white: [236, 228, 218],
    fin: [214, 206, 198],
    eye: [20, 20, 26],
    water: [255, 247, 240],
    pellet: [250, 236, 196],
    alpha: 0.8,
    depthFloor: 0.4,
    scales: {
        crimson: [
            [112, 22, 24],
            [168, 34, 28],
            [214, 58, 30],
            [240, 96, 34],
            [250, 138, 52],
            [255, 178, 96],
        ],
        jade: [
            [16, 58, 44],
            [24, 92, 64],
            [36, 128, 88],
            [62, 160, 112],
            [104, 192, 140],
            [160, 222, 180],
        ],
        gold: [
            [96, 60, 10],
            [150, 98, 18],
            [200, 142, 30],
            [228, 178, 52],
            [242, 206, 96],
            [252, 232, 150],
        ],
    },
    hair: { crimson: [246, 196, 92], jade: [236, 228, 218], gold: [232, 96, 56] },
    ink: 0.42,
};

// Paper page: tiles are pale washes of the skin colour with dark glyphs etched on top.
const LIGHT: Palette = {
    bg: [245, 244, 241],
    white: [112, 108, 104],
    fin: [138, 132, 126],
    eye: [24, 22, 26],
    water: [38, 37, 35],
    pellet: [176, 128, 40],
    alpha: 0.9,
    depthFloor: 0.55,
    scales: {
        crimson: [
            [138, 24, 22],
            [184, 38, 24],
            [222, 62, 28],
            [238, 100, 38],
            [244, 140, 66],
            [248, 176, 116],
        ],
        jade: [
            [14, 60, 42],
            [22, 88, 60],
            [34, 118, 80],
            [56, 146, 100],
            [90, 172, 124],
            [140, 200, 160],
        ],
        gold: [
            [110, 66, 8],
            [150, 96, 14],
            [188, 128, 22],
            [210, 156, 40],
            [224, 180, 80],
            [236, 204, 130],
        ],
    },
    hair: { crimson: [196, 140, 30], jade: [120, 112, 100], gold: [204, 62, 28] },
    ink: 0.45,
};

// Dense glyphs etched into each skin tile, sparse where it catches the light.
const TILE_GLYPHS = "t%SX8@#";
const SUBSAMPLES = [0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75];

// A line glyph that follows a direction in screen space, for limbs, whiskers and claws.
function lineGlyph(dx: number, dy: number) {
    const d = Math.hypot(dx, dy) || 1;
    if (Math.abs(dy) < 0.38 * d) return "-";
    if (Math.abs(dx) < 0.38 * d) return "|";
    return dx * dy > 0 ? "\\" : "/";
}

function valueNoise(x: number, y: number, seed: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smoothstep(0, 1, x - xi);
    const v = smoothstep(0, 1, y - yi);
    const a = hash3(xi, yi, seed);
    const b = hash3(xi + 1, yi, seed);
    const c = hash3(xi, yi + 1, seed);
    const d = hash3(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const packRgb = (c: Rgb) => (c[0] << 16) | (c[1] << 8) | c[2];
/** Sample a colour ramp at t in [0, 1]. */
function ramp(stops: Rgb[], t: number): Rgb {
    const x = clamp(t, 0, 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    return mix(stops[i], stops[i + 1], x - i);
}

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
    (a[0] + (b[0] - a[0]) * k) | 0,
    (a[1] + (b[1] - a[1]) * k) | 0,
    (a[2] + (b[2] - a[2]) * k) | 0,
];
const shade = (c: Rgb, k: number): Rgb => [
    Math.min(255, c[0] * k) | 0,
    Math.min(255, c[1] * k) | 0,
    Math.min(255, c[2] * k) | 0,
];

export class DragonRenderer {
    private ctx: CanvasRenderingContext2D;
    private dpr = 1;
    private cw = 8;
    private ch = 12;
    private cols = 0;
    private rows = 0;
    private palette = DARK;
    private styles = new Map<number, string>();
    private fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

    private energy = new Float32Array(0);
    private energyTmp = new Float32Array(0);
    private cellGlyph = new Uint16Array(0);
    private cellColor = new Uint32Array(0);
    private cellAlpha = new Float32Array(0);
    private cellTile = new Uint32Array(0);
    private cellTileAlpha = new Float32Array(0);
    private cellDim = new Float32Array(0);

    private spine = new Float32Array(DRAGON_NODES * 2);
    private arc = new Float32Array(DRAGON_NODES);
    private arcTotal = 1;
    private flareLeft = 1;
    private flareRight = 1;
    // Scratch outputs of sample(), to avoid allocating per sample.
    private hit: ShapeHit = { flag: 0, across: 1, du: 1, da: 0 };
    private hitS = 0;
    private hitV = 0;
    private hitDist = 0;
    private hitTx = 1;
    private hitTy = 0;
    private hitSeg = 0;

    constructor(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("2D canvas unavailable");
        this.ctx = ctx;
    }

    setTheme(isLight: boolean) {
        this.palette = isLight ? LIGHT : DARK;
    }

    resize(width: number, height: number, dpr: number) {
        this.dpr = dpr;
        // Near-square tiles, large enough to read each etched glyph.
        this.cw = clamp(Math.round(width / 125), 8, 12);
        this.ch = this.cw + 2;
        this.cols = Math.ceil(width / this.cw);
        this.rows = Math.ceil(height / this.ch);
        this.ctx.canvas.width = Math.round(width * dpr);
        this.ctx.canvas.height = Math.round(height * dpr);

        const n = this.cols * this.rows;
        this.energy = new Float32Array(n);
        this.energyTmp = new Float32Array(n);
        this.cellGlyph = new Uint16Array(n);
        this.cellColor = new Uint32Array(n);
        this.cellAlpha = new Float32Array(n);
        this.cellTile = new Uint32Array(n);
        this.cellTileAlpha = new Float32Array(n);
        this.cellDim = new Float32Array(n).fill(1);
    }

    /** Fade dragons under these canvas-space boxes, easing back in over a few cells around them. */
    setDimBoxes(boxes: Box[]) {
        const { cols, rows, cw, ch, cellDim } = this;
        cellDim.fill(1);
        const pad = cw * 4;
        for (const b of boxes) {
            const c0 = Math.max(0, Math.floor((b.left - pad) / cw));
            const c1 = Math.min(cols - 1, Math.floor((b.right + pad) / cw));
            const r0 = Math.max(0, Math.floor((b.top - pad) / ch));
            const r1 = Math.min(rows - 1, Math.floor((b.bottom + pad) / ch));
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    const x = c * cw + cw / 2;
                    const y = r * ch + ch / 2;
                    const d = Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
                    const i = r * cols + c;
                    cellDim[i] = Math.min(
                        cellDim[i],
                        DIM_UNDER_CONTENT + (1 - DIM_UNDER_CONTENT) * smoothstep(0, pad, d)
                    );
                }
            }
        }
    }

    render(world: World, dt: number) {
        const { ctx, dpr, cols } = this;
        if (cols === 0) return;

        this.cellGlyph.fill(0);
        this.cellTileAlpha.fill(0);
        // Farther dragons first, so the near ones fly over them.
        for (const k of [...world.dragons].sort((a, b) => a.depth - b.depth)) this.rasterizeDragon(k, world.time);
        this.depositWake(world);
        this.diffuse(dt);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = `600 ${Math.round(this.ch * 0.72)}px ${this.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        this.drawWake();
        this.drawPellets(world);
        this.drawCells();
        this.drawBites(world);
        ctx.globalAlpha = 1;
    }

    private style(rgb: number) {
        let s = this.styles.get(rgb);
        if (!s) {
            s = `rgb(${rgb >>> 16},${(rgb >>> 8) & 255},${rgb & 255})`;
            this.styles.set(rgb, s);
        }
        return s;
    }

    private glyphAt(i: number, glyph: string, rgb: Rgb, alpha: number) {
        const { ctx, cw, ch, cols } = this;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.style(packRgb(rgb));
        ctx.fillText(glyph, (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
    }

    private cellIndex(x: number, y: number) {
        const c = Math.floor(x / this.cw);
        const r = Math.floor(y / this.ch);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
        return r * this.cols + c;
    }

    // ── dragons ─────────────────────────────────────────────────────────

    /** Find the nearest point on the render spine, then classify it against the dragon's outline. */
    private sample(px: number, py: number, L: number, from = 0, to = DRAGON_NODES - 2) {
        const { spine, arc } = this;
        let best = Infinity;
        let bestS = 0;
        let bestSign = 1;
        let past = 0;
        let ahead = 0;
        let lateral = 0;
        for (let n = from; n <= to; n++) {
            const ax = spine[n * 2];
            const ay = spine[n * 2 + 1];
            const sx = spine[(n + 1) * 2] - ax;
            const sy = spine[(n + 1) * 2 + 1] - ay;
            const len2 = sx * sx + sy * sy || 1;
            const raw = ((px - ax) * sx + (py - ay) * sy) / len2;
            const u = clamp(raw, 0, 1);
            const d2 = (px - ax - sx * u) ** 2 + (py - ay - sy * u) ** 2;
            if (d2 < best) {
                const len = Math.sqrt(len2);
                best = d2;
                bestS = (arc[n] + u * len) / this.arcTotal;
                bestSign = sx * (py - ay) - sy * (px - ax) >= 0 ? 1 : -1;
                past = n === DRAGON_NODES - 2 ? Math.max(0, raw - 1) * len : 0;
                ahead = n === 0 ? Math.max(0, -raw) * len : 0;
                lateral = Math.abs(sx * (py - ay) - sy * (px - ax)) / len;
                this.hitTx = sx / len;
                this.hitTy = sy / len;
                this.hitSeg = n;
            }
        }

        const a = Math.sqrt(best);
        this.hitDist = a;
        this.hitS = bestS;
        this.hitV = a * bestSign;
        return classify(
            bestS,
            a / L,
            past / L,
            bestSign > 0 ? this.flareLeft : this.flareRight,
            this.hit,
            ahead / L,
            lateral / L
        );
    }

    private rasterizeDragon(k: Dragon, t: number) {
        const { spine, arc, cw, ch, cols, rows, cellGlyph, cellColor, cellAlpha, cellTile, cellTileAlpha, palette } =
            this;
        const L = k.length;
        const nodes = k.nodes;
        // Dragons never hold straight, but they writhe harder while swimming hard.
        const swim = 0.5 + 0.7 * k.beat;

        // A serpentine wave, about two crests long, travelling down the whole body.
        for (let n = 0; n < DRAGON_NODES; n++) {
            const s = n / (DRAGON_NODES - 1);
            const a = Math.max(0, n - 1);
            const b = Math.min(DRAGON_NODES - 1, n + 1);
            let tx = nodes[a * 2] - nodes[b * 2];
            let ty = nodes[a * 2 + 1] - nodes[b * 2 + 1];
            const tl = Math.hypot(tx, ty) || 1;
            tx /= tl;
            ty /= tl;
            const amp = L * 0.022 * (0.25 + 0.75 * smoothstep(0, 0.2, s)) * swim;
            const off = amp * Math.sin(k.phase - s * 13);
            spine[n * 2] = nodes[n * 2] - ty * off;
            spine[n * 2 + 1] = nodes[n * 2 + 1] + tx * off;
        }
        arc[0] = 0;
        for (let n = 1; n < DRAGON_NODES; n++) {
            arc[n] =
                arc[n - 1] + Math.hypot(spine[n * 2] - spine[(n - 1) * 2], spine[n * 2 + 1] - spine[(n - 1) * 2 + 1]);
        }
        this.arcTotal = arc[DRAGON_NODES - 1] || 1;
        // Legs paddle in a diagonal gait, so the two sides swing in opposite phase.
        const stride = Math.sin(k.finPhase) * (0.4 + 0.6 * k.beat);
        this.flareLeft = stride;
        this.flareRight = -stride;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let n = 0; n < DRAGON_NODES; n++) {
            minX = Math.min(minX, spine[n * 2]);
            maxX = Math.max(maxX, spine[n * 2]);
            minY = Math.min(minY, spine[n * 2 + 1]);
            maxY = Math.max(maxY, spine[n * 2 + 1]);
        }
        const reach = L * REACH;
        const c0 = Math.max(0, Math.floor((minX - reach) / cw));
        const c1 = Math.min(cols - 1, Math.floor((maxX + reach) / cw));
        const r0 = Math.max(0, Math.floor((minY - reach) / ch));
        const r1 = Math.min(rows - 1, Math.floor((maxY + reach) / ch));
        if (c0 > c1 || r0 > r1) return;

        const diag = Math.hypot(cw, ch);
        // Up close a dragon is brighter; far off it fades into the haze.
        const dim = palette.alpha * (palette.depthFloor + (1 - palette.depthFloor) * k.depth);
        const hit = this.hit;

        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const x = c * cw;
                const y = r * ch;
                const centerHit = this.sample(x + cw / 2, y + ch / 2, L);
                if (!centerHit && this.hitDist > reach + diag) {
                    // Distance to the spine changes by at most a cell per cell, so skip cells that can't reach it.
                    c += Math.max(0, Math.floor((this.hitDist - reach - diag) / cw));
                    continue;
                }
                // Sub-samples sit within a cell of the centre, so only the neighbouring segments can be nearest.
                const from = Math.max(0, this.hitSeg - 2);
                const to = Math.min(DRAGON_NODES - 2, this.hitSeg + 2);
                let { flag, across, du, da } = hit;
                let s = this.hitS;
                let v = this.hitV;
                let tx = this.hitTx;
                let ty = this.hitTy;

                let hits = centerHit ? 1 : 0;
                // Points from the cell centre toward the covered side, i.e. across the outline into the dragon.
                let gx = 0;
                let gy = 0;
                // Cells well inside the body can't have a sub-sample outside it, so skip straight to full coverage.
                const deepInside =
                    centerHit &&
                    (flag === FLAG_BODY || flag === FLAG_DORSAL) &&
                    s > 0.06 &&
                    s < 0.85 &&
                    bodyHalfWidth(s) * L - this.hitDist > diag * 0.35;
                if (deepInside) hits = 5;
                for (let q = 0; !deepInside && q < SUBSAMPLES.length; q += 2) {
                    if (!this.sample(x + SUBSAMPLES[q] * cw, y + SUBSAMPLES[q + 1] * ch, L, from, to)) continue;
                    gx += (SUBSAMPLES[q] - 0.5) * cw;
                    gy += (SUBSAMPLES[q + 1] - 0.5) * ch;
                    if (hits === 0) {
                        ({ flag, across, du, da } = hit);
                        s = this.hitS;
                        v = this.hitV;
                        tx = this.hitTx;
                        ty = this.hitTy;
                    }
                    hits++;
                }
                if (hits === 0) continue;
                this.hitTx = tx;
                this.hitTy = ty;
                const coverage = hits / 5;
                const side = v >= 0 ? 1 : -1;

                const i = r * cols + c;
                // Body-anchored key so each glyph rides along with the skin.
                const key = (hash3(Math.round(s * 90), Math.round(v / (cw * 0.8)), k.id) * 4294967295) >>> 0;
                const solid = centerHit && coverage >= 0.6;

                let glyph = " ";
                let rgb: Rgb = palette.fin;
                let alpha = dim;
                let tile: Rgb | null = null;
                let tileAlpha = 0;
                const scales = palette.scales[k.variety];
                const hair = palette.hair[k.variety];
                // Outward from the spine on this side, in screen space.
                const ox = -side * ty;
                const oy = side * tx;
                if (flag === FLAG_WHISKER) {
                    // Drawn along the whisker: forward from the snout and angled out to its side.
                    glyph = lineGlyph(-tx + ox * 0.9, -ty + oy * 0.9);
                    rgb = hair;
                } else if (flag === FLAG_EYE && solid) {
                    tile = mix(palette.bg, palette.eye, 0.85);
                    tileAlpha = dim;
                    glyph = "o";
                    rgb = hair;
                } else if (flag === FLAG_SPIKE) {
                    // Dark scale spikes tipped in the hair colour, pointing out and back.
                    tile = ramp(scales, 0.1);
                    tileAlpha = dim * coverage * 0.6;
                    glyph = lineGlyph(tx * 0.6 + ox, ty * 0.6 + oy);
                    rgb = across > 0.4 ? hair : shade(tile, palette.ink + 0.6);
                } else if (flag === FLAG_ANTLER) {
                    glyph = lineGlyph(tx * du + ox * da, ty * du + oy * da);
                    rgb = palette.fin;
                } else if (flag === FLAG_LEG) {
                    // Scaly limbs with hair-coloured claws at the tips.
                    tile = ramp(scales, 0.3);
                    tileAlpha = dim * coverage;
                    const claw = across > 0.75;
                    glyph = claw ? "*" : lineGlyph(tx * du + ox * da, ty * du + oy * da);
                    rgb = claw ? hair : shade(tile, palette.ink + 0.6);
                } else if (flag === FLAG_HAIR) {
                    // Mane and tail hair stream back along the body, fanning out toward their tips.
                    // Strands only, no tile, every other cell, so it reads as hair rather than a solid block.
                    if (key % 2 === 0) glyph = lineGlyph(tx + ox * across * 0.8, ty + oy * across * 0.8);
                    rgb = hair;
                    alpha *= 0.5 + 0.5 * coverage;
                } else {
                    // Each scale cell is a tile washed in the body colour, shaded like a rounded back lit from
                    // the top-left, with a dense glyph etched on top. Edge cells get a paler, empty tile.
                    const facing = side * (0.6 * ty - 0.8 * tx) * across;
                    const lum = clamp(0.22 + 0.5 * Math.sqrt(1 - across * across) + 0.18 * facing, 0, 1);
                    // Each dragon leans a little lighter or darker, and a slow body-pinned noise varies the hue.
                    const lean = (hash3(k.id, 5, 17) - 0.5) * 0.3;
                    const grain = (valueNoise(s * 9 + k.id, (v / L) * 18, k.id + 21) - 0.5) * 0.25;
                    // A band of shine travels down the body, like light sliding over wet scales.
                    const sheen = Math.max(0, Math.sin(s * 11 - t * 1.8 + k.id) - 0.7) / 0.3;
                    tile = ramp(scales, 0.15 + 0.8 * lum + lean + grain + sheen * 0.35);
                    // Belly plates peek out along the flanks.
                    if (across > 0.82) tile = mix(tile, hair, 0.45);
                    // A ridge of spines down the back, one plate every other row.
                    const plate = flag === FLAG_DORSAL && Math.floor((s * L) / (cw * 1.4)) % 2 === 0;
                    if (plate) tile = mix(tile, hair, 0.7);
                    if (hits === 5) {
                        tileAlpha = dim;
                        if (s < 0.02 && across < 0.6 && k.gulp > 0.5) {
                            glyph = "o";
                            rgb = palette.eye;
                        } else if (plate) {
                            glyph = "^";
                            rgb = shade(tile, palette.ink);
                        } else {
                            const jitter = (key >>> 4) % 3;
                            glyph = TILE_GLYPHS[clamp(Math.round((1 - lum) * 4) + jitter, 0, TILE_GLYPHS.length - 1)];
                            rgb = shade(tile, palette.ink);
                            // Scales glint on a staggered clock.
                            const tick = Math.floor(t * 1.4 + (key % 997) / 97);
                            if (hash3(key, tick, 7) < 0.03) tile = mix(tile, palette.bg, 0.45);
                        }
                    } else {
                        tileAlpha = dim * coverage * 0.55;
                        if (Math.hypot(gx, gy) > cw * 0.2 && key % 3 === 0) {
                            glyph = ".";
                            rgb = shade(tile, palette.ink);
                        }
                    }
                }
                if (glyph === " " && tileAlpha === 0) continue;
                cellTile[i] = tile ? packRgb(tile) : 0;
                cellTileAlpha[i] = tileAlpha;
                cellGlyph[i] = glyph.charCodeAt(0);
                cellColor[i] = packRgb(rgb);
                cellAlpha[i] = alpha;
            }
        }
    }

    private drawCells() {
        const { ctx, cw, ch, cols, cellGlyph, cellColor, cellAlpha, cellTile, cellTileAlpha, cellDim } = this;
        for (let i = 0; i < cellGlyph.length; i++) {
            const code = cellGlyph[i];
            if (!code) continue;
            const x = (i % cols) * cw;
            const y = ((i / cols) | 0) * ch;
            if (cellTileAlpha[i] > 0) {
                ctx.globalAlpha = cellTileAlpha[i] * cellDim[i];
                ctx.fillStyle = this.style(cellTile[i]);
                ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
            }
            if (code === 32) continue;
            ctx.globalAlpha = cellAlpha[i] * cellDim[i];
            ctx.fillStyle = this.style(cellColor[i]);
            ctx.fillText(String.fromCharCode(code), x + cw / 2, y + ch / 2 + 1);
        }
    }

    // ── sky ─────────────────────────────────────────────────────────────

    private depositWake(world: World) {
        const { energy } = this;
        for (const k of world.dragons) {
            for (let n = DRAGON_NODES - 4; n < DRAGON_NODES; n++) {
                const i = this.cellIndex(k.nodes[n * 2], k.nodes[n * 2 + 1]);
                if (i >= 0) energy[i] = Math.min(1.5, energy[i] + 0.035 + k.speed * 0.0012);
            }
        }
        if (world.pointer.active) {
            const i = this.cellIndex(world.pointer.x, world.pointer.y);
            if (i >= 0) energy[i] = Math.min(1.5, energy[i] + 0.12);
        }
    }

    /** Blur and decay so trails billow out like cloud and fade. */
    private diffuse(dt: number) {
        const { cols, rows, energy, energyTmp: tmp } = this;
        const decay = Math.exp(-dt * 1.1);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                const l = c > 0 ? energy[i - 1] : energy[i];
                const rt = c < cols - 1 ? energy[i + 1] : energy[i];
                const u = r > 0 ? energy[i - cols] : energy[i];
                const d = r < rows - 1 ? energy[i + cols] : energy[i];
                tmp[i] = (energy[i] * 4 + l + rt + u + d) * 0.125 * decay;
            }
        }
        this.energy = tmp;
        this.energyTmp = energy;
    }

    private drawWake() {
        const { energy, cellGlyph, palette } = this;
        for (let i = 0; i < energy.length; i++) {
            const e = energy[i];
            if (e < 0.22 || cellGlyph[i]) continue;
            this.glyphAt(i, e > 0.5 ? "~" : ".", palette.water, Math.min(1, (e - 0.22) * 1.4) * 0.35);
        }
    }

    /** A bite flashes * over the dragon's mouth, settling to + then a dot. */
    private drawBites(world: World) {
        const { palette } = this;
        for (const b of world.bites) {
            const i = this.cellIndex(b.x, b.y);
            if (i < 0) continue;
            const t = (world.time - b.born) / BITE_LIFE;
            const glyph = t < 0.35 ? "*" : t < 0.7 ? "+" : ".";
            this.glyphAt(i, glyph, palette.pellet, Math.min(1, palette.alpha * 1.6) * (1 - t * t));
        }
    }

    /** Pearls glow in (. then o), then hang as a shimmering O until eaten. */
    private drawPellets(world: World) {
        const { ctx, cellGlyph, palette, cw, ch, cols } = this;
        for (const p of world.pellets) {
            const age = world.time - p.born;
            if (!p.landed) {
                const grow = age / p.landAt;
                const i = this.cellIndex(p.x, p.y);
                if (i < 0 || cellGlyph[i]) continue;
                this.glyphAt(i, grow < 0.5 ? "." : "o", palette.pellet, palette.alpha * (0.5 + 0.4 * grow));
                continue;
            }
            const i = this.cellIndex(p.x, p.y);
            if (i < 0 || cellGlyph[i]) continue;
            const bob = 0.8 + 0.2 * Math.sin(age * 3 + p.x);
            const glow = palette.alpha * bob;
            // A soft round halo under the pearl, so it reads as a lit orb rather than a pellet.
            const cx = (i % cols) * cw + cw / 2;
            const cy = ((i / cols) | 0) * ch + ch / 2;
            ctx.fillStyle = this.style(packRgb(palette.pellet));
            for (const [r, a] of [
                [1.6, 0.1],
                [0.9, 0.22],
            ]) {
                ctx.globalAlpha = glow * a;
                ctx.beginPath();
                ctx.arc(cx, cy, cw * r, 0, Math.PI * 2);
                ctx.fill();
            }
            this.glyphAt(i, "O", palette.pellet, glow);
        }
    }
}
