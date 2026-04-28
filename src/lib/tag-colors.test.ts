import { describe, it, expect } from "vitest";
import { normalizeTag, getTagColor, PHOTO_TAG_COLORS, AUDIO_TAG_COLORS } from "./tag-colors";

describe("normalizeTag", () => {
  it("returns PHOTO as default for photo type when tag is undefined", () => {
    expect(normalizeTag(undefined, "photo")).toBe("PHOTO");
  });

  it("returns MUSIC as default for audio type when tag is undefined", () => {
    expect(normalizeTag(undefined, "audio")).toBe("MUSIC");
  });

  it("maps DESIGN to PIXEL (case-insensitive)", () => {
    expect(normalizeTag("DESIGN", "photo")).toBe("PIXEL");
    expect(normalizeTag("design", "photo")).toBe("PIXEL");
  });

  it("maps SFX to SOUND (case-insensitive)", () => {
    expect(normalizeTag("SFX", "audio")).toBe("SOUND");
    expect(normalizeTag("sfx", "audio")).toBe("SOUND");
  });

  it("maps WRITING to INK for photo type", () => {
    expect(normalizeTag("WRITING", "photo")).toBe("INK");
    expect(normalizeTag("writing", "photo")).toBe("INK");
  });

  it("maps WRITING to SPOKEN for audio type", () => {
    expect(normalizeTag("WRITING", "audio")).toBe("SPOKEN");
    expect(normalizeTag("writing", "audio")).toBe("SPOKEN");
  });

  it("uppercases known tags without any mapping", () => {
    expect(normalizeTag("photo", "photo")).toBe("PHOTO");
    expect(normalizeTag("ink", "photo")).toBe("INK");
    expect(normalizeTag("music", "audio")).toBe("MUSIC");
    expect(normalizeTag("SPOKEN", "audio")).toBe("SPOKEN");
  });
});

describe("getTagColor", () => {
  it("returns the correct color for known photo tags", () => {
    expect(getTagColor("PHOTO", "photo")).toBe(PHOTO_TAG_COLORS.PHOTO);
    expect(getTagColor("PIXEL", "photo")).toBe(PHOTO_TAG_COLORS.PIXEL);
    expect(getTagColor("INK", "photo")).toBe(PHOTO_TAG_COLORS.INK);
    expect(getTagColor("MATTER", "photo")).toBe(PHOTO_TAG_COLORS.MATTER);
  });

  it("returns the correct color for known audio tags", () => {
    expect(getTagColor("MUSIC", "audio")).toBe(AUDIO_TAG_COLORS.MUSIC);
    expect(getTagColor("VOICE", "audio")).toBe(AUDIO_TAG_COLORS.VOICE);
    expect(getTagColor("SPOKEN", "audio")).toBe(AUDIO_TAG_COLORS.SPOKEN);
    expect(getTagColor("SOUND", "audio")).toBe(AUDIO_TAG_COLORS.SOUND);
  });

  it("falls back to default PHOTO color for unknown photo tag", () => {
    expect(getTagColor("WHATEVER", "photo")).toBe(PHOTO_TAG_COLORS.PHOTO);
    expect(getTagColor(undefined, "photo")).toBe(PHOTO_TAG_COLORS.PHOTO);
  });

  it("falls back to default MUSIC color for unknown audio tag", () => {
    expect(getTagColor("WHATEVER", "audio")).toBe(AUDIO_TAG_COLORS.MUSIC);
    expect(getTagColor(undefined, "audio")).toBe(AUDIO_TAG_COLORS.MUSIC);
  });

  it("resolves legacy DESIGN tag to PIXEL color", () => {
    expect(getTagColor("DESIGN", "photo")).toBe(PHOTO_TAG_COLORS.PIXEL);
  });

  it("resolves legacy WRITING tag to correct color based on type", () => {
    expect(getTagColor("WRITING", "photo")).toBe(PHOTO_TAG_COLORS.INK);
    expect(getTagColor("WRITING", "audio")).toBe(AUDIO_TAG_COLORS.SPOKEN);
  });

  it("resolves legacy SFX tag to SOUND color", () => {
    expect(getTagColor("SFX", "audio")).toBe(AUDIO_TAG_COLORS.SOUND);
  });
});
