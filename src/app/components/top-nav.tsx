"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import ThemeIcon from "./theme-icon";

const LINKS = [
    { label: "pond", href: "/" },
    { label: "projects", href: "/projects" },
    { label: "shelf", href: "/shelf" },
    { label: "blog", href: "/blog" },
];

const ITEM = "transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 outline-none";

export default function TopNav() {
    const pathname = usePathname();
    const { resolvedTheme, setTheme } = useTheme();
    // A nested page still counts as being in its section.
    const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

    return (
        <nav
            data-koi-avoid
            aria-label="Main"
            className="fixed inset-x-0 top-0 z-30 flex items-center justify-center gap-8 pt-8 font-geistMono text-[13px] lowercase text-foreground transition-colors duration-200"
        >
            {LINKS.map(({ label, href }) => (
                <Link
                    key={href}
                    href={href}
                    aria-current={active(href) ? "page" : undefined}
                    className={`${ITEM} ${active(href) ? "opacity-100" : "opacity-50"}`}
                >
                    {label}
                </Link>
            ))}
            {/* A margin of dead space around the toggle, so a near miss doesn't drop food in the pond behind it. */}
            <span data-koi-ignore className="-m-4 flex p-4">
                <button
                    type="button"
                    onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
                    aria-label="Toggle theme"
                    className={`${ITEM} opacity-50`}
                >
                    <ThemeIcon size={15} />
                </button>
            </span>
        </nav>
    );
}
