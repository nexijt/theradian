import { describe, it, expect } from "vitest";
import { postToFeedPost } from "./useFeed";
import type { PostWithProfile } from "@/lib/posts";

function makePost(overrides: Partial<PostWithProfile> = {}): PostWithProfile {
  return {
    id: "test-id",
    type: "photo",
    caption: "a caption",
    media_url: "https://example.com/photo.jpg",
    latitude: 48.8566,
    longitude: 2.3522,
    city: "Paris",
    country: "France",
    created_at: "2024-03-15T12:00:00Z",
    user_id: "user-123",
    username: "alice",
    display_name: "Alice Smith",
    tag: "PHOTO",
    ...overrides,
  };
}

describe("postToFeedPost", () => {
  it("uses post coordinates when present", () => {
    const result = postToFeedPost(makePost(), "Today at 12:00 PM");
    expect(result.lat).toBe(48.8566);
    expect(result.lon).toBe(2.3522);
    expect(result.pinless).toBe(false);
  });

  it("marks post as pinless when coordinates are null", () => {
    const result = postToFeedPost(makePost({ latitude: null, longitude: null }), "Today at 12:00 PM");
    expect(result.pinless).toBe(true);
  });

  it("assigns random coordinates within valid range when post has no location", () => {
    const result = postToFeedPost(makePost({ latitude: null, longitude: null }), "Today at 12:00 PM");
    expect(result.lat).toBeGreaterThanOrEqual(-70);
    expect(result.lat).toBeLessThanOrEqual(70);
    expect(result.lon).toBeGreaterThanOrEqual(-180);
    expect(result.lon).toBeLessThanOrEqual(180);
  });

  it("builds location string from city and country", () => {
    const result = postToFeedPost(makePost({ city: "Paris", country: "France" }), "some time");
    expect(result.location).toBe("Paris, France");
  });

  it("uses only city when country is null", () => {
    const result = postToFeedPost(makePost({ city: "Paris", country: null }), "some time");
    expect(result.location).toBe("Paris");
  });

  it("uses only country when city is null", () => {
    const result = postToFeedPost(makePost({ city: null, country: "France" }), "some time");
    expect(result.location).toBe("France");
  });

  it("uses the provided locationFallback when both city and country are null", () => {
    const result = postToFeedPost(makePost({ city: null, country: null }), "some time", "Somewhere");
    expect(result.location).toBe("Somewhere");
  });

  it("defaults location to Unknown when city and country are null and no fallback is provided", () => {
    const result = postToFeedPost(makePost({ city: null, country: null }), "some time");
    expect(result.location).toBe("Unknown");
  });

  it("defaults caption to empty string when null", () => {
    const result = postToFeedPost(makePost({ caption: null }), "some time");
    expect(result.caption).toBe("");
  });

  it("passes through the provided time string unchanged", () => {
    const result = postToFeedPost(makePost(), "Today at 3:45 PM");
    expect(result.time).toBe("Today at 3:45 PM");
  });

  it("maps display_name to displayName", () => {
    const result = postToFeedPost(makePost({ display_name: "Alice Smith" }), "some time");
    expect(result.displayName).toBe("Alice Smith");
  });

  it("sets displayName to undefined when display_name is null", () => {
    const result = postToFeedPost(makePost({ display_name: null }), "some time");
    expect(result.displayName).toBeUndefined();
  });

  it("sets tag to undefined when post has no tag", () => {
    const result = postToFeedPost(makePost({ tag: null }), "some time");
    expect(result.tag).toBeUndefined();
  });
});
