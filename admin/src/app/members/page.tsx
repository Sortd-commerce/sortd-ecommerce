import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AddMemberDrawer } from "@/components/AddMemberDrawer";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { removeMemberAction, updateMemberAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";
import { ADMIN_PAGE_SIZE, pageFromParam, type Paginated } from "@/lib/pagination";
import { requireAdmin, type StaffProfile } from "@/lib/staff";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const me = await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = pageFromParam(pageParam);
  const members = await apiFetch<Paginated<StaffProfile>>(
    `/admin/members?page=${page}&page_size=${ADMIN_PAGE_SIZE}`,
  );
  const data = members.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description="Admins can change catalog, delivery, and staff. Members can only view orders."
        actions={<AddMemberDrawer />}
      />

      <div className="panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(data?.results || []).map((member) => (
              <tr key={member.id}>
                <td>
                  <p className="font-medium">{[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email}</p>
                  <p className="text-sm text-muted">{member.email}</p>
                </td>
                <td>
                  <ActionForm action={updateMemberAction} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={member.id} />
                    <select name="role" defaultValue={member.role} className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-sm" disabled={member.id === me.id}>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                    {member.id === me.id ? null : <SubmitButton className="btn-ghost text-sm" pendingLabel="Saving…">Save</SubmitButton>}
                  </ActionForm>
                </td>
                <td>
                  <StatusBadge value={member.is_active ? "active" : "inactive"} />
                </td>
                <td className="text-right">
                  {member.id === me.id ? (
                    <span className="text-xs text-muted">You</span>
                  ) : (
                    <ActionForm action={removeMemberAction}>
                      <input type="hidden" name="user_id" value={member.id} />
                      <SubmitButton className="btn-danger" pendingLabel="Removing…">
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.results?.length ? <p className="px-4 py-8 text-sm text-muted">No staff yet.</p> : null}
        {data ? (
          <Pagination
            page={data.page}
            pages={data.pages}
            count={data.count}
            pageSize={data.page_size}
            basePath="/members"
          />
        ) : null}
      </div>
    </div>
  );
}
