// The prompt libraries first listed on the Prompts tab (from "Master AI Prompt Library Directory", 19 Nov 2026).
// repo = open-source GitHub repo whose prompts were copied into the finder.
export const PROMPT_LIB_SEED: any[] = [
 {
  "id": "p1",
  "sec": "general",
  "kind": "official",
  "title": "OpenAI Academy & Examples",
  "summary": "Prompt packs by job role (marketing, sales, finance, ops), plus examples for structured JSON output and agent workflows.",
  "license": "Free",
  "format": "Website",
  "how": "Click a prompt card: it opens the exact system and user prompt next to a sample answer.",
  "links": [
   [
    "OpenAI Academy",
    "https://academy.openai.com/public/clubs/work-users-ynjqu/resources/chatgpt-for-any-role"
   ],
   [
    "OpenAI examples",
    "https://platform.openai.com/docs/examples"
   ]
  ],
  "bestFor": "Everyday office work by role (marketing, sales, finance, ops), plus examples of getting structured JSON answers."
 },
 {
  "id": "p2",
  "sec": "general",
  "kind": "official",
  "title": "Anthropic Prompt Library",
  "summary": "Claude prompts for writing, summarizing, spreadsheets, pulling data out of text and sorting it into categories.",
  "license": "Free",
  "format": "Website",
  "how": "Filter by category, click a card, and read the prompt with an example answer under it.",
  "links": [
   [
    "Anthropic docs",
    "https://docs.anthropic.com/en/resources/prompt-library/library"
   ]
  ],
  "bestFor": "Polished Claude prompts for writing, summarizing and pulling data out of text; good templates to learn from."
 },
 {
  "id": "p3",
  "sec": "general",
  "kind": "open",
  "title": "prompts.chat (Awesome ChatGPT Prompts)",
  "summary": "Hundreds of \"act as…\" role prompts: strategist, financial analyst, editor, recruiter, code reviewer and more.",
  "license": "CC0 (public domain)",
  "format": "Website + GitHub + MCP server",
  "how": "Type a role in the search bar; each card shows the full prompt with a one-click copy button.",
  "links": [
   [
    "prompts.chat",
    "https://prompts.chat"
   ],
   [
    "GitHub",
    "https://github.com/f/prompts.chat"
   ]
  ],
  "repo": "https://github.com/f/prompts.chat",
  "bestFor": "Turning the AI into any expert (\"act as…\"): 3,000+ role prompts across business, writing, coding and images."
 },
 {
  "id": "p4",
  "sec": "general",
  "kind": "open",
  "title": "Fabric Patterns",
  "summary": "Small single-job prompts (\"patterns\") like extract_wisdom, analyze_claims and create_threat_model. Run them from the command line or copy them.",
  "license": "MIT",
  "format": "GitHub + command-line tool",
  "how": "Open any pattern folder on GitHub (e.g. extract_wisdom) and read system.md for the exact rules and output format.",
  "links": [
   [
    "GitHub patterns",
    "https://github.com/danielmiessler/fabric/tree/main/data/patterns"
   ]
  ],
  "repo": "https://github.com/danielmiessler/fabric",
  "bestFor": "Repeatable one-job tasks: summarize a talk, extract key ideas, check claims, threat-model. About 270 sharp patterns."
 },
 {
  "id": "p5",
  "sec": "general",
  "kind": "open",
  "title": "awesome-claude-prompts",
  "summary": "Claude-focused prompts for business strategy, copywriting and coding setups, all in one long README.",
  "license": "Open source",
  "format": "GitHub",
  "how": "Scroll the README or use Ctrl/Cmd+F to jump to a topic; prompts are shown inline.",
  "links": [
   [
    "GitHub",
    "https://github.com/langgptai/awesome-claude-prompts"
   ]
  ],
  "repo": "https://github.com/langgptai/awesome-claude-prompts",
  "bestFor": "Claude-specific prompts: marketing copy, emails, decision-making, plus Claude Code and system-prompt examples."
 },
 {
  "id": "p6",
  "sec": "business",
  "kind": "official",
  "title": "Microsoft Copilot Prompt Gallery",
  "summary": "Prompts for summarizing meetings, drafting proposals, analyzing data and managing your schedule.",
  "license": "Free",
  "format": "Website",
  "how": "Filter by role or app (Word, Excel, Teams) and click a tile to see how the prompt is built.",
  "links": [
   [
    "Copilot prompts",
    "https://copilot.cloud.microsoft/en-US/prompts"
   ]
  ],
  "bestFor": "Microsoft 365 work: meeting recaps, proposals, Excel analysis and scheduling in Word, Excel and Teams."
 },
 {
  "id": "p7",
  "sec": "business",
  "kind": "free",
  "title": "ClickUp AI Prompt Templates",
  "summary": "Fill-in-the-blank prompts for project plans, product roadmaps, blog outlines, brand voice and finance summaries.",
  "license": "Free",
  "format": "Blog guide",
  "how": "Use the table of contents on the left to jump to a department, then copy a prompt box.",
  "links": [
   [
    "ClickUp blog",
    "https://clickup.com/blog/ai-prompt-workflow-templates/"
   ]
  ],
  "bestFor": "Fill-in-the-blank templates for project plans, roadmaps, blog outlines and brand voice."
 },
 {
  "id": "p8",
  "sec": "business",
  "kind": "free",
  "title": "Orbit Media B2B Marketing Prompts",
  "summary": "Marketing prompts for thought-leadership articles, case studies, webinar scripts and email sequences.",
  "license": "Free",
  "format": "Blog guide",
  "how": "Scroll the guide: each prompt has a screenshot of a real AI answer and tips for follow-up prompts.",
  "links": [
   [
    "Orbit Media",
    "https://www.orbitmedia.com/blog/ai-marketing-prompts/"
   ]
  ],
  "bestFor": "B2B content marketing: articles, case studies, webinar scripts and email sequences, with real output examples."
 },
 {
  "id": "p9",
  "sec": "business",
  "kind": "free",
  "title": "Momentum Revenue Prompts",
  "summary": "Sales prompts for handling objections, cold outreach, competitive positioning and preparing discovery calls.",
  "license": "Free",
  "format": "Website",
  "how": "Browse by sales stage and open a template to see its fill-in fields and a sample message.",
  "links": [
   [
    "Momentum",
    "https://www.momentum.io/resources/ai-prompts"
   ]
  ],
  "bestFor": "Sales reps: cold outreach, objection handling, discovery-call prep and competitive positioning."
 },
 {
  "id": "p10",
  "sec": "coding",
  "kind": "community",
  "title": "cursor.directory",
  "summary": "Ready rule files (.cursorrules), MCPs and system prompts for Cursor and Windsurf, sorted by tech stack (Next.js, Python, React…).",
  "license": "Free",
  "format": "Website",
  "how": "Click a framework tag on the left (e.g. Python) to read the full rule file and copy it.",
  "links": [
   [
    "cursor.directory",
    "https://cursor.directory"
   ]
  ],
  "bestFor": "Setting up AI coding tools: ready rule files per tech stack (Next.js, Python, React) for Cursor and Windsurf."
 },
 {
  "id": "p11",
  "sec": "coding",
  "kind": "official",
  "title": "Anthropic Prompt Engineering Tutorial",
  "summary": "A hands-on course in 9 chapters that teaches how to structure prompts and handle tricky cases, with exercises.",
  "license": "Open source",
  "format": "GitHub + Google Sheets",
  "how": "Open any numbered chapter (01 to 09) to see bad vs. good prompts side by side.",
  "links": [
   [
    "GitHub",
    "https://github.com/anthropics/prompt-eng-interactive-tutorial"
   ]
  ],
  "bestFor": "Learning prompt engineering hands-on: 9 chapters of exercises with bad vs. good prompt examples."
 },
 {
  "id": "p12",
  "sec": "coding",
  "kind": "free",
  "title": "PromptDen",
  "summary": "Prompts for software engineering, DevOps, full-stack architecture and debugging.",
  "license": "Free",
  "format": "Website",
  "how": "Pick a tech-stack filter at the top and click a card to see the prompt with sample code.",
  "links": [
   [
    "PromptDen",
    "https://promptden.com"
   ]
  ],
  "bestFor": "Developer tasks: debugging, architecture and DevOps, with prompts shown next to sample code."
 },
 {
  "id": "p13",
  "sec": "design",
  "kind": "open",
  "title": "SlideSpeak Slide Design Prompts",
  "summary": "120+ slide styles for decks (consulting, finance, strategy, education), each with colors, fonts and a ready prompt.",
  "license": "Open source (PROMPT.md)",
  "format": "Visual gallery + GitHub",
  "how": "Scroll the slide thumbnails and click a style to see its hex colors, fonts and PROMPT.md.",
  "links": [
   [
    "Gallery",
    "https://slidespeak.co/slide-design-prompts"
   ],
   [
    "GitHub",
    "https://github.com/SlideSpeak/presentation-design-prompts"
   ]
  ],
  "repo": "https://github.com/SlideSpeak/presentation-design-prompts",
  "bestFor": "Making decks look designed: 120+ slide styles (pitch, consulting, finance) with colors, fonts and a ready prompt."
 },
 {
  "id": "p14",
  "sec": "design",
  "kind": "open",
  "title": "OpenDesign",
  "summary": "150+ open design systems for slides, websites, graphics and app screens, with live previews and export to HTML, PDF or PPTX.",
  "license": "Apache-2.0",
  "format": "Visual gallery",
  "how": "Open the Gallery tab to see live renders, then click Inspect/Export to grab the spec.",
  "links": [
   [
    "open-design.ai",
    "https://open-design.ai/"
   ]
  ],
  "bestFor": "Starting a deck, website or app screen from a ready design system, previewed live and exportable."
 },
 {
  "id": "p15",
  "sec": "design",
  "kind": "free",
  "title": "Superdesign Prompt Library",
  "summary": "5,000+ website and UI styles (landing pages, dashboards, components) with live previews and layout rules.",
  "license": "Free",
  "format": "Visual gallery",
  "how": "Filter the thumbnail feed by look (Bento, Minimal…) and click a card to try the live preview and copy the prompt.",
  "links": [
   [
    "Superdesign",
    "https://superdesign.dev/library"
   ]
  ],
  "bestFor": "Picking a website or UI look fast: thousands of styles (bento, minimal, editorial) with live previews."
 },
 {
  "id": "p16",
  "sec": "design",
  "kind": "open",
  "title": "awesome-design-md (VoltAgent)",
  "summary": "The look of famous brands (Stripe, Linear, Apple…) written as DESIGN.md files you can drop into an AI coding tool.",
  "license": "Open source (DESIGN.md)",
  "format": "GitHub",
  "how": "Open a brand folder (e.g. stripe) to see color swatches, font tables and layout rules.",
  "links": [
   [
    "GitHub",
    "https://github.com/voltagent/awesome-design-md"
   ]
  ],
  "repo": "https://github.com/VoltAgent/awesome-design-md",
  "bestFor": "Making your site look like a famous brand (Stripe, Linear, Apple…): drop-in DESIGN.md files for AI coding tools."
 },
 {
  "id": "p17",
  "sec": "design",
  "kind": "open",
  "title": "awesome-design-skills (TypeUI)",
  "summary": "67 visual styles for websites and apps (glassmorphism, editorial, corporate…), each as DESIGN.md and SKILL.md files.",
  "license": "MIT",
  "format": "GitHub",
  "how": "Open a style folder (e.g. editorial) to see preview screenshots next to its DESIGN.md.",
  "links": [
   [
    "GitHub",
    "https://github.com/bergside/awesome-design-skills"
   ]
  ],
  "repo": "https://github.com/bergside/awesome-design-skills",
  "bestFor": "Giving AI-built apps a distinct look: 67 visual styles (glassmorphism, editorial, corporate) as design files."
 },
 {
  "id": "p18",
  "sec": "images",
  "kind": "community",
  "title": "YouMind Visual Prompt Library",
  "summary": "A huge picture feed (slides, websites, logos, posters, product shots) where each image comes with its exact prompt.",
  "license": "Free",
  "format": "Visual gallery",
  "how": "Scroll the Pinterest-style grid, filter by tag, and click an image to see its prompt.",
  "links": [
   [
    "YouMind",
    "https://youmind.com/prompts/image"
   ]
  ],
  "bestFor": "Image inspiration with the exact prompt behind each picture: posters, logos, product shots, slides."
 },
 {
  "id": "p19",
  "sec": "images",
  "kind": "free",
  "title": "GeneratePrompt Image Library",
  "summary": "Image prompts for logos, branding, product renders, packaging, ads and UI mockups.",
  "license": "Free",
  "format": "Visual gallery",
  "how": "Pick a category chip (e.g. Logos) to see the images with copyable prompts under them.",
  "links": [
   [
    "GeneratePrompt",
    "https://generateprompt.net/image-prompts"
   ]
  ],
  "bestFor": "Brand visuals: logos, packaging, product renders, ads and UI mockups, each with a copyable prompt."
 },
 {
  "id": "p20",
  "sec": "images",
  "kind": "free",
  "title": "MoodNode Prompt Library",
  "summary": "Strong on industrial design: exploded product views, studio product photos and concept renders.",
  "license": "Free",
  "format": "Visual gallery",
  "how": "Hover or click a render to see its camera, lighting and material settings.",
  "links": [
   [
    "MoodNode",
    "https://moodnode.ai/tools/prompt-library"
   ]
  ],
  "bestFor": "Product and industrial-design renders: studio shots, exploded views, materials and lighting settings."
 },
 {
  "id": "p21",
  "sec": "images",
  "kind": "community",
  "title": "The Prompt Index (Image DB)",
  "summary": "A searchable database of 500+ image prompts for logos, 3D branding and eBook covers, shown next to their results.",
  "license": "Free",
  "format": "Searchable database",
  "how": "Search a phrase like \"minimalist logo\" to see images and prompts side by side.",
  "links": [
   [
    "The Prompt Index",
    "https://www.thepromptindex.com/image-database.php"
   ]
  ],
  "bestFor": "Searching 500+ image prompts by keyword, e.g. minimalist logo, 3D mockup, eBook cover."
 },
 {
  "id": "p22",
  "sec": "images",
  "kind": "free",
  "title": "Founderz Product Design Generator",
  "summary": "A prompt builder plus 24 templates for product and packaging renders: materials, finish, scale and studio lighting.",
  "license": "Free",
  "format": "Interactive tool + guide",
  "how": "Scroll to the numbered template cards: each shows a sample render and the prompt formula.",
  "links": [
   [
    "Founderz",
    "https://founderz.com/blog/ai-prompts-product-design/"
   ]
  ],
  "bestFor": "Physical product and packaging renders: 24 templates for materials, finish, scale and lighting."
 },
 {
  "id": "p23",
  "sec": "patterns",
  "kind": "academic",
  "title": "Stress-test an idea",
  "summary": "Pre-mortems, red-teaming, devil’s advocate, first-principles breakdowns and weighted decision tables.",
  "license": "Free / MIT",
  "format": "Website + GitHub",
  "sources": "Wharton Interactive (More Useful Things), Fabric",
  "how": "On the Wharton site, click a title (e.g. Pre-Mortem) to see the full multi-step script and usage notes.",
  "links": [
   [
    "More Useful Things (Wharton)",
    "https://www.moreusefulthings.com/prompts"
   ],
   [
    "Fabric patterns",
    "https://github.com/danielmiessler/fabric/tree/main/data/patterns"
   ]
  ],
  "bestFor": "Pressure-testing a plan or decision: pre-mortems, devil's advocate, red-teaming and decision matrices."
 },
 {
  "id": "p24",
  "sec": "patterns",
  "kind": "official",
  "title": "Pull out what matters",
  "summary": "Turn noise into signal: transcripts into action items, messy text into JSON/CSV, and text rewritten for a different audience.",
  "license": "Free / MIT",
  "format": "GitHub + website",
  "sources": "Fabric, Anthropic Prompt Library",
  "how": "Open any extract_* or analyze_* folder in Fabric, or filter Anthropic’s library by Data Extraction.",
  "links": [
   [
    "Fabric patterns",
    "https://github.com/danielmiessler/fabric/tree/main/data/patterns"
   ],
   [
    "Anthropic library",
    "https://docs.anthropic.com/en/resources/prompt-library/library"
   ]
  ],
  "bestFor": "Turning messy input into something usable: transcripts to action items, text to tables or JSON, re-tone for an audience."
 },
 {
  "id": "p25",
  "sec": "patterns",
  "kind": "academic",
  "title": "Let the AI interview you",
  "summary": "The AI asks you one question at a time: to write a PRD, prep for a case interview, tutor you or practice a negotiation.",
  "license": "Free",
  "format": "Website",
  "sources": "Wharton coach & tutor prompts, Kipt",
  "how": "Copy a tested loop from Wharton’s Tutor/Coach section, or use Kipt’s cards with [BRACKETED] fields to fill in.",
  "links": [
   [
    "More Useful Things (Wharton)",
    "https://www.moreusefulthings.com/prompts"
   ],
   [
    "Kipt",
    "https://kipt.ai"
   ]
  ],
  "bestFor": "When you don't know what to ask: the AI interviews you to build a PRD, tutor you or rehearse a negotiation."
 },
 {
  "id": "p26",
  "sec": "patterns",
  "kind": "open",
  "title": "Grade and improve work",
  "summary": "1–5 scoring rubrics, \"no fluff\" ruthless editors, edge-case checkers and loops where the AI critiques its own answer.",
  "license": "MIT / Apache-2.0",
  "format": "Docs + GitHub",
  "sources": "Promptfoo, Fabric rate_content",
  "how": "Copy a grading rubric from Promptfoo’s docs, or read Fabric’s rate_content/system.md for a ready scorer.",
  "links": [
   [
    "Promptfoo docs",
    "https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/"
   ],
   [
    "Fabric rate_content",
    "https://github.com/danielmiessler/fabric/tree/main/data/patterns/rate_content"
   ]
  ],
  "bestFor": "Quality control: scoring rubrics, ruthless editors and self-critique loops to improve a draft."
 },
 {
  "id": "p27",
  "sec": "patterns",
  "kind": "open",
  "title": "Set a style and voice",
  "summary": "Write-like-me voice profiles, rules against generic \"AI-sounding\" text, consulting memo skeletons and visual design tokens.",
  "license": "Free / open source",
  "format": "GitHub + browser tool",
  "sources": "awesome-design-md, Savozi",
  "how": "Open a brand folder in awesome-design-md, or use Savozi in the browser to look at style and voice templates.",
  "links": [
   [
    "awesome-design-md",
    "https://github.com/voltagent/awesome-design-md"
   ],
   [
    "Savozi",
    "https://savozi.com"
   ]
  ],
  "bestFor": "Keeping output on-brand: voice profiles, rules against AI-sounding text, memo skeletons and design tokens."
 },
 {
  "id": "p28",
  "sec": "patterns",
  "kind": "official",
  "title": "Prompts that write prompts",
  "summary": "Meta-prompts that turn one sentence into a full structured prompt, plus real system prompts from tools like Claude Code, Cursor and v0.",
  "license": "Free / open source",
  "format": "GitHub + docs",
  "sources": "System Prompts of AI Tools (GitHub), Anthropic prompt generator",
  "how": "Open a tool folder (e.g. Cursor) in the GitHub repo to read its real system prompt, or copy Anthropic’s prompt generator.",
  "links": [
   [
    "System prompts of AI tools",
    "https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools"
   ],
   [
    "Anthropic prompt generator",
    "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-generator"
   ]
  ],
  "bestFor": "Writing better prompts: turn one sentence into a full structured prompt, and study real system prompts of top AI tools."
 }
];

