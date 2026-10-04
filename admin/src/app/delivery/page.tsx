import { redirect } from "next/navigation";
import { createPostalCodeAction, createWindowAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { apiFetch } from "@/lib/api";

type Window = {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  cutoff_minutes: number;
  is_active: boolean;
};

type Postal = { id: number; code: string; is_active: boolean };

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function DeliveryAdminPage() {
  const [windows, postal] = await Promise.all([
    apiFetch<Window[]>("/admin/delivery/windows"),
    apiFetch<Postal[]>("/admin/delivery/postal-codes"),
  ]);
  if (windows.status === 401 || windows.status === 403) redirect("/login");

  return (
    <div className="space-y-8 pt-2">
      <h1 className="text-3xl font-semibold">Delivery setup</h1>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-semibold">Weekly windows</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(windows.data || []).map((window) => (
              <li key={window.id} className="flex justify-between border-b border-line py-2">
                <span>
                  {weekdays[window.weekday]} · {window.start_time.slice(0, 5)}–{window.end_time.slice(0, 5)}
                </span>
                <span className="text-muted">
                  cap {window.capacity}
                  {!window.is_active ? " · inactive" : ""}
                </span>
              </li>
            ))}
          </ul>
          <ActionForm action={createWindowAction} className="mt-6 grid gap-3" successLabel="Window added.">
            <label className="field">
              <span>Weekday (0=Mon)</span>
              <input name="weekday" type="number" min={0} max={6} defaultValue={0} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span>Start</span>
                <input name="start_time" defaultValue="09:00:00" required />
              </label>
              <label className="field">
                <span>End</span>
                <input name="end_time" defaultValue="12:00:00" required />
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

        <div className="panel p-6">
          <h2 className="font-semibold">Serviceable postal codes</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(postal.data || []).map((row) => (
              <li key={row.id} className="flex justify-between border-b border-line py-2">
                <span>{row.code}</span>
                <span className="text-muted">{row.is_active ? "active" : "inactive"}</span>
              </li>
            ))}
            {!postal.data?.length ? <li className="text-muted">None yet. Fixture local geocode uses 00000.</li> : null}
          </ul>
          <ActionForm action={createPostalCodeAction} className="mt-6 grid gap-3" successLabel="Postal code added.">
            <label className="field">
              <span>Postal / pin code</span>
              <input name="code" placeholder="00000" required />
            </label>
            <SubmitButton>Add postal code</SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
