import type { Sim } from "./sim-canvas";

/*
 * A five-node Raft cluster: randomized election timeouts, RequestVote, AppendEntries heartbeats carrying client
 * writes, and commit by majority (only entries from the leader's own term, per §5.4.2). Messages take time to
 * cross the circle, so splits and lagging followers show up on their own. Click a node to crash or restart it;
 * left alone, the cluster loses its leader now and then so there's always something to watch.
 */

type Role = "follower" | "candidate" | "leader";
type Node = {
    id: number;
    role: Role;
    up: boolean;
    term: number;
    votedFor: number | null;
    votes: Set<number>;
    timeout: number;
    timeoutMax: number;
    log: number[]; // the term of each entry
    commit: number; // entries [0, commit) are committed
    match: number[]; // leader only: highest index known replicated on each peer
    beat: number; // leader only: time until the next heartbeat
    x: number;
    y: number;
    flash: number;
};
type Msg = {
    kind: "vote" | "voteReply" | "append" | "appendReply";
    from: number;
    to: number;
    term: number;
    ok?: boolean;
    len?: number; // append: leader's log length; appendReply: follower's log length
    log?: number[];
    commit?: number;
    lastTerm?: number;
    t: number; // 0 → 1 along the wire
    speed: number;
};

const N = 5;
const MAJORITY = 3;
const HEARTBEAT = 0.75;
const WRITE_EVERY = 1.4;
const LOG_COLS = 14;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lastTerm = (log: number[]) => log[log.length - 1] ?? 0;

