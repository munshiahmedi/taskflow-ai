
import { useCallback, useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";
import TasksPage from "./pages/TasksPage";
import { getCurrentUser } from "./api/authApi";

function App() {
  const [token, setToken] = useState(() =>
    sessionStorage.getItem("taskflow_token")
  );

  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem("taskflow_user");

    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [checkingSession, setCheckingSession] = useState(
    () => Boolean(sessionStorage.getItem("taskflow_token"))
  );

  function handleLogin(newToken, newUser) {
    sessionStorage.setItem("taskflow_token", newToken);
    sessionStorage.setItem("taskflow_user", JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);
    setCheckingSession(false);
  }

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("taskflow_token");
    sessionStorage.removeItem("taskflow_user");

    setToken(null);
    setUser(null);
    setCheckingSession(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      if (!token) {
        setCheckingSession(false);
        return;
      }

      setCheckingSession(true);

      try {
        const currentUser = await getCurrentUser();

        if (cancelled) return;

        let savedUser = null;

        try {
          savedUser = JSON.parse(
            sessionStorage.getItem("taskflow_user") || "null"
          );
        } catch {
          savedUser = null;
        }

        const mergedUser = {
          ...savedUser,
          ...currentUser,
        };

        setUser(mergedUser);

        sessionStorage.setItem(
          "taskflow_user",
          JSON.stringify(mergedUser)
        );
      } catch (error) {
        if (cancelled) return;

        if (error.response?.status === 401) {
          handleLogout();
        } else {
          // Keep the session if the server is temporarily unavailable.
          console.error(
            "Unable to validate session:",
            error.message
          );
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [token, handleLogout]);

  if (checkingSession) {
    return (
      <main className="screen-message" role="status">
        <span><span className="loading-dot" />Checking your session…</span>
      </main>
    );
  }

  if (!token || !user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return <TasksPage user={user} onLogout={handleLogout} />;
}

export default App;
