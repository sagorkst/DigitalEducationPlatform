"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type AccessState = "checking" | "allowed" | "denied";

type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";

type UserRole = {
  id?: string;
  name?: string;
  description?: string | null;
};

type UserRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar?: string | null;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt?: string;
  roles: UserRole[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(payload: unknown, fallback: string) {
  const message = isRecord(payload) ? payload.message : undefined;

  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string") return message;

  return fallback;
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    INACTIVE: "bg-slate-100 text-slate-700",
    SUSPENDED: "bg-red-50 text-red-700",
    PENDING: "bg-amber-50 text-amber-700",
  };

  const labels: Record<UserStatus, string> = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    SUSPENDED: "Suspended",
    PENDING: "Pending",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[status] ?? styles.INACTIVE}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function AdminUsersPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [currentUserId, setCurrentUserId] = useState("");

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pagination, setPagination] =
    useState<Pagination>(EMPTY_PAGINATION);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, string>
  >({});
  const [updatingUserId, setUpdatingUserId] = useState("");

  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const response = await fetch("/api/users/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) setAccess("denied");
          return;
        }

        const payload = await response.json();
        const profile =
          payload?.data?.user ??
          payload?.data ??
          payload?.user ??
          payload;

        const roles = Array.isArray(profile?.roles)
          ? profile.roles
          : Array.isArray(profile?.userRoles)
            ? profile.userRoles.map(
                (item: { role?: UserRole }) => item?.role,
              )
            : [];

        const isSuperAdmin = roles.some(
          (role: string | UserRole) =>
            typeof role === "string"
              ? role === "SUPER_ADMIN"
              : role?.name === "SUPER_ADMIN",
        );

        if (!active) return;

        if (!isSuperAdmin) {
          setAccess("denied");
          return;
        }

        setCurrentUserId(profile?.id ?? "");
        setAccess("allowed");
      } catch {
        if (active) setAccess("denied");
      }
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(
        `/api/admin/users?${params.toString()}`,
        { cache: "no-store" },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "User list load করা যায়নি।"),
        );
      }

      const rows = Array.isArray(payload?.data) ? payload.data : [];

      setUsers(rows);
      setPagination(payload?.pagination ?? EMPTY_PAGINATION);
    } catch (err) {
      setUsers([]);
      setError(
        err instanceof Error
          ? err.message
          : "User list load করতে সমস্যা হয়েছে।",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (access === "allowed") {
      void Promise.resolve().then(() => loadUsers());
    }
  }, [access, loadUsers]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setSelectedUser(null);
    setNotice("");
  }

  async function openUserDetails(userId: string) {
    if (selectedUser?.id === userId) {
      setSelectedUser(null);
      return;
    }

    setDetailLoading(true);
    setError("");
    setSelectedUser(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "User details পাওয়া যায়নি।"),
        );
      }

      const user = payload?.data ?? payload;
      setSelectedUser(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "User details load করতে সমস্যা হয়েছে।",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateUserStatus(user: UserRecord) {
    const nextStatus = statusDrafts[user.id];

    if (!nextStatus || nextStatus === user.status) return;

    if (user.roles?.some((role) => role.name === "SUPER_ADMIN")) {
      setError("SUPER_ADMIN account-এর status পরিবর্তন করা যাবে না।");
      return;
    }

    if (user.id === currentUserId) {
      setError("নিজের account status পরিবর্তন করা যাবে না।");
      return;
    }

    setUpdatingUserId(user.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Account status update হয়নি।"),
        );
      }

      setNotice(
        payload?.message ?? "Account status সফলভাবে update হয়েছে।",
      );

      await loadUsers();

      if (selectedUser?.id === user.id) {
        setSelectedUser({
          ...selectedUser,
          status: nextStatus as UserStatus,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Account status update করতে সমস্যা হয়েছে।",
      );
    } finally {
      setUpdatingUserId("");
    }
  }

  if (access === "checking") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          Super Admin permission যাচাই করা হচ্ছে...
        </p>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          Access restricted
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          এই পেজ ব্যবহারের জন্য Super Admin permission প্রয়োজন।
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
          Administration
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          User Management
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Platform-এর registered user, account status এবং role information
          পরিচালনা করো।
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Total Users</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {pagination.total.toLocaleString("en-US")}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Current Page</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {pagination.totalPages ? pagination.page : 0}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Users Per Page</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {pagination.limit}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={submitSearch}
          className="grid gap-3 md:grid-cols-[1fr_220px_auto]"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email or phone..."
            className="min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
              setSelectedUser(null);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-600"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Search
          </button>
        </form>

        {(error || notice) && (
          <div className="mt-4 space-y-2">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {notice}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">Registered Users</h2>
            <p className="mt-1 text-xs text-slate-500">
              {pagination.total.toLocaleString("en-US")} user(s) found
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            কোনো user পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">User</th>
                  <th className="px-5 py-4 font-semibold">Contact</th>
                  <th className="px-5 py-4 font-semibold">Roles</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Joined</th>
                  <th className="px-5 py-4 font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isSuperAdmin = user.roles?.some(
                    (role) => role.name === "SUPER_ADMIN",
                  );
                  const isSelf = user.id === currentUserId;
                  const draft = statusDrafts[user.id] ?? user.status;

                  return (
                    <tr key={user.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {user.name}
                        </p>
                        <p className="mt-1 max-w-[190px] truncate text-xs text-slate-400">
                          {user.id}
                        </p>
                        {isSelf && (
                          <span className="mt-1 inline-block text-xs font-medium text-emerald-700">
                            Your account
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-slate-700">{user.email || "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {user.phone || "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Email: {user.emailVerified ? "Verified" : "Not verified"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex max-w-[180px] flex-wrap gap-1">
                          {user.roles?.length ? (
                            user.roles.map((role, index) => (
                              <span
                                key={role.id ?? role.name ?? index}
                                className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                              >
                                {role.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">
                              No role
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={user.status} />
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-slate-600">
                        {formatDate(user.createdAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <button
                            type="button"
                            onClick={() => openUserDetails(user.id)}
                            className="text-xs font-semibold text-emerald-700 hover:underline"
                          >
                            {selectedUser?.id === user.id
                              ? "Hide details"
                              : "View details"}
                          </button>

                          {!isSuperAdmin &&
                            !isSelf &&
                            user.status !== "PENDING" && (
                              <div className="flex items-center gap-2">
                                <select
                                  value={draft}
                                  onChange={(event) =>
                                    setStatusDrafts((current) => ({
                                      ...current,
                                      [user.id]: event.target.value,
                                    }))
                                  }
                                  className="max-w-[125px] rounded-lg border border-slate-300 px-2 py-2 text-xs"
                                >
                                  <option value="ACTIVE">Active</option>
                                  <option value="INACTIVE">Inactive</option>
                                  <option value="SUSPENDED">Suspended</option>
                                </select>

                                <button
                                  type="button"
                                  disabled={
                                    updatingUserId === user.id ||
                                    draft === user.status
                                  }
                                  onClick={() => updateUserStatus(user)}
                                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {updatingUserId === user.id
                                    ? "Saving..."
                                    : "Update"}
                                </button>
                              </div>
                            )}

                          {user.status === "PENDING" && (
                            <span className="text-xs text-amber-700">
                              Awaiting email verification
                            </span>
                          )}

                          {isSuperAdmin && (
                            <span className="text-xs text-slate-400">
                              Protected account
                            </span>
                          )}

                          {isSelf && !isSuperAdmin && (
                            <span className="text-xs text-slate-400">
                              Self-protected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedUser && (
          <div className="border-t border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  User Details
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedUser.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <p className="mt-4 text-sm text-slate-500">
                Loading details...
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Full name</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedUser.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="mt-1 break-all text-sm text-slate-900">
                    {selectedUser.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedUser.phone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email verification</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedUser.emailVerified ? "Verified" : "Not verified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone verification</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedUser.phoneVerified ? "Verified" : "Not verified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Registration date</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {formatDate(selectedUser.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Account status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedUser.status} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Assigned roles</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedUser.roles?.map((role) => role.name).join(", ") ||
                      "No assigned role"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            Page {pagination.totalPages ? pagination.page : 0} of{" "}
            {pagination.totalPages} · {pagination.total} total users
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
                setSelectedUser(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => {
                setPage((current) => current + 1);
                setSelectedUser(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
