import { useQuery } from "@tanstack/react-query";
import { getPluginContext } from "@/lib/plugins.functions";

export function usePluginContext() {
  return useQuery({
    queryKey: ["plugin-context"],
    queryFn: () => getPluginContext(),
    staleTime: 60_000,
    retry: false,
  });
}

export function usePlugins() {
  const q = usePluginContext();
  const enabled = q.data?.enabled ?? [];
  const permissions = q.data?.permissions ?? [];
  return {
    ...q,
    enabled,
    permissions,
    isAdmin: q.data?.isAdmin ?? false,
    isEnabled: (id: string) => enabled.includes(id),
    can: (permission?: string) => (permission ? permissions.includes(permission) : true),
  };
}