// "Best for" lines, also used to fill cards created before this field existed.
export const BEST_FOR: Record<string, string> = {"p1": "Everyday office work by role (marketing, sales, finance, ops), plus examples of getting structured JSON answers.", "p2": "Polished Claude prompts for writing, summarizing and pulling data out of text; good templates to learn from.", "p3": "Turning the AI into any expert (\"act as…\"): 3,000+ role prompts across business, writing, coding and images.", "p4": "Repeatable one-job tasks: summarize a talk, extract key ideas, check claims, threat-model. About 270 sharp patterns.", "p5": "Claude-specific prompts: marketing copy, emails, decision-making, plus Claude Code and system-prompt examples.", "p6": "Microsoft 365 work: meeting recaps, proposals, Excel analysis and scheduling in Word, Excel and Teams.", "p7": "Fill-in-the-blank templates for project plans, roadmaps, blog outlines and brand voice.", "p8": "B2B content marketing: articles, case studies, webinar scripts and email sequences, with real output examples.", "p9": "Sales reps: cold outreach, objection handling, discovery-call prep and competitive positioning.", "p10": "Setting up AI coding tools: ready rule files per tech stack (Next.js, Python, React) for Cursor and Windsurf.", "p11": "Learning prompt engineering hands-on: 9 chapters of exercises with bad vs. good prompt examples.", "p12": "Developer tasks: debugging, architecture and DevOps, with prompts shown next to sample code.", "p13": "Making decks look designed: 120+ slide styles (pitch, consulting, finance) with colors, fonts and a ready prompt.", "p14": "Starting a deck, website or app screen from a ready design system, previewed live and exportable.", "p15": "Picking a website or UI look fast: thousands of styles (bento, minimal, editorial) with live previews.", "p16": "Making your site look like a famous brand (Stripe, Linear, Apple…): drop-in DESIGN.md files for AI coding tools.", "p17": "Giving AI-built apps a distinct look: 67 visual styles (glassmorphism, editorial, corporate) as design files.", "p18": "Image inspiration with the exact prompt behind each picture: posters, logos, product shots, slides.", "p19": "Brand visuals: logos, packaging, product renders, ads and UI mockups, each with a copyable prompt.", "p20": "Product and industrial-design renders: studio shots, exploded views, materials and lighting settings.", "p21": "Searching 500+ image prompts by keyword, e.g. minimalist logo, 3D mockup, eBook cover.", "p22": "Physical product and packaging renders: 24 templates for materials, finish, scale and lighting.", "p23": "Pressure-testing a plan or decision: pre-mortems, devil's advocate, red-teaming and decision matrices.", "p24": "Turning messy input into something usable: transcripts to action items, text to tables or JSON, re-tone for an audience.", "p25": "When you don't know what to ask: the AI interviews you to build a PRD, tutor you or rehearse a negotiation.", "p26": "Quality control: scoring rubrics, ruthless editors and self-critique loops to improve a draft.", "p27": "Keeping output on-brand: voice profiles, rules against AI-sounding text, memo skeletons and design tokens.", "p28": "Writing better prompts: turn one sentence into a full structured prompt, and study real system prompts of top AI tools."};

