import React, { useState, useEffect } from "react";
import { 
  UserPlus, ListFilter, Phone, Trash2, 
  Edit2, Send, CheckCircle2, ShieldOff,
  Activity
} from "lucide-react";
import { dbService } from "../../services/dbService";
import type { DayExpenses, Contact, Broadcast, Complaint, ManagerProfile, AuditLogEntry } from "../../services/dbService";
import { authService } from "../../services/authService";

interface ProvostPortalProps {
  addToast: (text: string, type: "success" | "error" | "info") => void;
}

export const ProvostPortal: React.FC<ProvostPortalProps> = ({ addToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<"audit" | "managers" | "broadcasts" | "contacts" | "logs">("audit");

  // Pagination states (SCALE-01)
  const [auditPage, setAuditPage] = useState(1);
  const [broadcastsPage, setBroadcastsPage] = useState(1);
  const [complaintsPage, setComplaintsPage] = useState(1);

  // State for registries
  const [allowedManagerIds, setAllowedManagerIds] = useState<string[]>([]);
  const [managersProfiles, setManagersProfiles] = useState<ManagerProfile[]>([]);
  const [selectedAuditManager, setSelectedAuditManager] = useState<string>("");
  const [auditExpenses, setAuditExpenses] = useState<DayExpenses[]>([]);
  const [auditCashCollection, setAuditCashCollection] = useState<number>(0);

  // Input states
  const [newManagerId, setNewManagerId] = useState("");
  const [credentialsModal, setCredentialsModal] = useState<{ id: string; pass: string } | null>(null);

  // Broadcast states
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [newBroadcast, setNewBroadcast] = useState({
    title: "",
    body: "",
    expiryDate: ""
  });

  // Contacts states
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState<Omit<Contact, "id">>({
    role: "Assistant Provost",
    name: "",
    phone: "",
    introduction: ""
  });

  // Complaints states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Load Data
  useEffect(() => {
    const loadProvostData = async () => {
      // Allowed Manager logins
      const ids = await authService.getRegisteredManagers();
      setAllowedManagerIds(ids);

      // Profiles
      const profiles = await dbService.getManagers();
      setManagersProfiles(profiles);
      if (ids.length > 0) {
        setSelectedAuditManager(ids[0]);
      }

      // Broadcasts & Contacts
      const fetchedBroadcasts = await dbService.getBroadcasts();
      setBroadcasts(fetchedBroadcasts);

      const fetchedContacts = await dbService.getContacts();
      setContacts(fetchedContacts);

      // Complaints
      const fetchedComplaints = await dbService.getComplaints();
      // Only show formally submitted complaints
      setComplaints(fetchedComplaints.filter(c => c.status === "submitted"));

      // Audit logs
      const logs = await dbService.getAuditLogs();
      setAuditLogs(logs);
    };

    loadProvostData();
  }, []);

  // Reload logs when logs tab is active
  useEffect(() => {
    if (activeSubTab === "logs") {
      dbService.getAuditLogs().then(setAuditLogs);
    }
  }, [activeSubTab]);

  // Load selected manager audit records
  useEffect(() => {
    if (!selectedAuditManager) return;

    const loadAudit = async () => {
      const expenses = await dbService.getExpenses(selectedAuditManager);
      setAuditExpenses(expenses);

      const cash = await dbService.getCashCollection(selectedAuditManager);
      setAuditCashCollection(cash);
      setAuditPage(1);
    };

    loadAudit();
  }, [selectedAuditManager]);

  // Provost action: create manager credentials
  const handleRegisterManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newManagerId.trim();
    if (!/^\d{7}$/.test(id)) {
      addToast("Student ID must be exactly 7 digits.", "error");
      return;
    }

    try {
      const generatedPass = await authService.registerManager(id);
      
      // Update local states
      const ids = await authService.getRegisteredManagers();
      setAllowedManagerIds(ids);
      
      // Set credentials modal to show password
      setCredentialsModal({ id, pass: generatedPass });
      setNewManagerId("");

      addToast(`Manager credentials registered successfully!`, "success");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to create manager account.";
      addToast(errMsg, "error");
    }
  };

  // Provost action: deactivate manager
  const handleDeactivateManager = async (id: string) => {
    if (window.confirm(`Are you sure you want to deactivate manager account ${id}?`)) {
      try {
        await authService.deactivateManager(id);
        const ids = await authService.getRegisteredManagers();
        setAllowedManagerIds(ids);
        addToast(`Manager ID ${id} deactivated.`, "info");
      } catch {
        addToast("Failed to deactivate account.", "error");
      }
    }
  };

  // Provost action: create broadcast notice
  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBroadcast.title.trim() || !newBroadcast.body.trim()) return;

    const addedBroadcast: Broadcast = {
      id: Math.random().toString(36).substring(2, 9),
      title: newBroadcast.title,
      body: newBroadcast.body,
      publishDate: new Date().toISOString().split("T")[0],
      expiryDate: newBroadcast.expiryDate ? `${newBroadcast.expiryDate}T23:59:59+06:00` : undefined
    };

    try {
      await dbService.addBroadcast(addedBroadcast);
      setBroadcasts(prev => [addedBroadcast, ...prev]);
      setNewBroadcast({ title: "", body: "", expiryDate: "" });
      addToast("New broadcast published to Student Portal!", "success");
    } catch {
      addToast("Failed to publish broadcast.", "error");
    }
  };

  // Provost action: delete broadcast notice (FEAT-03)
  const handleDeleteBroadcast = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this broadcast notice?")) {
      try {
        await dbService.deleteBroadcast(id);
        setBroadcasts(prev => prev.filter(b => b.id !== id));
        addToast("Broadcast notice deleted successfully.", "info");
      } catch {
        addToast("Failed to delete broadcast notice.", "error");
      }
    }
  };

  // Provost action: create contact directory item
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) return;

    const contactToSave: Contact = {
      id: editingContact?.id || Math.random().toString(36).substring(2, 9),
      ...newContact
    };

    try {
      await dbService.saveContact(contactToSave);
      
      // Reload
      const list = await dbService.getContacts();
      setContacts(list);

      // Reset
      setNewContact({ role: "Assistant Provost", name: "", phone: "", introduction: "" });
      setEditingContact(null);
      addToast(editingContact ? "Contact details updated." : "Contact added to hall directory.", "success");
    } catch {
      addToast("Failed to save contact.", "error");
    }
  };

  // Provost action: delete contact
  const handleDeleteContact = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this contact from the hall directory?")) {
      try {
        await dbService.deleteContact(id);
        setContacts(prev => prev.filter(c => c.id !== id));
        addToast("Contact deleted.", "info");
      } catch {
        addToast("Failed to remove contact.", "error");
      }
    }
  };

  // Audit Calculations
  const auditSpent = auditExpenses.reduce((s, d) => s + d.total, 0);
  const auditBalance = auditCashCollection - auditSpent;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Top Banner administrative panel */}
      <div className="bg-muted/30 border-b border-border/40 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Provost Control Portal</h1>
              <p className="text-xs text-muted-foreground">Monitor daily expenditures, register managers, and broadcast bulletins.</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {/* Sub-Navigation tabs */}
        <div className="flex border-b border-border/40 mb-8 overflow-x-auto w-full scrollbar-none">
          {[
            { id: "audit", label: "Ledger Audit", icon: <ListFilter size={14} /> },
            { id: "managers", label: "Manager Registrations", icon: <UserPlus size={14} /> },
            { id: "broadcasts", label: "Broadcast Notices", icon: <Send size={14} /> },
            { id: "contacts", label: "Contacts Directory", icon: <Phone size={14} /> },
            { id: "logs", label: "System Logs", icon: <Activity size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as "audit" | "managers" | "broadcasts" | "contacts" | "logs")}
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

        {/* 1. LEDGER AUDIT SUB-TAB */}
        {activeSubTab === "audit" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Audited expense list */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Manager Ledger Audit</h3>
                    <p className="text-xs text-muted-foreground">Select an active manager profile to review recorded ledger receipts.</p>
                  </div>
                  
                  {/* Select Manager Dropdown */}
                  <select
                    value={selectedAuditManager}
                    onChange={(e) => setSelectedAuditManager(e.target.value)}
                    className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl text-xs font-bold focus:outline-none"
                  >
                    {allowedManagerIds.map(id => {
                      const profile = managersProfiles.find(p => p.id === id);
                      return (
                        <option key={id} value={id}>
                          Manager ID: {id} {profile ? `(${profile.name})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Audit table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                        <th className="py-2.5 px-4">Ledger Date</th>
                        <th className="py-2.5 px-4">Line Items Count</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-right">Daily Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditExpenses.slice((auditPage - 1) * 10, auditPage * 10).map(day => (
                        <tr key={day.date} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-foreground">{day.date}</td>
                          <td className="py-2.5 px-4">{day.items.length} items logged</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                              day.isLocked 
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20" 
                                : "bg-blue-50 border-blue-200 text-blue-700"
                            }`}>
                              {day.isLocked ? "Locked" : "Open"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold">{day.total.toFixed(2)} BDT</td>
                        </tr>
                      ))}
                      {auditExpenses.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-muted-foreground select-none">
                            No ledger data has been published by this manager yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {auditExpenses.length > 10 && (
                  <div className="flex justify-between items-center mt-4 text-xs">
                    <button
                      disabled={auditPage === 1}
                      onClick={() => setAuditPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-muted-foreground">
                      Page {auditPage} of {Math.ceil(auditExpenses.length / 10)}
                    </span>
                    <button
                      disabled={auditPage * 10 >= auditExpenses.length}
                      onClick={() => setAuditPage(prev => prev + 1)}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right column - Audit totals & Complaints */}
            <div className="space-y-6">
              {/* Audit Summary Cards */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-4">Auditor Summary</h3>
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs py-2 border-b border-border/30">
                    <span className="text-muted-foreground font-semibold">Cash Collected</span>
                    <span className="font-bold text-foreground">{auditCashCollection.toFixed(2)} BDT</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-2 border-b border-border/30">
                    <span className="text-muted-foreground font-semibold">Total Audited Spent</span>
                    <span className="font-bold text-rose-600">-{auditSpent.toFixed(2)} BDT</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-2">
                    <span className="text-muted-foreground font-semibold">Running Balance</span>
                    <span className={`font-bold ${auditBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                      {auditBalance.toFixed(2)} BDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Complaints Inbox */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-4">Complaints Inbox</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {complaints.slice((complaintsPage - 1) * 5, complaintsPage * 5).map(item => (
                    <div key={item.id} className="p-3 bg-muted/40 border border-border/50 rounded-2xl text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-primary">{item.category}</span>
                        <span className="text-[9px] text-muted-foreground">{item.date}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                      <div className="text-[9px] text-muted-foreground font-semibold">
                        Endorsed by: Manager IDs {item.endorsingManagers.join(", ")}
                      </div>
                    </div>
                  ))}
                  {complaints.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground select-none">
                      No complaints submitted to provost.
                    </div>
                  )}
                  {complaints.length > 5 && (
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/20 text-[10px]">
                      <button
                        disabled={complaintsPage === 1}
                        onClick={() => setComplaintsPage(prev => Math.max(prev - 1, 1))}
                        className="px-2 py-1 bg-muted rounded disabled:opacity-50 font-bold"
                      >
                        Prev
                      </button>
                      <span className="text-muted-foreground">
                        Page {complaintsPage} of {Math.ceil(complaints.length / 5)}
                      </span>
                      <button
                        disabled={complaintsPage * 5 >= complaints.length}
                        onClick={() => setComplaintsPage(prev => prev + 1)}
                        className="px-2 py-1 bg-muted rounded disabled:opacity-50 font-bold"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. MANAGER REGISTRATIONS SUB-TAB */}
        {activeSubTab === "managers" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Allowed Managers table */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Active Mess Manager Logins</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                      <th className="py-2.5 px-4">Student ID</th>
                      <th className="py-2.5 px-4">Manager Name</th>
                      <th className="py-2.5 px-4">Department / Room</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowedManagerIds.map(id => {
                      const profile = managersProfiles.find(p => p.id === id);
                      return (
                        <tr key={id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-foreground">{id}</td>
                          <td className="py-2.5 px-4">{profile ? profile.name : "First login pending..."}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {profile ? `${profile.dept} / Rm ${profile.room}` : "N/A"}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => handleDeactivateManager(id)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors"
                            >
                              <ShieldOff size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Register Manager Form */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-foreground mb-4">Register New Manager</h3>
              
              <form onSubmit={handleRegisterManager} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Student ID (7 digits)</label>
                  <input
                    type="text"
                    value={newManagerId}
                    onChange={(e) => setNewManagerId(e.target.value)}
                    placeholder="e.g. 2012003"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                    required
                  />
                  <span className="block text-[9.5px] text-muted-foreground mt-1.5 leading-relaxed">
                    Credentials email automatically sent to address: 
                    <br />
                    <code>[studentid]@dept.buet.ac.bd</code>
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                >
                  Generate Credentials & Register
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. BROADCAST NOTICES SUB-TAB */}
        {activeSubTab === "broadcasts" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Broadcast history list */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Past Broadcast Log</h3>
              
              <div className="space-y-4">
                {broadcasts.slice((broadcastsPage - 1) * 5, broadcastsPage * 5).map(item => (
                  <div key={item.id} className="p-4 rounded-2xl bg-muted/20 border border-border/30 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-foreground">{item.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground">Published: {item.publishDate}</span>
                        <button
                          onClick={() => handleDeleteBroadcast(item.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors"
                          title="Delete Notice"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{item.body}</p>
                    {item.expiryDate && (
                      <span className="inline-block mt-2 text-[9px] text-rose-500 font-semibold uppercase">
                        Expires: {item.expiryDate}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {broadcasts.length > 5 && (
                <div className="flex justify-between items-center mt-4 text-xs">
                  <button
                    disabled={broadcastsPage === 1}
                    onClick={() => setBroadcastsPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-muted-foreground">
                    Page {broadcastsPage} of {Math.ceil(broadcasts.length / 5)}
                  </span>
                  <button
                    disabled={broadcastsPage * 5 >= broadcasts.length}
                    onClick={() => setBroadcastsPage(prev => prev + 1)}
                    className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Broadcast Creation Form */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-foreground mb-4">Compose Broadcast</h3>
              
              <form onSubmit={handleCreateBroadcast} className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Notice Title</label>
                  <input
                    type="text"
                    value={newBroadcast.title}
                    onChange={(e) => setNewBroadcast(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Dining Suspended This Friday"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Notice Body</label>
                  <textarea
                    value={newBroadcast.body}
                    onChange={(e) => setNewBroadcast(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Provide details about the announcement..."
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none h-24 resize-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={newBroadcast.expiryDate}
                    onChange={(e) => setNewBroadcast(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                >
                  Publish Notice Bulletin
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 4. CONTACTS DIRECTORY SUB-TAB */}
        {activeSubTab === "contacts" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Contacts Table List */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Contacts Registry</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Phone Number</th>
                      <th className="py-2.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-foreground">{c.role}</td>
                        <td className="py-2.5 px-4">{c.name}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{c.phone}</td>
                        <td className="py-2.5 px-4 text-center space-x-1.5">
                          <button
                            onClick={() => {
                              setEditingContact(c);
                              setNewContact({ role: c.role, name: c.name, phone: c.phone, introduction: c.introduction });
                            }}
                            className="text-primary hover:bg-primary/5 p-1 rounded-lg transition-colors border border-border/40"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1 rounded-lg transition-colors border border-border/40"
                          >
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create/Edit Contact Form */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-foreground mb-4">
                {editingContact ? "Edit Contact" : "Add New Contact"}
              </h3>
              
              <form onSubmit={handleSaveContact} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Contact Role</label>
                  <input
                    type="text"
                    value={newContact.role}
                    onChange={(e) => setNewContact(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g. Electrician"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Subrata Kumar"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newContact.phone}
                    onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 01711223344"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Introduction (Optional)</label>
                  <textarea
                    value={newContact.introduction}
                    onChange={(e) => setNewContact(prev => ({ ...prev, introduction: e.target.value }))}
                    placeholder="e.g. Available 8am to 8pm..."
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none h-16 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                  >
                    {editingContact ? "Save Changes" : "Register Contact"}
                  </button>
                  {editingContact && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContact(null);
                        setNewContact({ role: "Assistant Provost", name: "", phone: "", introduction: "" });
                      }}
                      className="px-3 bg-card border border-border/80 hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. SYSTEM AUDIT LOGS SUB-TAB (FEAT-02) */}
        {activeSubTab === "logs" && (
          <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-4">System Administrative Audit Trail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">User ID</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-foreground">{log.userId}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-primary/10 border border-primary/20 text-primary">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground break-all">{log.details}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground select-none">
                        No logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Provost Manager Credentials Alert Modal */}
      {credentialsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-card border border-border/60 rounded-3xl p-6 shadow-xl relative animate-scale-up">
            <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={20} />
              Manager Account Activated
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              The credentials have been successfully compiled. An automated credential delivery dispatch has been triggered via Gmail SMTP to the student email box.
            </p>

            <div className="bg-muted/40 border border-border/60 p-4 rounded-2xl space-y-2 text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Student ID (Username):</span>
                <strong className="text-foreground">{credentialsModal.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Department Email:</span>
                <code className="text-foreground">{credentialsModal.id}@dept.buet.ac.bd</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">Generated Secure Password:</span>
                <code className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{credentialsModal.pass}</code>
              </div>
            </div>

            <button
              onClick={() => setCredentialsModal(null)}
              className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProvostPortal;
