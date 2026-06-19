import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Lock, AlertCircle, ArrowRight, Mail, Users, ChevronDown, ChevronRight, UserCheck, Plus, Trash, User } from "lucide-react";
import { authService } from "../services/authService";
import type { SessionUser } from "../services/authService";
import { isFirebaseEnabled } from "../firebase/config";

interface LoginProps {
  onLoginSuccess: (user: SessionUser) => void;
  addToast: (text: string, type: "success" | "error" | "info") => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, addToast }) => {
  const navigate = useNavigate();
  
  // Tab state: "student" | "manager"
  const [activeTab, setActiveTab] = useState<"student" | "manager">("student");
  
  // Manager Sub-mode: "login" | "signup"
  const [managerMode, setManagerMode] = useState<"login" | "signup">("login");

  // Loading and Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Student Fields
  const [studentEmail, setStudentEmail] = useState("");

  // Manager Login Fields
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");

  // Manager Signup Fields
  const [signupTeamName, setSignupTeamName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  // Collapsible manager signup index (0, 1, or 2)
  const [expandedManager, setExpandedManager] = useState<number>(0);

  // 3 Managers details
  const [managers, setManagers] = useState([
    { name: "", id: "", room: "", dept: "", mobile: "", photoUrl: "" },
    { name: "", id: "", room: "", dept: "", mobile: "", photoUrl: "" },
    { name: "", id: "", room: "", dept: "", mobile: "", photoUrl: "" }
  ]);

  // Mock Registry state
  const [mockStudents, setMockStudents] = useState<{ name: string; email: string }[]>([]);
  const [mockTeams, setMockTeams] = useState<any[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [isRegistryExpanded, setIsRegistryExpanded] = useState(false);

  // Load mock data on mount
  useEffect(() => {
    if (!isFirebaseEnabled) {
      const fetchMockData = async () => {
        const students = authService.getRegisteredStudents();
        setMockStudents(students);
        const teams = await authService.getRegisteredTeams();
        setMockTeams(teams);
      };
      fetchMockData();
    }
  }, []);

  const refreshMockRegistry = async () => {
    const students = authService.getRegisteredStudents();
    setMockStudents(students);
    const teams = await authService.getRegisteredTeams();
    setMockTeams(teams);
  };

  const handleAddMockStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim()) {
      addToast("Student Name and Email are required.", "error");
      return;
    }
    const buetEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.buet\.ac\.bd$/;
    if (!buetEmailRegex.test(newStudentEmail.trim().toLowerCase())) {
      addToast("Email must end with .buet.ac.bd", "error");
      return;
    }
    try {
      authService.addMockStudent(newStudentName, newStudentEmail);
      addToast("Mock student added successfully!", "success");
      setNewStudentName("");
      setNewStudentEmail("");
      refreshMockRegistry();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to add student.", "error");
    }
  };

  const handleDeleteMockStudent = (email: string) => {
    try {
      authService.deleteMockStudent(email);
      addToast("Mock student deleted.", "success");
      refreshMockRegistry();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete student.", "error");
    }
  };

  const handleQuickLoginStudent = async (email: string) => {
    setLoading(true);
    try {
      const user = await authService.loginStudent(email);
      addToast(`Logged in as student ${email}`, "success");
      onLoginSuccess(user);
      navigate("/");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLoginTeam = async (teamName: string, pass: string) => {
    setLoading(true);
    try {
      const user = await authService.loginManagerTeam(teamName, pass);
      addToast(`Manager team "${user.id}" logged in!`, "success");
      onLoginSuccess(user);
      navigate("/manager");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmail.trim()) {
      setError("Please enter your BUET email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const user = await authService.loginStudent(studentEmail);
      addToast("Successfully entered as Student!", "success");
      onLoginSuccess(user);
      navigate("/");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to enter portal.";
      setError(errMsg);
      addToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleManagerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !password.trim()) {
      setError("Please enter both Team Name and Password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const user = await authService.loginManagerTeam(teamName, password);
      addToast(`Manager team "${user.id}" signed in successfully!`, "success");
      onLoginSuccess(user);
      navigate("/manager");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to sign in.";
      setError(errMsg);
      addToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleManagerSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!signupTeamName.trim() || !signupPassword.trim()) {
      setError("Team Name and Password are required.");
      return;
    }

    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Basic validation for managers
    for (let i = 0; i < managers.length; i++) {
      const mgr = managers[i];
      if (!mgr.name.trim() || !mgr.id.trim() || !mgr.room.trim() || !mgr.dept.trim() || !mgr.mobile.trim()) {
        setError(`Please fill in all details for Manager ${i + 1}.`);
        setExpandedManager(i);
        return;
      }
      if (!/^\d{7}$/.test(mgr.id.trim())) {
        setError(`Student ID for Manager ${i + 1} must be exactly 7 digits.`);
        setExpandedManager(i);
        return;
      }
    }

    setLoading(true);

    try {
      await authService.signupManagerTeam(signupTeamName, signupPassword, managers);
      addToast("Manager team registered successfully! You can now log in.", "success");
      setTeamName(signupTeamName);
      setManagerMode("login");
      // Clear signup fields
      setSignupTeamName("");
      setSignupPassword("");
      setSignupConfirmPassword("");
      setManagers([
        { name: "", id: "", room: "", dept: "", mobile: "", photoUrl: "" },
        { name: "", id: "", room: "", dept: "", mobile: "", photoUrl: "" },
        { name: "", id: "", room: "", dept: "", mobile: "", photoUrl: "" }
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Signup failed.";
      setError(errMsg);
      addToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const updateManagerField = (index: number, field: string, value: string) => {
    const updated = [...managers];
    updated[index] = { ...updated[index], [field]: value };
    setManagers(updated);
  };

  const handleStudentDemoFill = () => {
    setStudentEmail("206059@eee.buet.ac.bd");
    addToast("Filled demo BUET email address.", "info");
  };

  const handleManagerLoginDemoFill = () => {
    setTeamName("Team Delta");
    setPassword("123456");
    addToast("Filled demo manager login credentials.", "info");
  };

  const handleManagerSignupDemoFill = () => {
    setSignupTeamName("Team Delta");
    setSignupPassword("123456");
    setSignupConfirmPassword("123456");
    setManagers([
      { name: "Sajib Hasan", id: "2060059", room: "302", dept: "EEE", mobile: "01711223344", photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop" },
      { name: "Fahim Rahman", id: "2060060", room: "115", dept: "CSE", mobile: "01822334455", photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop" },
      { name: "Naimul Islam", id: "2060061", room: "204", dept: "ME", mobile: "01933445566", photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop" }
    ]);
    setExpandedManager(0);
    addToast("Demo team register data pre-filled!", "info");
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-md w-full space-y-6 glass glass-border p-8 rounded-[24px] shadow-2xl relative z-10 animate-pageIn">
        
        {/* Brand Badge */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-background border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.25)] mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-3xl font-bold font-serif text-foreground tracking-tight">Sher-E-Bangla Hall</h2>
          <p className="mt-1 text-sm text-foreground/50">
            Dining Management Portal
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-white/[0.03] border border-white/10 rounded-xl p-1">
          <button
            onClick={() => {
              setActiveTab("student");
              setError("");
            }}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === "student"
                ? "bg-primary text-background shadow-md"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Student Portal
          </button>
          <button
            onClick={() => {
              setActiveTab("manager");
              setError("");
            }}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === "manager"
                ? "bg-primary text-background shadow-md"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Mess Manager
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STUDENT ACCESS FORM */}
        {activeTab === "student" && (
          <form className="space-y-4 animate-fadeIn" onSubmit={handleStudentSubmit}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold uppercase text-foreground/55 tracking-wider">BUET Mail Address</label>
                <button
                  type="button"
                  onClick={handleStudentDemoFill}
                  className="text-[11px] text-primary hover:underline font-bold"
                >
                  (Demo Fill)
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground/30">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="e.g. 206059@eee.buet.ac.bd"
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-base focus:outline-none focus:border-primary/50 text-foreground placeholder:text-foreground/20"
                  required
                />
              </div>
              <p className="mt-1.5 text-xs text-foreground/35 leading-normal">
                Enter your official student mail. Only emails ending in <span className="text-primary/75 font-semibold">.buet.ac.bd</span> can enter.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 flex items-center justify-center gap-1.5 py-3.5 bg-gradient-to-r from-primary to-primary/95 text-background disabled:opacity-50 disabled:scale-100 rounded-xl text-sm font-bold uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-102 hover:shadow-primary/35 transition-all"
            >
              {loading ? "Entering..." : "Enter Student Portal"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>
        )}

        {/* MESS MANAGER PORTAL */}
        {activeTab === "manager" && (
          <div className="space-y-4">
            
            {/* LOGIN MODE */}
            {managerMode === "login" && (
              <form className="space-y-4 animate-fadeIn" onSubmit={handleManagerLoginSubmit}>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold uppercase text-foreground/55 tracking-wider">Manager Team Name</label>
                    <button
                      type="button"
                      onClick={handleManagerLoginDemoFill}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      (Demo Fill)
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground/30">
                      <Users size={16} />
                    </div>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Team Delta"
                      className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-base focus:outline-none focus:border-primary/50 text-foreground placeholder:text-foreground/20"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-foreground/55 tracking-wider mb-1">Team Secure Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground/30">
                      <Lock size={16} />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-base focus:outline-none focus:border-primary/50 text-foreground placeholder:text-foreground/20"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 flex items-center justify-center gap-1.5 py-3.5 bg-gradient-to-r from-primary to-primary/95 text-background disabled:opacity-50 disabled:scale-100 rounded-xl text-sm font-bold uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-102 hover:shadow-primary/35 transition-all"
                >
                  {loading ? "Authenticating..." : "Manager Login"}
                  {!loading && <ArrowRight size={15} />}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setManagerMode("signup");
                      setError("");
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    First time? Register Manager Team
                  </button>
                </div>
              </form>
            )}

            {/* SIGNUP MODE */}
            {managerMode === "signup" && (
              <form className="space-y-4 animate-fadeIn max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin" onSubmit={handleManagerSignupSubmit}>
                
                {/* Team Details */}
                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Manager Team Setup</h3>
                    <button
                      type="button"
                      onClick={handleManagerSignupDemoFill}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      (Demo Fill)
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Manager Team Name</label>
                    <input
                      type="text"
                      value={signupTeamName}
                      onChange={(e) => setSignupTeamName(e.target.value)}
                      placeholder="e.g. Team Delta"
                      className="w-full px-3.5 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-foreground/20"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Password</label>
                      <input
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3.5 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Confirm</label>
                      <input
                        type="password"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3.5 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-foreground"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 3 Managers Details */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wide px-1">Manager Details (3 Required)</h3>
                  
                  {managers.map((mgr, idx) => {
                    const isExpanded = expandedManager === idx;
                    return (
                      <div 
                        key={idx} 
                        className={`border rounded-2xl transition-all duration-300 ${
                          isExpanded 
                            ? "bg-white/[0.02] border-primary/30 p-4" 
                            : "bg-white/[0.01] border-white/5 p-3 hover:bg-white/[0.02]"
                        }`}
                      >
                        {/* Header toggle */}
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedManager(isExpanded ? -1 : idx)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </div>
                            <span className="text-sm font-bold text-foreground">
                              {mgr.name ? mgr.name : `Manager ${idx + 1}`}
                            </span>
                          </div>
                          {isExpanded ? <ChevronDown size={16} className="text-foreground/40" /> : <ChevronRight size={16} className="text-foreground/40" />}
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="mt-4 space-y-3 animate-fadeIn">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Full Name</label>
                                <input
                                  type="text"
                                  value={mgr.name}
                                  onChange={(e) => updateManagerField(idx, "name", e.target.value)}
                                  placeholder="Name"
                                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs focus:outline-none text-foreground"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Student ID (7 digits)</label>
                                <input
                                  type="text"
                                  value={mgr.id}
                                  onChange={(e) => updateManagerField(idx, "id", e.target.value.replace(/\D/g, "").slice(0, 7))}
                                  placeholder="e.g. 2012001"
                                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs focus:outline-none text-foreground font-mono"
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Dept</label>
                                <input
                                  type="text"
                                  value={mgr.dept}
                                  onChange={(e) => updateManagerField(idx, "dept", e.target.value)}
                                  placeholder="e.g. CSE"
                                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs focus:outline-none text-foreground"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Room No</label>
                                <input
                                  type="text"
                                  value={mgr.room}
                                  onChange={(e) => updateManagerField(idx, "room", e.target.value)}
                                  placeholder="e.g. 302"
                                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs focus:outline-none text-foreground"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Mobile Number</label>
                              <input
                                type="text"
                                value={mgr.mobile}
                                onChange={(e) => updateManagerField(idx, "mobile", e.target.value)}
                                placeholder="e.g. 01712345678"
                                className="w-full px-3 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs focus:outline-none text-foreground"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold uppercase text-foreground/45 mb-1">Photo (Optional)</label>
                              <div className="space-y-2">
                                <div className="flex gap-2 items-center">
                                  {mgr.photoUrl ? (
                                    <img src={mgr.photoUrl} alt="Preview" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/20 text-[10px] shrink-0 font-bold">No Image</div>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          updateManagerField(idx, "photoUrl", reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                    className="w-full text-xs text-foreground file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 file:cursor-pointer"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={mgr.photoUrl}
                                  onChange={(e) => updateManagerField(idx, "photoUrl", e.target.value)}
                                  placeholder="Or paste image URL"
                                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs focus:outline-none text-foreground text-ellipsis"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 flex items-center justify-center gap-1.5 py-3.5 bg-gradient-to-r from-primary to-primary/95 text-background disabled:opacity-50 disabled:scale-100 rounded-xl text-sm font-bold uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-102 hover:shadow-primary/35 transition-all"
                >
                  {loading ? "Registering..." : "Register Manager Team"}
                  {!loading && <ArrowRight size={15} />}
                </button>

                <div className="text-center mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setManagerMode("login");
                      setError("");
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Already registered? Team Login
                  </button>
                </div>
              </form>
            )}

          </div>
        )}
      </div>

      {/* MOCK REGISTRY CARD */}
      {!isFirebaseEnabled && (
        <div className="max-w-md w-full glass glass-border p-6 rounded-[20px] shadow-xl relative z-10 animate-fadeIn mt-4">
          <button
            type="button"
            onClick={() => setIsRegistryExpanded(!isRegistryExpanded)}
            className="w-full flex items-center justify-between text-sm font-bold text-primary tracking-wide focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <UserCheck size={18} />
              <span>TESTING MOCK REGISTRY</span>
            </div>
            {isRegistryExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {isRegistryExpanded && (
            <div className="mt-4 space-y-6 animate-fadeIn text-foreground/80">
              {/* Students section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary/80">Registered Students</h4>
                </div>
                
                {mockStudents.length === 0 ? (
                  <p className="text-xs text-foreground/40">No mock students registered.</p>
                ) : (
                  <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {mockStudents.map((student) => (
                      <div key={student.email} className="flex justify-between items-center bg-white/5 border border-white/5 p-2 rounded-xl text-xs">
                        <div className="truncate pr-2">
                          <p className="font-bold truncate">{student.name}</p>
                          <p className="font-mono text-[10px] text-foreground/45 truncate">{student.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuickLoginStudent(student.email)}
                            className="bg-primary/20 text-primary hover:bg-primary/30 px-2 py-1 rounded-lg font-bold"
                          >
                            Login
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMockStudent(student.email)}
                            className="text-rose-400 hover:bg-rose-500/20 p-1 rounded-lg"
                            title="Delete Student"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Mock Student Form */}
                <form onSubmit={handleAddMockStudent} className="flex gap-2">
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Student Name"
                    className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none text-foreground placeholder:text-foreground/30"
                    required
                  />
                  <input
                    type="email"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    placeholder="email@buet.ac.bd"
                    className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none text-foreground placeholder:text-foreground/30"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-primary text-background p-1.5 rounded-lg flex items-center justify-center hover:scale-105 transition-all shrink-0 font-bold text-xs"
                    title="Add Student"
                  >
                    <Plus size={14} />
                  </button>
                </form>
              </div>

              {/* Manager Teams section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary/80">Registered Manager Teams</h4>
                </div>

                {mockTeams.length === 0 ? (
                  <p className="text-xs text-foreground/40">No manager teams registered. Click signup above to create one.</p>
                ) : (
                  <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 scrollbar-thin text-foreground">
                    {mockTeams.map((team) => (
                      <div key={team.teamName} className="bg-white/5 border border-white/5 p-2 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold text-primary">{team.teamName}</span>
                            <span className="ml-2 text-[9px] bg-white/10 text-foreground/50 px-1 py-0.5 rounded-md font-mono">Pass: 123456 (or custom)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickLoginTeam(team.teamName, "123456")}
                            className="bg-primary/20 text-primary hover:bg-primary/30 px-2 py-1 rounded-lg font-bold"
                          >
                            Login
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/5">
                          {team.managers?.map((mgr: any, index: number) => (
                            <div key={index} className="text-[9px] text-foreground/60 truncate flex items-center gap-1">
                              {mgr.photoUrl ? (
                                <img src={mgr.photoUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                              ) : (
                                <User size={10} className="shrink-0" />
                              )}
                              <span className="truncate">{mgr.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default Login;
