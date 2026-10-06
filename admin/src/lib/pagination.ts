export type Paginated<T> = {
  count: number;
  page: number;
  page_size: number;
  pages: number;
  results: T[];
};

export const ADMIN_PAGE_SIZE = 20;

export function pageFromParam(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

export function paginatedPath(basePath: string, page: number, pageSize = ADMIN_PAGE_SIZE): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (pageSize !== ADMIN_PAGE_SIZE) params.set("page_size", String(pageSize));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
