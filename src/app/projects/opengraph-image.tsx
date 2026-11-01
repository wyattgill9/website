import { shareCard } from "../share-card";

export const alt = "Projects by Wyatt Gill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
    return shareCard({
        active: "projects",
        title: "Projects",
        lines: ["Nix build systems, HVM3 at ~400 MIPS,", "a git forge on object storage, and smaller tools."],
    });
}
