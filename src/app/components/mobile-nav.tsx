"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Socials } from "./front-page";
import ThemeIcon from "./theme-icon";
import { isActive, LINKS } from "./top-nav";

const ITEM = "transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 outline-none";

export default function MobileNav() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <>
            {/* Single persistent pill — always on top */}
            <div className="fixed inset-x-3 top-3 z-50 lg:hidden">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-controls="mobile-menu"
                    aria-label={open ? "Close menu" : "Open menu"}
                    className="flex w-full items-center justify-between rounded-full bg-[color-mix(in_srgb,var(--foreground-color)_6%,transparent)] px-5 py-3.5 font-geistMono text-[14px] lowercase text-foreground backdrop-blur-md"
                >
                    dao ho
                    <span className="relative size-4 opacity-50">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                                key={open ? "close" : "grid"}
                                className="absolute inset-0"
                                initial={{ opacity: 0, rotate: open ? 45 : -45 }}
                                animate={{ opacity: 1, rotate: 0 }}
                                exit={{ opacity: 0, rotate: open ? 45 : -45 }}
                                transition={{ duration: 0.18 }}
                            >
                                {open ? <CloseIcon /> : <GridIcon />}
                            </motion.span>
                        </AnimatePresence>
                    </span>
                </button>
            </div>

            {/* Full screen overlay */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        id="mobile-menu"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 flex flex-col bg-background px-6 font-geistMono lowercase text-foreground lg:hidden"
                    >
                        <nav aria-label="Main" className="flex flex-1 flex-col justify-center gap-2">
                            {LINKS.map(({ label, href }, i) => (
                                <motion.div
                                    key={href}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.07 + 0.08, duration: 0.28, ease: "easeOut" }}
                                >
                                    <Link
                                        href={href}
                                        onClick={() => setOpen(false)}
                                        aria-current={isActive(pathname, href) ? "page" : undefined}
                                        className={`${ITEM} block text-[28px] leading-[1.6] ${isActive(pathname, href) ? "opacity-100" : "opacity-50"}`}
                                    >
                                        {label}
                                    </Link>
                                </motion.div>
                            ))}
                        </nav>

                        <div className="flex items-center justify-between pb-12 text-[13px]">
                            <Socials />
                            <button
                                type="button"
                                onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
                                aria-label="Toggle theme"
                                className={`${ITEM} -m-3 p-3 opacity-50`}
                            >
                                <ThemeIcon size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function GridIcon() {
    return (
        <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="12" cy="4" r="1.5" />
            <circle cx="4" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg
            className="size-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden
        >
            <path d="M3 3L13 13M13 3L3 13" />
        </svg>
    );
}
