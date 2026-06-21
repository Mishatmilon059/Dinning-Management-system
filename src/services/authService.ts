import { isFirebaseEnabled, auth } from "../firebase/config";
import { 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously 
} from "firebase/auth";

export type UserRole = "student" | "manager" | "provost";

export interface SessionUser {
  id: string;
  role: UserRole;
  email?: string;
  needsSetup?: boolean;
  token?: string;
}

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
    return this.loginManagerTeam(userId, password);
  }

  async loginStudent(email: string): Promise<SessionUser> {
    const sanitizedEmail = email.trim().toLowerCase();
    const buetEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.buet\.ac\.bd$/;
    if (!buetEmailRegex.test(sanitizedEmail)) {
      throw new Error("Invalid email. Only BUET mail addresses (ending with .buet.ac.bd) are allowed.");
    }

    if (isFirebaseEnabled && auth) {
      try {
        await signInAnonymously(auth);
      } catch (error: any) {
        throw new Error(error.message || "Failed to start a secure session with Firebase.");
      }
    }

    const studentId = sanitizedEmail.split("@")[0];
    const sessionUser: SessionUser = {
      id: studentId,
      role: "student",
      email: sanitizedEmail,
      needsSetup: false
    };

    localStorage.setItem("hmms_session", JSON.stringify(sessionUser));
    localStorage.setItem("hmms_student_id", studentId);
    localStorage.setItem("hmms_student_email", sanitizedEmail);

    return sessionUser;
  }

  async loginManagerTeam(teamName: string, password: string): Promise<SessionUser> {
    const sanitizedTeamName = teamName.trim();
    this.checkRateLimit(sanitizedTeamName);

    const email = sanitizedTeamName.toLowerCase().replace(/\s+/g, "_") + "@hall.buet.ac.bd";

    if (isFirebaseEnabled && auth) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
        this.incrementFailedAttempts(sanitizedTeamName);
        throw new Error(error.message || "Failed to log in to Firebase Authentication.");
      }
    }

    const dbService = await import("./dbService").then(m => m.dbService);
    const team = await dbService.getTeamProfile(sanitizedTeamName);
    if (!team) {
      this.incrementFailedAttempts(sanitizedTeamName);
      throw new Error("Manager team profile not found. Please sign up first.");
    }

    if (!isFirebaseEnabled) {
      const hashedInput = await hashPassword(password);
      if (team.passwordHash !== hashedInput) {
        this.incrementFailedAttempts(sanitizedTeamName);
        throw new Error("Incorrect password for manager team.");
      }
    }

    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const sessionUser: SessionUser = {
      id: sanitizedTeamName,
      role: "manager",
      email: email,
      needsSetup: false,
      token: sessionToken
    };

    localStorage.setItem("hmms_session", JSON.stringify(sessionUser));

    if (!isFirebaseEnabled) {
      const activeSessions = getMockAuthData<Record<string, SessionUser>>("active_sessions", {});
      activeSessions[sessionToken] = sessionUser;
      saveMockAuthData("active_sessions", activeSessions);
    }

    this.resetFailedAttempts(sanitizedTeamName);
    return sessionUser;
  }

  async signupManagerTeam(teamName: string, password: string, managers: any[]): Promise<void> {
    const sanitizedTeamName = teamName.trim();
    if (!sanitizedTeamName) {
      throw new Error("Team name is required.");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    if (managers.length !== 3) {
      throw new Error("A manager team must consist of exactly 3 managers.");
    }

    // Validate details for all 3 managers
    for (let i = 0; i < managers.length; i++) {
      const mgr = managers[i];
      if (!mgr.name?.trim()) throw new Error(`Manager ${i + 1} Name is required.`);
      if (!/^\d{7}$/.test(mgr.id?.trim() || "")) throw new Error(`Manager ${i + 1} ID must be exactly 7 digits.`);
      if (!mgr.room?.trim()) throw new Error(`Manager ${i + 1} Room is required.`);
      if (!mgr.dept?.trim()) throw new Error(`Manager ${i + 1} Department is required.`);
      if (!mgr.mobile?.trim()) throw new Error(`Manager ${i + 1} Mobile number is required.`);
    }

    const dbService = await import("./dbService").then(m => m.dbService);
    const existingTeam = await dbService.getTeamProfile(sanitizedTeamName);
    if (existingTeam) {
      throw new Error(`Team name "${sanitizedTeamName}" is already taken.`);
    }

    const email = sanitizedTeamName.toLowerCase().replace(/\s+/g, "_") + "@hall.buet.ac.bd";

    if (isFirebaseEnabled && auth) {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
        throw new Error(error.message || "Failed to register manager team in Firebase.");
      }
    }

    const passwordHash = await hashPassword(password);
    const teamData = {
      teamName: sanitizedTeamName,
      passwordHash,
      managers: managers.map(mgr => ({
        id: mgr.id.trim(),
        name: mgr.name.trim(),
        dept: mgr.dept.trim(),
        room: mgr.room.trim(),
        mobile: mgr.mobile.trim(),
        photoUrl: mgr.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
        bio: mgr.bio?.trim() || `Active Mess Manager for ${sanitizedTeamName}`
      }))
    };

    await dbService.saveTeamProfile(sanitizedTeamName, teamData);
  }

  getCurrentUser(): SessionUser | null {
    const session = localStorage.getItem("hmms_session");
    if (!session) return null;
    try {
      return JSON.parse(session) as SessionUser;
    } catch {
      return null;
    }
  }

  getRegisteredStudents(): { name: string; email: string }[] {
    const defaultStudents: { name: string; email: string }[] = [];
    return getMockAuthData<{ name: string; email: string }[]>("registered_students", defaultStudents);
  }

  addMockStudent(name: string, email: string): void {
    const list = this.getRegisteredStudents();
    const sanitizedEmail = email.trim().toLowerCase();
    if (list.some(s => s.email === sanitizedEmail)) {
      throw new Error("Student email already exists in mock registry.");
    }
    list.push({ name: name.trim(), email: sanitizedEmail });
    saveMockAuthData("registered_students", list);
  }

  deleteMockStudent(email: string): void {
    const list = this.getRegisteredStudents();
    const updated = list.filter(s => s.email !== email.trim().toLowerCase());
    saveMockAuthData("registered_students", updated);
  }

  async getRegisteredTeams(): Promise<any[]> {
    const rawTeams = localStorage.getItem("hmms_mock_manager_teams");
    let teamsObj: Record<string, any> = {};
    if (rawTeams) {
      try {
        teamsObj = JSON.parse(rawTeams);
      } catch {
        teamsObj = {};
      }
    }
    return Object.values(teamsObj);
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
    localStorage.removeItem("hmms_student_id");
    localStorage.removeItem("hmms_student_email");
  }
}

export const authService = new AuthService();
export default authService;
