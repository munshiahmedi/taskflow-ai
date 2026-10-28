
import { useState } from "react";
import { updateTaskStatus } from "../api/tasksApi";

function TaskCard({ task, user, onStatusUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");

  const transitions =
    user?.role === "TEAM_MEMBER"
      ? {
          NOT_STARTED: ["IN_PROGRESS"],
          IN_PROGRESS: ["WAITING_FOR_CLIENT", "READY_FOR_REVIEW"],
          WAITING_FOR_CLIENT: ["IN_PROGRESS"],
          CHANGES_REQUESTED: ["IN_PROGRESS", "READY_FOR_REVIEW"],
        }
      : ["ADMIN", "MANAGER"].includes(user?.role)
        ? {
            READY_FOR_REVIEW: ["COMPLETED", "CHANGES_REQUESTED"],
          }
        : {};

  const availableStatuses = transitions[task.status] || [];
  const statusLabel = task.status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const statusClass = task.status.toLowerCase().replaceAll("_", "-");

  const actionLabels = {
    IN_PROGRESS: "Start work",
    WAITING_FOR_CLIENT: "Waiting for client",
    READY_FOR_REVIEW: "Submit for review",
    COMPLETED: "Approve & complete",
    CHANGES_REQUESTED: "Request changes",
  };

  async function handleStatusChange(status) {
    setError("");

    if (status === "CHANGES_REQUESTED" && !comment.trim()) {
      setError("Enter a review comment before requesting changes.");
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

  return (
    <article className="task-card">
      <div className="task-card__top">
        <h3 className="task-card__title">{task.title}</h3>
        <span className={`task-status task-status--${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <p className="task-card__description">
        {task.description || "No description has been added."}
      </p>
      <div className="task-card__meta">
        <span>Task #{task.id}</span>
      </div>

      {availableStatuses.length > 0 && (
        <div className="task-card__actions">
          {availableStatuses.includes("CHANGES_REQUESTED") && (
            <div className="review-field">
              <label htmlFor={`comment-${task.id}`}>
                Review note <span>(required to request changes)</span>
              </label>
              <textarea
                id={`comment-${task.id}`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
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
                ? "Updating…"
                : actionLabels[status] || `Move to ${statusLabel}`}
            </button>
          ))}
        </div>
      )}

      {availableStatuses.length === 0 && user?.role === "TEAM_MEMBER" && (
        <p className="field-hint">
          No action needed right now. You can continue when this task is ready.
        </p>
      )}

      {error && (
        <p className="inline-error task-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export default TaskCard;
