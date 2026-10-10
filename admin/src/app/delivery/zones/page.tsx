import { AddZoneDrawer } from "@/components/AddZoneDrawer";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ZoneEditor, type DeliveryZoneRow } from "@/components/ZoneEditor";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

export default async function DeliveryZonesPage() {
  await requireAdmin();
  const result = await apiFetch<DeliveryZoneRow[]>("/admin/delivery/zones");
  const zones = result.data || [];
  const activeCount = zones.filter((zone) => zone.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery zones"
        description="Control the service areas customers can order from. Zone boundaries are checked against the customer's map pin."
        actions={<AddZoneDrawer />}
      />

      {!result.ok ? <p className="text-sm text-warn">{result.message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-sm text-muted">Service areas</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{zones.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-muted">Currently enabled</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            {activeCount}<StatusBadge value={activeCount ? "active" : "inactive"} />
          </p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <h2 className="font-semibold">Service areas</h2>
          <p className="mt-1 text-sm text-muted">Manage area names, delivery fees, availability, and map boundaries.</p>
        </div>
        {zones.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-225">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Boundary</th>
                  <th>Delivery fee</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => <ZoneEditor key={zone.id} zone={zone} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="font-medium">No delivery zones configured</p>
            <p className="mt-1 text-sm text-muted">Add a service area and draw its boundary on the map.</p>
          </div>
        )}
      </section>
    </div>
  );
}
