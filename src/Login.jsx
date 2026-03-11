import { useState } from "react";
import { signIn } from "./db.js";

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      // onLogin is called by main.jsx via onAuthStateChange — no need to call it here
    } catch (err) {
      setError("Incorrect email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") handleLogin(); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #0a1628;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Sora', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Subtle background texture */
        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,163,74,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 100% 100%, rgba(22,163,74,0.06) 0%, transparent 60%);
          pointer-events: none;
        }

        /* Faint grid lines */
        .login-root::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          padding: 48px 44px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          backdrop-filter: blur(12px);
          box-shadow:
            0 0 0 1px rgba(22,163,74,0.08),
            0 32px 64px rgba(0,0,0,0.4),
            0 8px 24px rgba(0,0,0,0.3);
          animation: cardIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }

        .login-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 36px;
          gap: 14px;
        }

        .login-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #16a34a, #15803d);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 8px rgba(22,163,74,0.12), 0 4px 16px rgba(22,163,74,0.3);
        }

        .login-icon svg {
          width: 28px;
          height: 28px;
          fill: white;
        }

        .login-org {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #16a34a;
        }

        .login-title {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.3px;
          text-align: center;
        }

        .login-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          text-align: center;
          margin-top: 4px;
        }

        .login-fields {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 24px;
        }

        .login-field-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          margin-bottom: 6px;
        }

        .login-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          font-family: 'Sora', sans-serif;
          color: white;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .login-input::placeholder { color: rgba(255,255,255,0.2); }

        .login-input:focus {
          border-color: rgba(22,163,74,0.6);
          box-shadow: 0 0 0 3px rgba(22,163,74,0.12);
        }

        .login-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #fca5a5;
          margin-bottom: 20px;
          text-align: center;
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: #16a34a;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 16px rgba(22,163,74,0.3);
          letter-spacing: 0.2px;
        }

        .login-btn:hover:not(:disabled) {
          background: #15803d;
          box-shadow: 0 6px 20px rgba(22,163,74,0.4);
          transform: translateY(-1px);
        }

        .login-btn:active:not(:disabled) { transform: translateY(0); }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-footer {
          margin-top: 28px;
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.5px;
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">

          <div className="login-logo-wrap">
            {/* Hearing aid icon */}
            <div className="login-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.61 1.42 4.88 3.5 6.14V20a2 2 0 004 0v-4.86C14.58 13.88 16 11.61 16 9c0-2.21-.9-4.21-2.34-5.66A7.94 7.94 0 0012 2zm0 2c1.6 0 3.04.65 4.09 1.69A5.96 5.96 0 0118 9c0 2.08-1.06 3.9-2.67 4.99L14 15v5h-4v-5l-1.33-1.01A5.97 5.97 0 016 9c0-3.31 2.69-6 6-6zm0 2a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4z"/>
              </svg>
            </div>
            <div>
              <div className="login-org">My Hearing Centers</div>
              <div className="login-title">Provider Portal</div>
              <div className="login-sub">Sign in to access your clinic dashboard</div>
            </div>
          </div>

          <div className="login-fields">
            <div>
              <div className="login-field-label">Email</div>
              <input
                className="login-input"
                type="email"
                placeholder="you@myhearingcenters.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKey}
                autoComplete="email"
                autoFocus
              />
            </div>
            <div>
              <div className="login-field-label">Password</div>
              <input
                className="login-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKey}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <div className="login-footer">
            Powered by Distil · My Hearing Centers
          </div>

        </div>
      </div>
    </>
  );
}
