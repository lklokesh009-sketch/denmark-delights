import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const menuQuery = queryOptions({
  queryKey: ["menu"],
  queryFn: async () => {
    const { data, error } = await supabase.from("menu_items").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const infoQuery = queryOptions({
  queryKey: ["info"],
  queryFn: async () => {
    const { data, error } = await supabase.from("restaurant_info").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});
