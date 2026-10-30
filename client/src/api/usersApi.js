import api from "./axios";

export async function getUsers() {
  const response = await api.get("/users");
  return response.data.users;
}

export async function createUser(userDetails) {
  const response = await api.post("/users", userDetails);
  return response.data.user;
}

export async function updateUser(userId, details) {
  const response = await api.put(`/users/${userId}`, details);
  return response.data.user;
}

export async function updateUserRole(userId, role) {
  const response = await api.patch(`/users/${userId}/role`, { role });
  return response.data.user;
}

export async function updateUserStatus(userId, isActive) {
  const response = await api.patch(`/users/${userId}/status`, { isActive });
  return response.data.user;
}
