import { AddWindowDrawer } from "@/components/AddWindowDrawer";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { WindowEditor, type DeliveryWindowRow } from "@/components/WindowEditor";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

export default async function DeliveryWindowsPage() {
  await requireAdmin();
  const result = await apiFetch<DeliveryWindowRow[]>("/admin/delivery/windows");
  const windows = [...(result.data || [])].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
  );
  const activeCount = windows.filter((window) => window.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Window slots"
        description="Set the recurring weekly delivery schedule customers can choose from at checkout."
        actions={<AddWindowDrawer />}
      />

      {!result.ok ? <p className="text-sm text-warn">{result.message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-sm text-muted">Weekly slots</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{windows.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-muted">Available to customers</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            {activeCount}<StatusBadge value={activeCount ? "active" : "inactive"} />
          </p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <h2 className="font-semibold">Weekly schedule</h2>
          <p className="mt-1 text-sm text-muted">Each slot has its own order capacity and booking cutoff.</p>
        </div>
        {windows.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-190">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Capacity</th>
                  <th>Cutoff</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {windows.map((window) => <WindowEditor key={window.id} window={window} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="font-medium">No delivery slots yet</p>
            <p className="mt-1 text-sm text-muted">Use “Add delivery slot” above to make a recurring window available to customers.</p>
          </div>
        )}
      </section>

    </div>
  );
}
