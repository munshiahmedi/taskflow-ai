import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import TaskList from "./TaskList";

const tasks = [
  {
    id: 1,
    title: "Prepare monthly report",
    description: "Summarize service results",
    assigned_to_name: "Taylor Example",
    status: "IN_PROGRESS",
  },
  {
    id: 2,
    title: "Review client onboarding",
    description: "Check required forms",
    assigned_to_name: "Jordan Example",
    status: "READY_FOR_REVIEW",
  },
];

describe("TaskList", () => {
  it("searches task details and filters by status", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={tasks}
        user={{ role: "ADMIN" }}
        onStatusUpdated={() => {}}
        onTaskAssigned={() => {}}
      />
    );

    await user.type(screen.getByLabelText("Search tasks"), "Taylor Example");
    expect(screen.getByText("Prepare monthly report")).toBeVisible();
    expect(screen.queryByText("Review client onboarding")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search tasks"));
    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "READY_FOR_REVIEW"
    );
    expect(screen.queryByText("Prepare monthly report")).not.toBeInTheDocument();
    expect(screen.getByText("Review client onboarding")).toBeVisible();
  });

  it("shows an empty state when filters have no matches", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={tasks}
        user={{ role: "TEAM_MEMBER" }}
        onStatusUpdated={() => {}}
        onTaskAssigned={() => {}}
      />
    );

    await user.type(screen.getByLabelText("Search tasks"), "not found");
    expect(screen.getByText("No matching tasks")).toBeVisible();
  });
});
