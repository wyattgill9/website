/** Sources for the landing page's @-mentions: what the hover card shows, plus where a click lands. */

export type Source = {
    key: string;
    /** Shown beside the mark in the card header. */
    name: string;
    /**
     * Optical size correction, default 1. A circular plate covers ~79% of the
     * area a square one does, so it reads small at the same dimensions.
     */
    iconScale?: number;
    /** Vendored favicon in /public/logos. Omit and the card falls back to a monogram. */
    icon?: string;
    /** Prominent line in the card — the title slot. */
    role: string;
    /** Leads the body line, the way a publication date does in a real citation. */
    dates: string;
    /** One line on the work itself. */
    summary: string;
    /** Where a click lands: an in-app path or an external URL. */
    href?: string;
    /** Keys of other sources this one rolls up; the card lists each of them instead of one role. */
    group?: string[];
};

export const SOURCES: Record<string, Source> = {
    ix: {
        key: "ix",
        name: "ix.dev",
        role: "Previously",
        dates: "Past",
        summary: "Where I worked before.",
        href: "https://ix.dev",
    },
    rust: {
        key: "rust",
        name: "Rust",
        role: "Primary language",
        dates: "Stack",
        summary: "Systems code without the footguns.",
        href: "https://github.com/rust-lang/rust",
    },
    cpp: {
        key: "cpp",
        name: "C++",
        role: "Primary language",
        dates: "Stack",
        summary: "When it has to go fast.",
        href: "https://github.com/llvm/llvm-project",
    },
    nixos: {
        key: "nixos",
        name: "NixOS",
        role: "Daily driver",
        dates: "Setup",
        summary: "My whole machine, declared in one repo.",
        href: "https://github.com/wyattgill9/nix-config",
    },
    helix: {
        key: "helix",
        name: "Helix",
        role: "Editor",
        dates: "Setup",
        summary: "Modal editing, batteries included.",
        href: "https://github.com/helix-editor/helix",
    },
    tmux: {
        key: "tmux",
        name: "tmux",
        role: "Terminal multiplexer",
        dates: "Setup",
        summary: "Everything lives in a session.",
        href: "https://github.com/tmux/tmux",
    },
    raft: {
        key: "raft",
        name: "Raft",
        role: "In Search of an Understandable Consensus Algorithm",
        dates: "Favorite paper",
        summary: "Ongaro & Ousterhout, 2014.",
        href: "https://raft.github.io/raft.pdf",
    },
    shelf: {
        key: "shelf",
        name: "Shelf",
        role: "Reading, watching, playing",
        dates: "Synced daily",
        summary: "Favorites, what's on now, and what's next.",
        href: "/shelf",
    },
};
