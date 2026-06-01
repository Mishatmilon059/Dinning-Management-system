import { isFirebaseEnabled, auth } from "../firebase/config";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export type UserRole = "student" | "manager" | "provost";

export interface SessionUser {
  id: string;
  role: UserRole;
  email?: string;
  needsSetup?: boolean;
  token?: string;
}

const INITIAL_ALLOWED_MANAGERS = ["2012001", "2012002"];

// Default passwords for initial managers: manager1 and manager2
const INITIAL_PASSWORDS = {
  "2012001": "fc5c8b25121b6727289f07a04870f701c905ed95a31b674d8258e727ad8b8559", // SHA-256 of "manager1"
  "2012002": "bc2d449339e8020583492723c34a2e519e99c855a8057de278e5860cc415cb2c"  // SHA-256 of "manager2"
};

const getMockAuthData = <T>(key: string, initial: T): T => {
  const data = localStorage.getItem(`hmms_mock_auth_${key}`);
  if (!data) {
    localStorage.setItem(`hmms_mock_auth_${key}`, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const saveMockAuthData = (key: string, data: unknown) => {
  try {
    localStorage.setItem(`hmms_mock_auth_${key}`, JSON.stringify(data));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new Error("Local storage quota exceeded for authentication data!");
    }
    throw e;
  }
};

// SHA-256 password hashing helper for mock mode (AUTH-02)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

class AuthService {
  // Rate limiting check (AUTH-04)
  private checkRateLimit(userId: string): void {
    const attemptsKey = `hmms_login_attempts_${userId}`;
    const lockoutKey = `hmms_login_lockout_${userId}`;
    
    const lockoutTimeStr = sessionStorage.getItem(lockoutKey);
    if (lockoutTimeStr) {
      const lockoutTime = parseInt(lockoutTimeStr, 10);
      if (Date.now() < lockoutTime) {
        const remainingMinutes = Math.ceil((lockoutTime - Date.now()) / 60000);
        throw new Error(`Too many failed login attempts. Account locked. Try again in ${remainingMinutes} minute(s).`);
      } else {
        sessionStorage.removeItem(lockoutKey);
        sessionStorage.removeItem(attemptsKey);
      }
    }
  }

  private incrementFailedAttempts(userId: string): void {
    const attemptsKey = `hmms_login_attempts_${userId}`;
    const lockoutKey = `hmms_login_lockout_${userId}`;
    
    const attempts = parseInt(sessionStorage.getItem(attemptsKey) || "0", 10) + 1;
    sessionStorage.setItem(attemptsKey, attempts.toString());
    
    if (attempts >= 5) {
      const lockoutTime = Date.now() + 15 * 60 * 1000; // 15 minutes
      sessionStorage.setItem(lockoutKey, lockoutTime.toString());
      throw new Error("Too many failed login attempts. Account locked for 15 minutes.");
    }
  }

  private resetFailedAttempts(userId: string): void {
    sessionStorage.removeItem(`hmms_login_attempts_${userId}`);
    sessionStorage.removeItem(`hmms_login_lockout_${userId}`);
  }

  async login(userId: string, password: string): Promise<SessionUser> {
    const sanitizedId = userId.trim();
    this.checkRateLimit(sanitizedId);

    if (isFirebaseEnabled && auth) {
      try {
        let email = "";
        let role: UserRole = "manager";
        
        if (sanitizedId.toLowerCase() === "provost") {
          email = "provost@hall.buet.ac.bd";
          role = "provost";
        } else {
          email = `${sanitizedId}@dept.buet.ac.bd`;
          role = "manager";
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        let needsSetup = false;
        if (role === "manager") {
          const profile = await import("./dbService").then(m => m.dbService.getManagerProfile(sanitizedId));
          needsSetup = !profile || !profile.name;
        }

        const sessionUser: SessionUser = {
          id: sanitizedId,
          role,
          email: userCredential.user.email || undefined,
          needsSetup
        };
        
        localStorage.setItem("hmms_session", JSON.stringify(sessionUser));
        this.resetFailedAttempts(sanitizedId);
        return sessionUser;
      } catch (error) {
        this.incrementFailedAttempts(sanitizedId);
        throw new Error("Invalid student ID or password.", { cause: error });
      }
    } else {
      // Mock Login Implementation with password validation (AUTH-02)
      if (sanitizedId.toLowerCase() === "provost") {
        const provostHashed = "f73650c8c84b1e423d826db3c22264395fa5fed625d061cf493235cb67fc1f35"; // SHA-256 of "provost"
        const hashedInput = await hashPassword(password);
        if (hashedInput === provostHashed) {
          const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
          const user = { id: "provost", role: "provost" as UserRole, token: sessionToken };
          localStorage.setItem("hmms_session", JSON.stringify(user));
          
          const activeSessions = getMockAuthData<Record<string, SessionUser>>("active_sessions", {});
          activeSessions[sessionToken] = { id: "provost", role: "provost" };
          saveMockAuthData("active_sessions", activeSessions);

          this.resetFailedAttempts(sanitizedId);
          return user;
        } else {
          this.incrementFailedAttempts(sanitizedId);
          throw new Error("Invalid password for Provost.");
        }
      }

      // Check if ID is in the allowed managers list
      const allowed = getMockAuthData<string[]>("allowed_managers", INITIAL_ALLOWED_MANAGERS);
      if (allowed.includes(sanitizedId)) {
        // Enforce password verification in mock mode (AUTH-02)
        const passwords = getMockAuthData<Record<string, string>>("manager_passwords", INITIAL_PASSWORDS);
        const hashedInput = await hashPassword(password);
        
        if (passwords[sanitizedId] !== hashedInput) {
          this.incrementFailedAttempts(sanitizedId);
          throw new Error("Invalid password for Manager.");
        }

        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const user = { 
          id: sanitizedId, 
          role: "manager" as UserRole,
          needsSetup: true,
          token: sessionToken
        };

        // Check if profile is already configured
        const profile = localStorage.getItem("hmms_mock_managers");
        if (profile) {
          const managers = JSON.parse(profile);
          if (managers[sanitizedId] && managers[sanitizedId].name) {
            user.needsSetup = false;
          }
        }

        localStorage.setItem("hmms_session", JSON.stringify(user));

        const activeSessions = getMockAuthData<Record<string, SessionUser>>("active_sessions", {});
        activeSessions[sessionToken] = { id: sanitizedId, role: "manager", needsSetup: user.needsSetup };
        saveMockAuthData("active_sessions", activeSessions);

        this.resetFailedAttempts(sanitizedId);
        return user;
      } else {
        this.incrementFailedAttempts(sanitizedId);
        throw new Error("Access denied. Student ID is not registered as an active Mess Manager.");
      }
    }
  }

  getCurrentUser(): SessionUser | null {
    if (isFirebaseEnabled && auth) {
      const fbUser = auth.currentUser;
      if (!fbUser) return null;
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
      if (!id) return null;
      
      const session = localStorage.getItem("hmms_session");
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (parsed.id === id && parsed.role === role) {
            return parsed;
          }
        } catch {
          // ignore parsing error
        }
      }
      return { id, role, email };
    } else {
      // Mock mode session verification (AUTH-03)
      const session = localStorage.getItem("hmms_session");
      if (!session) return null;
      try {
        const parsed = JSON.parse(session) as SessionUser & { token?: string };
        if (!parsed.token) return null;
        const activeSessions = getMockAuthData<Record<string, SessionUser>>("active_sessions", {});
        if (!activeSessions[parsed.token]) return null;
        return parsed;
      } catch {
        return null;
      }
    }
  }

  async logout(): Promise<void> {
    const session = localStorage.getItem("hmms_session");
    if (session) {
      try {
        const parsed = JSON.parse(session) as SessionUser & { token?: string };
        if (parsed.token) {
          const activeSessions = getMockAuthData<Record<string, SessionUser>>("active_sessions", {});
          delete activeSessions[parsed.token];
          saveMockAuthData("active_sessions", activeSessions);
        }
      } catch {
        // ignore
      }
    }
    
    if (isFirebaseEnabled && auth) {
      await signOut(auth);
    }
    localStorage.removeItem("hmms_session");
  }

  // --- PROVOST ACTIONS: MANAGER PROFILES ---
  async getRegisteredManagers(): Promise<string[]> {
    if (isFirebaseEnabled) {
      return INITIAL_ALLOWED_MANAGERS;
    } else {
      return getMockAuthData<string[]>("allowed_managers", INITIAL_ALLOWED_MANAGERS);
    }
  }

  async registerManager(studentId: string): Promise<string> {
    const sanitizedId = studentId.trim();
    if (!/^\d{7}$/.test(sanitizedId)) {
      throw new Error("Student ID must be exactly 7 digits.");
    }

    // Verify duplication (FUNC-11)
    const registered = await this.getRegisteredManagers();
    if (registered.includes(sanitizedId)) {
      throw new Error("Manager is already registered.");
    }

    // Generate random secure password using CSPRNG (AUTH-06)
    const array = new Uint8Array(10);
    window.crypto.getRandomValues(array);
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    const password = Array.from(array).map(b => chars[b % chars.length]).join("");

    if (isFirebaseEnabled) {
      console.log(`Cloud Function Triggered: Create account for ${sanitizedId} and send email.`);
    } else {
      const allowed = getMockAuthData<string[]>("allowed_managers", INITIAL_ALLOWED_MANAGERS);
      allowed.push(sanitizedId);
      saveMockAuthData("allowed_managers", allowed);
      
      const passwords = getMockAuthData<Record<string, string>>("manager_passwords", INITIAL_PASSWORDS);
      passwords[sanitizedId] = await hashPassword(password);
      saveMockAuthData("manager_passwords", passwords);
    }

    return password;
  }

  async deactivateManager(studentId: string): Promise<void> {
    const sanitizedId = studentId.trim();
    if (isFirebaseEnabled) {
      // Cloud Function call to disable user auth
    } else {
      let allowed = getMockAuthData<string[]>("allowed_managers", INITIAL_ALLOWED_MANAGERS);
      allowed = allowed.filter(id => id !== sanitizedId);
      saveMockAuthData("allowed_managers", allowed);
      
      const passwords = getMockAuthData<Record<string, string>>("manager_passwords", INITIAL_PASSWORDS);
      delete passwords[sanitizedId];
      saveMockAuthData("manager_passwords", passwords);
    }
  }
}

export const authService = new AuthService();
export default authService;
