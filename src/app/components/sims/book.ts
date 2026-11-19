import type { Sim } from "./sim-canvas";
import { createBookEngine, type Order, type Side } from "./book-engine";

/*
 * The order book as a price ladder: asks above, bids below, each bar the shares resting at that price, with a trade
 * tape beside it. The engine underneath is a full L3 book (see book-engine.ts); here that shows only as texture:
 * hairline splits between the individual orders in a bar, and fills flashing at the front of the queue, where
 * price-time priority takes them. Click the ask side to buy, the bid side to sell.
 */

type Trade = { price: number; shares: number; buy: boolean; at: number; hidden: boolean; mine: boolean };

// The market runs this much faster than real time: the same order flow, compressed. At 3× it prints ~13 trades a
// second, still under what a mega-cap does on the consolidated tape (~20–30/s in regular hours).
const SPEED = 3;
const SUBSTEP = 1 / 60; // engine step, in market seconds, however fast the market runs

const dollars = (ticks: number) => (ticks / 100).toFixed(ticks % 1 ? 3 : 2);

export function createBook(): Sim {
    const e = createBookEngine();
    const tape: Trade[] = [];
    let ghosts: { side: Side; price: number; offset: number; shares: number; t: number }[] = [];
    // A click's feedback: a ripple where it landed, and a summary of the fill rising from it.
    let ripples: { x: number; y: number; t: number }[] = [];
    let toasts: { x: number; y: number; text: string; buy: boolean; t: number }[] = [];
    const flash = new Map<string, number>(); // `${side}${price}` → 1 when the level changes, fading to 0
    const seen = new Map<string, number>(); // each level's size at the last step, to spot changes
    let view = (e.best("B") + e.best("S")) / 2; // the ladder's centre, eased toward the mid
    let scaleMax = 1500; // shares that fill a bar
    let trades = 0;
    let wallMs = Date.now();
    let ladder = { x: 0, y: 0, w: 0, rows: 0, rowH: 17 };
    let tapeBox: { x: number; y: number; h: number } | null = null;

    /** Move new trades onto the tape and new fills into flashes; `mine` marks a visitor's own order. */
    const drain = (mine: boolean) => {
        for (const m of e.feed.splice(0)) {
            if (m.type !== "E" && m.type !== "P") continue;
            const hidden = m.type === "P";
            // E is a resting order filled, so the aggressor is the other side; P is a hidden midpoint print.
            tape.unshift({ price: m.price, shares: m.shares, buy: m.side === "S", at: wallMs, hidden, mine });
            trades++;
        }
        tape.length = Math.min(tape.length, 40);
        for (const f of e.fx.splice(0)) if (f.kind === "exec") ghosts.push({ ...f, t: mine ? 1.6 : 1 });
    };

    const inLadder = (x: number, y: number) =>
        x >= ladder.x && x <= ladder.x + ladder.w && y >= ladder.y && y <= ladder.y + ladder.rows * ladder.rowH;

    return {
        layout({ area }) {
            const rowH = area.h < 420 ? 15 : 17;
            const rows = Math.max(9, Math.floor((area.h - 8) / rowH) | 1);
            const wantTape = area.w >= 540;
            const w = Math.min(wantTape ? area.w * 0.6 : area.w, 380);
            const h = rows * rowH;
            ladder = { x: area.x, y: area.y + (area.h - h) / 2, w, rows, rowH };
            tapeBox = wantTape ? { x: area.x + w + 36, y: ladder.y, h } : null;
        },

        step(dt) {
            for (let left = dt * SPEED; left > 1e-6; left -= SUBSTEP) e.step(Math.min(SUBSTEP, left));
            wallMs += dt * 1000;
            // Trades off the feed: E is a resting order filled (the aggressor is the other side); P is a hidden print.
            drain(false);
            ripples = ripples.filter((r) => (r.t -= dt * 1.8) > 0);
            toasts = toasts.filter((t) => (t.t -= dt * 0.45) > 0);
            ghosts = ghosts.filter((g) => (g.t -= dt * 1.6) > 0);
            view += ((e.best("B") + e.best("S")) / 2 - view) * Math.min(1, dt * 3);

            // Any level whose size changed (an add, a cancel, a fill) lights up, then fades.
            for (const [k, v] of flash) {
                if (v - dt * 2 <= 0) flash.delete(k);
                else flash.set(k, v - dt * 2);
            }
            const mid = Math.round(view);
            for (let p = mid - ladder.rows; p <= mid + ladder.rows; p++)
                for (const [side, book] of [
                    ["B", e.bids],
                    ["S", e.asks],
                ] as const) {
                    const key = `${side}${p}`;
                    const size = book.get(p)?.reduce((n, o) => n + o.shares, 0) ?? 0;
                    if ((seen.get(key) ?? 0) !== size) flash.set(key, 1);
                    seen.set(key, size);
                }
        },

        draw(ctx, { ink, accent, font, bg }) {
            const { x, y, w, rows, rowH } = ladder;
            const priceW = 64;
            const px = x + (w - priceW) / 2; // price column
            const barMax = (w - priceW) / 2 - 8;
            const bb = e.best("B");
            const ba = e.best("S");
            const top = Math.round(view) + Math.floor(rows / 2);
            const offset = (view - Math.round(view)) * rowH; // sub-row scroll as the mid moves
            const now = e.now();

            const queue = (p: number): Order[] | undefined =>
                p <= bb ? e.bids.get(p) : p >= ba ? e.asks.get(p) : undefined;
            const total = (q?: Order[]) => q?.reduce((n, o) => n + o.shares, 0) ?? 0;
            // Scale to the second-deepest visible level, so one huge resting order doesn't flatten the rest.
            const depths = Array.from({ length: rows }, (_, i) => total(queue(top - i))).sort((a, b) => b - a);
            scaleMax += (Math.max(400, depths[1] ?? 0) - scaleMax) * 0.04;
            const scale = barMax / scaleMax;
            // From the price column outward: bids grow left, asks grow right.
            const run = (side: Side, ahead: number, shares: number) => {
                const a = Math.min(barMax, ahead * scale);
                const len = Math.min(barMax, (ahead + shares) * scale) - a;
                return side === "B" ? [px - 6 - a - len, len] : [px + priceW + 6 + a, len];
            };

            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 4, y, w + 8, rows * rowH);
            ctx.clip();
            ctx.font = `11px ${font}`;
            ctx.textBaseline = "middle";
            const last = e.stats.lastTrade;
            for (let i = -1; i <= rows; i++) {
                const p = top - i;
                const ry = y + i * rowH + offset;
                const cy = ry + rowH / 2;
                const side: Side | null = p <= bb ? "B" : p >= ba ? "S" : null;
                const q = queue(p);

                if (side && q) {
                    const color = side === "S" ? accent : ink(1);
                    const size = total(q);
                    const [bx, len] = run(side, 0, size);
                    ctx.globalAlpha = 0.17 + 0.38 * (flash.get(`${side}${p}`) ?? 0);
                    ctx.fillStyle = color;
                    ctx.fillRect(bx, ry + 2, len, rowH - 4);
                    // The order at the front of the queue fills next; new orders glow briefly as they join.
                    let ahead = 0;
                    q.forEach((o, k) => {
                        const glow = Math.max(0, 1 - (now - o.born) / 0.5) * 0.25 + (k === 0 ? 0.12 : 0);
                        const [sx, sw] = run(side, ahead, o.shares);
                        ahead += o.shares;
                        if (glow > 0 && sw > 0) {
                            ctx.globalAlpha = glow;
                            ctx.fillRect(sx, ry + 2, sw, rowH - 4);
                        }
                    });
                    // Hairline splits between orders.
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = bg;
                    ahead = 0;
                    for (const o of q.slice(0, -1)) {
                        ahead += o.shares;
                        const [sx, sw] = run(side, 0, ahead);
                        if (ahead * scale > barMax) break;
                        ctx.fillRect(side === "B" ? sx : sx + sw - 1, ry + 2, 1, rowH - 4);
                    }
                    ctx.fillStyle = side === "S" ? accent : ink(p === bb ? 0.95 : 0.75);
                    ctx.globalAlpha = side === "S" ? (p === ba ? 1 : 0.8) : 1;
                    ctx.textAlign = side === "B" ? "right" : "left";
                    ctx.fillText(size.toLocaleString("en-US"), side === "B" ? px - 10 : px + priceW + 10, cy);
                    ctx.globalAlpha = 1;
                }

                const touch = p === bb || p === ba;
                const traded = last && last.price === p ? Math.max(0, 1 - (now - last.at) / 1.2) : 0;
                ctx.textAlign = "center";
                ctx.fillStyle = traded > 0 ? accent : ink(touch ? 0.95 : q ? 0.45 : 0.18);
                ctx.fillText(dollars(p), px + priceW / 2, cy);
            }

            // Fills: a flash where the shares left the front of the queue.
            for (const g of ghosts) {
                const i = top - g.price;
                if (i < -1 || i > rows) continue;
                const ry = y + i * rowH + offset;
                const [sx, sw] = run(g.side, g.offset, g.shares);
                ctx.globalAlpha = g.t * 0.9;
                ctx.fillStyle = accent;
                ctx.fillRect(sx, ry + 1, Math.max(2, sw), rowH - 2);
            }
            ctx.globalAlpha = 1;
            ctx.restore();

            // Fade the ladder's ends into the page, so it reads as a window onto a deeper book.
            const fadeH = rowH * 3;
            for (const [y0, y1] of [
                [y, y + fadeH],
                [y + rows * rowH, y + rows * rowH - fadeH],
            ]) {
                const g = ctx.createLinearGradient(0, y0, 0, y1);
                g.addColorStop(0, bg);
                g.addColorStop(1, `${bg}00`);
                ctx.fillStyle = g;
                ctx.fillRect(x - 4, Math.min(y0, y1), w + 8, fadeH);
            }

            if (tapeBox) {
                const t = tapeBox;
                ctx.font = `11px ${font}`;
                ctx.textBaseline = "middle";
                ctx.textAlign = "left";
                ctx.fillStyle = ink(0.35);
                ctx.fillText("time      price   size", t.x, t.y + rowH / 2);
                const shown = Math.floor(t.h / rowH) - 2;
                tape.slice(0, shown).forEach((tr, i) => {
                    const cy = t.y + (i + 2) * rowH + rowH / 2;
                    const alpha = tr.mine ? 1 : Math.max(0.12, 0.85 - i * (0.75 / shown));
                    if (tr.mine) {
                        // Your own fills: a band behind the row and a tag after it.
                        ctx.globalAlpha = 0.14;
                        ctx.fillStyle = tr.buy ? accent : ink(1);
                        ctx.fillRect(t.x - 6, cy - rowH / 2 + 1, 210, rowH - 2);
                        ctx.globalAlpha = 1;
                        ctx.fillStyle = tr.buy ? accent : ink(0.9);
                        ctx.fillText("you", t.x + 176, cy);
                    }
                    const d = new Date(tr.at);
                    const time = `${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
                    ctx.fillStyle = ink(alpha);
                    ctx.fillText(time, t.x, cy);
                    // Buys (lifting the offer) in the accent; sells in ink; hidden midpoint prints dimmer.
                    ctx.fillStyle = tr.buy && !tr.hidden ? accent : ink(Math.min(1, alpha + 0.1));
                    ctx.globalAlpha = tr.hidden ? 0.5 : tr.buy ? Math.min(1, alpha + 0.2) : 1;
                    ctx.fillText(dollars(tr.price), t.x + 80, cy);
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = ink(alpha);
                    ctx.fillText(String(tr.shares).padStart(5, " "), t.x + 136, cy);
                });
            }

            for (const r of ripples) {
                ctx.strokeStyle = accent;
                ctx.globalAlpha = r.t * 0.8;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(r.x, r.y, 4 + (1 - r.t) * 26, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.font = `12px ${font}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            for (const tt of toasts) {
                // Rises and fades; fully opaque for the first half so it can be read.
                ctx.globalAlpha = Math.min(1, tt.t * 2);
                const ty = tt.y - 14 - (1 - tt.t) * 30;
                const width = ctx.measureText(tt.text).width + 14;
                // Centred on the click, but kept inside the ladder.
                const tx = Math.min(Math.max(tt.x, x + width / 2), x + w - width / 2);
                ctx.fillStyle = bg;
                ctx.fillRect(tx - width / 2, ty - 17, width, 20);
                ctx.fillStyle = tt.buy ? accent : ink(0.95);
                ctx.fillText(tt.text, tx, ty);
            }
            ctx.globalAlpha = 1;
        },

        click(cx, cy) {
            if (!inLadder(cx, cy)) return false;
            // The ask side buys (lifting offers), the bid side sells.
            const buy = cx >= ladder.x + ladder.w / 2;
            const fill = e.sweep(buy ? "B" : "S", 100 * Math.round(15 + Math.random() * 25));
            drain(true);
            ripples.push({ x: cx, y: cy, t: 1 });
            if (fill.shares) {
                const avg = (fill.cost / fill.shares / 100).toFixed(3);
                const levels = fill.levels.size > 1 ? ` · ${fill.levels.size} levels` : "";
                const text = `${buy ? "bought" : "sold"} ${fill.shares.toLocaleString("en-US")} · avg ${avg}${levels}`;
                toasts.push({ x: cx, y: cy, text, buy, t: 1 });
            }
            return true;
        },
        hit: inLadder,

        status() {
            const bb = e.best("B");
            const ba = e.best("S");
            return `book · ${dollars(bb)} × ${dollars(ba)} · spread ${ba - bb}¢ · ${trades.toLocaleString("en-US")} trades`;
        },
    };
}
