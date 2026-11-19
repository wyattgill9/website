import { useEffect, useRef, type RefObject } from "react";
import { useTheme } from "next-themes";
import { cn } from "../../../lib/utils";

export type Rect = { x: number; y: number; w: number; h: number };

/** What a sim draws with. `area` is the free space beside the bio text; sims lay themselves out inside it. */
export type Env = {
    w: number;
    h: number;
    area: Rect;
    light: boolean;
    fg: string;
    bg: string;
    accent: string;
    font: string;
    /** `fg` at an alpha, the one way sims shade things. */
    ink: (alpha: number) => string;
};

export interface Sim {
    layout(env: Env): void;
    step(dt: number): void;
    draw(ctx: CanvasRenderingContext2D, env: Env): void;
    /** True if the click hit something. */
    click?(x: number, y: number): boolean;
    hit?(x: number, y: number): boolean;
    status?(): string;
}

const INTERACTIVE = "a, button, input, textarea, select, label, [role='button'], [data-dragon-ignore]";

function hexToRgb(hex: string) {
    const n = parseInt(hex.replace("#", ""), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** The tight box around the bio's text, from the elements marked to be avoided inside <main>. */
function textBox(origin: DOMRect): Rect | null {
    const range = document.createRange();
    let l = Infinity,
        t = Infinity,
        r = -Infinity,
        b = -Infinity;
    for (const el of document.querySelectorAll("main [data-dragon-avoid]")) {
        range.selectNodeContents(el);
        for (const box of range.getClientRects()) {
            if (!box.width || !box.height) continue;
            l = Math.min(l, box.left);
            t = Math.min(t, box.top);
            r = Math.max(r, box.right);
            b = Math.max(b, box.bottom);
        }
    }
    if (l === Infinity) return null;
    return { x: l - origin.left, y: t - origin.top, w: r - l, h: b - t };
}

/**
 * The content column between the nav and the text, so a sim sits above its caption like a figure. The text's
 * left edge is the page gutter, mirrored for the right edge.
 */
function freeArea(w: number, h: number, origin: DOMRect): Rect {
    const nav = document.querySelector("nav[aria-label='Main']")?.getBoundingClientRect();
    const top = Math.max(nav ? nav.bottom - origin.top + 40 : 80, 80);
    const text = textBox(origin) ?? { x: 24, y: h - 24, w: 0, h: 0 };
    return { x: text.x, y: top, w: w - 2 * text.x, h: Math.max(120, text.y - 56 - top) };
}

export default function SimCanvas({
    make,
    className,
    statusRef,
}: {
    make: () => Sim;
    className?: string;
    statusRef?: RefObject<HTMLElement | null>;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const light = useTheme().resolvedTheme === "light";
    const lightRef = useRef(light);
    const redraw = useRef<() => void>(() => {});

    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const sim = make();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        let env: Env | null = null;
        let raf = 0;
        let last = 0;
        let visible = true;
        let statusAt = 0;

        const measure = () => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const css = getComputedStyle(document.documentElement);
            const fg = css.getPropertyValue("--foreground-color").trim();
            const rgb = hexToRgb(fg);
            const mono = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim();
            env = {
                w: rect.width,
                h: rect.height,
                area: freeArea(rect.width, rect.height, rect),
                light: lightRef.current,
                fg,
                bg: css.getPropertyValue("--background-color").trim(),
                accent: css.getPropertyValue("--accent-color").trim(),
                font: `${mono || "ui-monospace"}, ui-monospace, monospace`,
                ink: (a) => `rgba(${rgb}, ${a})`,
            };
            sim.layout(env);
            paint();
        };

        const paint = () => {
            if (!env) return;
            ctx.clearRect(0, 0, env.w, env.h);
            sim.draw(ctx, env);
            const now = performance.now();
            if (statusRef?.current && sim.status && now - statusAt > 200) {
                statusAt = now;
                const s = sim.status();
                if (statusRef.current.textContent !== s) statusRef.current.textContent = s;
            }
        };

        const frame = (now: number) => {
            sim.step(Math.min(0.05, (now - last) / 1000));
            last = now;
            paint();
            raf = requestAnimationFrame(frame);
        };

        const schedule = () => {
            cancelAnimationFrame(raf);
            if (!visible || document.hidden) return;
            if (reduced.matches) {
                // One settled frame instead of motion.
                for (let i = 0; i < 600; i++) sim.step(1 / 60);
                paint();
                return;
            }
            last = performance.now();
            raf = requestAnimationFrame(frame);
        };

        const local = (e: MouseEvent) => {
            const r = canvas.getBoundingClientRect();
            return [e.clientX - r.left, e.clientY - r.top] as const;
        };
        const onClick = (e: MouseEvent) => {
            if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVE))) return;
            if (window.getSelection()?.toString()) return;
            if (sim.click?.(...local(e)) && reduced.matches) schedule();
        };
        const onMove = (e: PointerEvent) => {
            if (!sim.hit) return;
            const over =
                !e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVE)) && sim.hit(...local(e));
            document.body.style.cursor = over ? "pointer" : "";
        };

        // next-themes flips the class in its own effect; read the new colours a frame later.
        redraw.current = () => requestAnimationFrame(measure);

        const ro = new ResizeObserver(measure);
        ro.observe(canvas);
        const io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            schedule();
        });
        io.observe(canvas);
        document.addEventListener("visibilitychange", schedule);
        reduced.addEventListener("change", schedule);
        window.addEventListener("click", onClick);
        window.addEventListener("pointermove", onMove, { passive: true });
        // The bio fades in and the mono font swaps in late; measure again once both have settled.
        document.fonts.ready.then(measure);
        const settle = setTimeout(measure, 600);
        measure();
        schedule();

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(settle);
            ro.disconnect();
            io.disconnect();
            document.removeEventListener("visibilitychange", schedule);
            reduced.removeEventListener("change", schedule);
            window.removeEventListener("click", onClick);
            window.removeEventListener("pointermove", onMove);
            document.body.style.cursor = "";
        };
        // `make` is a fresh closure each render; the sim is built once per mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        lightRef.current = light;
        redraw.current();
    }, [light]);

    return <canvas ref={canvasRef} aria-hidden="true" className={cn("pointer-events-none", className)} />;
}
