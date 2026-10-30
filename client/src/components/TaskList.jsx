
import { useState } from "react";
import TaskCard from "./TaskCard";

function TaskList({
  tasks,
  user,
  teamMembers = [],
  teamMembersLoading,
  teamMembersError,
  onStatusUpdated,
  onTaskAssigned,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [dueDateFilter, setDueDateFilter] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const clients = [...new Map(
    tasks
      .filter((task) => task.client_id && task.client_name)
      .map((task) => [task.client_id, task.client_name])
  )];
  const assignees = [...new Map(
    tasks
      .filter((task) => task.assigned_to && task.assigned_to_name)
      .map((task) => [task.assigned_to, task.assigned_to_name])
  )];
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      statusFilter === "ALL" || task.status === statusFilter;
    const matchesAssignee =
      assigneeFilter === "ALL" ||
      String(task.assigned_to) === assigneeFilter;
    const matchesClient =
      clientFilter === "ALL" || String(task.client_id) === clientFilter;
    const matchesDueDate =
      !dueDateFilter || task.due_date?.slice(0, 10) === dueDateFilter;
    const searchableText = [
      task.id,
      task.title,
      task.description,
      task.assigned_to_name,
      task.client_name,
      task.engagement_name,
      task.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      matchesStatus &&
      matchesAssignee &&
      matchesClient &&
      matchesDueDate &&
      searchableText.includes(normalizedSearch)
    );
  });

  return (
    <section
      className="task-section"
      aria-labelledby="task-list-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="task-list-title">Task history</h2>
          <p className="section-description">
            Find tasks and follow work through each stage.
          </p>
        </div>

        <span className="section-meta">
          Showing {filteredTasks.length} of {tasks.length}{" "}
          {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <span
            className="empty-state__mark"
            aria-hidden="true"
          >
            ✓
          </span>

          <strong>You’re all caught up</strong>
          <p>New work will appear here when it’s ready.</p>
        </div>
      ) : (
        <>
          <div className="task-filters">
            <div className="field">
              <label htmlFor="task-search">Search tasks</label>
              <input
                id="task-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, description, assignee"
              />
            </div>
            <div className="field">
              <label htmlFor="task-status-filter">Filter by status</label>
              <select
                id="task-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="NOT_STARTED">Not started</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="WAITING_FOR_CLIENT">Waiting for client</option>
                <option value="READY_FOR_REVIEW">Ready for review</option>
                <option value="CHANGES_REQUESTED">Changes requested</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-assignee-filter">Filter by assignee</label>
              <select
                id="task-assignee-filter"
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="ALL">All assignees</option>
                {assignees.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-client-filter">Filter by client</label>
              <select
                id="task-client-filter"
                value={clientFilter}
                onChange={(event) => setClientFilter(event.target.value)}
              >
                <option value="ALL">All clients</option>
                {clients.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-due-date-filter">Filter by deadline</label>
              <input
                id="task-due-date-filter"
                type="date"
                value={dueDateFilter}
                onChange={(event) => setDueDateFilter(event.target.value)}
              />
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <strong>No matching tasks</strong>
              <p>Try changing your search or status filter.</p>
            </div>
          ) : (
            <div className="task-list">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={`${task.id}:${task.assigned_to ?? task.assignedTo ?? task.assigned_to_id ?? task.assignedToId ?? ""}`}
                  task={task}
                  user={user}
                  teamMembers={teamMembers}
                  teamMembersLoading={teamMembersLoading}
                  teamMembersError={teamMembersError}
                  onStatusUpdated={onStatusUpdated}
                  onTaskAssigned={onTaskAssigned}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default TaskList;
