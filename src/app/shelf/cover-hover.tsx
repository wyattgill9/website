"use client";

import Image, { type StaticImageData } from "next/image";
import { type ReactNode, useEffect, useState } from "react";

// The card is w-36 with a 2:3 cover and 6px padding: 144 × 216 + 12.
const WIDTH = 144;
const HALF_HEIGHT = 114;
const MARGIN = 8;
const GAP = 16;

type Place = { left: number; top: number };

/** A title that shows its cover in a card beside it while hovered. */
export default function CoverHover({ cover, children }: { cover: StaticImageData; children: ReactNode }) {
    const [at, setAt] = useState<Place | null>(null);

    // The card is placed from where the title was when hovered, so drop it once the page moves.
    useEffect(() => {
        if (!at) return;
        const hide = () => setAt(null);
        window.addEventListener("scroll", hide, { capture: true, once: true });
        return () => window.removeEventListener("scroll", hide, { capture: true });
    }, [at]);

    /**
     * In the empty margin left of the column the title sits in, so the card covers nothing; beside the
     * title instead when the margin is too narrow. Centred on the title, but kept inside the window.
     */
    const place = (title: HTMLElement): Place => {
        const r = title.getBoundingClientRect();
        const column = title.closest("aside")?.getBoundingClientRect();
        const margin = column ? column.left - GAP - WIDTH : -1;
        return {
            left: margin >= MARGIN ? margin : r.right + GAP,
            top: Math.min(
                Math.max(r.top + r.height / 2, HALF_HEIGHT + MARGIN),
                window.innerHeight - HALF_HEIGHT - MARGIN
            ),
        };
    };

    return (
        <span
            onMouseEnter={(e) => setAt(place(e.currentTarget))}
            onMouseLeave={() => setAt(null)}
            className="cursor-default underline decoration-[transparent] decoration-1 underline-offset-[5px] transition-colors duration-150 hover:decoration-[color-mix(in_srgb,var(--foreground-color)_35%,transparent)]"
        >
            {children}
            {at && (
                // Fixed rather than absolute, so the pinned aside's scroll box can't clip it.
                <span
                    style={at}
                    className="pointer-events-none fixed z-50 block w-36 -translate-y-1/2 rounded-[8px] bg-[color-mix(in_srgb,var(--foreground-color)_7%,var(--background-color))] p-[6px] shadow-[0_12px_40px_rgba(0,0,0,0.35)] duration-150 animate-in fade-in-0"
                >
                    <Image
                        src={cover}
                        alt=""
                        sizes="144px"
                        placeholder="blur"
                        className="aspect-[2/3] w-full rounded-[4px] object-cover"
                    />
                </span>
            )}
        </span>
    );
}
