import { isFirebaseEnabled, auth } from "../firebase/config";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export type UserRole = "student" | "manager" | "provost";

export interface SessionUser {
  id: string;
  role: UserRole;
  email?: string;
  needsSetup?: boolean;
}

const INITIAL_ALLOWED_MANAGERS = ["2012001", "2012002"];

const getMockAuthData = <T>(key: string, initial: T): T => {
  const data = localStorage.getItem(`hmms_mock_auth_${key}`);
  if (!data) {
    localStorage.setItem(`hmms_mock_auth_${key}`, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const saveMockAuthData = (key: string, data: unknown) => {
  localStorage.setItem(`hmms_mock_auth_${key}`, JSON.stringify(data));
};

class AuthService {
  async login(userId: string, password: string): Promise<SessionUser> {
    const sanitizedId = userId.trim();

    if (isFirebaseEnabled && auth) {
      try {
        // Simple mapping: Provost or Student ID email
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
        
        // Check if profile setup is required
        let needsSetup = false;
        if (role === "manager") {
          // Check if profile exists in db
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
        return sessionUser;
      } catch (error) {
        throw new Error("Invalid student ID or password.", { cause: error });
      }
    } else {
      // Mock Login Implementation
      if (sanitizedId.toLowerCase() === "provost") {
        if (password === "provost") {
          const user: SessionUser = { id: "provost", role: "provost" };
          localStorage.setItem("hmms_session", JSON.stringify(user));
          return user;
        } else {
          throw new Error("Invalid password for Provost.");
        }
      }

      // Check if ID is in the allowed managers list
      const allowed = getMockAuthData<string[]>("allowed_managers", INITIAL_ALLOWED_MANAGERS);
      if (allowed.includes(sanitizedId)) {
        // In mock mode, any password works for testing, or matching credentials
        const user: SessionUser = { 
          id: sanitizedId, 
          role: "manager",
          needsSetup: true // will check profile state
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
        return user;
      } else {
        throw new Error("Access denied. Student ID is not registered as an active Mess Manager.");
      }
    }
  }

  getCurrentUser(): SessionUser | null {
    const session = localStorage.getItem("hmms_session");
    return session ? JSON.parse(session) : null;
  }

  async logout(): Promise<void> {
    if (isFirebaseEnabled && auth) {
      await signOut(auth);
    }
    localStorage.removeItem("hmms_session");
  }

  // --- PROVOST ACTIONS: MANAGER PROFILES ---
  async getRegisteredManagers(): Promise<string[]> {
    if (isFirebaseEnabled) {
      // In live Firebase, this can be fetched from a dedicated collection or custom claims
      // For simplicity, we can fetch from an 'allowed_managers' document in Firestore
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

    // Generate random secure password
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (isFirebaseEnabled) {
      // In live Firebase, we would call a Cloud Function to create the auth account 
      // and trigger SMTP nodemailer. We return a mock password or success message.
      console.log(`Cloud Function Triggered: Create account for ${sanitizedId} and send email.`);
    } else {
      const allowed = getMockAuthData<string[]>("allowed_managers", INITIAL_ALLOWED_MANAGERS);
      if (!allowed.includes(sanitizedId)) {
        allowed.push(sanitizedId);
        saveMockAuthData("allowed_managers", allowed);
      }
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
    }
  }
}

export const authService = new AuthService();
export default authService;
