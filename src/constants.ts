import { Question } from "./types";
import questionsData from "./questions";

// --- CUSTOMIZATION SECTION ---
export const APP_CONFIG = {
  // The Title displayed on the menu and header
  title: "SSW",
  
  // The subtitle or department name
  subtitle: "特定技能2号評価試験",

  // URL for your logo (Can be a web URL or a local path if in public folder)
  // Example: "https://your-company.com/logo.png"
  logoUrl: "https://i.imgur.com/S9kZFvc.png", 

  // URL for the background image
  // Example: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop"
  backgroundImageUrl: "https://proox.co.jp/wp2/wp-content/uploads/2023/06/PvYsK4DijyE0oPN1687914958_1687914993.jpg",

  // Admin PIN code
  adminPin: import.meta.env.VITE_ADMIN_PASSWORD || "8425",

  // How many questions to show in a single exam session?
  theoryQuestionsPerExam: 40,
  practicalQuestionsPerExam: 25,
  theoryTimeLimit: 60, // minutes
  practicalTimeLimit: 40, // minutes
  questionsPerExam: 30 // Fallback
};

// We cast the data to Question[] to ensure type safety with our specific interfaces
export const INITIAL_QUESTIONS: Question[] = questionsData as unknown as Question[];