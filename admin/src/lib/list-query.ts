import { ADMIN_PAGE_SIZE } from "@/lib/pagination";

export type ListQuery = {
  page?: string;
  status?: string;
  category?: string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function parseListQuery(params: Record<string, string | undefined>): ListQuery {
  const order = params.order === "asc" || params.order === "desc" ? params.order : undefined;
  return {
    page: params.page,
    status: params.status?.trim() || undefined,
    category: params.category?.trim() || undefined,
    search: params.search?.trim() || undefined,
    sort: params.sort?.trim() || undefined,
    order,
  };
}

export function buildListQueryString(query: ListQuery, page = 1): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  if (query.search) params.set("search", query.search);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  return params.toString();
}

export function listPath(basePath: string, query: ListQuery, page = 1): string {
  const qs = buildListQueryString(query, page);
  return qs ? `${basePath}?${qs}` : basePath;
}

export function apiListQuery(query: ListQuery, page: number, pageSize = ADMIN_PAGE_SIZE): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (query.status) params.set("status_filter", query.status);
  if (query.category) params.set("category_id", query.category);
  if (query.search) params.set("search", query.search);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  return params.toString();
}
