import type { ReactNode } from "react";
import { usePlugins } from "@/hooks/use-plugins";
import { AppShell } from "@/components/app-shell";

/** Hides a feature client-side when its module is off or permission is missing.
 *  Server functions enforce the same rules independently. */
export function PluginGate({
  plugin,
  permission,
  children,
}: {
  plugin: string;
  permission?: string;
  children: ReactNode;
}) {
  const { isLoading, isEnabled, can } = usePlugins();

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }
  if (!isEnabled(plugin)) {
    return (
      <AppShell>
        <div className="mx-auto mt-20 max-w-lg glass rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold">Module disabled</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This module has been turned off by an administrator. Its data is preserved and will return when it is
            re-enabled.
          </p>
        </div>
      </AppShell>
    );
  }
  if (!can(permission)) {
    return (
      <AppShell>
        <div className="mx-auto mt-20 max-w-lg glass rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold">No access</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </AppShell>
    );
  }
  return <>{children}</>;
}
