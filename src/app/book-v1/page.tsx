import type { Metadata } from "next";
import Home from "../components/home";

// The first order book, kept for comparison; unlinked and not indexed.
export const metadata: Metadata = { title: "Wyatt Gill", robots: { index: false } };

export default function BookV1() {
    return <Home fixed="book-v1" />;
}
