import worldAtlas from "world-atlas/countries-110m.json";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

/**
 * Builds accurate country/continent outlines from Natural Earth data (world-atlas).
 * Returns [lon, lat][][] — the same format Globe.tsx already consumes via ([lo, la]).
 */
function buildContinentOutlines(): [number, number][][] {
  const topo = worldAtlas as unknown as Topology;
  const geo = feature(topo, (topo as any).objects.countries);
  const rings: [number, number][][] = [];

  for (const f of geo.features) {
    const { type, coordinates } = f.geometry as {
      type: string;
      coordinates: [number, number][][][];
    };
    if (type === "Polygon") {
      rings.push(coordinates[0] as [number, number][]);
    } else if (type === "MultiPolygon") {
      for (const poly of coordinates) {
        rings.push(poly[0] as [number, number][]);
      }
    }
  }

  return rings;
}

// Computed once at module load — no runtime cost per render
export const CONTINENT_OUTLINES: [number, number][][] = buildContinentOutlines();

export interface GlobeLabel {
  name: string;
  lat: number;
  lon: number;
  type: "ocean" | "country";
  size: "sm" | "md" | "lg";
}

export const GLOBE_LABELS: GlobeLabel[] = [
  // Oceans — large italic
  { name: "Pacific Ocean",   lat:  10, lon: -155, type: "ocean",   size: "lg" },
  { name: "Atlantic Ocean",  lat:  10, lon:  -42, type: "ocean",   size: "lg" },
  { name: "Indian Ocean",    lat: -22, lon:   75, type: "ocean",   size: "lg" },
  { name: "Arctic Ocean",    lat:  83, lon:    0, type: "ocean",   size: "md" },
  { name: "Southern Ocean",  lat: -58, lon:    0, type: "ocean",   size: "md" },
  // Countries — regular weight
  { name: "Russia",          lat:  62, lon:  100, type: "country", size: "md" },
  { name: "Canada",          lat:  60, lon: -114, type: "country", size: "md" },
  { name: "United States",   lat:  39, lon:  -98, type: "country", size: "md" },
  { name: "Brazil",          lat: -10, lon:  -52, type: "country", size: "md" },
  { name: "Australia",       lat: -25, lon:  134, type: "country", size: "md" },
  { name: "China",           lat:  35, lon:  103, type: "country", size: "md" },
  { name: "India",           lat:  22, lon:   78, type: "country", size: "sm" },
  { name: "Greenland",       lat:  74, lon:  -42, type: "country", size: "sm" },
  { name: "Argentina",       lat: -35, lon:  -64, type: "country", size: "sm" },
  { name: "Kazakhstan",      lat:  48, lon:   67, type: "country", size: "sm" },
  { name: "Mexico",          lat:  23, lon: -102, type: "country", size: "sm" },
  { name: "Saudi Arabia",    lat:  24, lon:   45, type: "country", size: "sm" },
];

// Fallback posts shown when the database is empty or unreachable
export const MOCK_POSTS = [
  { lat: 51.5, lon: -0.12, user: "marina_l", location: "London, UK", caption: "Morning fog on the Thames. Everything quiet.", time: "7:42 AM", type: "photo" as const },
  { lat: 40.7, lon: -74.0, user: "jt_nyc", location: "New York, US", caption: "Finished a 7-mile run. Legs are done for.", time: "6:15 AM", type: "photo" as const },
  { lat: 35.7, lon: 139.7, user: "yuki.h", location: "Tokyo, JP", caption: "Cherry blossoms are almost here. Not yet.", time: "9:30 PM", type: "photo" as const },
  { lat: -33.9, lon: 18.4, user: "kez_cape", location: "Cape Town, ZA", caption: "Painted for 3 hours. Forgot to eat lunch.", time: "2:11 PM", type: "audio" as const, category: "[SFX]" },
  { lat: 52.4, lon: 4.9, user: "pierre_m", location: "Amsterdam, NL", caption: "Rain again. Reading Camus at the window.", time: "4:55 PM", type: "photo" as const },
  { lat: -23.5, lon: -46.6, user: "bia.crafts", location: "São Paulo, BR", caption: "New batch of ceramics out of the kiln.", time: "11:07 AM", type: "audio" as const, category: "[MUSIC]" },
  { lat: 55.7, lon: 37.6, user: "sasha_rn", location: "Moscow, RU", caption: "Snow is finally melting. First park day.", time: "3:40 PM", type: "photo" as const },
  { lat: 1.35, lon: 103.8, user: "lim_sg", location: "Singapore, SG", caption: "Tried sourdough for the first time. Dense.", time: "8:20 AM", type: "photo" as const },
  { lat: 19.4, lon: -99.1, user: "diego.ph", location: "Mexico City, MX", caption: "Sketching in Coyoacán. The light is perfect.", time: "12:33 PM", type: "audio" as const, category: "[WRITING]" },
  { lat: 37.6, lon: -122.4, user: "sara_sf", location: "San Francisco, US", caption: "Foghorn woke me at 5am. Worth it for this view.", time: "5:48 AM", type: "photo" as const },
  { lat: 28.6, lon: 77.2, user: "arjun.k", location: "Delhi, IN", caption: "Watercolour practice — monsoon mood already.", time: "7:00 PM", type: "audio" as const, category: "[VA]" },
  { lat: -27.5, lon: 153.0, user: "tom_bris", location: "Brisbane, AU", caption: "Magic hour on the river. This city, honestly.", time: "5:30 PM", type: "photo" as const },
];
