"use client";
import { motion } from "motion/react";
import { useGlobal } from "../../context-providers/global-provider";
import Cited from "./citation";
import Container from "./container";
import { SOURCES } from "../data/sources";

const SOCIALS = [
    { label: "github", href: "https://github.com/wyattgill9" },
    { label: "linkedin", href: "https://www.linkedin.com/in/wyatt-gill-17380b323/" },
    { label: "x", href: "https://x.com/WyattGill_" },
    { label: "email", href: "mailto:wyattgill01@outlook.com" },
];

const UNDERLINE =
    "underline decoration-[color-mix(in_srgb,var(--foreground-color)_35%,transparent)] decoration-1 underline-offset-[5px] outline-none transition-opacity duration-150 hover:decoration-foreground focus-visible:decoration-foreground";

const QuoteLines = () => (
    <>
        {/* 鲤鱼跃龙门, "the carp leaps the dragon gate": a carp that clears the falls becomes a dragon. */}
        <span lang="zh-Hans">鲤鱼跃龙门</span>
        <br />
        the carp that clears the gate
        <br />
        becomes a dragon
    </>
);

// The pond and the layout started as Dao Ho's portfolio.
const Credit = ({ className }: { className?: string }) => (
    <p className={`text-[12px] opacity-40 ${className ?? ""}`}>
        based on{" "}
        <a href="https://daoho.dev" target="_blank" rel="noopener noreferrer" className={UNDERLINE}>
            daoho.dev
        </a>
    </p>
);

const Socials = ({ className }: { className?: string }) => (
    <p className={className}>
        {SOCIALS.map(({ label, href }, i) => (
            <span key={label}>
                {i > 0 && <span className="opacity-40"> · </span>}
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${UNDERLINE} opacity-60 hover:opacity-100 focus-visible:opacity-100`}
                >
                    {label}
                </a>
            </span>
        ))}
    </p>
);

const FrontPage = () => {
    const { isMobile } = useGlobal();

    if (isMobile === null) return null;
    return isMobile ? mobilePage() : desktopPage();
};

const desktopPage = () => {
    return (
        <Container
            as="header"
            className="flex h-full flex-col justify-start gap-10 bg-transparent pb-12 pt-24 text-foreground [@media(max-height:720px)]:gap-6 [@media(max-height:720px)]:pt-20"
        >
            <motion.blockquote
                data-dragon-avoid
                className="font-geistMono text-[14px] lowercase leading-relaxed tracking-[0.02em]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.4 }}
            >
                <QuoteLines />
            </motion.blockquote>
            <motion.div
                data-dragon-avoid
                className="cited-prose max-w-[54rem] font-geistMono text-[15px] leading-[max(22px,3vh)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <h1>Wyatt Gill.</h1>
                <p>
                    Systems engineer in San Francisco, most recently @ <Cited source="ix">ix.dev</Cited>.
                </p>
                <p>
                    <Cited source="rust">Rust</Cited> and <Cited source="cpp">C++</Cited> on{" "}
                    <Cited source="nixos">NixOS</Cited>, with <Cited source="helix">Helix</Cited> +{" "}
                    <Cited source="tmux">tmux</Cited>.
                </p>
                <p>
                    Favorite paper: <Cited source="raft">Raft</Cited>. More on my <Cited source="shelf">shelf</Cited>.
                </p>
                <Socials className="mt-[1.5vh]" />
                <Credit className="mt-[1vh]" />
            </motion.div>
        </Container>
    );
};

// Hover cards need a pointer, so on touch the mentions link straight to each site.
const MobileLink = ({ source, children }: { source: string; children: React.ReactNode }) => (
    <a href={SOURCES[source].href} target="_blank" rel="noopener noreferrer" className={UNDERLINE}>
        {children}
    </a>
);

const mobilePage = () => {
    return (
        // Top padding clears the floating nav pill.
        <Container
            as="header"
            className="flex h-full flex-col justify-start gap-8 bg-transparent pb-12 pt-28 font-geistMono text-foreground [@media(max-height:640px)]:gap-5"
        >
            <motion.blockquote
                data-dragon-avoid
                className="text-[13px] lowercase leading-relaxed tracking-[0.02em]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.4 }}
            >
                <QuoteLines />
            </motion.blockquote>
            <motion.div
                data-dragon-avoid
                className="flex flex-col gap-3 text-[14px] leading-[1.6]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <h1>Wyatt Gill.</h1>
                <p>
                    Systems engineer in San Francisco, most recently @ <MobileLink source="ix">ix.dev</MobileLink>.
                </p>
                <p>
                    <MobileLink source="rust">Rust</MobileLink> and <MobileLink source="cpp">C++</MobileLink> on{" "}
                    <MobileLink source="nixos">NixOS</MobileLink>, with <MobileLink source="helix">Helix</MobileLink> +{" "}
                    <MobileLink source="tmux">tmux</MobileLink>.
                </p>
                <p>
                    Favorite paper: <MobileLink source="raft">Raft</MobileLink>.
                </p>
                <Socials className="mt-2" />
                <Credit className="mt-1" />
            </motion.div>
        </Container>
    );
};

export default FrontPage;
