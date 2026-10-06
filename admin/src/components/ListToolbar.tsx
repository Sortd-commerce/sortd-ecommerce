import Link from "next/link";
import type { ListQuery } from "@/lib/list-query";
import { listPath } from "@/lib/list-query";

type Field =
  | {
      kind: "search";
      name: "search";
      label: string;
      placeholder?: string;
    }
  | {
      kind: "select";
      name: keyof ListQuery;
      label: string;
      options: Array<{ value: string; label: string }>;
      emptyLabel?: string;
    };

export function ListToolbar({
  basePath,
  query,
  fields,
}: {
  basePath: string;
  query: ListQuery;
  fields: Field[];
}) {
  const hasFilters = Boolean(query.status || query.category || query.search || query.sort || query.order);

  return (
    <form method="get" action={basePath} className="list-toolbar">
      <div className="list-toolbar-fields">
        {fields.map((field) => {
          if (field.kind === "search") {
            return (
              <label key={field.name} className="field list-toolbar-search">
                <span>{field.label}</span>
                <input
                  type="search"
                  name={field.name}
                  defaultValue={query.search || ""}
                  placeholder={field.placeholder}
                />
              </label>
            );
          }
          const value = query[field.name] || "";
          return (
            <label key={field.name} className="field">
              <span>{field.label}</span>
              <select name={field.name} defaultValue={value}>
                <option value="">{field.emptyLabel || "All"}</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <div className="list-toolbar-actions">
        <button type="submit" className="btn">
          Apply
        </button>
        {hasFilters ? (
          <Link href={basePath} className="btn-ghost">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
