import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { StudentPortal } from "./portals/student/StudentPortal";
import { ManagerPortal } from "./portals/manager/ManagerPortal";
import { ProvostPortal } from "./portals/provost/ProvostPortal";
import { Login } from "./components/Login";
import { Toast } from "./components/Toast";
import type { ToastMessage } from "./components/Toast";
import { authService } from "./services/authService";
import type { SessionUser, UserRole } from "./services/authService";
import { applyTheme } from "./theme/themes";
import { isFirebaseEnabled, auth } from "./firebase/config";
import { dbService } from "./services/dbService";

const ProtectedRoute: React.FC<{
  allowedRole: UserRole;
  currentUser: SessionUser | null;
  children: React.ReactElement;
}> = ({ allowedRole, currentUser, children }) => {
  if (!currentUser || currentUser.role !== allowedRole) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => authService.getCurrentUser());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [activeTab, setActiveTab] = useState<"home" | "gallery" | "menu" | "notices" | "contacts" | "managers">("home");

  // Check active session on startup and listen to live Firebase Auth state (AUTH-03, AUTH-05)
  useEffect(() => {
    applyTheme();

    if (isFirebaseEnabled && auth) {
      const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
        if (fbUser) {
          const email = fbUser.email || "";
          let role: UserRole = "manager";
          let id = "";
          if (email === "provost@hall.buet.ac.bd") {
            role = "provost";
            id = "provost";
          } else {
            const match = email.match(/^(\d{7})@/);
            if (match) {
              id = match[1];
              role = "manager";
            }
          }

          if (id) {
            let needsSetup = false;
            if (role === "manager") {
              const profile = await dbService.getManagerProfile(id);
              needsSetup = !profile || !profile.name;
            }
            const verifiedUser: SessionUser = { id, role, email, needsSetup };
            localStorage.setItem("hmms_session", JSON.stringify(verifiedUser));
            setCurrentUser(verifiedUser);
          } else {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Floating notifications manager
  const addToast = (text: string, type: "success" | "error" | "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLoginSuccess = (user: SessionUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    authService.logout().then(() => {
      setCurrentUser(null);
      addToast("Logged out successfully.", "info");
    }).catch(() => {
      setCurrentUser(null);
      addToast("Logged out successfully.", "info");
    });
  };

  const refreshProfileState = () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground flex flex-col relative z-10">
        {/* Navigation header */}
        <Navbar 
          currentUser={currentUser} 
          onLogout={handleLogout} 
          lang={lang} 
          setLang={setLang}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Portals routes */}
        <div className="flex-1 pt-[68px]">
          <Routes>
            {/* Student portal */}
            <Route 
              path="/" 
              element={
                <StudentPortal 
                  addToast={addToast} 
                  lang={lang}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              } 
            />
            
            {/* Staff authentication */}
            <Route 
              path="/login" 
              element={
                currentUser ? (
                  currentUser.role === "provost" ? <Navigate to="/provost" replace /> : <Navigate to="/manager" replace />
                ) : (
                  <Login onLoginSuccess={handleLoginSuccess} addToast={addToast} />
                )
              } 
            />
            
            {/* Mess Manager Workspace */}
            <Route 
              path="/manager" 
              element={
                <ProtectedRoute allowedRole="manager" currentUser={currentUser}>
                  <ManagerPortal 
                    currentUser={currentUser} 
                    addToast={addToast} 
                    onProfileUpdated={refreshProfileState} 
                  />
                </ProtectedRoute>
              } 
            />
            
            {/* Provost Administration Dashboard */}
            <Route 
              path="/provost" 
              element={
                <ProtectedRoute allowedRole="provost" currentUser={currentUser}>
                  <ProvostPortal addToast={addToast} />
                </ProtectedRoute>
              } 
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      {/* Floating Notifications List */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast} onClose={removeToast} />
        ))}
      </div>
    </BrowserRouter>
  );
};
export default App;
