import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("heading", { name: /good to see you/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Create a task" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /^tasks$/i }));
    expect(await screen.findByRole("heading", { name: "Task history" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Task overview" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /create task/i }));
    expect(
      screen.getByRole("link", { name: /create task/i })
    ).toHaveAttribute("href", "#create-task");
    expect(screen.getByRole("heading", { name: "Create a task" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Task history" })).not.toBeInTheDocument();
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
    expect(screen.queryByText("Work assigned to you")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /^tasks$/i }));
    expect(screen.getByText("Work assigned to you")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Task history" })).toBeVisible();

    fireEvent.click(screen.getByRole("link", { name: "Overview" }));
    expect(screen.getByRole("heading", { name: "Task overview" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Task history" })).not.toBeInTheDocument();
  });
});
