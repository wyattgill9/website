"use client";
import React, { useEffect } from "react";
import { useGlobal } from "../context-providers/global-provider";

import MobileNav from "./components/mobile-nav";
import FrontPage from "./components/front-page";
import DragonPond from "./components/dragon-pond/dragon-pond";
import TopNav from "./components/top-nav";

export default function Home() {
    const { isMobile } = useGlobal();

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

    if (isMobile === null) return null;

    return (
        <div
            id="mainPage"
            className="relative h-[100dvh] w-full overflow-hidden bg-background transition-colors duration-300"
        >
            <DragonPond className="absolute inset-0 h-full w-full" />
            {isMobile ? <MobileNav /> : <TopNav />}
            <main className="relative z-20 flex h-full flex-col">
                <FrontPage />
            </main>
        </div>
    );
}
