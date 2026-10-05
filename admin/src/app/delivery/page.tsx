import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { PostalEditor, type PostalRow } from "@/components/PostalEditor";
import { WindowEditor, type DeliveryWindowRow } from "@/components/WindowEditor";
import { createPostalCodeAction, createWindowAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function DeliveryAdminPage() {
  await requireAdmin();
  const [windows, postal] = await Promise.all([
    apiFetch<DeliveryWindowRow[]>("/admin/delivery/windows"),
    apiFetch<PostalRow[]>("/admin/delivery/postal-codes"),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Delivery"
        description="Weekly slots and the postal codes you can serve. Edit or remove anything already saved."
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-4">
            <h2 className="font-semibold">Weekly windows</h2>
            <p className="mt-1 text-sm text-muted">Customers pick from open capacity on these days.</p>
          </div>
          <ul>
            {(windows.data || []).map((row) => (
              <WindowEditor key={row.id} window={row} />
            ))}
            {!windows.data?.length ? <li className="px-4 py-8 text-sm text-muted">No windows yet.</li> : null}
          </ul>
          <div className="border-t border-line p-4">
            <h3 className="text-sm font-medium">Add window</h3>
            <ActionForm action={createWindowAction} className="mt-3 grid gap-3" successLabel="Window added.">
              <label className="field">
                <span>Weekday</span>
                <select name="weekday" defaultValue={0}>
                  {WEEKDAYS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Start</span>
                  <input name="start_time" type="time" defaultValue="09:00" required />
                </label>
                <label className="field">
                  <span>End</span>
                  <input name="end_time" type="time" defaultValue="12:00" required />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Capacity</span>
                  <input name="capacity" type="number" min={1} defaultValue={20} required />
                </label>
                <label className="field">
                  <span>Cutoff minutes</span>
                  <input name="cutoff_minutes" type="number" min={0} defaultValue={60} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input name="is_active" type="checkbox" defaultChecked /> Active
              </label>
              <SubmitButton>Add window</SubmitButton>
            </ActionForm>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-4">
            <h2 className="font-semibold">Postal codes</h2>
            <p className="mt-1 text-sm text-muted">Only these codes pass the delivery check.</p>
          </div>
          <ul>
            {(postal.data || []).map((row) => (
              <PostalEditor key={row.id} row={row} />
            ))}
            {!postal.data?.length ? <li className="px-4 py-8 text-sm text-muted">None yet. Local fixture geocode uses 00000.</li> : null}
          </ul>
          <div className="border-t border-line p-4">
            <h3 className="text-sm font-medium">Add postal code</h3>
            <ActionForm action={createPostalCodeAction} className="mt-3 grid gap-3" successLabel="Postal code added.">
              <label className="field">
                <span>Postal / pin code</span>
                <input name="code" placeholder="00000" required />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input name="is_active" type="checkbox" defaultChecked /> Active
              </label>
              <SubmitButton>Add postal code</SubmitButton>
            </ActionForm>
          </div>
        </div>
      </section>
    </div>
  );
}
