export interface Theme {
  name: string;
  isDark: boolean;
  variables: {
    primary: string; // HSL e.g. "44 55% 54%"
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    radius: string;
  };
}

export const royalCrestTheme: Theme = {
  name: "Royal Crest",
  isDark: true,
  variables: {
    primary: "44 55% 54%",           // Gold #C9A84C
    primaryForeground: "225 50% 8%",  // Deep Navy #0A0F1E
    secondary: "218 30% 12%",
    secondaryForeground: "45 57% 86%", // Cream #F0E6C8
    background: "225 50% 8%",         // Deep Navy #0A0F1E
    foreground: "45 57% 86%",         // Cream #F0E6C8
    card: "218 58% 16%",              // Mid Navy #112240
    cardForeground: "45 57% 86%",     // Cream
    muted: "218 30% 12%",
    mutedForeground: "45 20% 60%",
    accent: "44 55% 54%",
    accentForeground: "225 50% 8%",
    border: "218 40% 22%",            // Subtle Navy Border #1A3056
    radius: "1rem",
  }
};

export function getThemeForDay(): Theme {
  return royalCrestTheme;
}

export function applyTheme(theme: Theme = royalCrestTheme) {
  const root = document.documentElement;
  
  // Set all color variables
  root.style.setProperty("--primary", theme.variables.primary);
  root.style.setProperty("--primary-foreground", theme.variables.primaryForeground);
  root.style.setProperty("--secondary", theme.variables.secondary);
  root.style.setProperty("--secondary-foreground", theme.variables.secondaryForeground);
  root.style.setProperty("--background", theme.variables.background);
  root.style.setProperty("--foreground", theme.variables.foreground);
  root.style.setProperty("--card", theme.variables.card);
  root.style.setProperty("--card-foreground", theme.variables.cardForeground);
  root.style.setProperty("--muted", theme.variables.muted);
  root.style.setProperty("--muted-foreground", theme.variables.mutedForeground);
  root.style.setProperty("--accent", theme.variables.accent);
  root.style.setProperty("--accent-foreground", theme.variables.accentForeground);
  root.style.setProperty("--border", theme.variables.border);
  root.style.setProperty("--radius", theme.variables.radius);
  
  // Apply dark class
  root.classList.add("dark");
}
