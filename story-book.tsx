import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Send, ChevronRight, ChevronLeft, BookOpen, Info, Trophy, AlertCircle, Settings2, Sparkles, ScrollText, Target, Palette } from 'lucide-react';

const apiKey = ""; // Running in environment with pre-configured key

const MAX_STEPS_LIMIT = 20;

const ART_STYLES = [
  'Photorealistic', 
  'Watercolor', 
  'Western Comic', 
  'Anime', 
  'Flat Design', 
  'Surrealist', 
  'Gouache Illustration', 
  'Native American Art'
];

const TRANSLATIONS = {
  Hebrew: {
    title: "יוצר הסיפורים האינטראקטיבי",
    loadingThemes: "מגבש את ערכי הסיפור והמטרה...",
    loadingStory: "הסיפור נכתב והתמונה מצוירת...",
    didYouKnow: "הידעת?",
    nextAction: "מה תרצה לעשות?",
    step: "צעד",
    of: "מתוך",
    theEnd: "הסוף!",
    endMessage: "הסיפור הגיע לסיומו.",
    restart: "התחל מחדש",
    dir: "rtl"
  },
  English: {
    title: "Interactive Story Creator",
    loadingThemes: "Crafting story themes and goals...",
    loadingStory: "Writing story and painting scene...",
    didYouKnow: "Did you know?",
    nextAction: "What do you want to do?",
    step: "Step",
    of: "of",
    theEnd: "The End!",
    endMessage: "The story has come to an end.",
    restart: "Start Over",
    dir: "ltr"
  },
  Russian: {
    title: "Интерактивный создатель историй",
    loadingThemes: "Формирование тем и целей истории...",
    loadingStory: "Пишем историю и рисуем сцену...",
    didYouKnow: "Знаете ли вы?",
    nextAction: "Что вы хотите сделать?",
    step: "Шаг",
    of: "из",
    theEnd: "Конец!",
    endMessage: "История подошла к концу.",
    restart: "Начать заново",
    dir: "ltr"
  }
};

