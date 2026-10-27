"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Container from "./container";
import ThemeIcon from "./theme-icon";

// tmux windows: the home page is the shell, fish.
export const LINKS = [
    { label: "fish", href: "/" },
    { label: "projects", href: "/projects" },
    { label: "shelf", href: "/shelf" },
    // { label: "blog", href: "/blog" },
];

const ITEM = "transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 outline-none";

/** A tmux status line: session name, numbered windows with `*` on the current one, theme toggle on the right. */
export default function TopNav() {
    const pathname = usePathname();
    const { resolvedTheme, setTheme } = useTheme();
    // A nested page still counts as being in its section.
    const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

    return (
        <Container
            as="nav"
            data-dragon-avoid
            aria-label="Main"
            className="fixed inset-x-0 top-0 z-30 flex items-center gap-6 pt-8 font-geistMono text-[13px] lowercase text-foreground transition-colors duration-200"
        >
            <span className="opacity-50">[wyatt]</span>
            {LINKS.map(({ label, href }, i) => (
                <Link
                    key={href}
                    href={href}
                    aria-current={active(href) ? "page" : undefined}
                    className={`${ITEM} ${active(href) ? "opacity-100" : "opacity-50"}`}
                >
                    <span className="opacity-60">{i}:</span>
                    {label}
                    <span aria-hidden="true" className={active(href) ? "" : "invisible"}>
                        *
                    </span>
                </Link>
            ))}
            {/* A margin of dead space around the toggle, so a near miss doesn't drop food in the pond behind it. */}
            <span data-dragon-ignore className="-m-4 ml-auto flex p-4">
                <button
                    type="button"
                    onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
                    aria-label="Toggle theme"
                    className={`${ITEM} opacity-50`}
                >
                    <ThemeIcon size={15} />
                </button>
            </span>
        </Container>
    );
}