export function createRaft(): Sim {
    const nodes: Node[] = Array.from({ length: N }, (_, id) => ({
        id,
        role: "follower",
        up: true,
        term: 0,
        votedFor: null,
        votes: new Set(),
        timeout: 0,
        timeoutMax: 1,
        log: [],
        commit: 0,
        match: Array(N).fill(0),
        beat: 0,
        x: 0,
        y: 0,
        flash: 0,
    }));
    const msgs: Msg[] = [];
    let writeIn = WRITE_EVERY;
    let chaosIn = rand(14, 20);
    let quietFor = 0; // seconds since the visitor last clicked
    let r = 16; // node radius
    let logBox = { x: 0, y: 0, cell: 10, row: 18 };
    let cols = LOG_COLS;

    const resetTimeout = (n: Node) => {
        n.timeoutMax = rand(1.8, 3.4);
        n.timeout = n.timeoutMax;
    };
    nodes.forEach((n) => {
        resetTimeout(n);
        n.timeout *= rand(0.4, 1); // a staggered start, so the first election is quick
    });

    const send = (m: Omit<Msg, "t" | "speed">) => {
        const a = nodes[m.from];
        const b = nodes[m.to];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        msgs.push({ ...m, t: 0, speed: rand(220, 300) / dist });
    };

    const stepDown = (n: Node, term: number) => {
        n.term = term;
        n.role = "follower";
        n.votedFor = null;
        n.votes.clear();
    };

    const heartbeat = (leader: Node) => {
        leader.beat = HEARTBEAT;
        for (const p of nodes)
            if (p.id !== leader.id)
                send({
                    kind: "append",
                    from: leader.id,
                    to: p.id,
                    term: leader.term,
                    log: leader.log.slice(),
                    len: leader.log.length,
                    commit: leader.commit,
                });
    };

    const deliver = (m: Msg) => {
        const n = nodes[m.to];
        if (!n.up) return;
        if (m.term > n.term) stepDown(n, m.term);
        switch (m.kind) {
            case "vote": {
                const upToDate =
                    m.lastTerm! > lastTerm(n.log) || (m.lastTerm === lastTerm(n.log) && m.len! >= n.log.length);
                const ok = m.term === n.term && (n.votedFor === null || n.votedFor === m.from) && upToDate;
                if (ok) {
                    n.votedFor = m.from;
                    resetTimeout(n);
                }
                send({ kind: "voteReply", from: n.id, to: m.from, term: n.term, ok });
                break;
            }
            case "voteReply": {
                if (n.role !== "candidate" || m.term !== n.term || !m.ok) break;
                n.votes.add(m.from);
                if (n.votes.size >= MAJORITY) {
                    n.role = "leader";
                    n.flash = 1;
                    n.match = nodes.map((p) => (p.id === n.id ? n.log.length : 0));
                    heartbeat(n);
                }
                break;
            }
            case "append": {
                if (m.term < n.term) {
                    send({ kind: "appendReply", from: n.id, to: m.from, term: n.term, ok: false });
                    break;
                }
                n.role = "follower";
                resetTimeout(n);
                // Simplified log matching: the leader ships its whole log and the follower takes it.
                n.log = m.log!;
                n.commit = Math.max(n.commit, Math.min(m.commit!, n.log.length));
                send({ kind: "appendReply", from: n.id, to: m.from, term: n.term, ok: true, len: n.log.length });
                break;
            }
            case "appendReply": {
                if (n.role !== "leader" || m.term !== n.term || !m.ok) break;
                n.match[m.from] = Math.max(n.match[m.from], m.len!);
                n.match[n.id] = n.log.length;
                const sorted = [...n.match].sort((a, b) => b - a);
                const majority = sorted[MAJORITY - 1];
                if (majority > n.commit && n.log[majority - 1] === n.term) n.commit = majority;
                break;
            }
        }
    };

    const toggle = (n: Node) => {
        n.up = !n.up;
        n.flash = 1;
        if (n.up) {
            // Restarts keep the persisted term and log, as Raft requires, and come back as followers.
            n.role = "follower";
            n.votes.clear();
            resetTimeout(n);
        }
    };

    const nodeAt = (x: number, y: number) => nodes.find((n) => Math.hypot(n.x - x, n.y - y) < r + 10);

    return {
        layout({ area }) {
            // The ring with its logs beside it when there's room for both, or below it; left-aligned either way.
            const row = 18;
            const logH = N * row;
            const ringFor = (h: number) => Math.max(50, Math.min(170, (h - 70) / 1.81, (area.w - 70) / 1.9));
            const minLogW = 40 + 8 * 7 * 1.4;
            const wide = area.x + area.w - (area.x + ringFor(area.h) * 1.9 + 64 + 96) >= minLogW;
            const ringH = wide ? area.h : Math.max(140, area.h - logH - 40);
            const R = ringFor(ringH);
            r = Math.max(10, Math.min(16, R * 0.11));
            const cx = area.x + R * 0.951 + 32;
            // Top label to bottom labels spans about 1.81 R plus the node and label heights.
            const cy = area.y + Math.max(0, (ringH - R * 1.81 - 70) / 2) + R + r + 22;
            nodes.forEach((n, i) => {
                const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
                n.x = cx + Math.cos(a) * R;
                n.y = cy + Math.sin(a) * R;
            });
            const logX = wide ? cx + R * 0.951 + 96 : area.x;
            const room = (wide ? area.x + area.w - logX : area.w) - 40;
            const cell = Math.max(7, Math.min(12, room / (LOG_COLS * 1.4)));
            cols = Math.max(6, Math.min(LOG_COLS, Math.floor(room / (cell * 1.4))));
            // Wide: level with the pentagon's middle (it spans cy − R to cy + 0.81 R).
            const logY = wide ? cy - R * 0.095 - logH / 2 : cy + R * 0.81 + r + 48;
            logBox = { x: logX, y: logY, cell, row };
        },

        step(dt) {
            quietFor += dt;
            for (const n of nodes) {
                n.flash = Math.max(0, n.flash - dt * 1.5);
                if (!n.up) continue;
                if (n.role === "leader") {
                    n.beat -= dt;
                    if (n.beat <= 0) heartbeat(n);
                    continue;
                }
                n.timeout -= dt;
                if (n.timeout > 0) continue;
                // Election timeout: become a candidate for a new term and ask everyone for a vote.
                n.role = "candidate";
                n.term += 1;
                n.votedFor = n.id;
                n.votes = new Set([n.id]);
                resetTimeout(n);
                for (const p of nodes)
                    if (p.id !== n.id)
                        send({
                            kind: "vote",
                            from: n.id,
                            to: p.id,
                            term: n.term,
                            len: n.log.length,
                            lastTerm: lastTerm(n.log),
                        });
            }

            const leader = nodes.find((n) => n.up && n.role === "leader");
            writeIn -= dt;
            if (writeIn <= 0) {
                writeIn = WRITE_EVERY * rand(0.6, 1.4);
                if (leader) leader.log.push(leader.term);
            }

            chaosIn -= dt;
            if (chaosIn <= 0) {
                chaosIn = rand(14, 22);
                const down = nodes.filter((n) => !n.up);
                // Bring back anything still down; otherwise, if the visitor's been idle, take out the leader.
                if (down.length) down.forEach(toggle);
                else if (leader && quietFor > 10) {
                    toggle(leader);
                    chaosIn = rand(4, 6);
                }
            }

            for (let i = msgs.length - 1; i >= 0; i--) {
                const m = msgs[i];
                m.t += m.speed * dt;
                if (m.t < 1) continue;
                msgs.splice(i, 1);
                deliver(m);
            }
        },

        draw(ctx, env) {
            const { ink, accent, font } = env;
            ctx.lineCap = "round";

            // Wires: every pair, faint.
            ctx.strokeStyle = ink(0.07);
            ctx.lineWidth = 1;
            for (let i = 0; i < N; i++)
                for (let j = i + 1; j < N; j++) {
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }

            // Messages in flight. Votes are the accent; heartbeats carry entries and are larger when they do.
            for (const m of msgs) {
                const a = nodes[m.from];
                const b = nodes[m.to];
                const t = m.t;
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;
                const vote = m.kind === "vote" || m.kind === "voteReply";
                const reply = m.kind.endsWith("Reply");
                ctx.fillStyle = vote ? accent : ink(reply ? 0.35 : 0.75);
                ctx.beginPath();
                ctx.arc(x, y, reply ? 1.6 : 2.6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (const n of nodes) {
                // Election timer: an arc that drains until the node stands for election.
                if (n.up && n.role !== "leader") {
                    const f = Math.max(0, n.timeout / n.timeoutMax);
                    ctx.strokeStyle = n.role === "candidate" ? accent : ink(0.28);
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, r + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
                    ctx.stroke();
                }
                if (n.flash > 0) {
                    ctx.strokeStyle = n.up ? ink(0.4 * n.flash) : `rgba(128,128,128,${0.4 * n.flash})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, r + 6 + (1 - n.flash) * 18, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
                ctx.fillStyle = env.bg;
                ctx.fill();
                if (!n.up) {
                    ctx.setLineDash([2, 3]);
                    ctx.strokeStyle = ink(0.25);
                } else if (n.role === "leader") {
                    ctx.fillStyle = env.fg;
                    ctx.fill();
                    ctx.strokeStyle = env.fg;
                } else {
                    ctx.strokeStyle = n.role === "candidate" ? accent : ink(0.55);
                }
                ctx.lineWidth = 1.25;
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.font = `${Math.round(r * 0.75)}px ${font}`;
                ctx.fillStyle = !n.up ? ink(0.3) : n.role === "leader" ? env.bg : env.fg;
                ctx.fillText(n.up ? `${n.term}` : "×", n.x, n.y + 0.5);

                ctx.font = `11px ${font}`;
                ctx.fillStyle = ink(n.up ? 0.5 : 0.25);
                const below = n.y > nodes[0].y + 1;
                const label = `n${n.id + 1}${n.up ? (n.role === "leader" ? " leader" : n.role === "candidate" ? " cand." : "") : " down"}`;
                ctx.fillText(label, n.x, n.y + (below ? r + 22 : -(r + 20)));
            }

            // Logs: one row per node, aligned by index, so a follower that's behind is visibly shorter.
            const { x, y, cell, row } = logBox;
            const maxLen = Math.max(...nodes.map((n) => n.log.length));
            const start = Math.max(0, maxLen - cols);
            const pitch = cell * 1.4;
            ctx.textAlign = "left";
            ctx.font = `11px ${font}`;
            for (const n of nodes) {
                const ry = y + n.id * row;
                ctx.fillStyle = ink(n.up ? 0.5 : 0.25);
                ctx.fillText(`n${n.id + 1}`, x, ry + cell / 2);
                for (let i = start; i < start + cols; i++) {
                    const cx = x + 40 + (i - start) * pitch;
                    if (i >= n.log.length) {
                        ctx.fillStyle = ink(0.06);
                        ctx.fillRect(cx, ry, cell, cell);
                        continue;
                    }
                    // Committed entries are solid; uncommitted ones are an outline.
                    const shade = n.up ? 1 : 0.35;
                    if (i < n.commit) {
                        ctx.fillStyle = ink(0.75 * shade);
                        ctx.fillRect(cx, ry, cell, cell);
                    } else {
                        ctx.strokeStyle = ink(0.6 * shade);
                        ctx.lineWidth = 1;
                        ctx.strokeRect(cx + 0.5, ry + 0.5, cell - 1, cell - 1);
                    }
                }
            }
        },

        click(x, y) {
            const n = nodeAt(x, y);
            if (!n) return false;
            quietFor = 0;
            toggle(n);
            return true;
        },
        hit: (x, y) => !!nodeAt(x, y),

        status() {
            const leader = nodes.find((n) => n.up && n.role === "leader");
            const term = Math.max(...nodes.map((n) => n.term));
            const commit = Math.max(...nodes.map((n) => n.commit));
            return `raft · term ${term} · ${leader ? `leader n${leader.id + 1}` : "electing"} · ${commit} committed`;
        },
    };
}
