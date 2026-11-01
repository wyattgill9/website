import type { StaticImageData } from "next/image";
import eightySix from "./86.jpg";
import apocalypseNow from "./apocalypse-now.jpg";
import chernobyl from "./chernobyl.jpg";
import darlingInTheFranxx from "./darling-in-the-franxx.jpg";
import fate from "./fate.jpg";
import inception from "./inception.jpg";
import monogatari from "./monogatari.jpg";
import nierAutomata from "./nier-automata.jpg";
import notesFromUnderground from "./notes-from-underground.jpg";
import reZero from "./re-zero.jpg";
import se7en from "./se7en.jpg";
import slaughterhouseFive from "./slaughterhouse-five.jpg";
import theLastDaysOfSocrates from "./the-last-days-of-socrates.jpg";
import theWindUpBirdChronicle from "./the-wind-up-bird-chronicle.jpg";
import tokyoGhoul from "./tokyo-ghoul.jpg";
import violetEvergarden from "./violet-evergarden.jpg";
import whiplash from "./whiplash.jpg";

/**
 * Covers for the currently and favorites titles, keyed by the title exactly as the shelf writes it.
 * Socrates is a crop of David's The Death of Socrates, the painting on the Penguin edition's cover.
 */
export const COVERS: Record<string, StaticImageData> = {
    "86": eightySix,
    "Apocalypse Now": apocalypseNow,
    Chernobyl: chernobyl,
    "Darling in the Franxx": darlingInTheFranxx,
    "Fate series": fate,
    Inception: inception,
    Monogatari: monogatari,
    "NieR: Automata": nierAutomata,
    "Notes from Underground": notesFromUnderground,
    "Re:Zero": reZero,
    Se7en: se7en,
    "Slaughterhouse-Five": slaughterhouseFive,
    "The Last Days of Socrates": theLastDaysOfSocrates,
    "The Wind-Up Bird Chronicle": theWindUpBirdChronicle,
    "Tokyo Ghoul": tokyoGhoul,
    "Violet Evergarden": violetEvergarden,
    Whiplash: whiplash,
};
