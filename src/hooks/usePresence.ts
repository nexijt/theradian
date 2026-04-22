import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresence() {
  const [activeCount, setActiveCount] = useState(1);

  useEffect(() => {
    const presenceKey = crypto.randomUUID();
    const channel = supabase.channel("theradian:presence", {
      config: { presence: { key: presenceKey } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setActiveCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { activeCount };
}
