import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the number of unique browser sessions currently connected to the app
 * via Supabase Realtime presence on a shared channel.
 */
export function usePresence(): number {
  const [count, setCount] = useState(1);

  useEffect(() => {
    // Stable per-tab id (Supabase presence dedupes on the channel "key")
    const sessionId =
      (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    const channel = supabase.channel("presence:radian-active", {
      config: { presence: { key: sessionId } },
    });

    function recompute() {
      const state = channel.presenceState();
      // state is an object keyed by session id with arrays of metadata entries
      const total = Object.keys(state).length;
      setCount(Math.max(1, total));
    }

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel));
    };
  }, []);

  return count;
}
