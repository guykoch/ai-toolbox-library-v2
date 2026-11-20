// Starter playbooks, written by Claude from items already in the library (20 Nov 2026).
// Each step points at library items: ["t", toolId] (Tools tab), ["l", "pN"] (Prompts tab library),
// ["c", "card title"] (Rules / Agents / Automations card).
export const PLAYBOOK_SEED_VERSION = "abc-1 20 Nov 2026";

export const PB_TYPES = ["create", "research", "learn", "career", "build", "money", "automate", "media"] as const;

type Ref = ["t", number] | ["l", string] | ["c", string];
type SeedStep = { title: string; do: string; use?: Ref[]; prompt?: string; tip?: string };
export type SeedPlaybook = { title: string; goal: string; type: string; topics: string[]; time: string; steps: SeedStep[] };

export const PLAYBOOK_SEED: SeedPlaybook[] = [
  {
    title: "Write a PRD", type: "create", topics: ["Product management"], time: "1–2 hours",
    goal: "Go from a rough product idea to a clear, reviewed product requirements document.",
    steps: [
      { title: "Let the AI interview you", do: "Instead of writing from a blank page, have the AI ask you questions about the problem, users, goals and limits, one at a time.", use: [["l", "p25"]],
        prompt: "I want to write a PRD for [product idea]. Interview me one question at a time about the problem, target users, goals, success metrics, scope and constraints. After 8–10 questions, summarize what you learned." },
      { title: "Research the market", do: "Collect competitor pages and articles in NotebookLM and ask it what others do and where the gaps are.", use: [["t", 3]] },
      { title: "Draft the PRD", do: "Set up a Claude Project with your interview notes and research, then ask for the PRD. Or use the PM system built for Claude Code.", use: [["c", "Claude Projects"], ["t", 88]],
        prompt: "Using the notes in this project, write a PRD with: problem, users, goals and non-goals, user stories, requirements (must/should/could), success metrics, risks and open questions. Keep it under 3 pages." },
      { title: "Stress-test it", do: "Ask for a pre-mortem and the hardest questions a skeptical engineer or exec would ask. Turn on the anti-sycophancy prompt so it doesn't just praise you.", use: [["l", "p23"], ["l", "p42"]] },
      { title: "Polish the writing", do: "Apply your voice and remove AI-sounding phrases before sharing.", use: [["l", "p27"], ["t", 59]] },
    ],
  },
  {
    title: "Build a pitch deck", type: "create", topics: ["Startups", "Slides"], time: "2–3 hours",
    goal: "A designed investor deck with a tight story, built with AI.",
    steps: [
      { title: "Check the idea first", do: "Run the idea through a validator to spot weak points before you design anything.", use: [["t", 102], ["t", 64]] },
      { title: "Write the story", do: "Get a 10–12 slide outline: problem, solution, why now, market, product, traction, business model, competition, team, ask.",
        prompt: "Write a 12-slide investor pitch outline for [company, one line]. For each slide give a headline (max 8 words), 3 bullet points and the one number that proves it. Audience: seed-stage VCs." },
      { title: "Pick a look", do: "Choose a slide style (pitch, consulting, editorial…) and copy its design prompt.", use: [["l", "p13"], ["l", "p34"]] },
      { title: "Generate the slides", do: "Build the deck from the outline plus the style prompt.", use: [["t", 90], ["t", 92], ["t", 99]] },
      { title: "Prepare for questions", do: "Have the AI play a tough investor and red-team the deck.", use: [["l", "p23"], ["l", "p43"]] },
    ],
  },
  {
    title: "Prepare for a PM interview", type: "career", topics: ["Product management", "Interviews"], time: "2–4 hours",
    goal: "Walk into a product-manager interview with company research, practiced answers and feedback.",
    steps: [
      { title: "Research the company", do: "Put the company's site, recent news and product reviews into NotebookLM; ask for their strategy, metrics and likely problems.", use: [["t", 3], ["t", 5]] },
      { title: "Mock interview", do: "Have the AI interview you with product-sense, execution and behavioral questions, one at a time.", use: [["l", "p25"], ["l", "p3"]],
        prompt: "Act as a senior PM interviewer at [company]. Ask me one question at a time: 2 product-sense, 2 execution/metrics, 2 behavioral. After each answer, score it 1–5 and tell me what a strong answer would add." },
      { title: "Record and review", do: "Answer out loud, transcribe it, then have your answers graded with a rubric.", use: [["t", 247], ["l", "p26"]] },
      { title: "Explore the role", do: "See related roles and skills to talk about your growth path.", use: [["t", 10]] },
    ],
  },
  {
    title: "Research a company", type: "research", topics: ["Business research"], time: "1 hour",
    goal: "A one-page brief on a company: what it does, how it makes money, competitors and risks.",
    steps: [
      { title: "Collect the sources", do: "Grab the company's site and key pages as clean text.", use: [["t", 157], ["t", 105], ["t", 258]] },
      { title: "Deep research", do: "Load the sources into NotebookLM and run a deep-research pass with follow-up questions.", use: [["t", 3]] },
      { title: "Pull out what matters", do: "Turn the notes into a structured brief: business model, customers, numbers, competitors, risks.", use: [["l", "p24"], ["l", "p4"]],
        prompt: "From these notes, write a one-page company brief: what they sell, to whom, how they make money, key numbers (with sources), top 3 competitors, 3 risks, and 3 open questions." },
      { title: "Challenge the conclusions", do: "Ask what you might be wrong about and what evidence would change your view.", use: [["l", "p23"], ["l", "p42"]] },
    ],
  },
  {
    title: "Turn a lecture or video into study notes", type: "learn", topics: ["Studying", "NotebookLM"], time: "30 min",
    goal: "Clear notes, key ideas and a self-quiz from a lecture, talk or YouTube video.",
    steps: [
      { title: "Get the transcript in", do: "Send a YouTube video straight into NotebookLM, or transcribe a recording locally.", use: [["t", 29], ["t", 221]] },
      { title: "Make the notes", do: "Use ready NotebookLM prompts for summaries, study guides and key terms.", use: [["l", "p39"], ["l", "p24"]] },
      { title: "Quiz yourself", do: "Have a tutor quiz you on the material until you get it right.", use: [["t", 211]],
        prompt: "Quiz me on these notes: one question at a time, mix recall and 'explain why' questions, and re-ask the ones I get wrong at the end." },
    ],
  },
  {
    title: "Ship a small app", type: "build", topics: ["Vibe coding"], time: "1 day",
    goal: "From idea to a working, good-looking small web app built with AI.",
    steps: [
      { title: "Write a short spec", do: "One page: who it's for, the 3 main screens, the data it stores. (The PRD playbook works for bigger ideas.)", use: [["l", "p25"]] },
      { title: "Set the rules", do: "Give your coding tool a rules file with your stack and style so it stays consistent.", use: [["c", "CLAUDE.md (Claude Code memory)"], ["c", "Cursor Rules"], ["c", "Awesome Cursor Rules"]] },
      { title: "Build it", do: "Build in Cursor or Lovable, screen by screen.", use: [["t", 164], ["l", "p40"], ["t", 7]] },
      { title: "Make it look designed", do: "Use the 3-prompt method or a design skill so it doesn't look AI-made.", use: [["t", 8], ["t", 198], ["t", 155]] },
      { title: "Pick a database", do: "Choose a simple database that AI tools handle well.", use: [["t", 108]] },
    ],
  },
  {
    title: "Make a product demo video", type: "media", topics: ["Video", "Marketing"], time: "2 hours",
    goal: "A short demo video with screen recording, edits, voice-over and music.",
    steps: [
      { title: "Record the screen", do: "Record a walkthrough of the product.", use: [["t", 245]] },
      { title: "Or generate an explainer", do: "Have a coding agent turn your website into an explainer video, or pick a 3D explainer style.", use: [["t", 58], ["t", 196], ["t", 222]] },
      { title: "Edit", do: "Cut, add captions and zooms.", use: [["t", 255], ["t", 138]] },
      { title: "Add voice and music", do: "Generate a voice-over and a short background track.", use: [["t", 241], ["t", 233]] },
    ],
  },
  {
    title: "Analyze a stock", type: "money", topics: ["Stocks", "Investing"], time: "1 hour",
    goal: "A structured, skeptical look at one stock before you decide anything.",
    steps: [
      { title: "Run the analyst prompts", do: "Use the ready Gemini prompts for business quality, valuation, risks and competition.", use: [["t", 63], ["l", "p41"]] },
      { title: "Read the filings", do: "Put the latest annual report and earnings call into NotebookLM and ask for what changed.", use: [["t", 3]] },
      { title: "Argue the other side", do: "Ask for the strongest bear case and what would prove your thesis wrong. Keep the AI from simply agreeing with you.", use: [["l", "p23"], ["t", 2]],
        prompt: "Here's my thesis on [ticker]: [thesis]. Give me the strongest bear case, the 3 facts that would prove me wrong, and what to watch in the next 2 quarters. Don't be polite." },
    ],
  },
  {
    title: "Landing page that doesn't look AI-made", type: "build", topics: ["Web design"], time: "2–3 hours",
    goal: "A landing page with a real design system, built by a coding agent.",
    steps: [
      { title: "Choose a look", do: "Pick a brand style (DESIGN.md) or a visual style and add it to the project.", use: [["c", "DESIGN.md brand rules (awesome-design-md)"], ["l", "p17"]] },
      { title: "Install design skills", do: "Add skills that push the agent toward good layout and taste.", use: [["t", 144], ["t", 198], ["t", 155], ["t", 197]] },
      { title: "Build and polish", do: "Generate the page, then run a pass that fixes generic, AI-looking UI.", use: [["t", 223], ["t", 199]] },
    ],
  },
  {
    title: "Meeting notes to action items", type: "create", topics: ["Meetings", "Productivity"], time: "15 min per meeting",
    goal: "Every meeting ends with a clean summary, decisions and owners.",
    steps: [
      { title: "Prepare", do: "Before the meeting, ask NotebookLM about the docs and past notes.", use: [["t", 5]] },
      { title: "Record locally", do: "Use a local, open-source meeting recorder that writes the transcript.", use: [["t", 116], ["t", 103]] },
      { title: "Extract decisions and tasks", do: "Turn the transcript into decisions, action items with owners and dates, and open questions.", use: [["l", "p24"]],
        prompt: "From this transcript, list: 1) decisions made, 2) action items as a table (task, owner, due date), 3) open questions. Quote the transcript when something is unclear." },
    ],
  },
  {
    title: "Learn a new technical skill", type: "learn", topics: ["Self-study", "Coding"], time: "Ongoing",
    goal: "A personal learning path with a roadmap, a tutor and practice.",
    steps: [
      { title: "Get the roadmap", do: "Pick your path and see what to learn in what order.", use: [["t", 236]] },
      { title: "Learn with a tutor", do: "Use an AI tutor that adapts to you, or audio mini-courses for commutes.", use: [["t", 211], ["t", 163]] },
      { title: "Turn a book into a skill", do: "Make the book you're reading into a skill your agent can use while you practice.", use: [["t", 125]] },
      { title: "Build something", do: "Follow a hands-on course and ship a small project.", use: [["t", 225], ["t", 51]] },
    ],
  },
  {
    title: "Job application pack", type: "career", topics: ["Job hunt"], time: "1–2 hours per job",
    goal: "A tailored CV and cover letter for one job, in your own voice.",
    steps: [
      { title: "Set up the job-search system", do: "Use the Claude Code job application framework to keep jobs, CVs and letters organized.", use: [["t", 141]] },
      { title: "Tailor the CV", do: "Match your experience to the job description, keeping it truthful.",
        prompt: "Here's the job description and my CV. Rewrite my bullet points to match the role's top 5 requirements, using only facts from my CV. Flag any requirement I don't meet." },
      { title: "Write in your voice", do: "Write the cover letter with your style profile and remove AI-sounding text.", use: [["l", "p27"], ["t", 59], ["t", 239]] },
      { title: "Grade it", do: "Score the letter as a hiring manager would and fix the weakest part.", use: [["l", "p26"]] },
    ],
  },
  {
    title: "Set up Claude Code for a project", type: "automate", topics: ["Claude Code", "Coding"], time: "1 hour",
    goal: "Claude Code that knows your project, has specialist helpers and follows your rules.",
    steps: [
      { title: "Learn the basics", do: "Watch a short intro if you're new.", use: [["t", 98], ["t", 131]] },
      { title: "Write CLAUDE.md", do: "Run /init, then add your commands, style and don'ts.", use: [["c", "CLAUDE.md (Claude Code memory)"], ["c", "AGENTS.md (the shared standard)"]] },
      { title: "Add subagents", do: "Add a reviewer and a test writer from a collection.", use: [["c", "Claude Code subagents (how they work)"], ["c", "Awesome Claude Code Subagents (VoltAgent)"]] },
      { title: "Add skills and hooks", do: "Install a skills framework and set hooks for checks that must always run.", use: [["t", 23], ["t", 96]] },
    ],
  },
  {
    title: "Automate a weekly chore with n8n", type: "automate", topics: ["Automation", "n8n"], time: "2 hours",
    goal: "A repeated task (reports, emails, sheet updates) that runs by itself.",
    steps: [
      { title: "Learn n8n basics", do: "Watch the first lessons of the beginner course.", use: [["t", 202]] },
      { title: "Install or sign up", do: "Run n8n yourself (open source) or use n8n Cloud.", use: [["t", 249]] },
      { title: "Start from a template", do: "Find a workflow close to your chore and import it.", use: [["c", "n8n workflow templates"], ["c", "Awesome n8n Templates"], ["c", "n8n-workflows (Zie619)"]] },
      { title: "Adapt and schedule", do: "Connect your accounts, change the steps, add a schedule trigger, and test it once by hand.",
        prompt: "Here's my n8n workflow JSON and what I want it to do instead: [goal]. Tell me exactly which nodes to change, add or remove, and the settings for each." },
    ],
  },
  {
    title: "Marketing post in your own voice", type: "create", topics: ["Marketing", "LinkedIn"], time: "30 min",
    goal: "A post that sounds like you, not like AI.",
    steps: [
      { title: "Find the angle", do: "Start from a proven B2B content prompt.", use: [["l", "p8"], ["l", "p9"]] },
      { title: "Set your voice", do: "Give the AI your voice profile and rules against AI-sounding text.", use: [["l", "p27"], ["t", 159]] },
      { title: "De-AI the draft", do: "Run the draft through a humanizer pass.", use: [["t", 59]] },
      { title: "Get honest feedback", do: "Ask for blunt feedback, not compliments.", use: [["l", "p43"], ["l", "p26"]] },
    ],
  },
  {
    title: "Product and brand images", type: "media", topics: ["Images", "Branding"], time: "1 hour",
    goal: "Product shots, packaging and brand visuals from proven prompts.",
    steps: [
      { title: "Find a prompt that matches", do: "Browse galleries that show the exact prompt behind each image.", use: [["l", "p19"], ["l", "p20"], ["l", "p21"]] },
      { title: "Generate", do: "Run it in ChatGPT/Gemini, or in an open model for full control.", use: [["l", "p37"], ["t", 81], ["t", 137]] },
      { title: "Advanced control", do: "For consistent series, build a node workflow.", use: [["t", 220]] },
    ],
  },
  {
    title: "Turn a pile of documents into a brief", type: "research", topics: ["Documents"], time: "45 min",
    goal: "Answers and a summary from many PDFs, Word and PowerPoint files.",
    steps: [
      { title: "Convert to clean text", do: "Turn PDFs and Office files into Markdown that AI reads well.", use: [["t", 172], ["t", 115]] },
      { title: "Ask questions with sources", do: "Load them into NotebookLM and ask questions; every answer cites the file.", use: [["t", 3]] },
      { title: "Write the brief", do: "Summarize into a decision-ready brief.", use: [["l", "p24"]],
        prompt: "Using only these documents, write a one-page brief: the 5 key findings (each with its source file), what's still unclear, and a recommendation." },
    ],
  },
];
