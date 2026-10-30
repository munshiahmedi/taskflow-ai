
import { useEffect, useRef, useState } from "react";
import { assignTask, createTask } from "../api/tasksApi";
import api from "../api/axios";

function CreateTaskForm({
  onTaskCreated,
  user,
  teamMembers = [],
  teamMembersLoading = false,
  teamMembersError = "",
}) {
  const [engagements, setEngagements] = useState([]);
  const [engagementId, setEngagementId] = useState("");
  const [engagementsLoading, setEngagementsLoading] = useState(true);
  const [engagementError, setEngagementError] = useState("");

  const canAssignTasks = ["ADMIN", "MANAGER"].includes(user?.role);
  const [assignedMemberId, setAssignedMemberId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const descriptionRef = useRef("");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [descriptionGenerationError, setDescriptionGenerationError] =
    useState("");
  const [creating, setCreating] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");
  const [taskError, setTaskError] = useState("");

  async function handleGenerateDescription() {
    setDescriptionGenerationError("");
    setTaskMessage("");

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setDescriptionGenerationError(
        "Enter a task title before generating a description."
      );
      return;
    }

    if (trimmedTitle.length > 255) {
      setDescriptionGenerationError(
        "Task titles must be 255 characters or fewer."
      );
      return;
    }

    setGeneratingDescription(true);

    try {
      const response = await api.post("/tasks/generate-description", {
        title: trimmedTitle,
      });
      const generatedDescription = response.data?.description;

      if (
        typeof generatedDescription !== "string" ||
        !generatedDescription.trim()
      ) {
        setDescriptionGenerationError(
          "The AI returned an empty or invalid description. Please try again."
        );
        return;
      }

      if (
        descriptionRef.current.trim() &&
        !window.confirm(
          "Replace the description you have entered with the generated description?"
        )
      ) {
        return;
      }

      const nextDescription = generatedDescription.trim();
      descriptionRef.current = nextDescription;
      setDescription(nextDescription);
    } catch (error) {
      const status = error.response?.status;
      const messages = {
        400: "Check the task title and try again.",
        401: "Your session has expired. Log in again to continue.",
        403: "Only administrators and managers can generate task descriptions.",
        429: "The AI service is receiving too many requests. Please try again shortly.",
        503: "AI description generation is not configured. Contact your administrator.",
        504: "The AI service took too long to respond. Please try again.",
      };

      setDescriptionGenerationError(
        messages[status] ||
          (error.response
            ? "Unable to generate a description right now. Please try again later."
            : "Unable to reach the server. Check your connection and try again.")
      );
    } finally {
      setGeneratingDescription(false);
    }
  }

  useEffect(() => {
    async function loadEngagements() {
      try {
        const response = await api.get("/engagements");
        const availableEngagements = response.data.engagements || [];

        setEngagements(availableEngagements);

        if (availableEngagements.length > 0) {
          setEngagementId(String(availableEngagements[0].id));
        }
      } catch (err) {
        setEngagementError(
          err.response?.data?.message ||
            err.message ||
            "Unable to load engagements"
        );
      } finally {
        setEngagementsLoading(false);
      }
    }

    loadEngagements();
  }, []);

  async function handleCreateTask(event) {
    event.preventDefault();
    setTaskMessage("");
    setTaskError("");

    if (!engagementId) {
      setTaskError("Please select an engagement");
      return;
    }

    if (!title.trim()) {
      setTaskError("Task title is required");
      return;
    }

    setCreating(true);

    try {
      const task = await createTask({
        engagementId: Number(engagementId),
        title: title.trim(),
        description: description.trim(),
      });

      if (assignedMemberId) {
        try {
          const assignedTask = await assignTask(
            task.id,
            Number(assignedMemberId)
          );
          onTaskCreated(assignedTask);
          setTaskMessage("Task created and assigned successfully!");
        } catch (assignmentError) {
          onTaskCreated(task);
          setTaskError(
            `Task was created, but assignment failed: ${
              assignmentError.response?.data?.message ||
              assignmentError.message ||
              "Unable to assign task"
            }`
          );
        }
      } else {
        onTaskCreated(task);
        setTaskMessage("Task created successfully!");
      }

      setTitle("");
      descriptionRef.current = "";
      setDescription("");
      setAssignedMemberId("");
    } catch (err) {
      setTaskError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create task"
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="form-card" aria-labelledby="create-task-title">
      <h2 id="create-task-title">Create a task</h2>
      <p className="form-card__intro">
        Add the essentials. You can review and edit an AI-assisted draft before
        creating the task.
      </p>

      {engagementsLoading ? (
        <p className="section-description">Loading engagements…</p>
      ) : engagementError ? (
        <p className="inline-error" role="alert">
          Unable to load engagements: {engagementError}
        </p>
      ) : engagements.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">＋</span>
          <strong>No engagements available</strong>
          <p>Create an engagement before adding a task.</p>
        </div>
      ) : (
        <form className="form-grid" onSubmit={handleCreateTask}>
          <div className="field">
            <label htmlFor="engagement">Engagement</label>
            <select
              id="engagement"
              value={engagementId}
              onChange={(event) => setEngagementId(event.target.value)}
              required
            >
              {engagements.map((engagement) => (
                <option key={engagement.id} value={engagement.id}>
                  {engagement.name} — {engagement.client_name}
                </option>
              ))}
            </select>
          </div>

          {canAssignTasks && (
            <div className="field">
              <label htmlFor="assignedMember">Team Member</label>
              {teamMembersLoading ? (
                <p className="field-hint">Loading team members…</p>
              ) : (
                <select
                  id="assignedMember"
                  value={assignedMemberId}
                  onChange={(event) =>
                    setAssignedMemberId(event.target.value)
                  }
                  disabled={Boolean(teamMembersError)}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} ({member.email})
                    </option>
                  ))}
                </select>
              )}
              {teamMembersError && (
                <p className="inline-error" role="alert">
                  Unable to load team members: {teamMembersError}
                </p>
              )}
            </div>
          )}

          <div className="field field--wide">
            <label htmlFor="title">Task title</label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="field field--wide">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => {
                descriptionRef.current = event.target.value;
                setDescription(event.target.value);
              }}
              placeholder="Enter task description"
              rows={4}
            />
            <div className="ai-action-row">
              <span className="field-hint">
                Turn a short title into a clear, actionable draft.
              </span>
            </div>
            <button
              className="button button--secondary"
              type="button"
              onClick={handleGenerateDescription}
              disabled={generatingDescription || creating}
            >
              {generatingDescription
                ? "Generating description..."
                : "Generate with AI"}
            </button>
            {descriptionGenerationError && (
              <p className="inline-error" role="alert">
                {descriptionGenerationError}
              </p>
            )}
          </div>

          <div className="field--wide form-actions">
            <span className="field-hint">
              {assignedMemberId
                ? "This task will be assigned after it is created."
                : "You can assign this task later."}
            </span>
            <button
              className="button button--primary"
              type="submit"
              disabled={creating || generatingDescription}
            >
              {creating ? "Creating task…" : "Create task"}
            </button>
          </div>
        </form>
      )}

      {taskMessage && (
        <p className="form-feedback form-feedback--success" role="status">
          {taskMessage}
        </p>
      )}
      {taskError && (
        <p className="form-feedback form-feedback--error" role="alert">
          {taskError}
        </p>
      )}
    </section>
  );
}

export default CreateTaskForm;
