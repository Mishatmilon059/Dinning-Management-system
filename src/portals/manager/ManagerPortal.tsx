import React, { useState, useEffect } from "react";
import { 
  Plus, Trash2, Edit2, FileText, AlertTriangle, AlertCircle, 
  CheckCircle, BarChart3, ListOrdered, Calendar,
  Activity, Flame, ChevronDown, ChevronUp, User, Settings
} from "lucide-react";
import { dbService } from "../../services/dbService";
import type { ManagerProfile, ExpenseItem, DayExpenses, MenuItem, InventoryItem, Complaint, ManagerTeam } from "../../services/dbService";
import { authService } from "../../services/authService";
import type { SessionUser } from "../../services/authService";
import { generateLedgerPdf } from "../../utils/pdfGenerator";
import { isFirebaseEnabled, storage } from "../../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface ManagerPortalProps {
  currentUser: SessionUser | null;
  addToast: (text: string, type: "success" | "error" | "info") => void;
  onProfileUpdated: () => void;
}

export const ManagerPortal: React.FC<ManagerPortalProps> = ({ currentUser, addToast, onProfileUpdated }) => {
  const managerId = currentUser?.id || "2012001";
  
  const [activeSubTab, setActiveSubTab] = useState<"ledger" | "menu" | "inventory" | "payments" | "analytics" | "complaints" | "profile" | "admin">("ledger");

  // Profile setup states
  const [needsSetup, setNeedsSetup] = useState(currentUser?.needsSetup ?? true);
  const [teamProfile, setTeamProfile] = useState<ManagerTeam | null>(null);
  const [setupForm, setSetupForm] = useState({
    name: "",
    dept: "",
    room: "",
    bio: "",
    photoUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop"
  });

  // Ledger & expense states
  const [cashCollected, setCashCollected] = useState(0);
  const [cashInput, setCashInput] = useState("");
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().split("T")[0]);
  const [dayExpenses, setDayExpenses] = useState<ExpenseItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [allPastExpenses, setAllPastExpenses] = useState<DayExpenses[]>([]);

  // Expense item input states
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: 1,
    unit: "kg",
    unitPrice: 0,
    category: "vegetables"
  });

  // Menu states
  const [menuDate, setMenuDate] = useState(new Date().toISOString().split("T")[0]);
  const [menuForm, setMenuForm] = useState<MenuItem>({
    lunch: "",
    dinner: "",
    estimatedCost: 150,
    lunchImages: [],
    dinnerImages: []
  });

  // Food Photo Upload states
  const [uploadingLunch, setUploadingLunch] = useState(false);
  const [uploadingDinner, setUploadingDinner] = useState(false);

  // Daily Consumption Logging states
  const [selectedStockId, setSelectedStockId] = useState("");
  const [consumedAmount, setConsumedAmount] = useState("");

  // Checklist state
  const [checklist, setChecklist] = useState<{ id: string; text: string; checked: boolean }[]>([]);

  useEffect(() => {
    const defaultChecklist = [
      { id: "menu", text: "Update the Menu Scheduler", checked: false },
      { id: "expense", text: "Make the Expense List (Ledger)", checked: false },
      { id: "inventory", text: "Update the Inventory Planner", checked: false },
      { id: "complaints", text: "Check Complaints Desk", checked: false }
    ];
    const saved = localStorage.getItem(`hmms_checklist_${managerId}_${ledgerDate}`);
    if (saved) {
      setChecklist(JSON.parse(saved));
    } else {
      setChecklist(defaultChecklist);
    }
  }, [managerId, ledgerDate]);

  const handleToggleChecklist = (id: string) => {
    const updated = checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
    setChecklist(updated);
    localStorage.setItem(`hmms_checklist_${managerId}_${ledgerDate}`, JSON.stringify(updated));
  };

  // Inventory states
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editingInvItem, setEditingInvItem] = useState<InventoryItem | null>(null);
  const [aiInventoryAlerts, setAiInventoryAlerts] = useState<string[]>([]);

  const [deadlineDate, setDeadlineDate] = useState("");
  const [expandedExpenseDate, setExpandedExpenseDate] = useState<string | null>(null);

  // Complaint states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintForm, setComplaintForm] = useState<{
    category: string;
    severity: "low" | "medium" | "high";
    description: string;
  }>({
    category: "Infrastructure",
    severity: "medium",
    description: ""
  });

  // Emoji statistics state
  const [reactions, setReactions] = useState<Record<string, number>>({ like: 0, love: 0, angry: 0 });

  const [complaintsPage, setComplaintsPage] = useState(1);

  // --- Profile Edit states ---
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState<ManagerTeam | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");

  // --- Hall Settings / Admin states ---
  const [contacts, setContacts] = useState<any[]>([]);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [contactForm, setContactForm] = useState({ id: "", role: "", name: "", phone: "", introduction: "" });

  const [deadlineText, setDeadlineText] = useState("");
  const [penaltyText, setPenaltyText] = useState("");

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [newBroadcast, setNewBroadcast] = useState({ title: "", body: "", expiryDays: 7 });

  const [galleryItems, setGalleryItems] = useState<any[]>([]);
  const [editingGalleryItem, setEditingGalleryItem] = useState<any | null>(null);
  const [galleryForm, setGalleryForm] = useState({ id: "", name: "", dept: "", batch: "", img: "" });

  // Load Initial Data
  useEffect(() => {
    const loadManagerData = async () => {
      // Profile check
      const team = await dbService.getTeamProfile(managerId);
      if (team) {
        setTeamProfile(team);
        setNeedsSetup(false);
        if (team.managers && team.managers[0]) {
          setSetupForm({
            name: team.managers[0].name,
            dept: team.managers[0].dept,
            room: team.managers[0].room,
            bio: team.managers[0].bio || "",
            photoUrl: team.managers[0].photoUrl || ""
          });
        }
      } else {
        const profile = await dbService.getManagerProfile(managerId);
        if (profile && profile.name) {
          setSetupForm({
            name: profile.name,
            dept: profile.dept,
            room: profile.room,
            bio: profile.bio,
            photoUrl: profile.photoUrl
          });
          setNeedsSetup(false);
        }
      }

      // Cash Collection & Ledger list
      const cash = await dbService.getCashCollection(managerId);
      setCashCollected(cash);
      setCashInput(cash > 0 ? cash.toString() : "");

      const fetchedAllExpenses = await dbService.getExpenses(managerId);
      setAllPastExpenses(fetchedAllExpenses);

      // Load active day expenses
      const activeDay = fetchedAllExpenses.find(d => d.date === ledgerDate);
      if (activeDay) {
        setDayExpenses(activeDay.items);
        setIsLocked(activeDay.isLocked || isDateLocked(activeDay.date));
      } else {
        setDayExpenses([]);
        setIsLocked(isDateLocked(ledgerDate));
      }

      // Menu
      const menuToday = await dbService.getMenu(ledgerDate);
      if (menuToday) {
        setMenuForm(menuToday);
      } else {
        setMenuForm({ lunch: "", dinner: "", estimatedCost: 150, lunchImages: [], dinnerImages: [] });
      }

      // Inventory
      const inv = await dbService.getInventory(managerId);
      setInventory(inv);
      generateAiInventoryInsights(inv);

      // Notice details
      const fetchedNotice = await dbService.getNotice();
      setDeadlineDate(fetchedNotice.paymentDeadline.split("T")[0] || "");
      setDeadlineText(fetchedNotice.paymentDeadline);
      setPenaltyText(fetchedNotice.penaltyText || "");

      // Contacts list
      const fetchedContacts = await dbService.getContacts();
      setContacts(fetchedContacts);

      // Broadcasts
      const fetchedBroadcasts = await dbService.getBroadcasts();
      setBroadcasts(fetchedBroadcasts);

      // Gallery Items
      const fetchedGallery = await dbService.getGalleryItems();
      setGalleryItems(fetchedGallery);

      // Complaints list
      const fetchComplaints = await dbService.getComplaints();
      setComplaints(fetchComplaints);

      // Student reactions
      const fetchedReactions = await dbService.getReactions(ledgerDate);
      setReactions(fetchedReactions);
    };

    loadManagerData();
  }, [managerId, ledgerDate]);

  // Load menu for selected menuDate (FUNC-09)
  useEffect(() => {
    const loadMenu = async () => {
      try {
        const menuData = await dbService.getMenu(menuDate);
        if (menuData) {
          setMenuForm(menuData);
        } else {
          setMenuForm({ lunch: "", dinner: "", estimatedCost: 150, lunchImages: [], dinnerImages: [] });
        }
      } catch (err) {
        console.error("Failed to load menu for date", menuDate, err);
      }
    };
    loadMenu();
  }, [menuDate]);

  // Date Locking check (older than 24h) (FUNC-01)
  function isDateLocked(targetDateStr: string): boolean {
    const today = new Date().toISOString().split("T")[0];
    return targetDateStr < today;
  }

  // --- Profile Edit Handlers ---
  const handleStartEditProfile = () => {
    if (teamProfile) {
      setEditProfileForm(JSON.parse(JSON.stringify(teamProfile))); // Deep copy
      setEditPassword("");
      setEditConfirmPassword("");
      setIsEditingProfile(true);
    }
  };

  const handleUpdateEditManagerField = (index: number, field: string, value: string) => {
    if (editProfileForm) {
      const updated = { ...editProfileForm };
      updated.managers[index] = { ...updated.managers[index], [field]: value };
      setEditProfileForm(updated);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfileForm) return;

    // Validate details for all 3 managers
    for (let i = 0; i < editProfileForm.managers.length; i++) {
      const mgr = editProfileForm.managers[i];
      if (!mgr.name.trim()) {
        addToast(`Manager ${i + 1} name is required.`, "error");
        return;
      }
      if (!/^\d{7}$/.test(mgr.id.trim())) {
        addToast(`Manager ${i + 1} ID must be exactly 7 digits.`, "error");
        return;
      }
      if (!mgr.room.trim()) {
        addToast(`Manager ${i + 1} room is required.`, "error");
        return;
      }
      if (!mgr.dept.trim()) {
        addToast(`Manager ${i + 1} department is required.`, "error");
        return;
      }
      if (!mgr.mobile.trim()) {
        addToast(`Manager ${i + 1} mobile is required.`, "error");
        return;
      }
    }

    if (editPassword) {
      if (editPassword.length < 6) {
        addToast("Password must be at least 6 characters.", "error");
        return;
      }
      if (editPassword !== editConfirmPassword) {
        addToast("Passwords do not match.", "error");
        return;
      }
    }

    try {
      const updatedTeam = { ...editProfileForm };
      if (editPassword) {
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(editPassword));
        updatedTeam.passwordHash = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
      }
      
      await dbService.saveTeamProfile(teamProfile!.teamName, updatedTeam);
      setTeamProfile(updatedTeam);
      setIsEditingProfile(false);
      addToast("Manager team profile updated successfully!", "success");
      onProfileUpdated?.();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update profile", "error");
    }
  };

  // --- Hall Contacts Handlers ---
  const handleSaveContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.role.trim() || !contactForm.name.trim() || !contactForm.phone.trim()) {
      addToast("Role, Name, and Phone are required.", "error");
      return;
    }
    try {
      const itemToSave = {
        id: contactForm.id || Math.random().toString(36).substring(2, 9),
        role: contactForm.role.trim(),
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        introduction: contactForm.introduction.trim()
      };
      await dbService.saveContact(itemToSave);
      addToast("Contact saved successfully!", "success");
      setContactForm({ id: "", role: "", name: "", phone: "", introduction: "" });
      setEditingContact(null);
      const fetched = await dbService.getContacts();
      setContacts(fetched);
    } catch (err) {
      addToast("Failed to save contact.", "error");
    }
  };

  const handleEditContact = (c: any) => {
    setEditingContact(c);
    setContactForm({
      id: c.id,
      role: c.role,
      name: c.name,
      phone: c.phone,
      introduction: c.introduction || ""
    });
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    try {
      await dbService.deleteContact(id);
      addToast("Contact deleted successfully.", "success");
      const fetched = await dbService.getContacts();
      setContacts(fetched);
    } catch (err) {
      addToast("Failed to delete contact.", "error");
    }
  };

  // --- Payment Deadline / Notice Notice Handlers ---
  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadlineText.trim()) {
      addToast("Payment deadline is required.", "error");
      return;
    }
    try {
      const newNotice = {
        paymentDeadline: deadlineText,
        penaltyText: penaltyText || "A penalty fee applies for late payments."
      };
      await dbService.setNotice(newNotice);
      addToast("Payment notice and deadline updated successfully!", "success");
    } catch (err) {
      addToast("Failed to save notice.", "error");
    }
  };

  const handleAddBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBroadcast.title.trim() || !newBroadcast.body.trim()) {
      addToast("Broadcast Title and Body are required.", "error");
      return;
    }
    try {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + newBroadcast.expiryDays);
      
      const broadcastObj = {
        id: Math.random().toString(36).substring(2, 9),
        title: newBroadcast.title.trim(),
        body: newBroadcast.body.trim(),
        publishDate: new Date().toISOString().split("T")[0],
        expiryDate: expiry.toISOString().split("T")[0]
      };
      await dbService.addBroadcast(broadcastObj);
      addToast("Notice Broadcast added successfully!", "success");
      setNewBroadcast({ title: "", body: "", expiryDays: 7 });
      const fetched = await dbService.getBroadcasts();
      setBroadcasts(fetched);
    } catch (err) {
      addToast("Failed to add broadcast.", "error");
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this broadcast notice?")) return;
    try {
      await dbService.deleteBroadcast(id);
      addToast("Broadcast deleted.", "success");
      const fetched = await dbService.getBroadcasts();
      setBroadcasts(fetched);
    } catch (err) {
      addToast("Failed to delete broadcast.", "error");
    }
  };

  // --- Gallery Memories CRUD Handlers ---
  const handleSaveGallerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryForm.name.trim() || !galleryForm.img.trim()) {
      addToast("Image Title and Photo File are required.", "error");
      return;
    }
    try {
      const itemToSave = {
        id: galleryForm.id || Math.random().toString(36).substring(2, 9),
        name: galleryForm.name.trim(),
        dept: galleryForm.dept.trim() || "CSE",
        batch: galleryForm.batch.trim() || "2024",
        img: galleryForm.img
      };
      await dbService.saveGalleryItem(itemToSave);
      addToast("Gallery memory saved successfully!", "success");
      setGalleryForm({ id: "", name: "", dept: "", batch: "", img: "" });
      setEditingGalleryItem(null);
      const fetched = await dbService.getGalleryItems();
      setGalleryItems(fetched);
    } catch (err) {
      addToast("Failed to save gallery memory.", "error");
    }
  };

  const handleEditGalleryItem = (g: any) => {
    setEditingGalleryItem(g);
    setGalleryForm({
      id: g.id,
      name: g.name,
      dept: g.dept,
      batch: g.batch,
      img: g.img
    });
  };

  const handleDeleteGalleryItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this memory from gallery?")) return;
    try {
      await dbService.deleteGalleryItem(id);
      addToast("Gallery memory deleted.", "success");
      const fetched = await dbService.getGalleryItems();
      setGalleryItems(fetched);
    } catch (err) {
      addToast("Failed to delete memory.", "error");
    }
  };

  const handleApproveGalleryItem = async (item: any) => {
    try {
      const approvedItem = { ...item, status: "approved" as const };
      await dbService.saveGalleryItem(approvedItem);
      addToast("Student gallery photo approved!", "success");
      const fetched = await dbService.getGalleryItems();
      setGalleryItems(fetched);
    } catch (err) {
      addToast("Failed to approve photo.", "error");
    }
  };

  const handleRejectGalleryItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to reject and delete this submission?")) return;
    try {
      await dbService.deleteGalleryItem(id);
      addToast("Student gallery photo rejected and deleted.", "info");
      const fetched = await dbService.getGalleryItems();
      setGalleryItems(fetched);
    } catch (err) {
      addToast("Failed to reject photo.", "error");
    }
  };

  // Generate Inventory Insights (Simulating Gemini API server-side analysis)
  function generateAiInventoryInsights(items: InventoryItem[]) {
    const alerts: string[] = [];
    items.forEach(item => {
      const daysRemaining = item.usageRate > 0 ? Math.floor(item.quantity / item.usageRate) : 99;
      if (daysRemaining <= 2) {
        alerts.push(`CRITICAL: ${item.name} stock will exhaust in ${daysRemaining} days (${item.quantity} ${item.unit} remaining). Reorder immediately.`);
      } else if (daysRemaining <= 6) {
        alerts.push(`WARNING: ${item.name} depletion rate is high. Estimated finish date: ${item.finishDate}.`);
      }
    });
    setAiInventoryAlerts(alerts);
  }

  // Photo upload states (DATA-NEW-01)
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please upload a valid image file.", "error");
      return;
    }

    setUploadingPhoto(true);

    try {
      if (isFirebaseEnabled && storage) {
        const storageRef = ref(storage, `profiles/${managerId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        setSetupForm(prev => ({ ...prev, photoUrl: downloadUrl }));
        addToast("Profile photo uploaded successfully!", "success");
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          setSetupForm(prev => ({ ...prev, photoUrl: url }));
          addToast("Profile photo loaded (mock mode)!", "success");
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to upload profile photo.", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle Profile Setup
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupForm.name || !setupForm.dept || !setupForm.room) {
      addToast("Please fill in all mandatory fields.", "error");
      return;
    }

    try {
      const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
      const profileData: ManagerProfile = {
        id: managerId,
        ...setupForm,
        month: currentMonth,
      };
      await dbService.updateManagerProfile(managerId, profileData);
      setNeedsSetup(false);
      
      // Update session needsSetup
      const session = authService.getCurrentUser();
      if (session) {
        session.needsSetup = false;
        localStorage.setItem("hmms_session", JSON.stringify(session));
        // Sync active sessions if in mock mode
        if (session.token) {
          try {
            const activeKey = "hmms_mock_auth_active_sessions";
            const activeStr = localStorage.getItem(activeKey);
            if (activeStr) {
              const active = JSON.parse(activeStr);
              if (active[session.token]) {
                active[session.token].needsSetup = false;
                localStorage.setItem(activeKey, JSON.stringify(active));
              }
            }
          } catch (e) {
            console.error("Failed to sync active session", e);
          }
        }
      }

      addToast("Profile setup completed successfully!", "success");
      onProfileUpdated();
    } catch {
      addToast("Failed to save profile details.", "error");
    }
  };

  // Handle Cash Collection Record
  const handleSaveCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cashInput);
    if (isNaN(amount) || amount <= 0) {
      addToast("Please enter a valid cash amount.", "error");
      return;
    }

    try {
      await dbService.setCashCollection(managerId, amount);
      setCashCollected(amount);
      addToast("Cash collection recorded successfully!", "success");
    } catch {
      addToast("Failed to save cash collection.", "error");
    }
  };

  // Add line-item to expense ledger
  const handleAddExpenseItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      addToast("This date's ledger is locked.", "error");
      return;
    }
    if (!newItem.name || newItem.unitPrice <= 0 || newItem.quantity <= 0) {
      addToast("Please input valid item parameters.", "error");
      return;
    }

    // Expense input length limit and sanitization (EXPENSE-INPUT)
    const sanitizedName = newItem.name
      .replace(/[<>"']/g, "")
      .trim()
      .substring(0, 100);

    if (!sanitizedName) {
      addToast("Invalid item name after sanitization.", "error");
      return;
    }

    const itemTotal = newItem.quantity * newItem.unitPrice;
    const addedItem: ExpenseItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: sanitizedName,
      quantity: newItem.quantity,
      unit: newItem.unit,
      unitPrice: newItem.unitPrice,
      total: itemTotal,
      category: newItem.category
    };

    const updatedList = [...dayExpenses, addedItem];
    setDayExpenses(updatedList);
    
    // Save to Database
    await dbService.saveDayExpenses(managerId, ledgerDate, updatedList, isLocked);
    
    // Refresh dashboard calculations
    const fetchedAllExpenses = await dbService.getExpenses(managerId);
    setAllPastExpenses(fetchedAllExpenses);

    // Reset Form
    setNewItem({
      name: "",
      quantity: 1,
      unit: "kg",
      unitPrice: 0,
      category: "vegetables"
    });
    addToast("Ledger item added!", "success");
  };

  // Remove line-item from expense ledger
  const handleDeleteExpenseItem = async (itemId: string) => {
    if (isLocked) {
      addToast("This date's ledger is locked.", "error");
      return;
    }

    const updatedList = dayExpenses.filter(item => item.id !== itemId);
    setDayExpenses(updatedList);
    await dbService.saveDayExpenses(managerId, ledgerDate, updatedList, isLocked);

    const fetchedAllExpenses = await dbService.getExpenses(managerId);
    setAllPastExpenses(fetchedAllExpenses);
    addToast("Ledger item removed.", "info");
  };

  // Food image upload handlers
  const handleLunchImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingLunch(true);
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        if (isFirebaseEnabled && storage) {
          const storageRef = ref(storage, `menus/${menuDate}/lunch/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);
          newUrls.push(downloadUrl);
        } else {
          const p = new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              resolve(event.target?.result as string);
            };
            reader.readAsDataURL(file);
          });
          const url = await p;
          newUrls.push(url);
        }
      } catch (err) {
        console.error(err);
        addToast("Failed to upload image", "error");
      }
    }

    setMenuForm(prev => ({
      ...prev,
      lunchImages: [...(prev.lunchImages || []), ...newUrls]
    }));
    setUploadingLunch(false);
    addToast(`${newUrls.length} Lunch image(s) added successfully!`, "success");
  };

  const handleDinnerImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingDinner(true);
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        if (isFirebaseEnabled && storage) {
          const storageRef = ref(storage, `menus/${menuDate}/dinner/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);
          newUrls.push(downloadUrl);
        } else {
          const p = new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              resolve(event.target?.result as string);
            };
            reader.readAsDataURL(file);
          });
          const url = await p;
          newUrls.push(url);
        }
      } catch (err) {
        console.error(err);
        addToast("Failed to upload image", "error");
      }
    }

    setMenuForm(prev => ({
      ...prev,
      dinnerImages: [...(prev.dinnerImages || []), ...newUrls]
    }));
    setUploadingDinner(false);
    addToast(`${newUrls.length} Dinner image(s) added successfully!`, "success");
  };

  const removeLunchImage = (indexToRemove: number) => {
    setMenuForm(prev => ({
      ...prev,
      lunchImages: (prev.lunchImages || []).filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const removeDinnerImage = (indexToRemove: number) => {
    setMenuForm(prev => ({
      ...prev,
      dinnerImages: (prev.dinnerImages || []).filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // Save/Publish Menu Scheduler
  const handlePublishMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.setMenu(menuDate, menuForm);
      addToast(`Menu for ${menuDate} published successfully!`, "success");
    } catch {
      addToast("Failed to publish menu.", "error");
    }
  };

  // Save Notice/Deadline Settings
  const handleSaveNoticeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.setNotice({
        paymentDeadline: `${deadlineDate}T23:59:59`,
        penaltyText: ""
      });
      addToast("Deadline notice updated successfully!", "success");
    } catch {
      addToast("Failed to save notice.", "error");
    }
  };



  // Create Complaint
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintForm.description.trim()) return;

    const newComplaint: Complaint = {
      id: Math.random().toString(36).substring(2, 9),
      category: complaintForm.category,
      date: new Date().toISOString().split("T")[0],
      severity: complaintForm.severity,
      description: complaintForm.description,
      endorsingManagers: [managerId],
      status: "draft"
    };

    try {
      await dbService.saveComplaint(newComplaint);
      setComplaints(prev => [newComplaint, ...prev]);
      setComplaintForm({ category: "Infrastructure", severity: "medium", description: "" });
      addToast("Complaint drafted. Waiting for co-manager endorsements.", "success");
    } catch {
      addToast("Failed to draft complaint.", "error");
    }
  };

  // Endorse Complaint
  const handleEndorseComplaint = async (complaintId: string) => {
    const list = [...complaints];
    const item = list.find(c => c.id === complaintId);
    if (item) {
      if (item.endorsingManagers[0] === managerId) {
        addToast("You cannot endorse your own complaint.", "error");
        return;
      }
      if (!item.endorsingManagers.includes(managerId)) {
        item.endorsingManagers.push(managerId);
        await dbService.saveComplaint(item);
        setComplaints(list);
        addToast("Complaint endorsed successfully!", "success");
      }
    }
  };

  // Submit Complaint to Provost
  const handleSubmitComplaintToProvost = async (complaintId: string) => {
    const list = [...complaints];
    const item = list.find(c => c.id === complaintId);
    if (item) {
      item.status = "submitted";
      await dbService.saveComplaint(item);
      setComplaints(list);
      addToast("Complaint submitted formally to the Provost's Office.", "success");
    }
  };

  // AI Cost Analysis publisher toggle
  const [publishAnalysis, setPublishAnalysis] = useState(
    localStorage.getItem(`hmms_publish_analysis_${ledgerDate}`) === "true"
  );
  
  const handleTogglePublishAnalysis = (val: boolean) => {
    setPublishAnalysis(val);
    localStorage.setItem(`hmms_publish_analysis_${ledgerDate}`, val ? "true" : "false");
    addToast(val ? "AI Cost Analysis published to Student Portal!" : "Cost Analysis hidden.", "info");
  };

  // Request Lock Correction from Provost (Functional Gap solution)
  const handleRequestCorrection = () => {
    addToast(`Correction request submitted to Provost for locked date ${ledgerDate}.`, "info");
  };

  // Inventory Stock item updater
  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvItem) return;

    try {
      await dbService.updateInventoryItem(managerId, editingInvItem);
      
      const inv = await dbService.getInventory(managerId);
      setInventory(inv);
      generateAiInventoryInsights(inv);
      setEditingInvItem(null);
      addToast("Inventory stock item updated!", "success");
    } catch {
      addToast("Failed to update inventory.", "error");
    }
  };

  // Daily Stock Consumption logger
  const handleLogConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockId || !consumedAmount) return;
    const amount = parseFloat(consumedAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast("Please enter a valid amount consumed.", "error");
      return;
    }
    const item = inventory.find(i => i.id === selectedStockId);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity - amount);
    
    // Recalculate estimated finish date based on new quantity and usage rate (or keep usage rate)
    const daysLeft = item.usageRate > 0 ? Math.floor(newQuantity / item.usageRate) : 99;
    const newFinishDate = new Date();
    newFinishDate.setDate(newFinishDate.getDate() + daysLeft);
    const finishDateStr = newFinishDate.toISOString().split("T")[0];

    const updatedItem = {
      ...item,
      quantity: newQuantity,
      finishDate: finishDateStr
    };

    try {
      await dbService.updateInventoryItem(managerId, updatedItem);
      const inv = await dbService.getInventory(managerId);
      setInventory(inv);
      generateAiInventoryInsights(inv);
      setConsumedAmount("");
      setSelectedStockId("");
      addToast(`Logged consumption of ${amount} ${item.unit} for ${item.name}. Remaining: ${newQuantity} ${item.unit}.`, "success");
    } catch {
      addToast("Failed to update inventory consumption.", "error");
    }
  };

  // Export PDF Ledger Trigger
  const handleExportPdf = () => {
    if (dayExpenses.length === 0) {
      addToast("Ledger is empty. Add items before exporting.", "error");
      return;
    }
    
    const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const profile: ManagerProfile = {
      id: managerId,
      name: setupForm.name || "Mess Manager",
      dept: setupForm.dept || "BUET",
      room: setupForm.room || "Dining",
      month: currentMonth,
      bio: setupForm.bio || "",
      photoUrl: setupForm.photoUrl || ""
    };

    generateLedgerPdf({
      manager: profile,
      month: currentMonth,
      cashCollected,
      expenses: [{ date: ledgerDate, items: dayExpenses, total: dayExpenses.reduce((s, i) => s + i.total, 0), isLocked }],
      startDate: ledgerDate,
      endDate: ledgerDate
    });
    addToast("Ledger statement downloaded as PDF.", "success");
  };

  // Export Day PDF Trigger
  const handleExportDayPdf = (day: DayExpenses) => {
    if (day.items.length === 0) {
      addToast("Day ledger is empty. Cannot export.", "error");
      return;
    }
    const currentMonth = new Date(day.date).toLocaleString("en-US", { month: "long", year: "numeric" });
    const profile: ManagerProfile = {
      id: managerId,
      name: setupForm.name || "Mess Manager",
      dept: setupForm.dept || "BUET",
      room: setupForm.room || "Dining",
      month: currentMonth,
      bio: setupForm.bio || "",
      photoUrl: setupForm.photoUrl || ""
    };

    generateLedgerPdf({
      manager: profile,
      month: currentMonth,
      cashCollected,
      expenses: [day],
      startDate: day.date,
      endDate: day.date
    });
    addToast(`Ledger for ${day.date} downloaded as PDF.`, "success");
  };

  // Export All Expenses to Excel/CSV
  const handleExportAllToExcel = () => {
    if (allPastExpenses.length === 0) {
      addToast("No expenses to export.", "error");
      return;
    }

    // Build CSV Content
    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    csvContent += "Date,Item Name,Category,Quantity,Unit,Unit Price (BDT),Total (BDT)\n";

    allPastExpenses.forEach(day => {
      day.items.forEach(item => {
        const name = `"${item.name.replace(/"/g, '""')}"`;
        const category = `"${item.category.replace(/"/g, '""')}"`;
        const quantity = item.quantity;
        const unit = `"${item.unit.replace(/"/g, '""')}"`;
        const unitPrice = item.unitPrice;
        const total = item.total;
        
        csvContent += `${day.date},${name},${category},${quantity},${unit},${unitPrice},${total}\n`;
      });
    });

    try {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `HMMS_All_Expenses_Export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast("All expense data exported to Excel successfully!", "success");
    } catch {
      addToast("Failed to export Excel file.", "error");
    }
  };

  // Computations
  const totalSpent = allPastExpenses.reduce((sum, day) => sum + day.total, 0);
  const currentSpentOnDay = dayExpenses.reduce((sum, item) => sum + item.total, 0);
  const runningBalance = cashCollected - totalSpent;
  const daysInMonthRemaining = 31 - new Date().getDate();
  const averageDailySpend = allPastExpenses.length > 0 ? (totalSpent / allPastExpenses.length) : 0;
  const forecastSurplus = cashCollected - (totalSpent + (averageDailySpend * daysInMonthRemaining));

  // Render mandatory profile setup on first login
  if (needsSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-card border border-border/60 rounded-3xl p-8 shadow-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Complete Profile Setup</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Welcome, Mess Manager! You must configure your profile before accessing operations.
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Manager ID (Locked)</label>
              <input
                type="text"
                value={managerId}
                disabled
                className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Profile Photo Upload Field (DATA-NEW-01) */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-2">Profile Photo</label>
              <div className="flex items-center gap-4">
                <img 
                  src={setupForm.photoUrl} 
                  alt="Preview" 
                  className="h-16 w-16 rounded-2xl object-cover border border-border/40"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="profile-photo-upload"
                  disabled={uploadingPhoto}
                />
                <label
                  htmlFor="profile-photo-upload"
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-xs font-bold rounded-xl cursor-pointer border border-border/60 transition-colors"
                >
                  {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Full Name</label>
              <input
                type="text"
                value={setupForm.name}
                onChange={(e) => setSetupForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Robin Hossain"
                className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Department</label>
                <input
                  type="text"
                  value={setupForm.dept}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, dept: e.target.value }))}
                  placeholder="e.g. CSE"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Room Number</label>
                <input
                  type="text"
                  value={setupForm.room}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, room: e.target.value }))}
                  placeholder="e.g. 302"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Personal Bio</label>
              <textarea
                value={setupForm.bio}
                onChange={(e) => setSetupForm(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Write a brief intro for residents..."
                className="w-full px-4 py-2 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50 h-16 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md shadow-primary/10 transition-all duration-200"
            >
              Complete Setup & Publish Card
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Top Banner Dashboard Statistics */}
      <div className="bg-muted/30 border-b border-border/40 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Manager Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage accounts, budgets, inventory, and payment lists.</p>
            </div>
            
            {/* Quick Summary Cards */}
            <div className="flex gap-4 w-full md:w-auto overflow-x-auto">
              <div className="bg-card border border-border/40 px-4 py-2 rounded-xl text-xs min-w-[130px]">
                <span className="text-muted-foreground block font-medium">Cash Collected</span>
                <span className="text-sm font-bold text-foreground">{cashCollected.toFixed(2)} BDT</span>
              </div>
              <div className="bg-card border border-border/40 px-4 py-2 rounded-xl text-xs min-w-[130px]">
                <span className="text-muted-foreground block font-medium">Total Spent</span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400">-{totalSpent.toFixed(2)} BDT</span>
              </div>
              <div className="bg-card border border-border/40 px-4 py-2 rounded-xl text-xs min-w-[130px]">
                <span className="text-muted-foreground block font-medium">Running Balance</span>
                <span className={`text-sm font-bold ${runningBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                  {runningBalance.toFixed(2)} BDT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {/* Sub-Navigation tabs */}
        <div className="flex border-b border-border/40 mb-8 overflow-x-auto w-full scrollbar-thin">
          {[
            { id: "ledger", label: "Expense Ledger", icon: <ListOrdered size={14} /> },
            { id: "menu", label: "Menu Scheduler", icon: <Calendar size={14} /> },
            { id: "inventory", label: "Inventory Planner", icon: <Flame size={14} /> },
            { id: "payments", label: "Everyday Expense Tracking", icon: <ListOrdered size={14} /> },
            { id: "analytics", label: "AI & Preference", icon: <BarChart3 size={14} /> },
            { id: "complaints", label: "Complaints Desk", icon: <Activity size={14} /> },
            { id: "profile", label: "Team Profile", icon: <User size={14} /> },
            { id: "admin", label: "Hall Settings / Admin", icon: <Settings size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as "ledger" | "menu" | "inventory" | "payments" | "analytics" | "complaints" | "profile" | "admin")}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-all duration-200 ${
                activeSubTab === tab.id 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. EXPENSE LEDGER SUB-TAB */}
        {activeSubTab === "ledger" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left columns - Daily entries input */}
            <div className="lg:col-span-2 space-y-6">
              {/* Daily Ledger List */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Daily Expenditure List</h3>
                    <p className="text-xs text-muted-foreground">Select a date to input and review itemized expenses.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={ledgerDate}
                      onChange={(e) => setLedgerDate(e.target.value)}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl text-xs font-bold"
                    />
                    <button 
                      onClick={handleExportPdf}
                      className="bg-card border border-border/80 hover:bg-muted text-foreground px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <FileText size={12} />
                      Export PDF
                    </button>
                  </div>
                </div>

                {/* Ledger Item Add Form */}
                {!isLocked ? (
                  <form onSubmit={handleAddExpenseItem} className="bg-muted/30 p-5 rounded-2xl border border-border/30 mb-6 space-y-4">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Add Expense Item</h4>
                    
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Item Name</label>
                        <input
                          type="text"
                          value={newItem.name}
                          onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Broiler Chicken"
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          maxLength={100}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Category</label>
                        <select
                          value={newItem.category}
                          onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                        >
                          <option value="vegetables">Vegetables</option>
                          <option value="protein">Protein</option>
                          <option value="grain">Rice & Grain</option>
                          <option value="fuel">Fuel & Gas</option>
                          <option value="miscellaneous">Miscellaneous</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Quantity</label>
                        <input
                          type="number"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Unit</label>
                        <input
                          type="text"
                          value={newItem.unit}
                          onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                          placeholder="e.g. kg, litre"
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Unit Price (BDT)</label>
                        <input
                          type="number"
                          value={newItem.unitPrice}
                          onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          min="0.1"
                          step="0.1"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-1 bg-primary text-primary-foreground hover:bg-primary/95 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                    >
                      <Plus size={12} />
                      Insert Item into Ledger
                    </button>
                  </form>
                ) : (
                  <div className="bg-rose-50/50 border border-rose-200 dark:bg-rose-950/10 dark:border-rose-900/40 p-4 rounded-2xl flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Ledger is locked for this date (older than 24 hours).
                    </span>
                    <button 
                      onClick={handleRequestCorrection}
                      className="bg-rose-600 text-white hover:bg-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all duration-150"
                    >
                      Request Provost Correction
                    </button>
                  </div>
                )}

                {/* Ledger Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                        <th className="py-2.5 px-4">Item Name</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-right">Quantity</th>
                        <th className="py-2.5 px-4 text-right">Unit Price</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        {!isLocked && <th className="py-2.5 px-4 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {dayExpenses.map(item => (
                        <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-foreground">{item.name}</td>
                          <td className="py-2.5 px-4 capitalize">{item.category}</td>
                          <td className="py-2.5 px-4 text-right">{item.quantity} {item.unit}</td>
                          <td className="py-2.5 px-4 text-right">{item.unitPrice.toFixed(2)} BDT</td>
                          <td className="py-2.5 px-4 text-right font-bold">{item.total.toFixed(2)} BDT</td>
                          {!isLocked && (
                            <td className="py-2.5 px-4 text-center">
                              <button 
                                onClick={() => handleDeleteExpenseItem(item.id)}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {dayExpenses.length === 0 && (
                        <tr>
                          <td colSpan={isLocked ? 5 : 6} className="text-center py-8 text-muted-foreground select-none">
                            No ledger items logged for this date.
                          </td>
                        </tr>
                      )}
                      <tr className="bg-muted/20 font-bold border-t border-border/60">
                        <td colSpan={4} className="py-3 px-4 text-right uppercase text-[9px] tracking-wider text-muted-foreground">Total Day Cost:</td>
                        <td className="py-3 px-4 text-right text-sm text-primary">{currentSpentOnDay.toFixed(2)} BDT</td>
                        {!isLocked && <td></td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right column - Cash input & settings */}
            <div className="space-y-6">
              {/* Cash Collection config */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-4">Cash Received</h3>
                <form onSubmit={handleSaveCash} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Amount received from Provost</label>
                    <input
                      type="number"
                      value={cashInput}
                      onChange={(e) => setCashInput(e.target.value)}
                      placeholder="e.g. 150000"
                      className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm focus:outline-none"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                  >
                    Save Cash Collection
                  </button>
                </form>
              </div>

              {/* Status Checklist */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-3">Today's Cost Analysis</h3>
                <p className="text-xs text-muted-foreground mb-4">Toggle visibility of today's cost summaries on the student portal.</p>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/30">
                  <span className="text-xs font-semibold text-foreground">Publish cost details</span>
                  <input
                    type="checkbox"
                    checked={publishAnalysis}
                    onChange={(e) => handleTogglePublishAnalysis(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                  />
                </div>
              </div>

              {/* Payment Deadline config (moved from payments sidebar) */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-3">Payment Deadline</h3>
                <p className="text-xs text-muted-foreground mb-4">Set the monthly mess fee payment deadline for the student portal.</p>
                <form onSubmit={handleSaveNoticeSettings} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Submission Deadline</label>
                    <input
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                  >
                    Save Payment Deadline
                  </button>
                </form>
              </div>

              {/* Manager Daily Checklist */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-3">Daily Task Checklist</h3>
                <p className="text-xs text-muted-foreground mb-4">Tick off daily responsibilities for {ledgerDate}.</p>
                <div className="space-y-3">
                  {checklist.map(item => (
                    <label 
                      key={item.id} 
                      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors cursor-pointer text-xs animate-fade-in"
                    >
                      <input 
                        type="checkbox" 
                        checked={item.checked} 
                        onChange={() => handleToggleChecklist(item.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                      />
                      <span className={`font-medium ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. MENU PLANNER SUB-TAB */}
        {activeSubTab === "menu" && (
          <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">Weekly Menu Scheduler</h3>
                <p className="text-xs text-muted-foreground mt-1">Select a calendar date to plan food menus.</p>
              </div>
              <input 
                type="date" 
                value={menuDate}
                onChange={(e) => setMenuDate(e.target.value)}
                className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl text-xs font-bold"
              />
            </div>

             <form onSubmit={handlePublishMenu} className="space-y-5">
              <div>
                <label className="block text-sm font-bold uppercase text-muted-foreground mb-1.5">Lunch Menu</label>
                <input
                  type="text"
                  value={menuForm.lunch}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, lunch: e.target.value }))}
                  placeholder="e.g. Plain Rice, Rui Fish Roast, Mixed Vegs"
                  className="w-full px-4 py-3 bg-muted/30 border border-border/60 rounded-xl text-base focus:outline-none focus:border-primary/55"
                  required
                />
                <div className="mt-2.5 space-y-2">
                  <span className="block text-xs font-bold uppercase text-muted-foreground">Lunch Photos</span>
                  <div className="flex flex-wrap gap-2.5">
                    {(menuForm.lunchImages || []).map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/50 group">
                        <img src={img} alt="Lunch" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeLunchImage(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                        >
                          <Trash2 size={14} className="text-rose-400" />
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-xl border border-dashed border-border/80 hover:border-primary/80 bg-muted/20 flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Plus size={16} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-semibold mt-1">Add</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleLunchImagesUpload}
                        className="hidden"
                        disabled={uploadingLunch}
                      />
                    </label>
                  </div>
                  {uploadingLunch && <p className="text-xs text-primary animate-pulse">Uploading lunch photo(s)...</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase text-muted-foreground mb-1.5">Dinner Menu</label>
                <input
                  type="text"
                  value={menuForm.dinner}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, dinner: e.target.value }))}
                  placeholder="e.g. Chicken Biryani, Salad, Borhani"
                  className="w-full px-4 py-3 bg-muted/30 border border-border/60 rounded-xl text-base focus:outline-none focus:border-primary/55"
                  required
                />
                <div className="mt-2.5 space-y-2">
                  <span className="block text-xs font-bold uppercase text-muted-foreground">Dinner Photos</span>
                  <div className="flex flex-wrap gap-2.5">
                    {(menuForm.dinnerImages || []).map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/50 group">
                        <img src={img} alt="Dinner" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeDinnerImage(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                        >
                          <Trash2 size={14} className="text-rose-400" />
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-xl border border-dashed border-border/80 hover:border-primary/80 bg-muted/20 flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Plus size={16} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-semibold mt-1">Add</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleDinnerImagesUpload}
                        className="hidden"
                        disabled={uploadingDinner}
                      />
                    </label>
                  </div>
                  {uploadingDinner && <p className="text-xs text-primary animate-pulse">Uploading dinner photo(s)...</p>}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-sm font-bold shadow-md shadow-primary/10 transition-colors"
              >
                Publish Menu Schedule
              </button>
            </form>
          </div>
        )}

        {/* 3. INVENTORY SUB-TAB */}
        {activeSubTab === "inventory" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left side - Inventory items table */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-foreground">Stock Ledger</h3>
                <button
                  onClick={() => setEditingInvItem({
                    id: "new_" + Math.random().toString(36).substring(2, 9),
                    name: "",
                    quantity: 0,
                    unit: "kg",
                    usageRate: 0,
                    finishDate: new Date().toISOString().split("T")[0]
                  })}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                >
                  Add New Item
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-4 text-right">Quantity</th>
                      <th className="py-2.5 px-4 text-right">Usage / Day</th>
                      <th className="py-2.5 px-4 text-right">Days Left</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map(item => {
                      const daysLeft = item.usageRate > 0 ? Math.floor(item.quantity / item.usageRate) : 99;
                      const statusColor = daysLeft <= 2 ? "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40" : daysLeft <= 6 ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40" : "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40";
                      
                      return (
                        <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-foreground">{item.name}</td>
                          <td className="py-2.5 px-4 text-right">{item.quantity} {item.unit}</td>
                          <td className="py-2.5 px-4 text-right">{item.usageRate} {item.unit}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusColor}`}>
                              {daysLeft} days
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => setEditingInvItem(item)}
                              className="text-primary hover:bg-primary/5 p-1.5 rounded-lg border border-border/40 transition-colors"
                            >
                              <Edit2 size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Log Daily Consumption Form */}
              <div className="mt-6 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-base font-bold text-foreground">Log Daily Consumption</h3>
                <p className="text-xs text-muted-foreground mb-4">Record approximately how much was consumed today to dynamically update remaining stock.</p>
                
                <form onSubmit={handleLogConsumption} className="grid gap-4 sm:grid-cols-3 items-end">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Select Item</label>
                    <select
                      value={selectedStockId}
                      onChange={(e) => setSelectedStockId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none text-foreground"
                      required
                    >
                      <option value="" className="text-muted-foreground">-- Choose Item --</option>
                      {inventory.map(item => (
                        <option key={item.id} value={item.id} className="text-foreground">
                          {item.name} ({item.quantity} {item.unit} left)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">
                      Amount Gone Today {selectedStockId && `(${inventory.find(i => i.id === selectedStockId)?.unit})`}
                    </label>
                    <input
                      type="number"
                      value={consumedAmount}
                      onChange={(e) => setConsumedAmount(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                      min="0.1"
                      step="0.1"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-all shadow-sm h-[34px]"
                  >
                    Log Consumption
                  </button>
                </form>
              </div>
            </div>

            {/* Right side - AI warnings & Editing */}
            <div className="space-y-6">
              {/* Gemini AI Alerts */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-4">Gemini AI Alerts</h3>
                <div className="space-y-3">
                  {aiInventoryAlerts.map((alert, i) => {
                    const isCritical = alert.startsWith("CRITICAL");
                    return (
                      <div 
                        key={i} 
                        className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex gap-2.5 ${
                          isCritical 
                            ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400" 
                            : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400"
                        }`}
                      >
                        {isCritical ? <AlertTriangle size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
                        <span>{alert}</span>
                      </div>
                    );
                  })}
                  {aiInventoryAlerts.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground select-none">
                      All inventory stocks are at sufficient levels.
                    </div>
                  )}
                </div>
              </div>

              {/* Editing Item Panel */}
              {editingInvItem && (
                <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-foreground mb-4">
                    {editingInvItem.id.startsWith("new_") ? "Add Inventory Item" : `Edit Stock: ${editingInvItem.name}`}
                  </h3>
                  <form onSubmit={handleUpdateStock} className="space-y-3">
                    {editingInvItem.id.startsWith("new_") && (
                      <>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Item Name</label>
                          <input
                            type="text"
                            value={editingInvItem.name}
                            onChange={(e) => setEditingInvItem(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                            placeholder="e.g. Potatoes"
                            className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Unit</label>
                          <input
                            type="text"
                            value={editingInvItem.unit}
                            onChange={(e) => setEditingInvItem(prev => prev ? ({ ...prev, unit: e.target.value }) : null)}
                            placeholder="e.g. kg, pcs"
                            className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                            required
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Quantity Remaining</label>
                      <input
                        type="number"
                        value={editingInvItem.quantity}
                        onChange={(e) => setEditingInvItem(prev => prev ? ({ ...prev, quantity: parseFloat(e.target.value) || 0 }) : null)}
                        className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Usage Rate (units/day)</label>
                      <input
                        type="number"
                        value={editingInvItem.usageRate}
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value) || 0;
                          setEditingInvItem(prev => {
                            if (!prev) return null;
                            const days = rate > 0 ? Math.floor(prev.quantity / rate) : 0;
                            const targetDate = new Date();
                            targetDate.setDate(targetDate.getDate() + days);
                            const dateStr = targetDate.toISOString().split("T")[0];
                            return { ...prev, usageRate: rate, finishDate: dateStr };
                          });
                        }}
                        className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Estimated Days It Will Last</label>
                      <input
                        type="number"
                        value={editingInvItem.usageRate > 0 ? Math.floor(editingInvItem.quantity / editingInvItem.usageRate) : ""}
                        onChange={(e) => {
                          const days = parseInt(e.target.value) || 0;
                          if (days > 0) {
                            const newRate = Math.round((editingInvItem.quantity / days) * 100) / 100;
                            const targetDate = new Date();
                            targetDate.setDate(targetDate.getDate() + days);
                            const dateStr = targetDate.toISOString().split("T")[0];
                            setEditingInvItem(prev => prev ? ({
                              ...prev,
                              usageRate: newRate,
                              finishDate: dateStr
                            }) : null);
                          }
                        }}
                        placeholder="e.g. 6"
                        className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Or Choose Estimated Finish Date</label>
                      <input
                        type="date"
                        value={editingInvItem.finishDate || ""}
                        onChange={(e) => {
                          const dateVal = e.target.value;
                          if (dateVal) {
                            const finish = new Date(dateVal);
                            const today = new Date();
                            const diffTime = finish.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            const days = diffDays > 0 ? diffDays : 1;
                            const newRate = Math.round((editingInvItem.quantity / days) * 100) / 100;
                            setEditingInvItem(prev => prev ? ({
                              ...prev,
                              finishDate: dateVal,
                              usageRate: newRate
                            }) : null);
                          }
                        }}
                        className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2.5">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                      >
                        {editingInvItem.id.startsWith("new_") ? "Create Item" : "Update Item"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingInvItem(null)}
                        className="px-3 bg-card border border-border/80 hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. EVERYDAY EXPENSE TRACKING SUB-TAB */}
        {activeSubTab === "payments" && (
          <div className="max-w-4xl mx-auto w-full">
            {/* Daily Expense Tracker & Budgeting List */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex justify-between items-start mb-6 gap-2">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Everyday Expense Tracking</h2>
                  <p className="text-xs text-muted-foreground mt-1">Review everyday logged expenses, budgeting details, and export reports.</p>
                </div>
                <button
                  onClick={handleExportAllToExcel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  📊 Export to Excel
                </button>
              </div>
              
              <div className="space-y-4 pr-1">
                {allPastExpenses.map((day) => {
                  const isExpanded = expandedExpenseDate === day.date;
                  return (
                    <div 
                      key={day.date} 
                      className="border border-border/40 rounded-2xl bg-muted/20 overflow-hidden transition-all duration-200"
                    >
                      {/* Header */}
                      <div 
                        onClick={() => setExpandedExpenseDate(isExpanded ? null : day.date)}
                        className="flex justify-between items-center p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <div>
                          <span className="text-sm font-bold text-foreground block">{day.date}</span>
                          <span className="text-xs text-muted-foreground">{day.items.length} items logged in ledger</span>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="text-sm font-bold text-primary">{day.total.toFixed(2)} BDT</span>
                          {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Details */}
                      {isExpanded && (
                        <div className="p-5 border-t border-border/30 bg-card space-y-3 text-xs">
                          {day.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-start py-2 border-b border-border/20 last:border-0">
                              <div>
                                <span className="font-semibold text-foreground block text-sm">{item.name}</span>
                                <span className="text-xs text-muted-foreground capitalize">{item.category} • {item.quantity} {item.unit} x {item.unitPrice.toFixed(2)} BDT</span>
                              </div>
                              <span className="font-mono text-foreground font-semibold text-sm">{item.total.toFixed(2)} BDT</span>
                            </div>
                          ))}
                          {day.items.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground text-xs">
                              No items logged for this date.
                            </div>
                          )}
                          
                          <button
                            onClick={() => handleExportDayPdf(day)}
                            className="mt-4 w-full py-2.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            📄 Export Day PDF Statement
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {allPastExpenses.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border/40 rounded-3xl select-none">
                    No daily expenses logged yet in the database.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. AI ANALYTICS & PREFERENCES SUB-TAB */}
        {activeSubTab === "analytics" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left columns - Cost forecasts & reaction charts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cost Forecast panel */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-1">Gemini AI Spending Forecast</h3>
                <p className="text-xs text-muted-foreground mb-6">Financial projections based on current average daily spending.</p>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Estimated Daily Average</span>
                    <span className="block text-xl font-bold text-foreground mt-1">{averageDailySpend.toFixed(2)} BDT</span>
                    <span className="text-[10px] text-muted-foreground block mt-1">Computed across active ledger dates</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Surplus Forecast (Month End)</span>
                    <span className={`block text-xl font-bold mt-1 ${forecastSurplus >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                      {forecastSurplus.toFixed(2)} BDT
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-1">Projections cover {daysInMonthRemaining} remaining days</span>
                  </div>
                </div>

                {/* Plain language summary */}
                <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1.5">
                    <AlertCircle size={14} />
                    Gemini AI Optimization Recommendations
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Today's spending rate is stable. To optimize the forecast surplus:
                    <br />
                    1. Substitute one broiler chicken dish with eggs to save ~3,000 BDT weekly.
                    <br />
                    2. Clear out the potato stocks (45 kg) before reordering. Estimated finish date is Friday.
                  </p>
                </div>
              </div>

              {/* Student Emoji Reactions analysis */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-1">Student Preference Insights</h3>
                <p className="text-xs text-muted-foreground mb-6">Reaction aggregates logged by residents on the Student Portal.</p>
                
                <div className="flex items-end justify-around h-44 gap-4 px-6 border-b border-border/50">
                  {/* Like bar */}
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-bold text-foreground mb-2">{reactions.like}</span>
                    <div 
                      className="w-full bg-primary/60 hover:bg-primary rounded-t-lg transition-all duration-300"
                      style={{ height: `${Math.max(10, (reactions.like / (reactions.like + reactions.love + reactions.angry || 1)) * 120)}px` }}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground mt-2">Like</span>
                  </div>

                  {/* Love bar */}
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-bold text-foreground mb-2">{reactions.love}</span>
                    <div 
                      className="w-full bg-primary/80 hover:bg-primary rounded-t-lg transition-all duration-300"
                      style={{ height: `${Math.max(10, (reactions.love / (reactions.like + reactions.love + reactions.angry || 1)) * 120)}px` }}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground mt-2">Love</span>
                  </div>

                  {/* Angry bar */}
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-bold text-foreground mb-2">{reactions.angry}</span>
                    <div 
                      className="w-full bg-rose-500/70 hover:bg-rose-500 rounded-t-lg transition-all duration-300"
                      style={{ height: `${Math.max(10, (reactions.angry / (reactions.like + reactions.love + reactions.angry || 1)) * 120)}px` }}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground mt-2">Angry</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground text-center mt-3">Reactions recorded for today's menu: {menuForm?.lunch ? `"${menuForm.lunch}"` : "Active Day"}</p>
              </div>
            </div>

            {/* Right side - quick analytics list */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-foreground mb-4">Historical Cashflows</h3>
              <div className="space-y-4">
                {allPastExpenses.slice(0, 5).map(day => (
                  <div key={day.date} className="flex justify-between items-center text-xs py-2 border-b border-border/30 last:border-0">
                    <span className="font-semibold text-foreground">{day.date}</span>
                    <span className="font-bold text-rose-600">-{day.total.toFixed(2)} BDT</span>
                  </div>
                ))}
                {allPastExpenses.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground select-none">
                    No historical cashflows logged.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. COMPLAINTS SUB-TAB */}
        {activeSubTab === "complaints" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left side - Complaint list */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Mess Manager Grievances</h3>
              
              <div className="space-y-5">
                {complaints.slice((complaintsPage - 1) * 5, complaintsPage * 5).map(complaint => {
                  const isEndorsed = complaint.endorsingManagers.includes(managerId);
                  const isAllEndorsed = complaint.endorsingManagers.length >= 2; // Simulating co-manager checks
                  
                  return (
                    <div key={complaint.id} className="p-5 rounded-2xl bg-muted/20 border border-border/40 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-primary uppercase">{complaint.category}</span>
                          <h4 className="text-sm font-bold text-foreground mt-0.5">Manager Grievance - {complaint.date}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                          complaint.severity === "high" 
                            ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-800/40" 
                            : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20"
                        }`}>
                          {complaint.severity} Severity
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">{complaint.description}</p>
                      
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/40 text-[10px]">
                        <span className="text-muted-foreground">
                          Endorsements: <strong>{complaint.endorsingManagers.length}</strong> (Manager IDs: {complaint.endorsingManagers.join(", ")})
                        </span>
                        
                        <div className="flex gap-2">
                          {!isEndorsed && complaint.status === "draft" && (
                            <button
                              onClick={() => handleEndorseComplaint(complaint.id)}
                              className="bg-card border border-border/80 hover:bg-muted text-foreground px-3 py-1.5 rounded-lg font-bold transition-colors"
                            >
                              Endorse Complaint
                            </button>
                          )}
                          {isAllEndorsed && complaint.status === "draft" && (
                            <button
                              onClick={() => handleSubmitComplaintToProvost(complaint.id)}
                              className="bg-primary text-primary-foreground hover:bg-primary/95 px-3 py-1.5 rounded-lg font-bold transition-colors"
                            >
                              Submit to Provost
                            </button>
                          )}
                          {complaint.status === "submitted" && (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold uppercase bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                              <CheckCircle size={10} />
                              Submitted to Provost
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {complaints.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground select-none">
                    No active manager complaints logged.
                  </div>
                )}
                {complaints.length > 5 && (
                  <div className="flex justify-between items-center mt-4 text-xs">
                    <button
                      type="button"
                      disabled={complaintsPage === 1}
                      onClick={() => setComplaintsPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-muted-foreground">
                      Page {complaintsPage} of {Math.ceil(complaints.length / 5)}
                    </span>
                    <button
                      type="button"
                      disabled={complaintsPage * 5 >= complaints.length}
                      onClick={() => setComplaintsPage(prev => prev + 1)}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Create complaint */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-foreground mb-4">File a Grievance</h3>
              <form onSubmit={handleCreateComplaint} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Issue Category</label>
                  <select
                    value={complaintForm.category}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="Water Supply">Water Supply</option>
                    <option value="Electricity / Load Shedding">Electricity</option>
                    <option value="Kitchen Sanitation">Kitchen Sanitation</option>
                    <option value="Gas / Fuel Exhaustion">Gas & Fuel</option>
                    <option value="Staffing / Attendance">Staffing & Cook Attendance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Severity Level</label>
                  <select
                    value={complaintForm.severity}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, severity: e.target.value as "low" | "medium" | "high" }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="low">Low Severity</option>
                    <option value="medium">Medium Severity</option>
                    <option value="high">High Severity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Description</label>
                  <textarea
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter detailed description of dining mess issue..."
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none h-24 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                >
                  Draft Complaint Card
                </button>
              </form>
            </div>
          </div>
        )}

        {activeSubTab === "profile" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Mess Manager Team Profile</h3>
                  <p className="text-xs text-muted-foreground">Detailed overview of the active mess administration team.</p>
                </div>
                {!isEditingProfile && teamProfile && (
                  <button
                    onClick={handleStartEditProfile}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:scale-102 transition-all shadow-md shadow-primary/10"
                  >
                    <Edit2 size={12} />
                    Edit Team Profile
                  </button>
                )}
              </div>

              {isEditingProfile && editProfileForm ? (
                /* EDIT PROFILE FORM */
                <form onSubmit={handleSaveProfile} className="space-y-6 animate-fadeIn">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-primary font-medium">
                    You are editing the details of manager team: <span className="font-bold">{editProfileForm.teamName}</span>
                  </div>

                  {/* Edit Grid of 3 Managers */}
                  <div className="grid gap-6 md:grid-cols-3">
                    {editProfileForm.managers.map((mgr, idx) => (
                      <div key={idx} className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-bold text-primary">Manager {idx + 1} Details</span>
                          <span className="text-[10px] font-mono text-muted-foreground">ID: {mgr.id}</span>
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Full Name</label>
                          <input
                            type="text"
                            value={mgr.name}
                            onChange={(e) => handleUpdateEditManagerField(idx, "name", e.target.value)}
                            className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Dept</label>
                            <input
                              type="text"
                              value={mgr.dept}
                              onChange={(e) => handleUpdateEditManagerField(idx, "dept", e.target.value)}
                              className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Room No</label>
                            <input
                              type="text"
                              value={mgr.room}
                              onChange={(e) => handleUpdateEditManagerField(idx, "room", e.target.value)}
                              className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Mobile</label>
                          <input
                            type="text"
                            value={mgr.mobile}
                            onChange={(e) => handleUpdateEditManagerField(idx, "mobile", e.target.value)}
                            className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Photo Upload</label>
                          <div className="flex gap-2 items-center">
                            {mgr.photoUrl ? (
                              <img src={mgr.photoUrl} alt="Preview" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/20 text-[9px] shrink-0 font-bold">No Image</div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    handleUpdateEditManagerField(idx, "photoUrl", reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="w-full text-[10px] text-foreground file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 file:cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Change Password Block */}
                  <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4">
                    <h4 className="text-xs font-bold text-foreground">Change Account Password (Optional)</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">New Password</label>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Leave blank to keep current"
                          className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          value={editConfirmPassword}
                          onChange={(e) => setEditConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-muted/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:scale-102 transition-all shadow-md shadow-primary/25"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : teamProfile ? (
                <div className="space-y-8">
                  {/* Team Header Card */}
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active Team</span>
                    <h4 className="text-xl font-bold text-foreground mt-1">{teamProfile.teamName}</h4>
                    <p className="text-xs text-muted-foreground mt-1">Registered on {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                  </div>

                  {/* 3 Managers Grid */}
                  <div className="grid gap-6 md:grid-cols-3">
                    {teamProfile.managers.map((mgr, i) => (
                      <div key={mgr.id} className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 hover:border-primary/25 transition-all">
                        <div className="flex flex-col items-center text-center">
                          <img 
                            src={mgr.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop"} 
                            alt={mgr.name}
                            className="h-20 w-20 rounded-2xl object-cover border border-white/10 mb-4 bg-white/5"
                          />
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary mb-2">
                            Manager {i + 1}
                          </span>
                          <h5 className="font-bold text-foreground text-sm">{mgr.name}</h5>
                          <p className="text-[10px] text-muted-foreground mt-1">ID: {mgr.id}</p>
                          
                          <div className="w-full border-t border-white/5 my-3 pt-3 text-[11px] text-foreground/70 space-y-1.5 text-left">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Department:</span>
                              <span className="font-semibold">{mgr.dept}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Room No:</span>
                              <span className="font-semibold">{mgr.room}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Mobile:</span>
                              <span className="font-semibold">{mgr.mobile}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Fallback for seeded single manager accounts */
                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center">
                  <img 
                    src={setupForm.photoUrl} 
                    alt={setupForm.name} 
                    className="h-24 w-24 rounded-2xl object-cover border border-white/10"
                  />
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Seeded Single Account</span>
                    <h4 className="text-lg font-bold text-foreground">{setupForm.name || "Mess Manager"}</h4>
                    <p className="text-xs text-muted-foreground italic">"{setupForm.bio || "No bio configured."}"</p>
                    <div className="text-xs text-foreground/60 space-x-4">
                      <span>DEPT: {setupForm.dept}</span>
                      <span>ROOM: {setupForm.room}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. HALL SETTINGS / ADMIN SUB-TAB */}
        {activeSubTab === "admin" && (
          <div className="space-y-8 animate-fadeIn text-foreground">
            {/* Grid of 3 Admin Sections */}
            <div className="grid gap-8 lg:grid-cols-3">
              
              {/* SECTION 1: MANAGE HALL CONTACTS */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Hall Contacts Directory</h3>
                  <p className="text-xs text-muted-foreground">Add, edit, or remove hall staff & emergency contact cards shown on landing page.</p>
                </div>

                <form onSubmit={handleSaveContactSubmit} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wide">
                    {editingContact ? "Edit Contact Card" : "Add New Contact Card"}
                  </h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Role / Designation</label>
                    <input
                      type="text"
                      value={contactForm.role}
                      onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                      placeholder="e.g. Electrician, Provost"
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Full Name</label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="e.g. Dr. Mohammad Ali"
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      placeholder="e.g. 01712345678"
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Availability / Introduction (Optional)</label>
                    <textarea
                      value={contactForm.introduction}
                      onChange={(e) => setContactForm({ ...contactForm, introduction: e.target.value })}
                      placeholder="Available hours, office location..."
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none h-16 resize-none text-foreground"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    {editingContact && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContact(null);
                          setContactForm({ id: "", role: "", name: "", phone: "", introduction: "" });
                        }}
                        className="px-3 py-1.5 border border-border rounded-xl text-[10px] font-bold text-foreground"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-primary text-background rounded-xl text-[10px] font-bold"
                    >
                      {editingContact ? "Save Changes" : "Add Contact"}
                    </button>
                  </div>
                </form>

                {/* Contact List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide px-1">Active Directory</h4>
                  {contacts.map((c) => (
                    <div key={c.id} className="flex justify-between items-start bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                      <div className="truncate pr-2">
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.role}</span>
                        <h5 className="font-bold text-sm text-foreground mt-1 truncate">{c.name}</h5>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{c.phone}</p>
                        {c.introduction && <p className="text-[10px] text-muted-foreground italic mt-1 font-serif truncate">"{c.introduction}"</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditContact(c)}
                          className="p-1 hover:bg-white/10 rounded-lg text-primary"
                          title="Edit Contact"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-1 hover:bg-rose-500/10 rounded-lg text-rose-400"
                          title="Delete Contact"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 2: ANNOUNCEMENTS & PAYMENT DEADLINE */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Announcements & Deadlines</h3>
                  <p className="text-xs text-muted-foreground">Manage mess fee deadlines, late payment penalty notices, and broadcast warnings.</p>
                </div>

                {/* Deadline Form */}
                <form onSubmit={handleSaveNotice} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Mess Fee Submission notice</h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Submission Deadline (Date & Time)</label>
                    <input
                      type="datetime-local"
                      value={deadlineText ? deadlineText.substring(0, 16) : ""}
                      onChange={(e) => setDeadlineText(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Penalty / Guidelines Note</label>
                    <input
                      type="text"
                      value={penaltyText}
                      onChange={(e) => setPenaltyText(e.target.value)}
                      placeholder="e.g. A penalty fee of 200 BDT applies for payments made after..."
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                    />
                  </div>

                  <div className="text-right">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-primary text-background rounded-xl text-[10px] font-bold"
                    >
                      Update Deadline
                    </button>
                  </div>
                </form>

                {/* Broadcast Bulletins Form */}
                <form onSubmit={handleAddBroadcast} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Create Broadcast notice</h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Broadcast Title</label>
                    <input
                      type="text"
                      value={newBroadcast.title}
                      onChange={(e) => setNewBroadcast({ ...newBroadcast, title: e.target.value })}
                      placeholder="e.g. Cleaning Drive in Hall Dining"
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Broadcast Details</label>
                    <textarea
                      value={newBroadcast.body}
                      onChange={(e) => setNewBroadcast({ ...newBroadcast, body: e.target.value })}
                      placeholder="Enter announcement description..."
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none h-16 resize-none text-foreground animate-fadeIn"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-center">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Expiry Days</label>
                      <input
                        type="number"
                        value={newBroadcast.expiryDays}
                        onChange={(e) => setNewBroadcast({ ...newBroadcast, expiryDays: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground font-mono"
                        min="1"
                        required
                      />
                    </div>
                    <div className="text-right pt-4">
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-primary text-background rounded-xl text-[10px] font-bold"
                      >
                        Publish Broadcast
                      </button>
                    </div>
                  </div>
                </form>

                {/* Broadcasts List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide px-1">Active Notices</h4>
                  {broadcasts.map((b) => (
                    <div key={b.id} className="flex justify-between items-start bg-white/[0.01] border border-white/5 p-3 rounded-xl text-xs">
                      <div>
                        <h5 className="font-bold text-foreground">{b.title}</h5>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{b.body}</p>
                        <p className="text-[9px] text-primary/70 mt-1 font-mono">Expires: {b.expiryDate}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBroadcast(b.id)}
                        className="p-1 hover:bg-rose-500/10 rounded-lg text-rose-400 shrink-0 ml-2"
                        title="Delete Notice"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: MANAGE HALL GALLERY MEMORIES */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Hall Memories Gallery</h3>
                  <p className="text-xs text-muted-foreground">Post student photos in the hall gallery. Add titles, details, and upload image files.</p>
                </div>

                <form onSubmit={handleSaveGallerySubmit} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wide">
                    {editingGalleryItem ? "Edit Memory Photo" : "Upload New Memory Photo"}
                  </h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Image Title / Description</label>
                    <input
                      type="text"
                      value={galleryForm.name}
                      onChange={(e) => setGalleryForm({ ...galleryForm, name: e.target.value })}
                      placeholder="e.g. Md. Rajib Khan"
                      className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Department</label>
                      <input
                        type="text"
                        value={galleryForm.dept}
                        onChange={(e) => setGalleryForm({ ...galleryForm, dept: e.target.value })}
                        placeholder="e.g. CSE"
                        className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Batch</label>
                      <input
                        type="text"
                        value={galleryForm.batch}
                        onChange={(e) => setGalleryForm({ ...galleryForm, batch: e.target.value })}
                        placeholder="e.g. 2022"
                        className="w-full px-3 py-2 bg-muted/20 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Photo Upload File</label>
                    <div className="flex gap-2 items-center">
                      {galleryForm.img ? (
                        <img src={galleryForm.img} alt="Preview" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/20 text-[9px] shrink-0 font-bold">No Image</div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setGalleryForm({ ...galleryForm, img: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-[10px] text-foreground file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 file:cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    {editingGalleryItem && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGalleryItem(null);
                          setGalleryForm({ id: "", name: "", dept: "", batch: "", img: "" });
                        }}
                        className="px-3 py-1.5 border border-border rounded-xl text-[10px] font-bold text-foreground"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-primary text-background rounded-xl text-[10px] font-bold"
                    >
                      {editingGalleryItem ? "Save Photo" : "Add Photo"}
                    </button>
                  </div>
                </form>

                {/* Pending Student Uploads */}
                {galleryItems.filter(g => g.status === "pending").length > 0 && (
                  <div className="space-y-2 border-b border-white/10 pb-4 mb-4">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide px-1">Pending Approval ({galleryItems.filter(g => g.status === "pending").length})</h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                      {galleryItems.filter(g => g.status === "pending").map((g) => (
                        <div key={g.id} className="flex gap-3 bg-amber-500/5 border border-amber-500/20 p-2 rounded-xl text-xs items-center justify-between">
                          <div className="flex gap-2 items-center truncate">
                            <img src={g.img} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />
                            <div className="truncate">
                              <p className="font-bold text-foreground truncate">{g.name}</p>
                              <p className="text-[9px] text-muted-foreground truncate">{g.dept} • Batch {g.batch}</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApproveGalleryItem(g)}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-background rounded-lg font-bold text-[10px]"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectGalleryItem(g.id)}
                              className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold text-[10px]"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gallery List (Approved Only) */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide px-1">Approved Gallery Memories</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {galleryItems.filter(g => g.status !== "pending").map((g) => (
                      <div key={g.id} className="relative rounded-xl overflow-hidden bg-white/[0.01] border border-white/5 group h-28">
                        <img src={g.img} alt={g.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2 transition-all">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditGalleryItem(g)}
                              className="bg-primary hover:bg-primary/80 text-background p-1 rounded-md"
                              title="Edit Title"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGalleryItem(g.id)}
                              className="bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-md"
                              title="Delete Memory"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                          <div className="truncate text-white text-[10px] w-full">
                            <p className="font-bold truncate">{g.name}</p>
                            <p className="text-[8px] text-gray-300 truncate">{g.dept} - Batch {g.batch}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
};
export default ManagerPortal;
