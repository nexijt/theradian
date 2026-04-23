import type { FeedPost } from "@/hooks/useFeed";

export type ClusterSize = "single" | "small" | "large";

export interface Cluster {
  id: string;
  centroidLat: number;
  centroidLon: number;
  posts: FeedPost[];
  size: ClusterSize;
}

function sizeOf(n: number): ClusterSize {
  if (n === 1) return "single";
  if (n <= 5) return "small";
  return "large";
}

/**
 * Groups posts that are within `threshDeg` degrees of each other into clusters.
 * Single-pass greedy: posts are assumed to arrive in the order you want to
 * prioritise (e.g. sorted newest-first so each cluster's representative post
 * is its most recent one).
 */
export function buildClusters(posts: FeedPost[], threshDeg: number): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (const post of posts) {
    if (assigned.has(post.id)) continue;

    let nearest: Cluster | null = null;
    let nearestDist = Infinity;

    for (const c of clusters) {
      const dlat = post.lat - c.centroidLat;
      const dlon = post.lon - c.centroidLon;
      const dist = Math.sqrt(dlat * dlat + dlon * dlon);
      if (dist < threshDeg && dist < nearestDist) {
        nearest = c;
        nearestDist = dist;
      }
    }

    if (nearest) {
      nearest.posts.push(post);
      const n = nearest.posts.length;
      nearest.centroidLat = nearest.posts.reduce((s, p) => s + p.lat, 0) / n;
      nearest.centroidLon = nearest.posts.reduce((s, p) => s + p.lon, 0) / n;
      nearest.size = sizeOf(n);
    } else {
      clusters.push({
        id: post.id,
        centroidLat: post.lat,
        centroidLon: post.lon,
        posts: [post],
        size: "single",
      });
    }
    assigned.add(post.id);
  }

  return clusters;
}