const App = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [config, setConfig] = useState({
    topic: "Native American hunters",
    language: "Hebrew",
    maxSteps: 10,
    extraDetails: "",
    artStyle: "Watercolor"
  });

  const [themes, setThemes] = useState([]);
  const [endingGoal, setEndingGoal] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState(null);

  const t = TRANSLATIONS[config.language];
  const textContainerRef = useRef(null);

  // Scroll to top whenever the page changes
  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = 0;
    }
  }, [currentPageIndex]);

  const safeJsonParse = (str) => {
    try {
      const cleanJson = str.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error:", e);
      throw new Error("Failed to read the story data. Please try again.");
    }
  };

  const generateThemesPrompt = () => `You are a story architect. The user wants to play an interactive story about "${config.topic}". 
Style: ${config.artStyle}. 
Additional user preferences: "${config.extraDetails}".

Tasks:
1. Generate 5 core philosophical themes for this story.
2. Generate a "storyEndingGoal" - a specific narrative resolution.
3. Generate a "visualBrief" - a short description in English of how characters and settings should look.

Output must be in valid JSON format.`;

  const generateStoryPrompt = (factsHistory, currentThemes, currentGoal, summary) => `You are an AI storyteller for children. 
Theme: ${config.topic}. 
Language: ${config.language}. 
Visual Style: ${config.artStyle}.

Context:
- Themes: [${currentThemes.join(', ')}]
- Goal: ${currentGoal}
- Story Summary so far: ${summary}

Storytelling Guidelines:
1. MERGE WITH THEME: Pick one background theme and integrate it.
2. CONSEQUENCE: Decisions must have logical outcomes based on environmental clues.
3. VISUAL CONSISTENCY: Maintain the look of the ${config.artStyle} style based on visual history.
4. FLEXIBLE ENDING: Conclude early if the goal is met or fails.
5. MAX PAGES: Do not exceed ${config.maxSteps}.

Return ONLY JSON.`;

  const fetchWithRetry = async (url, options, retries = 3, backoff = 1500) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Server Error: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
      }
      throw err;
    }
  };

  const generateNextStep = async (input, currentThemes, currentGoal) => {
    if (isGameOver) return;
    
    setIsLoading(true);
    setStatusText(t.loadingStory);
    setError(null);

    try {
      const currentStep = pages.length + 1;
      const factsHistory = pages.map(p => p.educationalFact);
      const lastPage = pages[pages.length - 1];
      const summary = lastPage?.updatedSummary || "Beginning of the journey.";
      
      const userQuery = `Step: ${currentStep}/${config.maxSteps}. User input: ${input}`;

      const recentImages = pages.slice(-3).map(p => ({
        inlineData: {
          mimeType: "image/png",
          data: p.imageUrl.split(',')[1]
        }
      }));

      const geminiResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }, ...recentImages] }],
            systemInstruction: { parts: [{ text: generateStoryPrompt(factsHistory, currentThemes, currentGoal, summary) }] },
            generationConfig: { 
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  storyText: { type: "STRING" },
                  educationalFact: { type: "STRING" },
                  question: { type: "STRING" },
                  imagePrompt: { type: "STRING" },
                  isGameOver: { type: "BOOLEAN" },
                  updatedSummary: { type: "STRING" }
                },
                required: ["storyText", "educationalFact", "imagePrompt", "isGameOver", "updatedSummary"]
              }
            }
          })
        }
      );

      const text = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Connection failed.");
      const result = safeJsonParse(text);

      const imagenResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: { prompt: `${result.imagePrompt} in ${config.artStyle} style. Detailed, consistent characters, full scene.` },
            parameters: { sampleCount: 1 }
          })
        }
      );

      const bytes = imagenResponse.predictions?.[0]?.bytesBase64Encoded;
      const imageUrl = bytes ? `data:image/png;base64,${bytes}` : null;

      const newPage = {
        storyText: result.storyText,
        educationalFact: result.educationalFact,
        question: result.question || "",
        imageUrl: imageUrl,
        choice: input,
        updatedSummary: result.updatedSummary
      };

      setPages(prev => [...prev, newPage]);
      setCurrentPageIndex(pages.length);
      setIsGameOver(result.isGameOver || currentStep >= config.maxSteps);
      setUserInput("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error generating story page.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    setIsStarted(true);
    setIsLoading(true);
    setStatusText(t.loadingThemes);
    setError(null);

    try {
      const themeResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Initialize the story themes and ending goal based on the topic." }] }],
            systemInstruction: { parts: [{ text: generateThemesPrompt() }] },
            generationConfig: { 
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  themes: { type: "ARRAY", items: { type: "STRING" } },
                  storyEndingGoal: { type: "STRING" },
                  visualBrief: { type: "STRING" }
                },
                required: ["themes", "storyEndingGoal", "visualBrief"]
              }
            }
          })
        }
      );
      
      const text = themeResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Could not initialize story themes.");
      
      const data = safeJsonParse(text);
      setThemes(data.themes || []);
      setEndingGoal(data.storyEndingGoal || "");
      
      await generateNextStep(`Start the story.`, data.themes, data.storyEndingGoal);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to initialize story settings.");
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userInput.trim() && !isLoading && !isGameOver) {
      generateNextStep(userInput, themes, endingGoal);
    }
  };

  const currentPage = pages[currentPageIndex];

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans" dir="ltr">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-8 border-4 border-amber-200">
          <div className="text-center mb-6">
            <div className="inline-block p-4 bg-amber-100 rounded-full mb-4">
              <Sparkles className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900 font-serif">Create Your Adventure</h1>
            <p className="text-stone-500">Interactive story with visual & logic consistency</p>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Story Topic</label>
                <input 
                  type="text" 
                  required
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2 focus:border-amber-600 outline-none"
                  placeholder="e.g. Native American hunters..."
                  value={config.topic}
                  onChange={(e) => setConfig({...config, topic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Visual Style</label>
                <select 
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2 focus:border-amber-600 outline-none bg-white"
                  value={config.artStyle}
                  onChange={(e) => setConfig({...config, artStyle: e.target.value})}
                >
                  {ART_STYLES.map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">Extra Details (Optional)</label>
              <textarea 
                className="w-full border-2 border-stone-200 rounded-xl px-4 py-2 focus:border-amber-600 outline-none text-sm min-h-[80px]"
                placeholder="Specific elements, values, or tone..."
                value={config.extraDetails}
                onChange={(e) => setConfig({...config, extraDetails: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Language</label>
                <select 
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2 focus:border-amber-600 outline-none bg-white"
                  value={config.language}
                  onChange={(e) => setConfig({...config, language: e.target.value})}
                >
                  <option value="English">English</option>
                  <option value="Hebrew">Hebrew (עברית)</option>
                  <option value="Russian">Russian (Русский)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Max Pages</label>
                <input 
                  type="number" 
                  min="5" 
                  max={MAX_STEPS_LIMIT}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2 focus:border-amber-600 outline-none"
                  value={config.maxSteps}
                  onChange={(e) => setConfig({...config, maxSteps: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4"
            >
              <ScrollText className="w-5 h-5" />
              Start Adventure
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-stone-50 font-sans text-stone-900 flex flex-col p-2 md:p-4 overflow-hidden`} dir={t.dir}>
      <header className="max-w-7xl w-full mx-auto mb-2 text-center shrink-0">
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-amber-900 leading-tight">{t.title}</h1>
        <div className="flex justify-center items-center gap-2 text-stone-600 text-[10px] md:text-xs">
           <span className="bg-amber-200 px-2 py-0.5 rounded-full font-bold">
             {t.step} {pages.length} {t.of} {config.maxSteps}
           </span>
           <span className="opacity-60 font-bold flex items-center gap-1">
             <Palette className="w-3 h-3" /> {config.artStyle} • {config.topic}
           </span>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto flex-1 flex flex-col md:flex-row bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-stone-200 relative mb-2">
        
        {/* LEFT PART: IMAGE (Vertical Split) */}
        <div className={`w-full md:w-1/2 h-[40vh] md:h-full relative bg-white flex items-center justify-center overflow-hidden border-b md:border-b-0 ${t.dir === 'rtl' ? 'md:border-l' : 'md:border-r'} border-stone-200 shrink-0`}>
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 text-amber-700 p-8 text-center">
              <div className="relative">
                <Loader2 className="w-12 md:w-16 h-12 md:h-16 animate-spin" />
                <BookOpen className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="font-bold animate-pulse text-xs md:text-sm">{statusText}</p>
            </div>
          ) : currentPage?.imageUrl ? (
            <img 
              src={currentPage.imageUrl} 
              alt="Story scene" 
              className="w-full h-full object-contain" 
            />
          ) : (
            <div className="p-12 text-center text-stone-200">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-10" />
            </div>
          )}

          {/* Navigation Controls Overlay */}
          {pages.length > 1 && (
            <div className="absolute inset-x-4 bottom-4 flex justify-between pointer-events-none">
              <button 
                onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                disabled={currentPageIndex === 0}
                className="pointer-events-auto bg-white/90 p-2 rounded-full shadow-lg hover:bg-amber-50 disabled:opacity-20 transition-all border border-amber-100"
              >
                {t.dir === 'rtl' ? <ChevronRight className="w-5 h-5 text-amber-900" /> : <ChevronLeft className="w-5 h-5 text-amber-900" />}
              </button>
              <button 
                onClick={() => setCurrentPageIndex(p => Math.min(pages.length - 1, p + 1))}
                disabled={currentPageIndex === pages.length - 1}
                className="pointer-events-auto bg-white/90 p-2 rounded-full shadow-lg hover:bg-amber-50 disabled:opacity-20 transition-all border border-amber-100"
              >
                {t.dir === 'rtl' ? <ChevronLeft className="w-5 h-5 text-amber-900" /> : <ChevronRight className="w-5 h-5 text-amber-900" />}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PART: TEXT (Vertical Split) */}
        <div className="w-full md:w-1/2 h-full flex flex-col bg-stone-50/10 overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/parchment.png')]"></div>
          
          <div 
            ref={textContainerRef}
            className={`flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 relative z-10 transition-all duration-500 ${isLoading ? 'blur-md opacity-40 grayscale pointer-events-none' : ''}`}
          >
            {currentPage ? (
              <div className="space-y-8 max-w-2xl mx-auto">
                <div className="prose prose-stone prose-lg lg:prose-xl">
                  <p className="text-xl md:text-2xl lg:text-3xl leading-relaxed font-serif text-stone-800 drop-shadow-sm first-letter:text-5xl first-letter:font-bold first-letter:mr-2">
                    {currentPage.storyText}
                  </p>
                </div>

                <div className={`bg-white/95 p-5 rounded-2xl border-y border-amber-100 ${t.dir === 'rtl' ? 'border-r-8 border-r-amber-600' : 'border-l-8 border-l-amber-600'} flex gap-4 shadow-md`}>
                  <Info className="w-6 h-6 text-amber-700 shrink-0 mt-1" />
                  <div className="flex-1">
                    <span className="block font-bold text-amber-900 text-[10px] uppercase tracking-widest mb-1">{t.didYouKnow}</span>
                    <p className="text-amber-800 text-sm md:text-base leading-snug font-medium italic">{currentPage.educationalFact}</p>
                  </div>
                </div>

                {currentPageIndex === pages.length - 1 && !isGameOver && (
                  <div className="pt-8 space-y-4">
                    <h3 className="text-lg md:text-xl font-bold text-stone-900 leading-tight">{currentPage.question}</h3>
                    <form onSubmit={handleSubmit} className="flex gap-2">
                      <input 
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder={t.nextAction}
                        className="flex-1 border-2 border-stone-200 rounded-xl px-5 py-3 focus:border-amber-700 focus:ring-4 focus:ring-amber-100 outline-none bg-white transition-all shadow-inner text-base"
                        disabled={isLoading}
                      />
                      <button 
                        type="submit"
                        disabled={isLoading || !userInput.trim()}
                        className={`bg-amber-800 text-white px-7 rounded-2xl hover:bg-amber-900 disabled:bg-stone-400 ${t.dir === 'rtl' ? '' : 'rotate-180'} transition-all shadow-lg flex items-center justify-center shrink-0 active:scale-95`}
                      >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                      </button>
                    </form>
                  </div>
                )}

                {isGameOver && currentPageIndex === pages.length - 1 && (
                  <div className="py-10 text-center bg-amber-50/50 rounded-3xl border-2 border-amber-200 shadow-xl backdrop-blur-sm mt-8 animate-in zoom-in-95 duration-500">
                    <Trophy className="w-14 h-14 text-amber-600 mx-auto mb-3" />
                    <h2 className="text-3xl font-bold text-amber-900 mb-2">{t.theEnd}</h2>
                    <p className="mb-8 text-stone-700 px-6 text-base font-medium">{t.endMessage}</p>
                    <button onClick={() => window.location.reload()} className="bg-amber-700 text-white px-12 py-3 rounded-full font-bold hover:bg-amber-800 transition-all shadow-lg active:scale-95">
                      {t.restart}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-stone-400">
                {error ? (
                    <div className="text-center text-red-600 p-8 bg-red-50 rounded-3xl border border-red-100 shadow-sm max-w-sm">
                        <AlertCircle className="w-14 h-14 mx-auto mb-4" />
                        <p className="font-bold mb-6 text-sm leading-relaxed">{error}</p>
                        <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-8 py-3 rounded-xl text-xs font-bold shadow-md hover:bg-red-700 transition-colors uppercase tracking-widest">{t.restart}</button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 opacity-10">
                        <Loader2 className="w-12 h-12 animate-spin text-amber-200" />
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-7xl w-full mx-auto flex flex-wrap justify-between items-center gap-x-4 gap-y-1 text-[10px] md:text-xs text-stone-400 shrink-0 px-2 pb-1">
        <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 opacity-70"><Sparkles className="w-3 h-3 text-amber-500" /> Story Engine v2.0</span>
            <button onClick={() => window.location.reload()} className="flex items-center gap-1 hover:text-amber-700 transition-colors bg-stone-200/50 px-2 py-0.5 rounded">
              <Settings2 className="w-3 h-3" />
              <span>{t.restart}</span>
            </button>
        </div>
        {endingGoal && isStarted && (
           <div className="flex items-center gap-2 bg-amber-100/40 px-3 py-1 rounded-full italic truncate border border-amber-200/50 max-w-[50%]">
             <Target className="w-3 h-3 text-amber-600 shrink-0" />
             <span className="text-stone-600 font-medium truncate leading-none">Goal: {endingGoal}</span>
           </div>
        )}
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;700;800&family=Amiri:wght@400;700&family=Inter:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Assistant', sans-serif; background-color: #fcfcfc; overflow: hidden; }
        .font-serif { font-family: 'Amiri', serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e5e5; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d6d3d1; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        
        @media (max-width: 768px) {
          body { overflow: auto; }
          .h-screen { height: auto; min-height: 100vh; }
        }
      `}</style>
    </div>
  );
};

export default App;
