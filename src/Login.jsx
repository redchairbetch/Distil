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
          background: #0b1929;
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
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(24,64,105,0.25) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 100% 100%, rgba(234,172,21,0.06) 0%, transparent 60%);
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
            0 0 0 1px rgba(24,64,105,0.15),
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
          text-align: center;
          margin-bottom: 36px;
          gap: 16px;
        }

        .login-logo-mark {
          width: 72px;
          height: 72px;
          filter: drop-shadow(0 2px 8px rgba(234,172,21,0.15));
        }

        .login-org {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #EAAC15;
          text-align: center;
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
          border-color: rgba(234,172,21,0.5);
          box-shadow: 0 0 0 3px rgba(234,172,21,0.1);
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
          background: #184069;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 16px rgba(24,64,105,0.4);
          letter-spacing: 0.2px;
        }

        .login-btn:hover:not(:disabled) {
          background: #1b4d7d;
          box-shadow: 0 6px 20px rgba(24,64,105,0.5);
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
            {/* MHC globe logo mark — white on dark */}
            <svg className="login-logo-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id="mhcMask">
                  <circle cx="50" cy="50" r="48" fill="white"/>
                  <ellipse cx="8" cy="50" rx="22" ry="30" fill="black"/>
                  <path d="M 28 2 C 46 30 46 70 30 98" stroke="black" strokeWidth="7" fill="none"/>
                  <path d="M 60 2 C 74 30 74 70 64 98" stroke="black" strokeWidth="7" fill="none"/>
                </mask>
              </defs>
              <circle cx="50" cy="50" r="48" fill="white" mask="url(#mhcMask)"/>
            </svg>
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
