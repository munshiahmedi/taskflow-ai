
import { useState } from "react";
import {
  assignTask,
  updateTaskStatus,
  getTaskHistory,
} from "../api/tasksApi";

function TaskCard({
  task,
  user,
  teamMembers = [],
  teamMembersLoading,
  teamMembersError,
  onStatusUpdated,
  onTaskAssigned,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");

  const [selectedAssignee, setSelectedAssignee] = useState(
    String(
      task.assigned_to ??
        task.assignedTo ??
        task.assigned_to_id ??
        task.assignedToId ??
        ""
    )
  );
  const [assignmentLoading, setAssignmentLoading] =
    useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const canAssignTasks = ["ADMIN", "MANAGER"].includes(
    user?.role
  );

  const transitions =
    user?.role === "TEAM_MEMBER"
      ? {
          NOT_STARTED: ["IN_PROGRESS"],
          IN_PROGRESS: [
            "WAITING_FOR_CLIENT",
            "READY_FOR_REVIEW",
          ],
          WAITING_FOR_CLIENT: ["IN_PROGRESS"],
          CHANGES_REQUESTED: [
            "IN_PROGRESS",
            "READY_FOR_REVIEW",
          ],
        }
      : ["ADMIN", "MANAGER"].includes(user?.role)
        ? {
            READY_FOR_REVIEW: [
              "COMPLETED",
              "CHANGES_REQUESTED",
            ],
          }
        : {};

  const availableStatuses = transitions[task.status] || [];

  const statusLabel = (task.status || "UNKNOWN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const statusClass = (task.status || "unknown")
    .toLowerCase()
    .replaceAll("_", "-");

  const actionLabels = {
    IN_PROGRESS: "Start work",
    WAITING_FOR_CLIENT: "Waiting for client",
    READY_FOR_REVIEW: "Submit for review",
    COMPLETED: "Approve & complete",
    CHANGES_REQUESTED: "Request changes",
  };

  async function handleAssignTask() {
    if (!selectedAssignee) {
      setAssignmentError("Select a team member first.");
      return;
    }

    setAssignmentError("");
    setAssignmentMessage("");
    setAssignmentLoading(true);

    try {
      const result = await assignTask(
        task.id,
        Number(selectedAssignee)
      );

      const selectedMember = teamMembers.find(
        (member) =>
          String(member.id) === String(selectedAssignee)
      );

      // Preserve the existing task fields while updating
      // the assignment fields returned by the API.
      const updatedTask = {
        ...task,
        ...(result || {}),
        assigned_to:
          result?.assigned_to ??
          result?.assignedTo ??
          result?.assigned_to_id ??
          result?.assignedToId ??
          Number(selectedAssignee),
        assignedTo:
          result?.assignedTo ??
          result?.assigned_to ??
          result?.assignedToId ??
          result?.assigned_to_id ??
          Number(selectedAssignee),
        assigned_to_name:
          result?.assigned_to_name ??
          result?.assignedToName ??
          selectedMember?.fullName ??
          "",
        assignedToName:
          result?.assignedToName ??
          result?.assigned_to_name ??
          selectedMember?.fullName ??
          "",
      };

      onTaskAssigned?.(updatedTask);
      setAssignmentMessage("Task assigned successfully.");
    } catch (err) {
      setAssignmentError(
        err.response?.data?.message ||
          err.message ||
          "Unable to assign this task."
      );
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function handleStatusChange(status) {
    setError("");

    if (
      status === "CHANGES_REQUESTED" &&
      !comment.trim()
    ) {
      setError(
        "Enter a review comment before requesting changes."
      );
      return;
    }

    setLoading(true);

    try {
      const updatedTask = await updateTaskStatus(
        task.id,
        status,
        comment.trim()
      );

      onStatusUpdated(updatedTask);
      setComment("");

      // Reload history next time it is opened.
      setHistoryLoaded(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update task status"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleHistoryClick() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }

    setShowHistory(true);

    if (historyLoaded) return;

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const result = await getTaskHistory(task.id);

      setHistory(Array.isArray(result) ? result : []);
      setHistoryLoaded(true);
    } catch (err) {
      setHistoryError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load task history"
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  function formatStatus(status) {
    if (!status) return "—";

    return status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(date) {
    if (!date) return "—";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleString();
  }

  function formatDueDate(date) {
    if (!date) return "No due date";

    const dateString = date instanceof Date
      ? date.toISOString().slice(0, 10)
      : String(date).slice(0, 10);
    const [year, month, day] = dateString.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (Number.isNaN(parsedDate.getTime())) {
      return "No due date";
    }

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(parsedDate);
  }

  const assignedMember = teamMembers.find(
    (member) =>
      String(member.id) ===
      String(
        task.assigned_to ??
          task.assignedTo ??
          task.assigned_to_id ??
          task.assignedToId ??
          ""
      )
  );

  const assignedName =
    task.assigned_to_name ||
    task.assignedToName ||
    assignedMember?.fullName ||
    "";

  return (
    <article className="task-card">
      <div className="task-card__top">
        <h3 className="task-card__title">{task.title}</h3>

        <span
          className={`task-status task-status--${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <p className="task-card__description">
        {task.description || "No description has been added."}
      </p>

      <div className="task-card__meta">
        <span>Task #{task.id}</span>

        <span>
          Assigned to: {assignedName || "Unassigned"}
        </span>
        <span>Due: {formatDueDate(task.due_date)}</span>
      </div>

      {canAssignTasks && (
        <div className="task-card__assignment">
          <label htmlFor={`assignee-${task.id}`}>
            Assign to team member
          </label>

          <div className="task-card__assignment-controls">
            <select
              id={`assignee-${task.id}`}
              value={selectedAssignee}
              onChange={(event) => {
                setSelectedAssignee(event.target.value);
                setAssignmentError("");
                setAssignmentMessage("");
              }}
              disabled={
                teamMembersLoading ||
                assignmentLoading ||
                Boolean(teamMembersError)
              }
            >
              <option value="">Select a team member</option>

              {teamMembers.map((member) => (
                <option key={member.id} value={String(member.id)}>
                  {member.fullName} ({member.email})
                </option>
              ))}
            </select>

            <button
              type="button"
              className="button button--primary"
              onClick={handleAssignTask}
              disabled={
                teamMembersLoading ||
                assignmentLoading ||
                Boolean(teamMembersError) ||
                !selectedAssignee
              }
            >
              {teamMembersLoading
                ? "Loading members..."
                : assignmentLoading
                  ? "Assigning..."
                  : "Assign task"}
            </button>
          </div>

          {assignmentError && (
            <p className="inline-error" role="alert">
              {assignmentError}
            </p>
          )}

          {teamMembersError && (
            <p className="inline-error" role="alert">
              Unable to load team members: {teamMembersError}
            </p>
          )}

          {assignmentMessage && (
            <p className="field-hint" role="status">
              {assignmentMessage}
            </p>
          )}
        </div>
      )}

      {availableStatuses.length > 0 && (
        <div className="task-card__actions">
          {availableStatuses.includes("CHANGES_REQUESTED") && (
            <div className="review-field">
              <label htmlFor={`comment-${task.id}`}>
                Review note{" "}
                <span>(required to request changes)</span>
              </label>

              <textarea
                id={`comment-${task.id}`}
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value)
                }
                placeholder="Describe what needs attention"
                disabled={loading}
              />
            </div>
          )}

          {availableStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`button ${
                status === "CHANGES_REQUESTED"
                  ? "button--quiet"
                  : "button--primary"
              }`}
              disabled={loading}
              onClick={() => handleStatusChange(status)}
            >
              {loading
                ? "Updating..."
                : actionLabels[status] ||
                  `Move to ${formatStatus(status)}`}
            </button>
          ))}
        </div>
      )}

      {availableStatuses.length === 0 &&
        user?.role === "TEAM_MEMBER" && (
          <p className="field-hint">
            No action needed right now. You can continue when
            this task is ready.
          </p>
        )}

      {error && (
        <p className="inline-error task-error" role="alert">
          {error}
        </p>
      )}

      <div className="task-history">
        <button
          type="button"
          className="button button--quiet"
          onClick={handleHistoryClick}
          disabled={historyLoading}
          aria-expanded={showHistory}
        >
          {historyLoading
            ? "Loading history..."
            : showHistory
              ? "Hide history"
              : "View history"}
        </button>

        {showHistory && (
          <div className="task-history__content">
            <h4>Task activity</h4>

            {historyLoading && (
              <p className="field-hint">
                Loading task history...
              </p>
            )}

            {historyError && (
              <p className="inline-error" role="alert">
                {historyError}
              </p>
            )}

            {!historyLoading &&
              !historyError &&
              history.length === 0 && (
                <p className="field-hint">
                  No history recorded for this task yet.
                </p>
              )}

            {!historyLoading &&
              !historyError &&
              history.length > 0 && (
                <ol className="task-history__list">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="task-history__item"
                    >
                      <p>
                        <strong>
                          {entry.actor_name || "Unknown user"}
                        </strong>
                      </p>

                      <p>
                        {formatStatus(entry.old_status)}
                        {" → "}
                        {formatStatus(entry.new_status)}
                      </p>

                      {entry.comment && (
                        <p className="task-history__comment">
                          <strong>Comment:</strong>{" "}
                          {entry.comment}
                        </p>
                      )}

                      <p className="field-hint">
                        {formatDate(entry.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
          </div>
        )}
      </div>
    </article>
  );
}

export default TaskCard;
