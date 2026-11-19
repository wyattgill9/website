import type { Sim } from "./sim-canvas";

/*
 * Go on a 9×9 board, playing itself: captures, suicide and simple ko are enforced, and the policy is a few lines of
 * greed (capture, escape atari, play near the action, don't fill your own eyes). When both sides pass, the board is
 * scored by area and a new game starts. Click an empty point to play the next move yourself.
 */

const SIZE = 9;
const MOVE_EVERY = 0.75;
const COLS = "ABCDEFGHJ"; // Go skips I

type Color = 1 | 2;
const other = (c: Color): Color => (c === 1 ? 2 : 1);

export function createGo(): Sim {
    let board: number[] = [];
    let prev = ""; // the position before the last move, for ko
    let toPlay: Color = 1;
    let moveNo = 0;
    let passes = 0;
    let captures = [0, 0, 0];
    let last = -1;
    let fading: { at: number; color: number; t: number }[] = [];
    let result = "";
    let wait = 0.8;
    let geo = { x: 0, y: 0, cell: 30 };

    const reset = () => {
        board = Array(SIZE * SIZE).fill(0);
        prev = "";
        toPlay = 1;
        moveNo = 0;
        passes = 0;
        captures = [0, 0, 0];
        last = -1;
        result = "";
    };
    reset();

    const neighbors = (p: number) => {
        const x = p % SIZE;
        const y = Math.floor(p / SIZE);
        const out: number[] = [];
        if (x > 0) out.push(p - 1);
        if (x < SIZE - 1) out.push(p + 1);
        if (y > 0) out.push(p - SIZE);
        if (y < SIZE - 1) out.push(p + SIZE);
        return out;
    };

    /** The group at p and its liberties. */
    const group = (b: number[], p: number) => {
        const color = b[p];
        const stones = new Set([p]);
        const libs = new Set<number>();
        const stack = [p];
        while (stack.length) {
            const q = stack.pop()!;
            for (const n of neighbors(q)) {
                if (b[n] === 0) libs.add(n);
                else if (b[n] === color && !stones.has(n)) {
                    stones.add(n);
                    stack.push(n);
                }
            }
        }
        return { stones, libs };
    };

    /** The board after `color` plays p, and what it captured, or null if illegal. */
    const tryPlay = (p: number, color: Color) => {
        if (board[p] !== 0) return null;
        const b = board.slice();
        b[p] = color;
        const taken: number[] = [];
        for (const n of neighbors(p)) {
            if (b[n] !== other(color)) continue;
            const g = group(b, n);
            if (g.libs.size === 0)
                for (const s of g.stones) {
                    b[s] = 0;
                    taken.push(s);
                }
        }
        if (group(b, p).libs.size === 0) return null; // suicide
        if (b.join("") === prev) return null; // simple ko
        return { b, taken };
    };

    const play = (p: number) => {
        const r = tryPlay(p, toPlay);
        if (!r) return false;
        prev = board.join("");
        r.taken.forEach((s) => fading.push({ at: s, color: board[s], t: 1 }));
        board = r.b;
        captures[toPlay] += r.taken.length;
        last = p;
        moveNo++;
        passes = 0;
        toPlay = other(toPlay);
        return true;
    };

    const isEye = (p: number, color: Color) => neighbors(p).every((n) => board[n] === color);

    const choose = (): number | null => {
        let best: number | null = null;
        let bestScore = -Infinity;
        for (let p = 0; p < board.length; p++) {
            if (board[p] !== 0 || isEye(p, toPlay)) continue;
            const r = tryPlay(p, toPlay);
            if (!r) continue;
            let score = Math.random() * 2 + r.taken.length * 6;
            const mine = group(r.b, p);
            if (mine.libs.size === 1) score -= 8; // self-atari
            for (const n of neighbors(p)) {
                if (board[n] === toPlay && group(board, n).libs.size === 1) score += 5; // escape atari
                if (board[n] === other(toPlay) && group(r.b, n).libs.size === 1) score += 2.5; // put in atari
                if (board[n] !== 0) score += 0.6; // contact
            }
            if (last >= 0) {
                const dx = Math.abs((p % SIZE) - (last % SIZE));
                const dy = Math.abs(Math.floor(p / SIZE) - Math.floor(last / SIZE));
                score += Math.max(0, 2 - (dx + dy) * 0.4);
            }
            const x = p % SIZE;
            const y = Math.floor(p / SIZE);
            const edge = Math.min(x, y, SIZE - 1 - x, SIZE - 1 - y);
            if (moveNo < 10) score += edge === 2 ? 2 : edge === 0 ? -3 : 0; // open on the third line
            if (score > bestScore) [best, bestScore] = [p, score];
        }
        return bestScore > -2 ? best : null;
    };

    // Area scoring: stones plus empty regions bordered by one colour only, with komi.
    const score = () => {
        const area = [0, 0, 0];
        const seen = new Set<number>();
        for (let p = 0; p < board.length; p++) {
            if (board[p]) area[board[p]]++;
            else if (!seen.has(p)) {
                const region = [p];
                const borders = new Set<number>();
                seen.add(p);
                for (let i = 0; i < region.length; i++)
                    for (const n of neighbors(region[i])) {
                        if (board[n]) borders.add(board[n]);
                        else if (!seen.has(n)) {
                            seen.add(n);
                            region.push(n);
                        }
                    }
                if (borders.size === 1) area[[...borders][0]] += region.length;
            }
        }
        const diff = area[1] - area[2] - 6.5;
        return diff > 0 ? `black wins by ${diff}` : `white wins by ${-diff}`;
    };

    const pointAt = (x: number, y: number) => {
        const i = Math.round((x - geo.x) / geo.cell);
        const j = Math.round((y - geo.y) / geo.cell);
        if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) return -1;
        if (Math.hypot(x - (geo.x + i * geo.cell), y - (geo.y + j * geo.cell)) > geo.cell * 0.45) return -1;
        return j * SIZE + i;
    };

    return {
        layout({ area }) {
            const side = Math.min(area.h - 24, area.w - 24, 380);
            const cell = side / (SIZE - 1 + 1.2);
            geo = { x: area.x + 22 + cell * 0.6, y: area.y + Math.max(0, (area.h - side) / 2) + cell * 0.6, cell };
        },

        step(dt) {
            fading = fading.filter((f) => (f.t -= dt * 1.8) > 0);
            wait -= dt;
            if (wait > 0) return;
            if (result) {
                reset();
                wait = 0.8;
                return;
            }
            wait = MOVE_EVERY;
            const p = choose();
            if (p === null) {
                passes++;
                toPlay = other(toPlay);
                if (passes >= 2 || moveNo > 160) {
                    result = score();
                    wait = 5;
                }
            } else play(p);
        },

        draw(ctx, { ink, accent, font, fg, bg }) {
            const { x, y, cell } = geo;
            const span = cell * (SIZE - 1);
            ctx.strokeStyle = ink(0.22);
            ctx.lineWidth = 1;
            for (let i = 0; i < SIZE; i++) {
                const o = Math.round(i * cell) + 0.5;
                ctx.beginPath();
                ctx.moveTo(Math.round(x) + 0.5, Math.round(y) + o);
                ctx.lineTo(Math.round(x + span) + 0.5, Math.round(y) + o);
                ctx.moveTo(Math.round(x) + o, Math.round(y) + 0.5);
                ctx.lineTo(Math.round(x) + o, Math.round(y + span) + 0.5);
                ctx.stroke();
            }
            ctx.fillStyle = ink(0.35);
            for (const [i, j] of [
                [2, 2],
                [6, 2],
                [4, 4],
                [2, 6],
                [6, 6],
            ]) {
                ctx.beginPath();
                ctx.arc(x + i * cell, y + j * cell, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.font = `10px ${font}`;
            ctx.fillStyle = ink(0.3);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (let i = 0; i < SIZE; i++) {
                ctx.fillText(COLS[i], x + i * cell, y + span + cell * 0.55);
                ctx.fillText(String(SIZE - i), x - cell * 0.55, y + i * cell);
            }

            const stone = (p: number, color: number, alpha: number) => {
                const sx = x + (p % SIZE) * cell;
                const sy = y + Math.floor(p / SIZE) * cell;
                const r = cell * 0.44;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                // Black is the solid ink colour, white the page colour with an ink edge, in either theme.
                ctx.fillStyle = color === 1 ? fg : bg;
                ctx.fill();
                if (color === 2) {
                    ctx.strokeStyle = ink(0.7);
                    ctx.lineWidth = 1.25;
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            };
            board.forEach((c, p) => c && stone(p, c, 1));
            fading.forEach((f) => stone(f.at, f.color, f.t * 0.6));

            if (last >= 0 && board[last]) {
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(x + (last % SIZE) * cell, y + Math.floor(last / SIZE) * cell, cell * 0.12, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        click(px, py) {
            const p = pointAt(px, py);
            if (p < 0 || result) return false;
            if (play(p)) wait = MOVE_EVERY * 1.5;
            return true;
        },
        hit: (px, py) => {
            const p = pointAt(px, py);
            return p >= 0 && board[p] === 0;
        },

        status() {
            if (result) return `go · ${result} · ${moveNo} moves`;
            const side = toPlay === 1 ? "black" : "white";
            return `go · move ${moveNo + 1}, ${side} to play · captures ${captures[1]}–${captures[2]}`;
        },
    };
}
