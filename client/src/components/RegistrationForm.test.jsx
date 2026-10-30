import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerUser } from "../api/authApi";
import RegistrationForm from "./RegistrationForm";

vi.mock("../api/authApi", () => ({
  registerUser: vi.fn(),
}));

describe("RegistrationForm", () => {
  function fillForm({
    fullName = "Taylor Example",
    email = "taylor@example.com",
    password = "Password123",
    confirmPassword = password,
  } = {}) {
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: fullName },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: confirmPassword },
    });
  }

  beforeEach(() => {
    registerUser.mockReset();
  });

  it("submits valid account details and switches to sign-in", async () => {
    const user = userEvent.setup();
    const onRegistered = vi.fn();
    registerUser.mockResolvedValueOnce({ success: true });
    render(
      <RegistrationForm
        onRegistered={onRegistered}
        onSwitchToLogin={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Role")).toHaveValue("TEAM_MEMBER");

    fillForm({
      fullName: " Taylor Example ",
      email: "TAYLOR@example.com",
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(registerUser).toHaveBeenCalledWith({
        fullName: "Taylor Example",
        email: "taylor@example.com",
        password: "Password123",
      });
    });
    expect(onRegistered).toHaveBeenCalledWith("taylor@example.com");
  });

  it("rejects passwords that do not match", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationForm
        onRegistered={vi.fn()}
        onSwitchToLogin={vi.fn()}
      />
    );

    fillForm({ confirmPassword: "Different123" });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match"
    );
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("shows duplicate-email errors from the API", async () => {
    const user = userEvent.setup();
    registerUser.mockRejectedValueOnce({
      response: {
        data: { message: "Email is already registered" },
      },
    });
    render(
      <RegistrationForm
        onRegistered={vi.fn()}
        onSwitchToLogin={vi.fn()}
      />
    );

    fillForm();
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email is already registered"
    );
  });

  it("supports showing and hiding both password fields", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationForm
        onRegistered={vi.fn()}
        onSwitchToLogin={vi.fn()}
      />
    );

    const password = screen.getByLabelText("Password");
    const confirmation = screen.getByLabelText("Confirm password");
    expect(password).toHaveAttribute("type", "password");
    expect(confirmation).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(
      screen.getByRole("button", { name: "Show confirm password" })
    );
    expect(password).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "text");
  });
});
