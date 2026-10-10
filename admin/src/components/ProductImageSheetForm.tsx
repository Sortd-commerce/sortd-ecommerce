"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ActionForm";
import {
  uploadProductImageSheetAction,
  type ProductImageSheetRow,
  type ProductImageSheetState,
} from "@/lib/actions";

const initialState: ProductImageSheetState = { ok: null, message: "", result: null };
const OUTPUT_COLUMNS = ["product_id", "image_url", "cloudinary_url", "status", "error"] as const;

function csvValue(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadOutput(rows: ProductImageSheetRow[]) {
  const lines = [
    OUTPUT_COLUMNS.map(csvValue).join(","),
    ...rows.map((row) => [row.product_id, row.image_url, row.cloudinary_url, row.status, row.error].map(csvValue).join(",")),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "product-image-upload-results.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProductImageSheetForm() {
  const [state, formAction] = useActionState(uploadProductImageSheetAction, initialState);
  const result = state.result;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-panel-2 p-4 text-sm text-muted">
        <p className="font-medium text-text">Prepare the image sheet</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Use one row per image, with a <span className="font-medium text-text">product_id</span> and a public HTTPS <span className="font-medium text-text">image_url</span>.</li>
          <li>Optional columns: <span className="font-medium text-text">alt</span>.</li>
          <li>Upload no more than 10 image rows at once. Images must be JPEG, PNG, or WebP and no larger than 5 MB.</li>
          <li>Successful uploads are added to that product’s gallery; existing images are not replaced.</li>
        </ul>
        <a className="mt-3 inline-flex text-accent underline underline-offset-2" href="/product-image-upload-template.csv" download>
          Download CSV template
        </a>
      </div>

      <form action={formAction} className="grid gap-4 rounded-xl border border-line p-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="field">
          <span>Image sheet (.xlsx or .csv)</span>
          <input
            name="file"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
          />
        </label>
        <SubmitButton pendingLabel="Uploading images…">Upload up to 10 images</SubmitButton>
      </form>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-accent" : "text-warn"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}

      {result ? (
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4">
            <div>
              <h2 className="font-semibold">Upload results</h2>
              <p className="mt-1 text-sm text-muted">Export these rows to keep the source image URL and stored URL together.</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => downloadOutput(result.results)}>
              Export results CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-225">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Source image</th>
                  <th>Stored image URL</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((row) => (
                  <tr key={`${row.row}-${row.product_id}`}>
                    <td className="tabular-nums">{row.product_id || "—"}</td>
                    <td className="max-w-64 truncate text-xs text-muted" title={row.image_url}>{row.image_url || "—"}</td>
                    <td className="max-w-64 truncate text-xs" title={row.cloudinary_url}>
                      {row.cloudinary_url ? <a className="text-accent underline underline-offset-2" href={row.cloudinary_url} target="_blank" rel="noreferrer">{row.cloudinary_url}</a> : "—"}
                    </td>
                    <td><span className={`badge ${row.status === "uploaded" ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger"}`}>{row.status}</span></td>
                    <td className="text-sm text-muted">{row.error || "Uploaded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
