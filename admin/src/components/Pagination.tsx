import Link from "next/link";
import { paginatedPath } from "@/lib/pagination";

export function Pagination({
  page,
  pages,
  count,
  pageSize,
  basePath,
}: {
  page: number;
  pages: number;
  count: number;
  pageSize: number;
  basePath: string;
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
          <Link href={paginatedPath(basePath, page - 1, pageSize)} className="btn-ghost pagination-btn">
            Previous
          </Link>
        ) : (
          <span className="btn-ghost pagination-btn pagination-btn--disabled">Previous</span>
        )}
        <span className="pagination-page">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={paginatedPath(basePath, page + 1, pageSize)} className="btn-ghost pagination-btn">
            Next
          </Link>
        ) : (
          <span className="btn-ghost pagination-btn pagination-btn--disabled">Next</span>
        )}
      </div>
    </nav>
  );
}
