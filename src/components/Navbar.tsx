import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, X, Shield } from "lucide-react";
import type { SessionUser } from "../services/authService";

interface NavbarProps {
  currentUser: SessionUser | null;
  onLogout: () => void;
  lang: "en" | "bn";
  setLang: (lang: "en" | "bn") => void;
  activeTab: "home" | "gallery" | "menu" | "notices" | "contacts" | "managers";
  setActiveTab: (tab: "home" | "gallery" | "menu" | "notices" | "contacts" | "managers") => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  lang,
  setLang,
  activeTab,
  setActiveTab,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const handleLogoClick = () => {
    setActiveTab("home");
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const navLinks = [
    { id: "home", en: "Home", bn: "হোম" },
    { id: "menu", en: "Menu", bn: "মেনু" },
    { id: "notices", en: "Notices", bn: "নোটিশ" },
    { id: "contacts", en: "Contacts", bn: "যোগাযোগ" },
    { id: "managers", en: "Managers", bn: "ম্যানেজার" },
    { id: "gallery", en: "Gallery", bn: "গ্যালারি" },
  ] as const;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 md:px-12 h-[68px] bg-background/92 backdrop-blur-md border-b border-white/5">
      {/* Brand logo */}
      <div onClick={handleLogoClick} className="flex items-center gap-3 cursor-pointer select-none">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center font-serif text-lg font-bold text-background border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
          শ
        </div>
        <div>
          <div className="font-serif text-base font-bold text-foreground leading-tight">
            {lang === "en" ? "HMMS" : "এইচএমএমএস"}
          </div>
          <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
            {lang === "en" ? "Sher-E-Bangla Hall" : "শেরে বাংলা হল"}
          </div>
        </div>
      </div>

      {/* Desktop Links */}
      <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
        {navLinks.map(link => (
          <button
            key={link.id}
            onClick={() => handleTabClick(link.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
              location.pathname === "/" && activeTab === link.id
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-foreground/60 hover:text-foreground border border-transparent"
            }`}
          >
            {lang === "en" ? link.en : link.bn}
          </button>
        ))}
      </div>

      {/* Navbar Right Actions */}
      <div className="flex items-center gap-4">
        {/* Language selector */}
        <div className="flex bg-white/5 border border-white/5 rounded-full p-0.5 overflow-hidden">
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all ${
              lang === "en" ? "bg-primary text-background" : "text-foreground/50 hover:text-foreground"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang("bn")}
            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all ${
              lang === "bn" ? "bg-primary text-background" : "text-foreground/50 hover:text-foreground"
            }`}
          >
            বাং
          </button>
        </div>

        {/* Portal Access Button */}
        {currentUser ? (
          <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5 text-xs font-bold text-primary">
            <Shield size={12} />
            {currentUser.role === "student" ? (
              <span className="text-foreground/80 max-w-[150px] truncate" title={currentUser.email}>
                {currentUser.email}
              </span>
            ) : (
              <Link to="/manager" className="hover:underline">
                {lang === "en" ? `Team: ${currentUser.id}` : `টিম: ${currentUser.id}`}
              </Link>
            )}
            <span className="text-white/20">|</span>
            <button onClick={onLogout} className="text-foreground/60 hover:text-destructive transition-colors" title="Logout">
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="hidden sm:block px-4.5 py-1.5 rounded-full text-xs font-bold bg-gradient-to-br from-primary to-primary/80 text-background border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.25)] hover:scale-102 hover:shadow-[0_0_20px_rgba(var(--primary),0.4)] transition-all"
          >
            {lang === "en" ? "Portal" : "পোর্টাল"}
          </Link>
        )}

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-foreground hover:text-primary transition-colors"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Links Overlay */}
      {mobileMenuOpen && (
        <div className="absolute top-[68px] left-0 right-0 bg-background/95 backdrop-blur-lg border-b border-white/5 flex flex-col gap-2 p-4 md:hidden z-40 animate-pageIn">
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => handleTabClick(link.id)}
              className={`text-left px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                location.pathname === "/" && activeTab === link.id
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/75 hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {lang === "en" ? link.en : link.bn}
            </button>
          ))}
          {!currentUser ? (
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center mt-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-background"
            >
              {lang === "en" ? "Portal Sign In" : "পোর্টাল লগইন"}
            </Link>
          ) : (
            <div className="flex items-center justify-between mt-2 bg-white/5 p-3 rounded-xl border border-white/5">
              {currentUser.role === "student" ? (
                <span className="text-sm font-bold text-primary truncate max-w-[200px]" title={currentUser.email}>
                  {currentUser.email}
                </span>
              ) : (
                <Link
                  to="/manager"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  {lang === "en" ? `Team: ${currentUser.id}` : `টিম: ${currentUser.id}`}
                </Link>
              )}
              <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="text-destructive">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
export default Navbar;
