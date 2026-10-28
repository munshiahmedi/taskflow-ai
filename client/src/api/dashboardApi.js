import api from "./axios";

export async function getDashboardStats() {
  const response = await api.get("/dashboard");
  return response.data.statistics;
}
