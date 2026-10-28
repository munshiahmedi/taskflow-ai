
import api from "./axios";

export async function getTasks() {
  const response = await api.get("/tasks");
  return response.data.tasks;
}

export async function createTask(taskData) {
  const response = await api.post("/tasks", taskData);
  return response.data.task;
}

export async function assignTask(taskId, assignedTo) {
  const response = await api.patch(`/tasks/${taskId}/assign`, {
    assignedTo,
  });
  return response.data.task;
}

export async function updateTaskStatus(taskId, status, comment = "") {
  const response = await api.patch(`/tasks/${taskId}/status`, {
    status,
    comment,
  });

  return response.data.task;
}
