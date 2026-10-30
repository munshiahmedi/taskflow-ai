import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/axios";
import CatalogManagement from "./CatalogManagement";
import EngagementManagement from "./EngagementManagement";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("role-based management screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an administrator to create a client through Axios", async () => {
    const user = userEvent.setup();
    api.get.mockImplementation((path) =>
      Promise.resolve({
        data:
          path === "/clients"
            ? { clients: [] }
            : path === "/service-types"
              ? { serviceTypes: [] }
              : { taskTemplates: [] },
      })
    );
    api.post.mockResolvedValueOnce({
      data: {
        client: {
          id: 1,
          name: "Northwind",
          email: "contact@northwind.example",
          phone: null,
          is_active: 1,
        },
      },
    });

    render(<CatalogManagement />);
    await screen.findByText("No catalog items found.");
    await user.click(screen.getByRole("button", { name: "Create client" }));
    await user.type(screen.getByLabelText("Name"), "Northwind");
    await user.type(
      screen.getByLabelText("Email"),
      "contact@northwind.example"
    );
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/clients", {
        name: "Northwind",
        email: "contact@northwind.example",
        phone: "",
      });
    });
    expect(await screen.findByText("Northwind")).toBeVisible();
  });

  it("creates an engagement and generates tasks using its selected template", async () => {
    const user = userEvent.setup();
    api.get.mockImplementation((path) => {
      if (path === "/clients") {
        return Promise.resolve({
          data: { clients: [{ id: 1, name: "Northwind" }] },
        });
      }
      if (path === "/service-types") {
        return Promise.resolve({
          data: {
            serviceTypes: [
              {
                id: 2,
                name: "Monthly accounting",
                engagement_kind: "RECURRING",
              },
            ],
          },
        });
      }
      if (path === "/engagements") {
        return Promise.resolve({ data: { engagements: [] } });
      }
      return Promise.resolve({
        data: {
          taskTemplates: [{ id: 3, name: "Monthly close", version: 1 }],
        },
      });
    });
    api.post.mockResolvedValueOnce({
      data: {
        engagement: {
          id: 4,
          name: "Northwind October close",
          client_name: "Northwind",
          period_start: "2026-10-01",
          period_end: "2026-10-31",
        },
      },
    });

    render(<EngagementManagement />);
    await screen.findByRole("heading", { name: "Engagements" });
    await waitFor(() => {
      expect(screen.getByLabelText("Task template")).toHaveValue("3");
    });
    await user.selectOptions(screen.getByLabelText("Client"), "1");
    await user.type(
      screen.getByLabelText("Engagement name"),
      "Northwind October close"
    );
    fireEvent.change(screen.getByLabelText("Period start"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Period end"), {
      target: { value: "2026-10-31" },
    });
    await user.click(
      screen.getByRole("button", { name: "Create engagement" })
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/engagements", {
        clientId: 1,
        serviceTypeId: 2,
        templateId: 3,
        name: "Northwind October close",
        engagementKind: "RECURRING",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
      });
    });
    expect(
      await screen.findByText(
        "Engagement created and template tasks generated."
      )
    ).toBeVisible();
  });
});
