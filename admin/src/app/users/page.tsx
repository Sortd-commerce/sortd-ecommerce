import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { ADMIN_PAGE_SIZE, pageFromParam, type Paginated } from "@/lib/pagination";
import { requireAdmin } from "@/lib/staff";

type PlatformUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  email_verified_at: string | null;
  date_joined: string;
};

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = pageFromParam(pageParam);
  const users = await apiFetch<Paginated<PlatformUser>>(
    `/admin/users?page=${page}&page_size=${ADMIN_PAGE_SIZE}`,
  );
  const data = users.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform users"
        description="Customer accounts on Sortd. Staff and admin accounts are excluded."
      />

      <div className="panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Phone</th>
              <th>Joined</th>
              <th>Email</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {(data?.results || []).map((user) => (
              <tr key={user.id}>
                <td>
                  <p className="font-medium">
                    {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}
                  </p>
                  <p className="text-sm text-muted">{user.email}</p>
                </td>
                <td>{user.phone || "—"}</td>
                <td>{new Date(user.date_joined).toLocaleDateString("en-GB")}</td>
                <td>
                  <StatusBadge value={user.email_verified_at ? "verified" : "pending"} />
                </td>
                <td>
                  <StatusBadge value={user.is_active ? "active" : "inactive"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.ok ? <p className="px-4 py-10 text-sm text-warn">{users.message}</p> : null}
        {users.ok && !data?.results?.length ? (
          <p className="px-4 py-10 text-sm text-muted">No platform users yet.</p>
        ) : null}
        {data ? (
          <Pagination
            page={data.page}
            pages={data.pages}
            count={data.count}
            pageSize={data.page_size}
            basePath="/users"
          />
        ) : null}
      </div>
    </div>
  );
}