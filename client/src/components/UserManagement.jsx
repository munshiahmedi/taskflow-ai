import { useEffect, useState } from "react";
import {
  createUser,
  getUsers,
  updateUser,
  updateUserRole,
  updateUserStatus,
} from "../api/usersApi";

const USER_ROLES = ["ADMIN", "MANAGER", "TEAM_MEMBER"];

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [pendingRoles, setPendingRoles] = useState({});
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [creatingRole, setCreatingRole] = useState("");
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUser, setEditUser] = useState({ fullName: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        const result = await getUsers();

        if (!cancelled) {
          setUsers(result);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Unable to load users"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRoleSave(user) {
    const role = pendingRoles[user.id] ?? user.role;

    if (role === user.role) return;

    setSavingKey(`role-${user.id}`);
    setError("");
    setSuccess("");

    try {
      const updatedUser = await updateUserRole(user.id, role);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser
        )
      );
      setPendingRoles((currentRoles) => {
        const remainingRoles = { ...currentRoles };
        delete remainingRoles[user.id];
        return remainingRoles;
      });
      setSuccess(`Updated ${updatedUser.fullName}'s role.`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update user role"
      );
    } finally {
      setSavingKey("");
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const createdUser = await createUser({
        ...newUser,
        role: creatingRole,
      });
      setUsers((currentUsers) =>
        [...currentUsers, createdUser].sort((a, b) =>
          a.fullName.localeCompare(b.fullName)
        )
      );
      setCreatingRole("");
      setNewUser({ fullName: "", email: "", password: "" });
      setSuccess(`${createdUser.role.replace("_", " ")} account created.`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to create user"
      );
    }
  }

  async function handleEditSave(user) {
    setSavingKey(`edit-${user.id}`);
    setError("");
    setSuccess("");

    try {
      const updatedUser = await updateUser(user.id, editUser);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser
        )
      );
      setEditingUserId(null);
      setSuccess("User details updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update user"
      );
    } finally {
      setSavingKey("");
    }
  }

  async function handleStatusToggle(user) {
    setSavingKey(`status-${user.id}`);
    setError("");
    setSuccess("");

    try {
      const updatedUser = await updateUserStatus(user.id, !user.isActive);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser
        )
      );
      setSuccess(
        `${updatedUser.fullName} ${updatedUser.isActive ? "activated" : "deactivated"}.`
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update user status"
      );
    } finally {
      setSavingKey("");
    }
  }

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);

    return matchesSearch && (roleFilter === "ALL" || user.role === roleFilter);
  });

  return (
    <section
      className="dashboard-section user-management"
      aria-labelledby="user-management-title"
    >
      <div className="section-heading">
        <div>
          <h1 id="user-management-title">User management</h1>
          <p className="section-description">
            Create accounts, update profiles, and manage role and access.
          </p>
        </div>
      </div>

      <div className="user-management__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={() => setCreatingRole("MANAGER")}
        >
          Create Manager
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => setCreatingRole("TEAM_MEMBER")}
        >
          Create Team Member
        </button>
      </div>

      {creatingRole && (
        <form className="form-card user-management__create" onSubmit={handleCreateUser}>
          <div className="section-heading">
            <h2>Create {creatingRole.replace("_", " ")}</h2>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setCreatingRole("")}
            >
              Cancel
            </button>
          </div>
          <p className="section-description">
            Role is assigned by the administrator. The account will be active
            and can sign in using the common login page.
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="managed-user-name">Full name</label>
              <input
                id="managed-user-name"
                required
                maxLength={100}
                value={newUser.fullName}
                onChange={(event) =>
                  setNewUser({ ...newUser, fullName: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="managed-user-email">Email</label>
              <input
                id="managed-user-email"
                type="email"
                required
                maxLength={254}
                value={newUser.email}
                onChange={(event) =>
                  setNewUser({ ...newUser, email: event.target.value })
                }
              />
            </div>
            <div className="field field--wide">
              <label htmlFor="managed-user-password">
                Temporary password
              </label>
              <input
                id="managed-user-password"
                type="password"
                required
                minLength={8}
                value={newUser.password}
                onChange={(event) =>
                  setNewUser({ ...newUser, password: event.target.value })
                }
              />
              <span className="field-hint">
                Use at least 8 characters; passwords are stored as bcrypt hashes.
              </span>
            </div>
          </div>
          <button className="button button--primary" type="submit">
            Create account
          </button>
        </form>
      )}

      {loading && <p className="section-description">Loading users…</p>}
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {success && <p className="auth-success" role="status">{success}</p>}

      {!loading && !error && users.length === 0 && (
        <p className="section-description">No users found.</p>
      )}

      {!loading && users.length > 0 && (
        <>
          <div className="user-management__filters">
            <label>
              <span>Search users</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or email"
              />
            </label>
            <label>
              <span>Filter by role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="ALL">All roles</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="user-management__list">
          {filteredUsers.map((user) => {
            const selectedRole = pendingRoles[user.id] ?? user.role;
            const isCurrentUser = Number(user.id) === Number(currentUser.id);
            const isLastActiveAdmin =
              isCurrentUser &&
              user.role === "ADMIN" &&
              user.isActive &&
              users.filter(
                (listedUser) =>
                  listedUser.role === "ADMIN" && listedUser.isActive
              ).length <= 1;
            const isSaving = savingKey.endsWith(`-${user.id}`);

            return (
              <article className="user-management__row" key={user.id}>
                <div className="user-management__identity">
                  {editingUserId === user.id ? (
                    <>
                      <input
                        aria-label={`Name for ${user.email}`}
                        maxLength={100}
                        value={editUser.fullName}
                        onChange={(event) =>
                          setEditUser({
                            ...editUser,
                            fullName: event.target.value,
                          })
                        }
                      />
                      <input
                        aria-label={`Email for ${user.email}`}
                        type="email"
                        maxLength={254}
                        value={editUser.email}
                        onChange={(event) =>
                          setEditUser({
                            ...editUser,
                            email: event.target.value,
                          })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <strong>{user.fullName}</strong>
                      <span>{user.email}</span>
                    </>
                  )}
                  {isCurrentUser && <small>Current account</small>}
                </div>
                <label className="user-management__role">
                  <span>Role</span>
                  <select
                    aria-label={`Role for ${user.email}`}
                    value={selectedRole}
                    disabled={isSaving || isLastActiveAdmin}
                    onChange={(event) =>
                      setPendingRoles((currentRoles) => ({
                        ...currentRoles,
                        [user.id]: event.target.value,
                      }))
                    }
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                {editingUserId === user.id ? (
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleEditSave(user)}
                  >
                    {isSaving ? "Saving…" : "Save details"}
                  </button>
                ) : (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => {
                      setEditingUserId(user.id);
                      setEditUser({
                        fullName: user.fullName,
                        email: user.email,
                      });
                    }}
                  >
                    Edit details
                  </button>
                )}
                <button
                  className="button button--primary"
                  type="button"
                  disabled={selectedRole === user.role || isSaving}
                  onClick={() => handleRoleSave(user)}
                >
                  {savingKey === `role-${user.id}` ? "Saving…" : "Save role"}
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={isCurrentUser || isSaving}
                  onClick={() => handleStatusToggle(user)}
                >
                  {savingKey === `status-${user.id}`
                    ? "Saving…"
                    : user.isActive
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </article>
            );
          })}
          {filteredUsers.length === 0 && (
            <p className="section-description">No users match these filters.</p>
          )}
          </div>
        </>
      )}
    </section>
  );
}

export default UserManagement;
