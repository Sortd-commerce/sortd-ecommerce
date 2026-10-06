import Link from "next/link";
import type { ListQuery } from "@/lib/list-query";
import { listPath } from "@/lib/list-query";

export function Pagination({
  page,
  pages,
  count,
  pageSize,
  basePath,
  query = {},
}: {
  page: number;
  pages: number;
  count: number;
  pageSize: number;
  basePath: string;
  query?: ListQuery;
}) {
  if (pages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-summary">
        Showing {start}–{end} of {count}
      </p>
      <div className="pagination-controls">
        {page > 1 ? (
          <Link href={listPath(basePath, query, page - 1)} className="btn-ghost pagination-btn">
            Previous
          </Link>
        ) : (
          <span className="btn-ghost pagination-btn pagination-btn--disabled">Previous</span>
        )}
        <span className="pagination-page">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={listPath(basePath, query, page + 1)} className="btn-ghost pagination-btn">
            Next
          </Link>
        ) : (
          <span className="btn-ghost pagination-btn pagination-btn--disabled">Next</span>
        )}
      </div>
    </nav>
  );
}
