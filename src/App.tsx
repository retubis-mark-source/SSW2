import React, { useState, useCallback, useRef, useEffect } from 'react';
import { INITIAL_QUESTIONS, APP_CONFIG } from './constants';
import { QuizCard } from './components/QuizCard';
import { FuriganaText } from './components/FuriganaText';
import { QuizState, Category, Question, Option } from './types';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  EyeOff,
  Layout,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Settings,
  PlusCircle,
  Upload,
  Home,
  Briefcase,
  Lock,
  X,
  FileText,
  Download,
  Trash2,
  Trophy,
  RotateCcw,
  Image as ImageIcon,
  AlertTriangle,
  Clock,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
} from 'lucide-react';

// Declare mammoth for TypeScript since it is loaded via script tag in index.html
declare const mammoth: {
  extractRawText: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

type ViewMode = 'gate' | 'menu' | 'exam' | 'admin' | 'result';

// Utility to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// --- GLOBAL STYLES & WRAPPER ---
const AppWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div 
    className="min-h-screen w-full bg-cover bg-center bg-no-repeat bg-fixed flex flex-col items-center justify-center font-sans text-slate-800"
    style={{ backgroundImage: `url('${APP_CONFIG.backgroundImageUrl}')` }}
  >
    {/* Preload background image with no-referrer policy */}
    <img 
      src={APP_CONFIG.backgroundImageUrl} 
      className="hidden" 
      referrerPolicy="no-referrer" 
      alt="" 
    />
    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] z-0" />
    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
      {children}
    </div>
  </div>
);

interface Student {
  id: string;
  email: string;
  is_approved: boolean;
  created_at: string;
  last_login_at?: string;
  last_ip?: string;
  last_user_agent?: string;
  device_id?: string;
}

