import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Lock, User, AlertCircle, ArrowRight } from "lucide-react";
import { authService } from "../services/authService";
import type { SessionUser } from "../services/authService";

interface LoginProps {
  onLoginSuccess: (user: SessionUser) => void;
  addToast: (text: string, type: "success" | "error" | "info") => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, addToast }) => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError("Please input both ID and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const user = await authService.login(userId, password);
      addToast(`Signed in successfully as ${user.role}!`, "success");
      onLoginSuccess(user);
      
      // Redirect based on role
      if (user.role === "provost") {
        navigate("/provost");
      } else {
        navigate("/manager");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to log in.";
      setError(errMsg);
      addToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-md w-full space-y-8 glass glass-border p-8 rounded-[24px] shadow-2xl relative z-10 animate-pageIn">
        
        {/* Brand/Role Badge */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-background border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.25)] mb-4">
            <ShieldAlert size={20} />
          </div>
          <h2 className="text-2xl font-bold font-serif text-foreground tracking-tight">Portal Access Sign In</h2>
          <p className="mt-1.5 text-xs text-foreground/50">
            Sign in below to manage dining ledger sheets or hall broadcast bulletins.
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* User ID Field */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-foreground/45 mb-1 tracking-wider">Student ID / Account ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground/30">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g. 2012001 or provost"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-foreground/20"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-foreground/45 mb-1 tracking-wider">Secure Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground/30">
                  <Lock size={15} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-foreground/20"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 flex items-center justify-center gap-1.5 py-3 bg-gradient-to-r from-primary to-primary/95 text-background disabled:opacity-50 disabled:scale-100 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-102 hover:shadow-primary/35 transition-all"
          >
            {loading ? "Verifying..." : "Authenticate Session"}
            {!loading && <ArrowRight size={13} />}
          </button>
        </form>
      </div>
    </div>
  );
};
export default Login;
