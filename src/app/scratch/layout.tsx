import type { ReactNode } from "react";

// Unlisted: not in the nav and not indexed, so only someone who types /scratch finds it.
export const metadata = {
    title: "Scratch",
    robots: { index: false },
};

export default function ScratchLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
