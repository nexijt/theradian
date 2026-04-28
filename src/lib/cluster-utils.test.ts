import { describe, it, expect } from "vitest";
import { buildClusters } from "./cluster-utils";
import type { FeedPost } from "@/hooks/useFeed";

function makePost(id: string, lat: number, lon: number): FeedPost {
  return {
    id,
    lat,
    lon,
    user: "testuser",
    location: "Test",
    caption: "",
    time: "Today",
    type: "photo",
    createdAt: new Date().toISOString(),
  };
}

describe("buildClusters", () => {
  it("returns empty array for no posts", () => {
    expect(buildClusters([], 5)).toEqual([]);
  });

  it("creates a single cluster for a single post", () => {
    const clusters = buildClusters([makePost("a", 10, 20)], 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].posts).toHaveLength(1);
    expect(clusters[0].size).toBe("single");
    expect(clusters[0].centroidLat).toBe(10);
    expect(clusters[0].centroidLon).toBe(20);
  });

  it("merges two nearby posts into one cluster", () => {
    const posts = [makePost("a", 10, 20), makePost("b", 10.5, 20.5)];
    const clusters = buildClusters(posts, 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].posts).toHaveLength(2);
    expect(clusters[0].size).toBe("small");
  });

  it("keeps two distant posts as separate clusters", () => {
    const posts = [makePost("a", 0, 0), makePost("b", 50, 50)];
    const clusters = buildClusters(posts, 5);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].posts).toHaveLength(1);
    expect(clusters[1].posts).toHaveLength(1);
  });

  it("recalculates centroid as the average position of merged posts", () => {
    const posts = [makePost("a", 10, 20), makePost("b", 12, 24)];
    const clusters = buildClusters(posts, 10);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].centroidLat).toBe(11);
    expect(clusters[0].centroidLon).toBe(22);
  });

  it("labels cluster size as single for 1 post, small for 2–5, large for 6+", () => {
    const near = (id: string, i: number) => makePost(id, i * 0.1, 0);

    const one = [near("a", 0)];
    const five = Array.from({ length: 5 }, (_, i) => near(String(i), i));
    const six = Array.from({ length: 6 }, (_, i) => near(String(i), i));

    expect(buildClusters(one, 10)[0].size).toBe("single");
    expect(buildClusters(five, 10)[0].size).toBe("small");
    expect(buildClusters(six, 10)[0].size).toBe("large");
  });

  it("never assigns the same post to more than one cluster", () => {
    const posts = [
      makePost("a", 0, 0),
      makePost("b", 0.1, 0.1),
      makePost("c", 0.2, 0.2),
      makePost("d", 50, 50),
    ];
    const clusters = buildClusters(posts, 1);
    const allIds = clusters.flatMap((c) => c.posts.map((p) => p.id));
    expect(allIds.length).toBe(new Set(allIds).size);
  });

  it("uses the first post's id as the cluster id", () => {
    const clusters = buildClusters([makePost("first", 0, 0)], 5);
    expect(clusters[0].id).toBe("first");
  });
});
