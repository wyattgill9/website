import type { Sim } from "./sim-canvas";

/*
 * A Rust workspace where every crate is its own Nix derivation (the nix-cargo-unit idea). It cold-builds once,
 * then something gets edited: that derivation and everything downstream of it (its blast radius) rebuild on four
 * builders while the rest stays cached. Click a derivation to edit it yourself.
 */

type State = "cached" | "dirty" | "building";
type Drv = {
    name: string;
    version: string;
    row: number;
    col: number;
    deps: number[];
    users: number[];
    cost: number; // seconds to build
    state: State;
    progress: number;
    glow: number; // 1 right after a build, fading
    x: number;
    y: number;
};

// [name, version, row, column, deps, build seconds]. Rows run from leaves to the final binary; columns 0–3 are
// placed by hand so each crate sits near what it depends on and the edges barely cross.
const GRAPH: [string, string, number, number, string[], number][] = [
    ["libc", "0.2.174", 0, 0, [], 0.6],
    ["cfg-if", "1.0.1", 0, 1, [], 0.3],
    ["memchr", "2.7.5", 0, 2, [], 0.6],
    ["unicode-ident", "1.0.18", 0, 3, [], 0.4],
    ["mio", "1.0.4", 1, 0, ["libc"], 0.7],
    ["bytes", "1.10.1", 1, 1, [], 0.6],
    ["itoa", "1.0.15", 1, 2, [], 0.3],
    ["proc-macro2", "1.0.95", 1, 3, ["unicode-ident"], 0.8],
    ["tokio", "1.47.1", 2, 0, ["mio", "bytes", "libc"], 2.2],
    ["tracing", "0.1.41", 2, 1, ["cfg-if"], 0.9],
    ["quote", "1.0.40", 2, 3, ["proc-macro2"], 0.5],
    ["hyper", "1.6.0", 3, 0.5, ["tokio", "bytes", "tracing"], 1.7],
    ["syn", "2.0.104", 3, 3, ["proc-macro2", "quote", "unicode-ident"], 2.6],
    ["axum", "0.8.4", 4, 0.5, ["hyper", "tokio"], 1.5],
    ["serde_derive", "1.0.219", 4, 2, ["syn"], 1.3],
    ["clap_derive", "4.5.41", 4, 3, ["syn"], 1.0],
    ["serde", "1.0.219", 5, 2, ["serde_derive"], 1.0],
    ["clap", "4.5.41", 5, 3, ["clap_derive"], 1.3],
    ["ix-core", "0.1.0", 6, 1, ["serde", "tokio", "tracing"], 1.6],
    ["serde_json", "1.0.141", 6, 2, ["serde", "memchr", "itoa"], 1.1],
    ["ix-store", "0.1.0", 7, 0.5, ["ix-core", "bytes"], 1.2],
    ["ix-api", "0.1.0", 7, 1.5, ["axum", "ix-core", "serde_json"], 1.8],
    ["ix", "0.1.0", 8, 1.5, ["ix-api", "ix-store", "clap"], 1.4],
];
const ROWS = 9;
const JOBS = 4;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function createNix(): Sim {
    const index = new Map(GRAPH.map(([name], i) => [name, i]));
    const drvs: Drv[] = GRAPH.map(([name, version, row, col, deps, cost]) => ({
        name,
        version,
        row,
        col,
        deps: deps.map((d) => index.get(d)!),
        users: [],
        cost,
        state: "dirty",
        progress: 0,
        glow: 0,
        x: 0,
        y: 0,
    }));
    drvs.forEach((d, i) => d.deps.forEach((p) => drvs[p].users.push(i)));

    let edited: number | null = null;
    let radius = drvs.length;
    let rebuilt = 0;
    let idle = 0;
    let labels = true;
    let pulses: { from: number; to: number; t: number }[] = [];
    let panel = { x: 0, y: 0 };
    let horizontal = false;
    let nodeR = 4;

    const edit = (i: number) => {
        // The edited derivation and everything that depends on it, transitively.
        const blast = new Set<number>();
        const visit = (j: number) => {
            if (blast.has(j)) return;
            blast.add(j);
            drvs[j].users.forEach(visit);
        };
        visit(i);
        blast.forEach((j) => {
            drvs[j].state = "dirty";
            drvs[j].progress = 0;
        });
        edited = i;
        radius = blast.size;
        rebuilt = 0;
        idle = 0;
    };

    const nodeAt = (x: number, y: number) => {
        let best = -1;
        let bestD = 18;
        drvs.forEach((d, i) => {
            const dist = Math.hypot(d.x - x, d.y - y);
            if (dist < bestD) {
                best = i;
                bestD = dist;
            }
        });
        return best;
    };

    return {
        layout({ area, font }) {
            const ctx = document.createElement("canvas").getContext("2d")!;
            ctx.font = `10.5px ${font}`;
            const label = Math.max(...drvs.map((d) => ctx.measureText(d.name).width));
            const inset = label / 2 + 4; // so the outermost labels stay inside the column
            horizontal = area.w >= area.h * 1.4;
            if (horizontal) {
                // Leaves on the left, the binary on the right; columns 0–3 become lanes down the band.
                const span = Math.min(area.w - 2 * inset, 900);
                const gap = span / (ROWS - 1);
                labels = gap - 12 >= label;
                // Without labels the builders list names the work, under the graph.
                const panelH = labels ? 0 : JOBS * 18 + 24;
                const cross = Math.min(area.h - 30 - panelH, 240);
                const top = area.y + (area.h - 30 - panelH - cross) / 2;
                panel = { x: area.x, y: top + cross + 36 };
                for (const d of drvs) {
                    d.x = area.x + inset + d.row * gap;
                    d.y = top + (d.col / 3) * cross;
                }
            } else {
                const width = Math.min(area.w - 2 * inset, 520);
                labels = width / 3 - 10 >= label;
                let rowGap = Math.min(56, area.h / (ROWS - 1));
                if (rowGap < 26) labels = false;
                if (!labels) rowGap = Math.min(56, (area.h - JOBS * 18 - 36) / (ROWS - 1));
                for (const d of drvs) {
                    d.x = area.x + inset + (d.col / 3) * width;
                    d.y = area.y + d.row * rowGap;
                }
                panel = { x: area.x, y: area.y + rowGap * (ROWS - 1) + 36 };
            }
            nodeR = labels ? 4 : 3.5;
        },

        step(dt) {
            for (const d of drvs) d.glow = Math.max(0, d.glow - dt * 0.45);
            pulses = pulses.filter((p) => (p.t += dt * 2.2) < 1);

            // Start whatever is ready, up to the builder count.
            let running = drvs.filter((d) => d.state === "building").length;
            for (const d of drvs) {
                if (running >= JOBS) break;
                if (d.state === "dirty" && d.deps.every((p) => drvs[p].state === "cached")) {
                    d.state = "building";
                    d.progress = 0;
                    running++;
                }
            }
            for (const [i, d] of drvs.entries()) {
                if (d.state !== "building") continue;
                d.progress += dt / d.cost;
                if (d.progress < 1) continue;
                d.state = "cached";
                d.glow = 1;
                rebuilt++;
                d.users.forEach((u) => drvs[u].state === "dirty" && pulses.push({ from: i, to: u, t: 0 }));
            }

            if (drvs.every((d) => d.state === "cached")) {
                idle += dt;
                // Edit something new; anything but the final binary, so there's a radius to see.
                if (idle > 3.2) edit(Math.floor(rand(0, drvs.length - 1)));
            }
        },

        draw(ctx, { ink, accent, font, fg }) {
            // An S-curve from a dependency to its dependent, leaving and arriving along the build direction.
            const controls = (a: Drv, b: Drv) => {
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                return horizontal ? [mx, a.y, mx, b.y] : [a.x, my, b.x, my];
            };
            const curve = (a: Drv, b: Drv) => {
                const [c1x, c1y, c2x, c2y] = controls(a, b);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.bezierCurveTo(c1x, c1y, c2x, c2y, b.x, b.y);
            };

            ctx.lineWidth = 1;
            for (const d of drvs)
                for (const p of d.deps) {
                    const dep = drvs[p];
                    const live = d.state === "building" || (d.state === "dirty" && dep.state !== "cached");
                    ctx.strokeStyle = live ? ink(0.22) : ink(0.09);
                    curve(dep, d);
                    ctx.stroke();
                }

            // A dot down each edge when a dependency finishes and its dependent can move.
            ctx.fillStyle = accent;
            for (const { from, to, t } of pulses) {
                const a = drvs[from];
                const b = drvs[to];
                const [c1x, c1y, c2x, c2y] = controls(a, b);
                const u = 1 - t;
                const x = u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b.x;
                const y = u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y;
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.font = `10.5px ${font}`;
            for (const [i, d] of drvs.entries()) {
                const s = nodeR;
                if (d.state === "building") {
                    ctx.fillStyle = accent;
                    ctx.fillRect(d.x - s, d.y - s, s * 2, s * 2);
                    ctx.strokeStyle = accent;
                    ctx.lineWidth = 1.25;
                    ctx.beginPath();
                    ctx.arc(d.x, d.y, s + 5, -Math.PI / 2, -Math.PI / 2 + d.progress * Math.PI * 2);
                    ctx.stroke();
                } else if (d.state === "dirty") {
                    ctx.strokeStyle = ink(0.5);
                    ctx.lineWidth = 1;
                    ctx.strokeRect(d.x - s + 0.5, d.y - s + 0.5, s * 2 - 1, s * 2 - 1);
                } else {
                    ctx.fillStyle = d.glow > 0 ? fg : ink(0.45);
                    ctx.globalAlpha = d.glow > 0 ? 0.45 + 0.55 * d.glow : 1;
                    ctx.fillRect(d.x - s, d.y - s, s * 2, s * 2);
                    ctx.globalAlpha = 1;
                }
                if (i === edited && d.state !== "cached") {
                    ctx.strokeStyle = accent;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(d.x, d.y, s + 9, 0, Math.PI * 2);
                    ctx.stroke();
                }
                if (labels) {
                    ctx.fillStyle =
                        d.state === "building" ? accent : d.state === "dirty" ? ink(0.6) : ink(0.3 + 0.5 * d.glow);
                    ctx.fillText(d.name, d.x, d.y + s + 6);
                }
            }

            // Builders, as nix-output-monitor shows them; only when the graph is too tight to carry labels.
            if (labels) return;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = `11px ${font}`;
            const building = drvs.filter((d) => d.state === "building");
            for (let j = 0; j < JOBS; j++) {
                const y = panel.y + j * 18;
                const d = building[j];
                if (!d) {
                    ctx.fillStyle = ink(0.2);
                    ctx.fillText(`builder ${j + 1}  idle`, panel.x, y);
                    continue;
                }
                ctx.fillStyle = ink(0.7);
                ctx.fillText(`builder ${j + 1}  ${d.name}-${d.version}`, panel.x, y);
                const barX = panel.x + 250;
                ctx.fillStyle = ink(0.1);
                ctx.fillRect(barX, y - 2, 90, 4);
                ctx.fillStyle = accent;
                ctx.fillRect(barX, y - 2, 90 * Math.min(1, d.progress), 4);
            }
        },

        click(x, y) {
            const i = nodeAt(x, y);
            if (i < 0) return false;
            edit(i);
            return true;
        },
        hit: (x, y) => nodeAt(x, y) >= 0,

        status() {
            const name = edited === null ? "cold build" : `edited ${drvs[edited].name}`;
            const cached = drvs.length - radius;
            return `nix build · ${name} · ${Math.min(rebuilt, radius)}/${radius} rebuilt · ${cached} cached`;
        },
    };
}