export const App: React.FC = () => {
  // Global Data State (The Full Database)
  const [questions, setQuestions] = useState<Question[]>(() => {
    return INITIAL_QUESTIONS.map((q, i) => ({ ...q, id: i + 1 }));
  });

  // Navigation State
  const [view, setView] = useState<ViewMode>('gate');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('theory');

  // Admin Auth State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Supabase Auth State
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Student Management State
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  // --- Supabase Auth Logic ---
  
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const checkUser = async (session: Session | null) => {
      if (session?.user) {
        try {
          // Generate or retrieve a persistent device ID
          let deviceId = localStorage.getItem('ssw_device_id');
          if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem('ssw_device_id', deviceId);
          }

          // Update profile with latest login info
          await supabase.from('profiles').update({
            last_login_at: new Date().toISOString(),
            last_user_agent: navigator.userAgent,
            device_id: deviceId
          }).eq('id', session.user.id);

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_approved')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (profileError) throw profileError;

          if (profile?.is_approved) {
            setView('menu');
            setAuthError(null);
          } else {
            setAuthError("Your account is pending admin approval.");
          }
        } catch (err) {
          console.error("Error checking profile:", err);
        }
      }
    };

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => checkUser(session));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkUser(session);
      } else if (event === 'SIGNED_OUT') {
        setView('gate');
        setAuthError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseConfigured]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.");
      return;
    }
    setAuthError(null);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        
        // Also create a profile entry for management
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert([
            { id: data.user.id, email: authEmail, is_approved: false }
          ]);
          if (profileError) console.error("Profile creation error:", profileError);
        }
        
        alert("Sign up successful! Please wait for admin approval.");
        setIsSignUp(false); // Switch to login view
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            setAuthError("Your account is pending admin approval.");
          } else {
            throw error;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAuthError(err.message);
      } else {
        setAuthError("An unknown error occurred.");
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView('gate');
  };

  // Admin: Fetch pending requests
  const fetchStudents = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setIsLoadingStudents(false);
    }
  }, [isAdmin]);

  const handleApproveStudent = async (id: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: approve })
        .eq('id', id);
      
      if (error) throw error;
      fetchStudents();
    } catch (err) {
      console.error("Error updating student status:", err);
      alert("Error updating student status");
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student profile? This will not delete their auth account, but they won't be able to log in if you have approval checks enabled.")) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchStudents();
    } catch (err) {
      console.error("Error deleting student profile:", err);
      alert("Error deleting student profile");
    }
  };

  React.useEffect(() => {
    if (view === 'admin' && isAdmin) {
      fetchStudents();
    }
  }, [view, isAdmin, fetchStudents]);

  // Exam State
  const [examQuestions, setExamQuestions] = useState<Question[]>([]); // The subset of 40 questions
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizState, setQuizState] = useState<QuizState>({
    answers: {},
    isSubmitted: false,
    score: 0,
  });
  const [showFurigana, setShowFurigana] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // --- Exam Logic ---
  
  // Start Quiz: Filters, Shuffles, Slices questions, AND Shuffles Options
  const handleStartQuiz = () => {
    // 1. Filter by category
    const pool = selectedCategory === 'all' 
      ? questions 
      : questions.filter(q => q.category === selectedCategory);
    
    // 2. Shuffle Questions
    const shuffledQuestions = shuffleArray(pool);

    // 3. Slice to limit
    let limit = APP_CONFIG.questionsPerExam;
    let timeLimitMins = 30; // Default
    
    if (selectedCategory === 'theory') {
      limit = APP_CONFIG.theoryQuestionsPerExam;
      timeLimitMins = APP_CONFIG.theoryTimeLimit;
    } else if (selectedCategory === 'practical') {
      limit = APP_CONFIG.practicalQuestionsPerExam;
      timeLimitMins = APP_CONFIG.practicalTimeLimit;
    }
    
    const selectedSubset = shuffledQuestions.slice(0, limit);

    if (selectedSubset.length === 0) {
      alert("No questions available in this category!");
      return;
    }

    // 4. Shuffle Options for each selected question
    // We map over the subset and create new objects with shuffled options
    const questionsWithShuffledOptions = selectedSubset.map(q => ({
      ...q,
      options: shuffleArray(q.options)
    }));

    setExamQuestions(questionsWithShuffledOptions);
    setQuizState({ answers: {}, isSubmitted: false, score: 0 });
    setCurrentQuestionIndex(0);
    setTimeLeft(timeLimitMins * 60);
    setView('exam');
  };

  const currentQuestion = examQuestions[currentQuestionIndex];
  const totalQuestions = examQuestions.length;
  const percentage = Math.round((quizState.score / totalQuestions) * 100);
  const isPassing = percentage >= 60;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Handlers: Exam Navigation ---
  const handleSelectOption = useCallback((questionId: number, optionId: string) => {
    setQuizState((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: optionId,
      },
    }));
  }, []);

  const handleNext = useCallback(() => {
    if (!isLastQuestion) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [isLastQuestion]);

  const handlePrev = useCallback(() => {
    if (!isFirstQuestion) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [isFirstQuestion]);

  const handleJumpToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
  }, []);

  const handleSubmit = useCallback(() => {
    let newScore = 0;
    // Calculate score based on the EXAM questions only
    examQuestions.forEach((q) => {
      if (quizState.answers[q.id] === q.correctAnswerId) {
        newScore += 1;
      }
    });

    setQuizState((prev) => ({ ...prev, isSubmitted: true, score: newScore }));
    setView('result'); // Switch to dedicated Result view
  }, [quizState.answers, examQuestions]);

  // Timer Effect
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (view === 'exam' && !quizState.isSubmitted && timeLeft !== null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (timeLeft === 0 && !quizState.isSubmitted && view === 'exam') {
      alert("Time is up! Submitting your answers.");
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [view, quizState.isSubmitted, timeLeft, handleSubmit]);

  const handleReviewAnswers = () => {
    setCurrentQuestionIndex(0);
    setView('exam');
  };

  const handleExitExam = () => {
    if(quizState.isSubmitted || window.confirm("メインメニューに戻りますか？\n(Return to menu?)")) {
      setQuizState({ answers: {}, isSubmitted: false, score: 0 });
      setExamQuestions([]); // Clear the current exam session
      setCurrentQuestionIndex(0);
      setView('menu');
    }
  }

  const handleEndSession = () => {
    if(window.confirm("セッションを終了してロックしますか？\n(End session and lock?)")) {
      setView('gate');
    }
  }

  // Calculate status for palette
  const getQuestionStatus = (index: number) => {
    if (!examQuestions[index]) return 'unanswered';
    const qId = examQuestions[index].id;
    const isAnswered = !!quizState.answers[qId];
    const isCorrect = quizState.answers[qId] === examQuestions[index].correctAnswerId;

    if (quizState.isSubmitted) {
      return isCorrect ? 'correct' : 'incorrect';
    }
    return isAnswered ? 'answered' : 'unanswered';
  };

  // --- Admin / Upload Logic ---
  const [newQ, setNewQ] = useState<Partial<Question>>({
    category: 'theory',
    options: [
      { id: 'A', text: '' }, { id: 'B', text: '' },
      { id: 'C', text: '' }, { id: 'D', text: '' }
    ],
    correctAnswerId: 'A'
  });

  const [isProcessingDoc, setIsProcessingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewQ(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddQuestion = () => {
    if (!newQ.questionText) {
      alert("Please enter question text");
      return;
    }

    // Find the highest ID in the database to prevent conflict
    const maxId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) : 0;

    const questionToAdd: Question = {
      id: maxId + 1,
      category: newQ.category as Category,
      questionText: newQ.questionText || "",
      imageUrl: newQ.imageUrl,
      textbookPage: newQ.textbookPage,
      correctAnswerId: newQ.correctAnswerId || "A",
      options: newQ.options as Option[]
    };

    setQuestions([...questions, questionToAdd]);
    alert("Question Added Successfully!");
    
    // Reset form partial
    setNewQ({
      category: 'theory',
      questionText: '',
      imageUrl: undefined,
      textbookPage: '',
      correctAnswerId: 'A',
      options: [
        { id: 'A', text: '' }, { id: 'B', text: '' },
        { id: 'C', text: '' }, { id: 'D', text: '' }
      ]
    });
    // Clear image input
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleDeleteQuestion = (id: number) => {
    if(window.confirm("Are you sure you want to delete this question?")) {
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  // --- Word Doc Import Logic ---
  const handleWordUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (typeof mammoth === 'undefined') {
      alert("System Error: Word parser library (Mammoth) is not loaded. Please refresh the page.");
      return;
    }

    setIsProcessingDoc(true);
    const reader = new FileReader();

    reader.onload = function(loadEvent) {
      const arrayBuffer = loadEvent.target?.result as ArrayBuffer;

      mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(function(result) {
          const text = result.value;
          const parsedQuestions = parseRawTextToQuestions(text);
          
          if (parsedQuestions.length > 0) {
            if (window.confirm(`Successfully parsed ${parsedQuestions.length} questions. Add them to the database?`)) {
               // Assign IDs and add
               const currentMaxId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) : 0;
               const formattedQuestions = parsedQuestions.map((q, idx) => ({
                 ...q,
                 id: currentMaxId + idx + 1
               }));
               setQuestions(prev => [...prev, ...formattedQuestions]);
               alert("Import successful!");
            }
          } else {
            const previewText = text.substring(0, 200);
            alert(`No questions found.\n\nDebug - Text extracted from doc:\n${previewText}...\n\nEnsure format is:\n1. Question Text\nA. Option\nB. Option\n...\nAnswer: A`);
          }
          setIsProcessingDoc(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        })
        .catch(function(err: Error) {
          console.error(err);
          alert(`Error reading Word file: ${err.message}`);
          setIsProcessingDoc(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        });
    };
    reader.readAsArrayBuffer(file);
  };

  // Simple heuristic parser for Word content
  const parseRawTextToQuestions = (text: string): Question[] => {
    const lines = text.split(/\n+/);
    const result: Question[] = [];

    let currentQ: Partial<Question> | null = null;
    let currentOptions: Option[] = [];

    const qStartRegex = /^\s*(\d+)[.)、]\s*(.*)/; 
    const optRegex = /^\s*([A-D])[.)、]\s*(.*)/; 
    const ansRegex = /^\s*(?:正解|Answer|Ans)[:：\s]*([A-D])/i; 

    for (const line of lines) {
      const trimmed = line; 
      if (!trimmed.trim()) continue;

      // 1. Check for Question Start
      const qMatch = trimmed.match(qStartRegex);
      if (qMatch) {
        if (currentQ && currentOptions.length > 0) {
           result.push({
             id: 0, 
             category: 'theory',
             questionText: currentQ.questionText || "Empty Question",
             options: currentOptions.length >= 2 ? currentOptions : [
               {id:'A', text:'Yes'}, {id:'B', text:'No'}
             ],
             correctAnswerId: currentQ.correctAnswerId || 'A',
             textbookPage: currentQ.textbookPage
           });
        }
        currentQ = {
          questionText: qMatch[2],
          category: 'theory', 
          correctAnswerId: 'A'
        };
        currentOptions = [];
        continue;
      }

      // 2. Check for Option
      const optMatch = trimmed.match(optRegex);
      if (optMatch && currentQ) {
        currentOptions.push({
          id: optMatch[1].toUpperCase(),
          text: optMatch[2]
        });
        continue;
      }

      // 3. Check for Answer line
      const ansMatch = trimmed.match(ansRegex);
      if (ansMatch && currentQ) {
        currentQ.correctAnswerId = ansMatch[1].toUpperCase();
        continue;
      }

      // 4. Check for textbook ref
      if (trimmed.includes("Page") || trimmed.includes("ページ")) {
         if (currentQ) currentQ.textbookPage = trimmed.replace(/\D/g, '');
         continue;
      }

      // 5. Continuation of question text
      if (currentQ && currentOptions.length === 0) {
        currentQ.questionText += ` ${trimmed.trim()}`;
      }
    }

    if (currentQ && currentOptions.length > 0) {
       result.push({
         id: 0,
         category: 'theory',
         questionText: currentQ.questionText || "Empty",
         options: currentOptions,
         correctAnswerId: currentQ.correctAnswerId || 'A',
         textbookPage: currentQ.textbookPage
       });
    }

    return result;
  };

  // --- Auth Logic ---
  const attemptLogin = (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if (adminPasswordInput === APP_CONFIG.adminPin) {
      setIsAdmin(true);
      localStorage.setItem('adminPin', adminPasswordInput);
      setShowAuthModal(false);
      setView('admin');
      setAdminPasswordInput("");
    } else {
      alert("Invalid PIN Code");
    }
  };

  const handleAdminClick = () => {
    const savedPin = localStorage.getItem('adminPin');
    if (savedPin === APP_CONFIG.adminPin) {
      setIsAdmin(true);
      setView('admin');
    } else {
      setAdminPasswordInput("");
      setShowAuthModal(true);
    }
  };

  const handleDownloadData = () => {
    const jsonString = JSON.stringify(questions, null, 2);
    const fileContent = `export default ${jsonString};`;
    
    const blob = new Blob([fileContent], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'questions.ts';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- RENDER ---
  return (
    <AnimatePresence mode="wait">
      {view === 'gate' && (
        <motion.div
          key="gate"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full flex items-center justify-center"
        >
          <AppWrapper>
            <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/50 text-center relative overflow-hidden m-4">
          <div className="absolute top-0 left-0 w-full h-2 bg-slate-800"></div>
          
          <div className="mb-8 mt-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-slate-200">
              <Lock className="w-10 h-10 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {isSignUp ? "Create Account" : "Student Login"}
            </h1>
            <p className="text-slate-500 text-sm">
              {isSignUp 
                ? "Sign up to request access to the examination." 
                : "Login to access your authorized quiz session."}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
              <input 
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="student@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
              <input 
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {authError}
                </div>
                {authError.includes("pending admin approval") && (
                  <button 
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-[10px] text-red-700 font-bold hover:underline text-left pl-6"
                  >
                    Click here to refresh status
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isSignUp ? <PlusCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              {isSignUp ? "Sign Up" : "Login"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-indigo-600 text-sm font-medium hover:underline"
            >
              {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or Admin</span></div>
            </div>

            <button
              onClick={handleAdminClick}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Admin Dashboard
            </button>
          </div>
          
          <div className="mt-8 text-[10px] text-slate-300 uppercase tracking-widest">
            Secure Examination System v3.0
          </div>
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Admin Verification</h3>
              <form onSubmit={attemptLogin}>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter PIN Code"
                  className="w-full p-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center text-2xl tracking-widest text-black"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Login</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppWrapper>
    </motion.div>
    )}

    {view === 'menu' && (
      <motion.div
        key="menu"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.3 }}
        className="w-full h-full flex items-center justify-center"
      >
        <AppWrapper>
          <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/50 relative overflow-hidden m-4">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          
          <div className="text-center mb-8 mt-4">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-md border border-slate-100 p-2">
                {APP_CONFIG.logoUrl ? (
                  <img 
                    src={APP_CONFIG.logoUrl} 
                    alt="Logo" 
                    className="w-full h-full object-contain" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                 <Briefcase className="w-10 h-10 text-indigo-600" />
               )}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">{APP_CONFIG.title}</h1>
            <p className="text-slate-500 font-medium">{APP_CONFIG.subtitle}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Select Category</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setSelectedCategory('theory')}
                  className={`relative py-3 px-2 text-sm rounded-xl border-2 font-bold transition-all ${selectedCategory === 'theory' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                >
                  学科 (がっか)
                  <span className="absolute bottom-1 right-2 text-[10px] opacity-70">
                  </span>
                </button>
                <button 
                  onClick={() => setSelectedCategory('practical')}
                  className={`relative py-3 px-2 text-sm rounded-xl border-2 font-bold transition-all ${selectedCategory === 'practical' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}
                >
                  実技（じつぎ） 
                  <span className="absolute bottom-1 right-2 text-[10px] opacity-70">
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={handleStartQuiz}
              className="w-full py-4 mt-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 group"
            >
              <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Start Quiz ({selectedCategory === 'theory' ? APP_CONFIG.theoryQuestionsPerExam : (selectedCategory === 'practical' ? APP_CONFIG.practicalQuestionsPerExam : APP_CONFIG.questionsPerExam)} Questions)
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between text-slate-400">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium hover:text-red-500 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Logout
            </button>
            <button 
              onClick={handleAdminClick}
              className="flex items-center gap-1.5 text-xs font-medium hover:text-slate-600 transition-colors"
            >
              <Settings className="w-3 h-3" />
              Admin Dashboard
            </button>
            <button 
              onClick={handleEndSession}
              className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
            >
              <Lock className="w-3 h-3" />
              Lock App
            </button>
          </div>
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Admin Verification</h3>
              <form onSubmit={attemptLogin}>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter PIN Code"
                  className="w-full p-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center text-2xl tracking-widest text-black"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Login</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppWrapper>
    </motion.div>
    )}

    {view === 'result' && (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.4, type: "spring", damping: 20 }}
          className="w-full h-full flex items-center justify-center"
        >
          <AppWrapper>
            <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/50 text-center animate-in fade-in zoom-in duration-300 m-4">
              
              <div className="mb-6">
                <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 shadow-lg ${isPassing ? 'bg-gradient-to-br from-green-400 to-emerald-600 text-white' : 'bg-gradient-to-br from-red-400 to-rose-600 text-white'}`}>
                  <Trophy className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1">
                  {isPassing ? "Excellent Work!" : "Keep Studying!"}
                </h2>
                <p className="text-slate-500">Quiz Completed</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-100 shadow-inner">
                <div className="text-sm text-slate-500 uppercase tracking-wider font-bold mb-2">Your Score</div>
                <div className="text-5xl font-black text-slate-800 mb-2">
                  {quizState.score} <span className="text-2xl text-slate-400 font-medium">/ {totalQuestions}</span>
                </div>
                <div className={`text-lg font-bold ${isPassing ? 'text-green-600' : 'text-red-500'}`}>
                  {percentage}% Correct
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleReviewAnswers}
                  className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Review Answers
                </button>
                <button
                  onClick={handleExitExam}
                  className="w-full py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" /> Back to Menu
                </button>
              </div>
            </div>
          </AppWrapper>
        </motion.div>
    )}

    {view === 'admin' && (
      <motion.div
        key="admin"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-slate-100 flex flex-col"
      >
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-2 rounded-lg text-white">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Admin Dashboard</h1>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setView('menu')} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 border border-indigo-700 rounded-lg hover:bg-indigo-700 shadow-sm font-medium">
              <BookOpen className="w-4 h-4" /> Start Student Session
            </button>
             <button onClick={handleDownloadData} className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 border border-green-700 rounded-lg hover:bg-green-700 shadow-sm font-medium">
              <Download className="w-4 h-4" /> Export Data
            </button>
            <button onClick={() => setView('gate')} className="flex items-center gap-2 px-4 py-2 text-white bg-slate-800 rounded-lg hover:bg-slate-900 font-medium">
              <Lock className="w-4 h-4" /> Lock App
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
          
          {/* Update Instructions */}
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl flex gap-4 text-blue-900 shadow-sm">
            <AlertTriangle className="w-8 h-8 shrink-0 text-orange-500" />
            <div>
              <p className="font-bold text-lg mb-2">Changes made here are NOT live yet!</p>
              <p className="text-sm mb-3 text-blue-800">
                Any questions you add or delete here are only saved in your browser temporarily. 
                To publish your changes to the internet, you must follow these steps:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-sm font-medium">
                <li>Make all your changes below.</li>
                <li>Click the <b className="text-green-700">Export Data</b> button (top right) to download <code>questions.ts</code>.</li>
                <li>Replace the <code>questions.ts</code> file in your project folder with this new file.</li>
                <li>Run <code>npm run build</code> and upload the <code>dist</code> folder to Netlify again.</li>
              </ol>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="text-slate-500 text-sm font-medium">Total Database</div>
              <div className="text-2xl font-bold text-slate-800">{questions.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="text-slate-500 text-sm font-medium">Theory</div>
              <div className="text-2xl font-bold text-indigo-600">{questions.filter(q => q.category === 'theory').length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="text-slate-500 text-sm font-medium">Practical</div>
              <div className="text-2xl font-bold text-emerald-600">{questions.filter(q => q.category === 'practical').length}</div>
            </div>
            <div className="bg-indigo-600 p-4 rounded-xl shadow-lg border border-indigo-700 text-white">
              <div className="text-indigo-100 text-sm font-medium">System Status</div>
              <div className="text-2xl font-bold">Active</div>
            </div>
          </div>

          {/* Student Management */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Student Management
            </h2>
            
            {isLoadingStudents ? (
              <div className="py-8 text-center text-slate-400 animate-pulse">Loading students...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Device Info</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Joined</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-slate-700">{student.email}</td>
                        <td className="py-3 px-4">
                          {student.is_approved ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-bold border border-green-100">
                              <ShieldCheck className="w-3 h-3" /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-600 text-[10px] font-bold border border-orange-100">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(student.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            {student.last_login_at ? (
                              <>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(student.last_login_at).toLocaleString()}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate max-w-[150px]" title={student.last_user_agent}>
                                  {student.last_user_agent}
                                </div>
                                {student.device_id && (
                                  <div className="text-[9px] font-mono text-indigo-400 truncate max-w-[150px]" title={`Device ID: ${student.device_id}`}>
                                    ID: {student.device_id.substring(0, 8)}...
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">Never logged in</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {student.is_approved ? (
                            <button 
                              onClick={() => handleApproveStudent(student.id, false)}
                              className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Revoke Approval"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleApproveStudent(student.id, true)}
                              className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve Student"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                          No students found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Note: Approving a student here allows them to access the exam menu after they confirm their email (if email confirmation is enabled in Supabase).
              </p>
            </div>
          </div>

          {/* Import Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
             <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
               <FileText className="w-5 h-5 text-indigo-500" />
               Import Questions
             </h2>
             <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center">
                {isProcessingDoc ? (
                  <div className="animate-pulse text-indigo-600 font-medium">Processing Document...</div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mb-2" />
                    <p className="text-slate-600 font-medium mb-1">Upload Microsoft Word (.docx)</p>
                    <p className="text-slate-400 text-sm mb-4">Auto-detects format: "1. Question... A. Option..."</p>
                    <input 
                      type="file" 
                      accept=".docx" 
                      ref={fileInputRef}
                      onChange={handleWordUpload} 
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 max-w-xs mx-auto"
                    />
                  </>
                )}
             </div>
          </div>

          {/* Manual Add */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-green-500" />
              Add Manually
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                   <select 
                     className="w-full p-2 border rounded-lg bg-slate-50 text-black"
                     value={newQ.category}
                     onChange={e => setNewQ({...newQ, category: e.target.value as Category})}
                   >
                     <option value="theory">Theory (学科)</option>
                     <option value="practical">Practical (実技)</option>
                   </select>
                </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Correct Answer</label>
                   <select 
                     className="w-full p-2 border rounded-lg bg-slate-50 text-black"
                     value={newQ.correctAnswerId}
                     onChange={e => setNewQ({...newQ, correctAnswerId: e.target.value})}
                   >
                     <option value="A">A</option>
                     <option value="B">B</option>
                     <option value="C">C</option>
                     <option value="D">D</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Textbook Page / Reference</label>
                   <input 
                     type="text"
                     placeholder="Ex: 42 or P.42"
                     className="w-full p-2 border rounded-lg bg-slate-50 text-black"
                     value={newQ.textbookPage || ''}
                     onChange={e => setNewQ({...newQ, textbookPage: e.target.value})}
                   />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question Text (Use [Kanji|Reading] or Kanji(Reading) for furigana)</label>
                <textarea 
                  className="w-full p-3 border rounded-lg bg-slate-50 h-24 text-black"
                  placeholder="Example: [安全|あんぜん] or 安全(あんぜん)な[作業|さぎょう]について..."
                  value={newQ.questionText}
                  onChange={e => setNewQ({...newQ, questionText: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['A', 'B', 'C', 'D'].map((optId, idx) => (
                   <div key={optId}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Option {optId}</label>
                      <input 
                        type="text"
                        className="w-full p-2 border rounded-lg bg-slate-50 text-black"
                        value={newQ.options?.[idx]?.text || ''}
                        onChange={e => {
                          const newOpts = [...(newQ.options || [])];
                          newOpts[idx] = { id: optId, text: e.target.value };
                          setNewQ({...newQ, options: newOpts});
                        }}
                      />
                   </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-slate-500" /> Image (Optional)
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={imageInputRef}
                  onChange={handleImageUpload} 
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                />
                {newQ.imageUrl && (
                  <div className="mt-2 relative inline-block">
                    <img 
                      src={newQ.imageUrl} 
                      alt="Preview" 
                      className="h-32 object-contain border rounded bg-slate-50" 
                      referrerPolicy="no-referrer"
                    />
                    <button 
                      onClick={() => {
                        setNewQ({...newQ, imageUrl: undefined});
                        if (imageInputRef.current) imageInputRef.current.value = "";
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <button 
                onClick={handleAddQuestion}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm transition-colors"
              >
                Add Question
              </button>
            </div>
          </div>

          {/* Manage Questions List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Layout className="w-5 h-5 text-purple-500" />
              Manage Questions
            </h2>
            
            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
              {questions.slice().reverse().map((q) => (
                <div key={q.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors group">
                   <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex flex-col min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                              q.category === 'theory' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            }`}>
                              {q.category}
                            </span>
                            <span className="text-xs text-slate-400">ID: {q.id}</span>
                            {q.textbookPage && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">P.{q.textbookPage}</span>
                            )}
                         </div>
                         {/* Using FuriganaText here so you can verify parsing immediately */}
                         <div className="text-sm text-slate-700 font-medium truncate">
                           <FuriganaText text={q.questionText} showFurigana={true} />
                         </div>
                      </div>
                   </div>
                   <button 
                     onClick={() => handleDeleteQuestion(q.id)}
                     className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                     title="Delete Question"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  No questions available. Add some above!
                </div>
              )}
            </div>
          </div>

        </main>
      </motion.div>
    )}

    {view === 'exam' && currentQuestion && (
      <motion.div
        key="exam"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col h-screen max-w-4xl mx-auto bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden md:my-4 md:rounded-2xl md:h-[calc(100vh-2rem)] border border-white/50"
      >
        {/* Header */}
        <header className="flex-none bg-slate-900 text-white p-4 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={handleExitExam} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-slate-200 tracking-wide uppercase">{APP_CONFIG.title}</h1>
            <span className="text-xs text-slate-400">
              {quizState.isSubmitted ? 'Result Mode' : 'Exam Mode'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Timer */}
           {view === 'exam' && !quizState.isSubmitted && timeLeft !== null && (
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-sm font-bold ${timeLeft < 60 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-slate-800 text-slate-200 border-slate-700'}`}>
               <Clock className="w-4 h-4" />
               {formatTime(timeLeft)}
             </div>
           )}

           {/* Furigana Toggle */}
           <button 
             onClick={() => setShowFurigana(!showFurigana)} 
             className="flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors border border-slate-700"
           >
             {showFurigana ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
             {showFurigana ? 'Furigana ON' : 'Furigana OFF'}
           </button>

           <div className="text-right">
             <div className="text-xl font-bold font-mono leading-none">
               {currentQuestionIndex + 1}<span className="text-sm text-slate-500">/{totalQuestions}</span>
             </div>
           </div>
        </div>
      </header>

      {/* Scrollable Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 scroll-smooth">
         {quizState.isSubmitted && (
           <div className={`mb-6 p-4 rounded-xl border-l-4 shadow-sm ${
             quizState.answers[currentQuestion.id] === currentQuestion.correctAnswerId 
               ? 'bg-green-50 border-green-500 text-green-800'
               : 'bg-red-50 border-red-500 text-red-800'
           } flex items-center gap-3 animate-in slide-in-from-top-2 duration-300`}>
             {quizState.answers[currentQuestion.id] === currentQuestion.correctAnswerId 
               ? <CheckCircle2 className="w-6 h-6 shrink-0" />
               : <AlertCircle className="w-6 h-6 shrink-0" />
             }
             <div>
               <p className="font-bold">
                 {quizState.answers[currentQuestion.id] === currentQuestion.correctAnswerId ? 'Correct!' : 'Incorrect'}
               </p>
               <p className="text-sm opacity-90 mt-1">
                 <span className="font-bold">Answer:</span> <FuriganaText text={currentQuestion.options.find(o => o.id === currentQuestion.correctAnswerId)?.text || currentQuestion.correctAnswerId} showFurigana={showFurigana} />
                 {currentQuestion.textbookPage && (
                   <span className="ml-2 px-2 py-0.5 bg-white/50 rounded-md border border-black/10 text-xs">
                     Page: {currentQuestion.textbookPage}
                   </span>
                 )}
                 {currentQuestion.explanation && ` - ${currentQuestion.explanation}`}
               </p>
             </div>
           </div>
         )}

         <QuizCard 
           question={currentQuestion}
           selectedOptionId={quizState.answers[currentQuestion.id]}
           onSelect={handleSelectOption}
           isSubmitted={quizState.isSubmitted}
           showFurigana={showFurigana}
         />
      </main>

      {/* Footer Navigation */}
      <footer className="flex-none bg-white border-t p-4 flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {/* Palette (Horizontal Scroll) */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {examQuestions.map((_, idx) => {
            const status = getQuestionStatus(idx);
            let bgClass = "bg-slate-100 text-slate-400 border-slate-200";
            if (idx === currentQuestionIndex) bgClass = "ring-2 ring-offset-1 ring-indigo-500 border-indigo-500 bg-white text-indigo-600 font-bold";
            else if (status === 'correct') bgClass = "bg-green-500 text-white border-green-600";
            else if (status === 'incorrect') bgClass = "bg-red-500 text-white border-red-600";
            else if (status === 'answered') bgClass = "bg-indigo-100 text-indigo-700 border-indigo-200";

            return (
              <button
                key={idx}
                onClick={() => handleJumpToQuestion(idx)}
                className={`w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-lg flex items-center justify-center text-sm border transition-all ${bgClass}`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={handlePrev}
            disabled={isFirstQuestion}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" /> Prev
          </button>
          
          {isLastQuestion ? (
             !quizState.isSubmitted ? (
              <button 
                onClick={handleSubmit}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-95"
              >
                Submit Exam <CheckCircle2 className="w-5 h-5" />
              </button>
             ) : (
              <button 
                onClick={handleExitExam}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-slate-800 text-white shadow-lg hover:bg-slate-900 transition-all"
              >
                Return to Menu <Home className="w-5 h-5" />
              </button>
             )
          ) : (
            <button 
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-colors"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </footer>
    </motion.div>
    )}
    </AnimatePresence>
  );
};
