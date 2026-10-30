
import axios from "axios";

const apiBaseUrl = import.meta.env.PROD
  ? "https://taskflow-ai-boto.onrender.com/api"
  : "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("taskflow_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;