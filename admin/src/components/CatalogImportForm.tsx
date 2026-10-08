"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ActionForm";
import { importCatalogAction, type CatalogImportState } from "@/lib/actions";

const initialState: CatalogImportState = { ok: null, message: "", result: null };

export function CatalogImportForm() {
  const [state, formAction] = useActionState(importCatalogAction, initialState);
  const result = state.result;

  return (
    <form action={formAction} className="space-y-4">
      <label className="field">
        <span>Workbook (.xlsx)</span>
        <input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="dry_run" type="checkbox" defaultChecked />
        Validate only — do not write to the database
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="force_active" type="checkbox" />
        Import all products as active (ignore Excel status — for testing)
      </label>
      <SubmitButton pendingLabel="Processing…">Run import</SubmitButton>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-accent" : "text-warn"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-line bg-panel-2 p-4 text-sm text-text">
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted">Rows</dt>
              <dd className="font-medium tabular-nums text-text">{result.row_count}</dd>
            </div>
            <div>
              <dt className="text-muted">Created</dt>
              <dd className="font-medium tabular-nums text-text">{result.created}</dd>
            </div>
            <div>
              <dt className="text-muted">Updated</dt>
              <dd className="font-medium tabular-nums text-text">{result.updated}</dd>
            </div>
            <div>
              <dt className="text-muted">Aisle images</dt>
              <dd className="font-medium tabular-nums text-text">{result.aisle_images_updated ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted">Warnings</dt>
              <dd className="font-medium tabular-nums text-text">{result.warnings.length}</dd>
            </div>
          </dl>

          {result.errors.length ? (
            <div className="mt-4">
              <h3 className="font-medium text-warn">Validation errors</h3>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm">
                {result.errors.map((issue, index) => (
                  <li key={`${issue.row}-${issue.field}-${index}`}>
                    Row {issue.row}
                    {issue.sku ? ` (${issue.sku})` : ""} · {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.warnings.length ? (
            <div className="mt-4">
              <h3 className="font-medium text-text">Warnings</h3>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-muted">
                {result.warnings.map((issue, index) => (
                  <li key={`warn-${issue.row}-${issue.field}-${index}`}>
                    Row {issue.row}
                    {issue.sku ? ` (${issue.sku})` : ""} · {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
