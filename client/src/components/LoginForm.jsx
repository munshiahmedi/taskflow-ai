
import { useState } from "react";
import { loginUser } from "../api/authApi";

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await loginUser({
        email: email.trim(),
        password,
      });

      if (!result.token) {
        throw new Error("Login response did not contain a token");
      }

      onLogin(result.token, result.user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <aside className="login-aside">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">TF</span>
          <span className="brand-name">TaskFlow AI</span>
        </div>
        <div className="login-aside__copy">
          <p className="eyebrow">Work with clarity</p>
          <h2>Make every next step feel manageable.</h2>
          <p>
            Bring tasks, reviews, and team progress into one calm, focused
            workspace.
          </p>
        </div>
        <p className="login-aside__foot">
          A clearer view of work, from start to done.
        </p>
      </aside>

      <section className="login-main">
        <div className="login-card">
          <p className="login-card__eyebrow">Welcome back</p>
          <h1>Sign in to your workspace</h1>
          <p className="login-card__intro">
            Enter your account details to continue to your tasks and updates.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button
              className="button button--primary login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {error && (
            <p className="inline-error login-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default LoginForm;
