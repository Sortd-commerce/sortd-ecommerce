import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { createMemberAction, removeMemberAction, updateMemberAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";
import { requireAdmin, type StaffProfile } from "@/lib/staff";
import { PasswordField } from "@/components/PasswordField";

export default async function MembersPage() {
  const me = await requireAdmin();
  const members = await apiFetch<StaffProfile[]>("/admin/members");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description="Admins can change catalog, delivery, and staff. Members can only view orders."
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
            {(members.data || []).map((member) => (
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
        {!members.data?.length ? <p className="px-4 py-8 text-sm text-muted">No staff yet.</p> : null}
      </div>

      <section className="panel max-w-xl p-5">
        <h2 className="font-semibold">Add member</h2>
        <p className="mt-1 text-sm text-muted">Creates a staff login, or promotes an existing shopper account.</p>
        <ActionForm action={createMemberAction} className="mt-4 grid gap-3" successLabel="Member added.">
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="off" required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">
              <span>First name</span>
              <input name="first_name" />
            </label>
            <label className="field">
              <span>Last name</span>
              <input name="last_name" />
            </label>
          </div>
          <PasswordField autoComplete="new-password" />
          <label className="field">
            <span>Role</span>
            <select name="role" defaultValue="member">
              <option value="member">Member (view orders)</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <SubmitButton>Add member</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
