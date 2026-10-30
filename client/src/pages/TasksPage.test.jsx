import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/axios";
import { getDashboardStats } from "../api/dashboardApi";
import { getTasks, getTeamMembers } from "../api/tasksApi";
import {
  createUser,
  getUsers,
  updateUser,
  updateUserRole,
  updateUserStatus,
} from "../api/usersApi";
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

vi.mock("../api/usersApi", () => ({
  createUser: vi.fn(),
  getUsers: vi.fn(),
  updateUser: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserStatus: vi.fn(),
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
    getUsers.mockResolvedValue([]);
    createUser.mockReset();
    updateUser.mockReset();
    updateUserRole.mockReset();
    updateUserStatus.mockReset();
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
      screen.getByText(
        role === "ADMIN" ? "Admin dashboard" : "Manager dashboard"
      )
    ).toBeVisible();
    expect(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: /log out/i,
      })
    ).toBeVisible();
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: /log out/i,
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /good to see you/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Create a task" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    expect(screen.getByRole("heading", { name: "Create a task" })).toBeVisible();

    fireEvent.click(screen.getByRole("link", { name: "Overview" }));
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
    expect(screen.getByText("Team member dashboard")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /create task/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create task" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Users" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Work assigned to you")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /^tasks$/i }));
    expect(screen.getByText("Work assigned to you")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Task history" })).toBeVisible();

    fireEvent.click(screen.getByRole("link", { name: "Overview" }));
    expect(screen.getByRole("heading", { name: "Task overview" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Task history" })    ).not.toBeInTheDocument();
  });

  it("opens and closes the mobile sidebar when navigating", async () => {
    const user = userEvent.setup();
    render(
      <TasksPage
        user={{ fullName: "Taylor Example", role: "TEAM_MEMBER" }}
        onLogout={vi.fn()}
      />
    );

    const menuButton = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveTextContent("");
    expect(menuButton.querySelectorAll("span")).toHaveLength(3);

    await user.click(menuButton);
    expect(
      screen.getByRole("button", { name: "Close navigation menu" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeVisible();

    await user.click(screen.getByRole("link", { name: /^tasks$/i }));
    expect(
      screen.getByRole("button", { name: "Open navigation menu" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByRole("heading", { name: "Task history" })).toBeVisible();
  });

  it("allows only admins to access user role management", async () => {
    const user = userEvent.setup();
    getUsers.mockResolvedValueOnce([
      {
        id: 2,
        fullName: "Team Member",
        email: "member@example.com",
        role: "TEAM_MEMBER",
        isActive: true,
      },
      {
        id: 1,
        fullName: "Taylor Example",
        email: "admin@example.com",
        role: "ADMIN",
        isActive: true,
      },
    ]);
    updateUserRole.mockResolvedValueOnce({
      id: 2,
      fullName: "Team Member",
      email: "member@example.com",
      role: "MANAGER",
      isActive: 1,
    });

    render(
      <TasksPage
        user={{ id: 1, fullName: "Taylor Example", role: "ADMIN" }}
        onLogout={vi.fn()}
      />
    );

    await user.click(screen.getByRole("link", { name: "Users" }));
    expect(await screen.findByRole("heading", { name: "User management" }))
      .toBeVisible();
    expect(getUsers).toHaveBeenCalledOnce();

    const roleSelector = screen.getByRole("combobox", {
      name: "Role for member@example.com",
    });
    await user.selectOptions(roleSelector, "MANAGER");
    await user.click(
      screen.getAllByRole("button", { name: "Save role" })[0]
    );

    expect(updateUserRole).toHaveBeenCalledWith(2, "MANAGER");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Updated Team Member's role."
    );
    expect(
      screen.getByRole("combobox", { name: "Role for admin@example.com" })
    ).toBeDisabled();
    expect(
      within(screen.getByText("Current account").closest("article")).getByRole(
        "button",
        { name: "Deactivate" }
      )
    ).toBeDisabled();
  });

  it("allows an admin to create a Manager with the role fixed by the action", async () => {
    const user = userEvent.setup();
    getUsers.mockResolvedValueOnce([]);
    createUser.mockResolvedValueOnce({
      id: 8,
      fullName: "Morgan Manager",
      email: "morgan@example.com",
      role: "MANAGER",
      isActive: true,
    });

    render(
      <TasksPage
        user={{ id: 1, fullName: "Taylor Example", role: "ADMIN" }}
        onLogout={vi.fn()}
      />
    );

    await user.click(screen.getByRole("link", { name: "Users" }));
    await user.click(screen.getByRole("button", { name: "Create Manager" }));
    await user.type(screen.getByLabelText("Full name"), "Morgan Manager");
    await user.type(screen.getByLabelText("Email"), "morgan@example.com");
    await user.type(
      screen.getByLabelText("Temporary password"),
      "SecurePassword123"
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(createUser).toHaveBeenCalledWith({
      fullName: "Morgan Manager",
      email: "morgan@example.com",
      password: "SecurePassword123",
      role: "MANAGER",
    });
    expect(await screen.findByText("Morgan Manager")).toBeVisible();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "MANAGER account created."
    );
  });
});