// One-time additions: prompts already saved on the Tools tab, copied to the Prompts tab (20 Nov 2026).
// Applied once on page load; a card is skipped if its main link is already on the Prompts tab.
export const PROMPT_LIB_ADDITIONS_VERSION = "20 Nov 2026 tools-to-prompts";
export const PROMPT_LIB_ADDITIONS: any[] = [
  { fromTool: 150, title: "Lyra Prompt (AI Prompt Generator & Directory)", sec: "patterns", kind: "free", license: "Free", format: "Website",
    summary: "Prompt optimizer that uses a four-step method to turn vague requests into precise, effective prompts, plus a directory of prompts.",
    bestFor: "Turning a vague request into a sharp prompt with Lyra's 4-step method, or browsing ready prompts.",
    how: "Describe what you want and let Lyra rewrite it into a precise prompt, or browse its prompt directory.",
    links: [["Lyra Prompt", "https://lyraprompt.com/"]] },
  { fromTool: 128, title: "320 ChatGPT image shortcuts (320 פקודות תמונה ל־ChatGPT)", sec: "images", kind: "community", license: "Free", format: "Website (Hebrew)",
    summary: "Hebrew catalog of 320 copyable ChatGPT image-prompt shortcuts across 12 visual style families.",
    bestFor: "Fast ChatGPT image styles: 320 copy-ready shortcuts in 12 visual style families (Hebrew).",
    how: "Pick one of the 12 style families and copy a shortcut into ChatGPT's image generation.",
    links: [["Guide", "https://chatgpt-image-slash-guide.royecr.chatgpt.site/"]] },
  { fromTool: 196, title: "3D Style Atlas (Futurepedia)", sec: "design", kind: "free", license: "Free", format: "Visual gallery",
    summary: "Atlas of 37 three.js looks for 3D animated explainers, each with a copy-prompt button to rebuild it in Claude on your own topic.",
    bestFor: "3D animated explainers: 37 looks, each with a copy-prompt button to recreate it in Claude on your topic.",
    how: "Browse the 37 styles and use a style's copy-prompt button, then paste it into Claude with your topic.",
    links: [["Futurepedia", "https://www.futurepedia.io/resources/3d-style-atlas/view"]] },
  { fromTool: 36, title: "10 NotebookLM prompts (10 פרומפטים ל־NotebookLM)", sec: "general", kind: "community", license: "Free", format: "Article (Hebrew)",
    summary: "Ten copy-paste Hebrew prompts for getting more from Google's NotebookLM, with tips on sources and citations.",
    bestFor: "Getting more out of NotebookLM: 10 copy-paste prompts with tips on sources and citations (Hebrew).",
    how: "Scroll the article: each prompt is shown ready to copy, with a short tip.",
    links: [["eilon.co", "https://eilon.co/10-%d7%a4%d7%a8%d7%95%d7%9e%d7%a4%d7%98%d7%99%d7%9d-%d7%9c-notebooklm-%d7%a9%d7%a9%d7%99%d7%a0%d7%95/"]] },
  { fromTool: 17, title: "Lovable Israel prompts (פרומפטים | Lovable Israel)", sec: "coding", kind: "community", license: "Free", format: "Website (Hebrew)",
    summary: "Hebrew collection of ready-made prompts for building apps with Lovable, including a detailed accessibility-toolbar prompt.",
    bestFor: "Building apps in Lovable: ready-made prompts, including a detailed accessibility-toolbar prompt (Hebrew).",
    how: "Open the prompts page and copy a ready prompt into Lovable.",
    links: [["Lovable Israel", "https://lovable-ai.co.il/prompts"]] },
  { fromTool: 63, title: "Gemini stock analysis prompts", sec: "business", kind: "community", license: "Free", format: "Facebook post",
    summary: "Ten Gemini prompts for analysing a stock like a Wall Street analyst, as a free alternative to expensive terminals.",
    bestFor: "Analyzing a stock like an analyst with Gemini: 10 ready prompts.",
    how: "Open the post to read the 10 prompts (Facebook may ask you to sign in).",
    links: [["Facebook post", "https://facebook.com/61571991616735/posts/pfbid02g9Fk5iWkhucB8v5ptETFfBJRtUZkcx6rkvDTzmzV27FTYMTaGLetYksFx1QixWbtl/"]] },
  { fromTool: 2, title: "Claude anti-sycophancy prompt", sec: "patterns", kind: "community", license: "Free", format: "Facebook post (Hebrew)",
    summary: "A Claude settings prompt telling it to contradict you instead of flattering you, turning it into a genuine sparring partner.",
    bestFor: "Making Claude a real sparring partner: a settings prompt that tells it to push back instead of flatter.",
    how: "Open the post and paste the prompt into Claude's settings (personal instructions).",
    links: [["Facebook post", "https://facebook.com/100002717045940/posts/pfbid0YbYQht5K5Darmt7KtZASH29yAxQwa1yqo3TC8UdtUQccmLmM4E6eqgijxWmvgbjHl/"]] },
  { fromTool: 85, title: "Claude anti-glazing prompt", sec: "patterns", kind: "community", license: "Free", format: "Facebook reel",
    summary: "Prompt and settings tweak to stop Claude flattering you, making it stress-test ideas and lead with weaknesses instead.",
    bestFor: "Stopping Claude from flattering you: it stress-tests ideas and leads with weaknesses.",
    how: "Watch the reel and copy the prompt into Claude's settings.",
    links: [["Facebook reel", "https://facebook.com/reel/955735520376190/"]] },
  { fromTool: 32, title: "OpenClaw security hardening prompt", sec: "coding", kind: "community", license: "Free", format: "Facebook post (Hebrew)",
    summary: "A hardening prompt for OpenClaw so it refuses to leak sensitive data, resists manipulation, and warns then blocks attackers.",
    bestFor: "Protecting an OpenClaw agent: a system prompt that refuses to leak secrets and resists manipulation.",
    how: "Open the post and add the prompt to your OpenClaw agent's instructions.",
    links: [["Facebook post", "https://facebook.com/100002717045940/posts/pfbid02jwe8ahZx9zBd9HCPAi35agyCPWzwDPH3crgwhuex234QGQceW5WdtZQWH3p6ukvil/"]] },
  { fromTool: 8, title: "Beautiful apps in 3 prompts (Cursor)", sec: "design", kind: "community", license: "Free", format: "YouTube video",
    summary: "Chris Ashby's three-prompt method for creating a reusable design system in Cursor so AI-built apps avoid generic-looking UIs.",
    bestFor: "Making AI-built apps look designed: a 3-prompt method to set up a reusable design system in Cursor.",
    how: "Watch the video; the three prompts are shown as he builds.",
    links: [["YouTube", "https://www.youtube.com/watch?v=Be5IAxyxa6g"]] },
];
