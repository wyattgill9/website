import type { ReactNode } from "react";

// Unlisted: not in the nav and not indexed, so only someone who types /blog finds it.
export const metadata = {
    title: "Blog",
    robots: { index: false },
};

export default function BlogLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
