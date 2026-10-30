import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { loginUser } from "../api/authApi";
import LoginForm from "./LoginForm";

vi.mock("../api/authApi", () => ({
  loginUser: vi.fn(),
}));

describe("LoginForm", () => {
  it("keeps the existing login flow and forwards the returned session", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    loginUser.mockResolvedValueOnce({
      token: "test-token",
      user: { id: 1, role: "TEAM_MEMBER" },
    });
    render(<LoginForm onLogin={onLogin} onSwitchToRegister={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123" },
    });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("button", { name: "Register" })).toBeVisible();
    expect(loginUser).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Password123",
    });
    expect(onLogin).toHaveBeenCalledWith("test-token", {
      id: 1,
      role: "TEAM_MEMBER",
    });
  });

  it("passes a prefilled registration email into the login form", () => {
    render(
      <LoginForm
        initialEmail="new@example.com"
        onLogin={vi.fn()}
        onSwitchToRegister={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Email address")).toHaveValue("new@example.com");
  });
});
