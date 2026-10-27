"use client";

import { useGlobal } from "../../context-providers/global-provider";
import MobileNav from "./mobile-nav";
import TopNav from "./top-nav";

/** The nav for server-rendered pages, which can't read isMobile themselves. */
export default function SiteNav() {
    const { isMobile } = useGlobal();
    if (isMobile === null) return null;
    return isMobile ? <MobileNav /> : <TopNav />;
}
