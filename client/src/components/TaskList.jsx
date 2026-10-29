
import TaskCard from "./TaskCard";

function TaskList({
  tasks,
  user,
  onStatusUpdated,
  onTaskAssigned,
}) {
  return (
    <section
      className="task-section"
      aria-labelledby="task-list-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="task-list-title">Your tasks</h2>
          <p className="section-description">
            Keep work moving and make the next step clear.
          </p>
        </div>

        <span className="section-meta">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
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
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              user={user}
              onStatusUpdated={onStatusUpdated}
              onTaskAssigned={onTaskAssigned}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TaskList;
