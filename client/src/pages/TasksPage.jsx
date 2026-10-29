
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { getTasks } from "../api/tasksApi";
import { getDashboardStats } from "../api/dashboardApi";
import CreateTaskForm from "../components/CreateTaskForm";
import TaskList from "../components/TaskList";

function TasksPage({ user, onLogout }) {
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [healthLoading, setHealthLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const canCreateTasks = ["ADMIN", "MANAGER"].includes(user?.role);

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

  const dashboardCards = [
    { label: "Total Tasks", key: "totalTasks" },
    { label: "Not Started", key: "notStartedTasks" },
    { label: "In Progress", key: "inProgressTasks" },
    { label: "Waiting for Client", key: "waitingForClientTasks" },
    { label: "Ready for Review", key: "readyForReviewTasks" },
    { label: "Changes Requested", key: "changesRequestedTasks" },
    { label: "Completed", key: "completedTasks" },
    { label: "Overdue", key: "overdueTasks" },
  ];

  const displayName =
    user?.fullName || user?.name || user?.email || "User";

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup" aria-label="TaskFlow AI home">
          <span className="brand-mark" aria-hidden="true">
            TF
          </span>

          <span className="brand-name">
            TaskFlow <span className="brand-caption">AI workspace</span>
          </span>
        </div>

        <div className="user-menu">
          <div className="user-identity">
            <span className="user-avatar" aria-hidden="true">
              {initials}
            </span>

            <span className="user-details">
              <span className="user-name">{displayName}</span>
              <span className="role-pill">
                {user?.role || "Unknown role"}
              </span>
            </span>
          </div>

          <button
            className="button button--quiet"
            type="button"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>Good work starts with clarity.</h1>

          <p className="welcome-copy">
            Here’s what’s happening across your tasks today.
          </p>
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
            <p className="section-description">
              A quick read on workload and progress.
            </p>
          </div>

          {stats && (
            <span className="section-meta">
              Live workspace totals
            </span>
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

      {canCreateTasks ? (
        <section className="dashboard-section">
          <CreateTaskForm
            user={user}
            onTaskCreated={handleTaskCreated}
          />
        </section>
      ) : (
        <p className="system-notice">
          <strong>Work assigned to you</strong> — review your tasks
          below and update their status as work progresses.
        </p>
      )}

      <section className="dashboard-section" aria-label="Tasks">
        {tasksLoading ? (
          <div className="task-section">
            <p className="section-description">
              Loading your tasks…
            </p>
          </div>
        ) : tasksError ? (
          <p className="dashboard-error" role="alert">
            Unable to load tasks: {tasksError}
          </p>
        ) : (
          <TaskList
            tasks={tasks}
            user={user}
            onStatusUpdated={handleStatusUpdated}
            onTaskAssigned={handleTaskAssigned}
          />
        )}
      </section>
    </main>
  );
}

export default TasksPage;
