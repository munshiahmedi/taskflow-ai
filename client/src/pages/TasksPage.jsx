
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { getTasks, getTeamMembers } from "../api/tasksApi";
import { getDashboardStats } from "../api/dashboardApi";
import CatalogManagement from "../components/CatalogManagement";
import CreateTaskForm from "../components/CreateTaskForm";
import EngagementManagement from "../components/EngagementManagement";
import TaskList from "../components/TaskList";
import UserManagement from "../components/UserManagement";

function TasksPage({ user, onLogout }) {
  const canCreateTasks = ["ADMIN", "MANAGER"].includes(user?.role);
  const canManageUsers = user?.role === "ADMIN";
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [healthLoading, setHealthLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(canCreateTasks);
  const [teamMembersError, setTeamMembersError] = useState("");

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const refreshDashboardStats = useCallback(async () => {
    try {
      const result = await getDashboardStats();
      setStats(result);
      setStatsError("");
    } catch (err) {
      setStatsError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load dashboard statistics"
      );
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await api.get("/health");

        if (!cancelled) {
          setHealth(response.data);
          setHealthError("");
        }
      } catch (err) {
        if (!cancelled) {
          setHealthError(
            err.response?.data?.message ||
              err.message ||
              "Unable to check backend connection"
          );
        }
      } finally {
        if (!cancelled) {
          setHealthLoading(false);
        }
      }
    }

    async function loadUserTasks() {
      try {
        const result = await getTasks();

        if (!cancelled) {
          setTasks(result);
          setTasksError("");
        }
      } catch (err) {
        if (!cancelled) {
          setTasksError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load tasks"
          );
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    }

    loadHealth();
    loadUserTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canCreateTasks) return undefined;

    let cancelled = false;

    async function loadTeamMembers() {
      try {
        const members = await getTeamMembers();

        if (!cancelled) {
          setTeamMembers(members);
          setTeamMembersError("");
        }
      } catch (err) {
        if (!cancelled) {
          setTeamMembersError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load team members"
          );
        }
      } finally {
        if (!cancelled) {
          setTeamMembersLoading(false);
        }
      }
    }

    loadTeamMembers();

    return () => {
      cancelled = true;
    };
  }, [canCreateTasks]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardStats() {
      try {
        const result = await getDashboardStats();

        if (!cancelled) {
          setStats(result);
          setStatsError("");
        }
      } catch (err) {
        if (!cancelled) {
          setStatsError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load dashboard statistics"
          );
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    }

    loadDashboardStats();

    return () => {
      cancelled = true;
    };
  }, []);

  // Add a newly created task to the current list.
  function handleTaskCreated(newTask) {
    setTasks((currentTasks) => [newTask, ...currentTasks]);
    refreshDashboardStats();
  }

  // Update a task after its status changes.
  function handleStatusUpdated(updatedTask) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === updatedTask.id ? updatedTask : task
      )
    );

    refreshDashboardStats();
  }

  // Update a task after its assignment changes.
  function handleTaskAssigned(updatedTask) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === updatedTask.id ? updatedTask : task
      )
    );

    refreshDashboardStats();
  }

  const taskDashboardCards = [
    { label: "Total Tasks", key: "totalTasks" },
    { label: "Open Tasks", key: "openTasks" },
    { label: "Due Today", key: "dueTodayTasks" },
    { label: "Waiting for Client", key: "waitingForClientTasks" },
    { label: "Waiting for Review", key: "readyForReviewTasks" },
    { label: "Overdue", key: "overdueTasks" },
  ];
  const dashboardCards =
    user?.role === "ADMIN"
      ? [
          { label: "Total Users", key: "totalUsers" },
          { label: "Managers", key: "totalManagers" },
          { label: "Team Members", key: "totalTeamMembers" },
          { label: "Clients", key: "totalClients" },
          { label: "Engagements", key: "totalEngagements" },
          { label: "Total Tasks", key: "totalTasks" },
          { label: "Open Tasks", key: "openTasks" },
          { label: "Overdue Tasks", key: "overdueTasks" },
        ]
      : user?.role === "MANAGER"
        ? [
            { label: "Assigned Team Tasks", key: "assignedTasks" },
            ...taskDashboardCards,
          ]
        : taskDashboardCards;

  const statisticsScope =
    user?.role === "ADMIN"
      ? "Counts across all workspace tasks."
      : user?.role === "MANAGER"
        ? "Counts for engagements you created."
        : "Counts for tasks assigned to you.";
  const roleLabel =
    user?.role === "ADMIN"
      ? "Administrator"
      : user?.role === "MANAGER"
        ? "Manager"
        : user?.role === "TEAM_MEMBER"
          ? "Team member"
          : user?.role || "Workspace member";
  const dashboardTitle =
    user?.role === "ADMIN"
      ? "Admin dashboard"
      : user?.role === "MANAGER"
        ? "Manager dashboard"
        : "Team member dashboard";
  const welcomeMessage =
    user?.role === "ADMIN"
      ? "Here’s the latest across your workspace."
      : user?.role === "MANAGER"
        ? "Keep your engagements and team work moving."
        : "Here’s what’s on your plate today.";

  const displayName =
    user?.fullName || user?.name || user?.email || "User";
  const firstName = displayName.trim().split(/\s+/)[0];

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Dismiss navigation overlay"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="dashboard-layout">
        <aside
          className={`sidebar${mobileNavOpen ? " sidebar--mobile-open" : ""}`}
          id="workspace-sidebar"
          aria-label="Workspace navigation"
        >
          <a className="sidebar-brand" href="#overview" aria-label="TaskFlow AI home">
            <span className="brand-mark" aria-hidden="true">
              TF
            </span>
            <span className="brand-name">
              TaskFlow <span className="brand-caption">AI workspace</span>
            </span>
          </a>
          <button
            className="button button--quiet sidebar-mobile-close"
            type="button"
            onClick={() => setMobileNavOpen(false)}
          >
            Close navigation
          </button>

          <p className="sidebar-label">Workspace</p>
          <nav className="sidebar-nav" aria-label="Primary navigation">
            <a
              className={`sidebar-link ${
                activeSection === "overview" ? "sidebar-link--active" : ""
              }`}
              href="#overview"
              onClick={() => {
                setActiveSection("overview");
                setMobileNavOpen(false);
              }}
              aria-current={activeSection === "overview" ? "page" : undefined}
            >
              <span className="sidebar-link__icon" aria-hidden="true">⌂</span>
              Overview
            </a>
            <a
              className={`sidebar-link ${
                activeSection === "tasks" ? "sidebar-link--active" : ""
              }`}
              href="#tasks"
              onClick={() => {
                setActiveSection("tasks");
                setMobileNavOpen(false);
              }}
              aria-current={activeSection === "tasks" ? "page" : undefined}
            >
              <span className="sidebar-link__icon" aria-hidden="true">▤</span>
              Tasks
            </a>
            {canCreateTasks && (
              <a
                className={`sidebar-link ${
                  activeSection === "create-task" ? "sidebar-link--active" : ""
                }`}
                href="#create-task"
                onClick={() => {
                  setActiveSection("create-task");
                  setMobileNavOpen(false);
                }}
                aria-current={
                  activeSection === "create-task" ? "page" : undefined
                }
              >
                <span className="sidebar-link__icon" aria-hidden="true">＋</span>
                Create task
              </a>
            )}
            {canCreateTasks && (
              <a
                className={`sidebar-link ${
                  activeSection === "engagements" ? "sidebar-link--active" : ""
                }`}
                href="#engagements"
                onClick={() => {
                  setActiveSection("engagements");
                  setMobileNavOpen(false);
                }}
                aria-current={
                  activeSection === "engagements" ? "page" : undefined
                }
              >
                <span className="sidebar-link__icon" aria-hidden="true">▧</span>
                Engagements
              </a>
            )}
            {canManageUsers && (
              <a
                className={`sidebar-link ${
                  activeSection === "users" ? "sidebar-link--active" : ""
                }`}
                href="#users"
                onClick={() => {
                  setActiveSection("users");
                  setMobileNavOpen(false);
                }}
                aria-current={activeSection === "users" ? "page" : undefined}
              >
                <span className="sidebar-link__icon" aria-hidden="true">♙</span>
                Users
              </a>
            )}
            {canManageUsers && (
              <a
                className={`sidebar-link ${
                  activeSection === "catalog" ? "sidebar-link--active" : ""
                }`}
                href="#catalog"
                onClick={() => {
                  setActiveSection("catalog");
                  setMobileNavOpen(false);
                }}
                aria-current={activeSection === "catalog" ? "page" : undefined}
              >
                <span className="sidebar-link__icon" aria-hidden="true">▦</span>
                Clients &amp; templates
              </a>
            )}
          </nav>

          <div className="sidebar-note">
            <span className="sidebar-note__mark" aria-hidden="true">✦</span>
            <p>Make progress visible. Keep great work moving.</p>
          </div>
          <button
            className="button button--quiet sidebar-logout"
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              onLogout();
            }}
          >
            <span className="sidebar-link__icon" aria-hidden="true">↪</span>
            Log out
          </button>
        </aside>

        <main className="dashboard-main">
          <header className="topbar">
            <button
              className="button button--quiet sidebar-mobile-toggle"
              type="button"
              aria-label={
                mobileNavOpen ? "Close navigation menu" : "Open navigation menu"
              }
              aria-controls="workspace-sidebar"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
            <div className="topbar-context">
              <span className="topbar-context__label">Workspace</span>
              <span className="topbar-context__title">{dashboardTitle}</span>
            </div>

            {canCreateTasks && (
              <button
                className="button button--primary topbar-create-task"
                type="button"
                aria-label="Create task"
                title="Create task"
                onClick={() => setActiveSection("create-task")}
              >
                <span aria-hidden="true">+</span>
              </button>
            )}

            <div className="user-menu">
              <div className="user-identity">
                <span className="user-avatar" aria-hidden="true">
                  {initials}
                </span>

                <span className="user-details">
                  <span className="user-name">{displayName}</span>
                  <span className="role-pill">{roleLabel}</span>
                </span>
              </div>

            </div>
          </header>

          {activeSection === "overview" && (
            <>
              <section className="welcome" id="overview">
                <div>
                  <p className="eyebrow">Your workspace · {roleLabel}</p>
                  <h1>Good to see you, {firstName}.</h1>

                  <p className="welcome-copy">{welcomeMessage}</p>
                </div>

                {healthLoading ? (
                  <span className="connection-pill">
                    <span className="loading-dot" />
                    Checking connection
                  </span>
                ) : healthError ? (
                  <span className="connection-pill connection-pill--offline">
                    Connection issue
                  </span>
                ) : (
                  <span className="connection-pill">
                    {health?.message || "Workspace connected"}
                  </span>
                )}
              </section>

              <section
                className="dashboard-section"
                aria-label="Dashboard statistics"
              >
                <div className="section-heading">
                  <div>
                    <h2>Task overview</h2>
                    <p className="section-description">{statisticsScope}</p>
                  </div>

                  {stats && (
                    <span className="section-meta">Live workspace totals</span>
                  )}
                </div>

                {statsLoading && (
                  <p className="section-description">
                    Loading dashboard statistics…
                  </p>
                )}

                {statsError && (
                  <p className="dashboard-error" role="alert">
                    Dashboard error: {statsError}
                  </p>
                )}

                {stats && (
                  <div className="stats-grid">
                    {dashboardCards.map((card) => (
                      <article
                        key={card.key}
                        className={`stat-card stat-card--${card.key}`}
                      >
                        <p className="stat-card__label">{card.label}</p>
                        <strong className="stat-card__value">
                          {stats[card.key] ?? 0}
                        </strong>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {healthError && (
                <p className="dashboard-error" role="alert">
                  Unable to reach the backend: {healthError}
                </p>
              )}
            </>
          )}

          {activeSection === "create-task" && canCreateTasks && (
            <section className="dashboard-section" id="create-task">
              <CreateTaskForm
                user={user}
                teamMembers={teamMembers}
                teamMembersLoading={teamMembersLoading}
                teamMembersError={teamMembersError}
                onTaskCreated={handleTaskCreated}
              />
            </section>
          )}

          {activeSection === "tasks" && (
            <>
              {!canCreateTasks && (
                <p className="system-notice">
                  <strong>Work assigned to you</strong> — review your tasks
                  below and update their status as work progresses.
                </p>
              )}

              <section className="dashboard-section" id="tasks" aria-label="Tasks">
                {tasksLoading ? (
                  <div className="task-section">
                    <p className="section-description">Loading your tasks…</p>
                  </div>
                ) : tasksError ? (
                  <p className="dashboard-error" role="alert">
                    Unable to load tasks: {tasksError}
                  </p>
                ) : (
                  <TaskList
                    tasks={tasks}
                    user={user}
                    teamMembers={teamMembers}
                    teamMembersLoading={teamMembersLoading}
                    teamMembersError={teamMembersError}
                    onStatusUpdated={handleStatusUpdated}
                    onTaskAssigned={handleTaskAssigned}
                  />
                )}
              </section>
            </>
          )}

          {activeSection === "users" && canManageUsers && (
            <UserManagement currentUser={user} />
          )}

          {activeSection === "engagements" && canCreateTasks && (
            <EngagementManagement />
          )}

          {activeSection === "catalog" && canManageUsers && (
            <CatalogManagement />
          )}
        </main>
      </div>
    </div>
  );
}

export default TasksPage;
