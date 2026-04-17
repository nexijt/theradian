// Centralized tag → color mapping
// HSL strings are used for CSS variables / Tailwind; hex is used for THREE.js

export type PostType = "photo" | "audio";

export interface TagColor {
  hex: string;        // e.g. "#4E7FFF"
  hexNum: number;     // e.g. 0x4E7FFF
  hsl: string;        // e.g. "220 100% 65%"
  rgb: [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): string {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function makeColor(hex: string): TagColor {
  const rgb = hexToRgb(hex);
  return {
    hex,
    hexNum: parseInt(hex.replace("#", ""), 16),
    hsl: rgbToHsl(...rgb),
    rgb,
  };
}

// Photo (rectangular) tags
export const PHOTO_TAG_COLORS: Record<string, TagColor> = {
  PHOTO:  makeColor("#4E7FFF"), // Cobalt
  PIXEL:  makeColor("#B44EFF"), // Violet
  INK:    makeColor("#FFAC33"), // Amber
  MATTER: makeColor("#E8623A"), // Terracotta
};

// Audio (circular) tags
export const AUDIO_TAG_COLORS: Record<string, TagColor> = {
  MUSIC:  makeColor("#FF4464"), // Coral
  VOICE:  makeColor("#F278A1"), // Rose
  SPOKEN: makeColor("#2EC4A2"), // Teal
  SOUND:  makeColor("#4ECC5E"), // Green
};

const DEFAULT_PHOTO = PHOTO_TAG_COLORS.PHOTO;
const DEFAULT_AUDIO = AUDIO_TAG_COLORS.MUSIC;

// Map legacy tag names → new tag names
const LEGACY_MAP: Record<string, string> = {
  DESIGN: "PIXEL",
  WRITING_PHOTO: "INK",
  WRITING_AUDIO: "SPOKEN",
  SFX: "SOUND",
};

export function normalizeTag(tag: string | undefined, type: PostType): string {
  if (!tag) return type === "photo" ? "PHOTO" : "MUSIC";
  const upper = tag.toUpperCase();
  if (upper === "DESIGN") return "PIXEL";
  if (upper === "SFX") return "SOUND";
  if (upper === "WRITING") return type === "photo" ? "INK" : "SPOKEN";
  return upper;
}

export function getTagColor(tag: string | undefined, type: PostType): TagColor {
  const normalized = normalizeTag(tag, type);
  if (type === "photo") return PHOTO_TAG_COLORS[normalized] || DEFAULT_PHOTO;
  return AUDIO_TAG_COLORS[normalized] || DEFAULT_AUDIO;
}

export const TAG_DESCRIPTIONS: Record<PostType, Record<string, string>> = {
  photo: {
    PHOTO:  "photography. analogue or digital",
    PIXEL:  "digital edit.",
    INK:    "written by you.",
    MATTER: "physical. analogue. crafted.",
  },
  audio: {
    MUSIC:  "music you made.",
    VOICE:  "singing. va.",
    SPOKEN: "written by you.",
    SOUND:  "you. nature. digital.",
  },
};
