"use client";
import React, { useEffect, useRef, useState } from "react";
import { useGlobal } from "../../context-providers/global-provider";

import FrontPage from "./front-page";
import DragonPond from "./dragon-pond/dragon-pond";
import TopNav from "./top-nav";
import SimCanvas, { type Sim } from "./sims/sim-canvas";
import { createRaft } from "./sims/raft";
import { createNix } from "./sims/nix";
import { createBook } from "./sims/book";
import { createBookV1 } from "./sims/book-v1";
import { createGo } from "./sims/go";

// The book is the home page; the rest stay reachable, unlinked, at /?v=pond, /?v=raft, /?v=nix, /?v=go, and the
// first order book at /book-v1.
const SIMS: Record<string, { make: () => Sim; hint: string }> = {
    raft: { make: createRaft, hint: "click a node to take it down" },
    nix: { make: createNix, hint: "click a derivation to edit it" },
    book: { make: createBook, hint: "click the ladder to trade" },
    "book-v1": { make: createBookV1, hint: "click the ladder to trade" },
    go: { make: createGo, hint: "click a point to play the next move" },
};
const VARIANTS = ["pond", "raft", "nix", "book", "book-v1", "go"];
const DEFAULT = "book";

/** The epigraph for a canvas experiment: its live status line, then how to poke it. */
const Status = ({ statusRef, hint }: { statusRef: React.RefObject<HTMLParagraphElement | null>; hint: string }) => (
    <div className="flex flex-col gap-0.5">
        <p ref={statusRef} className="min-h-[1.6em] tabular-nums" />
        <p className="text-[12px] opacity-60">{hint}</p>
    </div>
);

/** The home screen. `fixed` pins the experiment (a route of its own); otherwise ?v= picks it. */
export default function Home({ fixed }: { fixed?: string }) {
    const { isMobile } = useGlobal();
    // Read on the client only; the server renders nothing here anyway until isMobile is known.
    const [variant] = useState(() => {
        if (fixed) return fixed;
        if (typeof window === "undefined") return null;
        const v = new URLSearchParams(window.location.search).get("v") ?? DEFAULT;
        return VARIANTS.includes(v) ? v : DEFAULT;
    });
    const statusRef = useRef<HTMLParagraphElement>(null);

    // The home page is a single screen: no scrolling and no overscroll bounce. Restored when leaving the page.
    useEffect(() => {
        const root = document.documentElement;
        const previous = { overflow: root.style.overflow, overscroll: root.style.overscrollBehavior };
        root.style.overflow = "hidden";
        root.style.overscrollBehavior = "none";
        return () => {
            root.style.overflow = previous.overflow;
            root.style.overscrollBehavior = previous.overscroll;
        };
    }, []);

    if (isMobile === null || variant === null) return null;
    const sim = SIMS[variant];

    return (
        <div
            id="mainPage"
            className="relative h-[100dvh] w-full overflow-hidden bg-background transition-colors duration-300"
        >
            {variant === "pond" && <DragonPond className="absolute inset-0 h-full w-full" />}
            {sim && <SimCanvas make={sim.make} statusRef={statusRef} className="absolute inset-0 h-full w-full" />}
            <TopNav />
            <main className="relative z-20 flex h-full flex-col">
                <FrontPage epigraph={sim ? <Status statusRef={statusRef} hint={sim.hint} /> : undefined} />
            </main>
        </div>
    );
}
