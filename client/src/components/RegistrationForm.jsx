import { useState } from "react";
import { registerUser } from "../api/authApi";

function RegistrationForm({ onRegistered, onSwitchToLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setError("Name is required and must not exceed 100 characters");
      return;
    }

    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      setError("Password must be at least 8 characters and at most 72 UTF-8 bytes");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await registerUser({
        fullName: trimmedName,
        email: normalizedEmail,
        password,
      });

      if (!result.success) {
        throw new Error("Registration could not be completed");
      }

      onRegistered(normalizedEmail);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page login-page--registration">
      <aside className="login-aside">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">TF</span>
          <span className="brand-name">TaskFlow AI</span>
        </div>
        <div className="login-aside__copy">
          <p className="eyebrow">A better way to work</p>
          <h2>Make room for focused, meaningful progress.</h2>
          <p>
            Create your account to keep tasks, reviews, and team progress in
            one calm, focused workspace.
          </p>
          <div className="auth-benefits" aria-label="Workspace highlights">
            <span>Clear ownership</span>
            <span>Thoughtful reviews</span>
            <span>Visible progress</span>
          </div>
        </div>
        <p className="login-aside__foot">
          A clearer view of work, from start to done.
        </p>
      </aside>

      <section className="login-main login-main--registration">
        <div className="login-card">
          <p className="login-card__eyebrow">Get started</p>
          <h1>Create your account</h1>
          <p className="login-card__intro">
            Set up your TaskFlow AI account to get started.
          </p>

          <form
            className="login-form login-form--registration"
            onSubmit={handleSubmit}
          >
            <div className="login-field">
              <label htmlFor="registration-name">Full name</label>
              <input
                id="registration-name"
                name="fullName"
                type="text"
                autoComplete="name"
                maxLength={100}
                placeholder="Your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="registration-email">Email address</label>
              <input
                id="registration-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="registration-password">Password</label>
              <div className="auth-password-control">
                <input
                  id="registration-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <svg
                    className="auth-password-toggle__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <path d="m3 3 18 18" />}
                  </svg>
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="registration-confirm-password">
                Confirm password
              </label>
              <div className="auth-password-control">
                <input
                  id="registration-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  aria-pressed={showConfirmPassword}
                  onClick={() =>
                    setShowConfirmPassword((visible) => !visible)
                  }
                >
                  <svg
                    className="auth-password-toggle__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    {showConfirmPassword && <path d="m3 3 18 18" />}
                  </svg>
                </button>
              </div>
            </div>

            <button
              className="button button--primary login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          {error && (
            <p className="inline-error login-error" role="alert">
              {error}
            </p>
          )}

          <p className="auth-switch">
            Already have an account?{" "}
            <button type="button" onClick={onSwitchToLogin}>
              Sign in
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default RegistrationForm;
