import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/axios";
import { getDashboardStats } from "../api/dashboardApi";
import { getTasks, getTeamMembers } from "../api/tasksApi";
import TasksPage from "./TasksPage";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../api/dashboardApi", () => ({
  getDashboardStats: vi.fn(),
}));

vi.mock("../api/tasksApi", () => ({
  getTasks: vi.fn(),
  getTeamMembers: vi.fn(),
}));

describe("TasksPage role-based workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) =>
      Promise.resolve(
        path === "/health"
          ? { data: { message: "Workspace connected" } }
          : { data: { engagements: [] } }
      )
    );
    getDashboardStats.mockResolvedValue({ totalTasks: 3 });
    getTasks.mockResolvedValue([]);
    getTeamMembers.mockResolvedValue([]);
  });

  it.each([
    ["ADMIN", "Administrator"],
    ["MANAGER", "Manager"],
  ])("%s can navigate to task creation", async (role, roleLabel) => {
    render(
      <TasksPage
        user={{ fullName: "Taylor Example", role }}
        onLogout={vi.fn()}
      />
    );

    expect(await screen.findByText(roleLabel)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /create task/i })
    ).toHaveAttribute("href", "#create-task");
    expect(screen.getByRole("heading", { name: "Create a task" })).toBeVisible();
  });

  it("keeps task creation hidden for team members", async () => {
    render(
      <TasksPage
        user={{ fullName: "Taylor Example", role: "TEAM_MEMBER" }}
        onLogout={vi.fn()}
      />
    );

    expect(await screen.findByText("Team member")).toBeVisible();
    expect(screen.getByText("My workspace")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /create task/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Work assigned to you")).toBeVisible();
  });
});
