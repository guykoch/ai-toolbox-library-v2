// stub:server
var id = (d) => d;
var query = id;
var mutation = id;
var internalQuery = id;
var internalMutation = id;
var internalAction = id;

// convex/promptLibs.ts
import { v as v2, ConvexError as ConvexError2 } from "convex/values";

// convex/auth.ts
import { ConvexError } from "convex/values";
function checkKey(key) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new ConvexError("ADMIN_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  }
  if (key !== expected) {
    throw new ConvexError("Wrong access key.");
  }
}

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/promptLibSeed.ts
var PROMPT_LIB_SEED = [
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
    "summary": 'Hundreds of "act as\u2026" role prompts: strategist, financial analyst, editor, recruiter, code reviewer and more.',
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
    "bestFor": 'Turning the AI into any expert ("act as\u2026"): 3,000+ role prompts across business, writing, coding and images.'
  },
  {
    "id": "p4",
    "sec": "general",
    "kind": "open",
    "title": "Fabric Patterns",
    "summary": 'Small single-job prompts ("patterns") like extract_wisdom, analyze_claims and create_threat_model. Run them from the command line or copy them.',
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
    "summary": "Ready rule files (.cursorrules), MCPs and system prompts for Cursor and Windsurf, sorted by tech stack (Next.js, Python, React\u2026).",
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
    "how": "Filter the thumbnail feed by look (Bento, Minimal\u2026) and click a card to try the live preview and copy the prompt.",
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
    "summary": "The look of famous brands (Stripe, Linear, Apple\u2026) written as DESIGN.md files you can drop into an AI coding tool.",
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
    "bestFor": "Making your site look like a famous brand (Stripe, Linear, Apple\u2026): drop-in DESIGN.md files for AI coding tools."
  },
  {
    "id": "p17",
    "sec": "design",
    "kind": "open",
    "title": "awesome-design-skills (TypeUI)",
    "summary": "67 visual styles for websites and apps (glassmorphism, editorial, corporate\u2026), each as DESIGN.md and SKILL.md files.",
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
    "how": 'Search a phrase like "minimalist logo" to see images and prompts side by side.',
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
    "summary": "Pre-mortems, red-teaming, devil\u2019s advocate, first-principles breakdowns and weighted decision tables.",
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
    "how": "Open any extract_* or analyze_* folder in Fabric, or filter Anthropic\u2019s library by Data Extraction.",
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
    "how": "Copy a tested loop from Wharton\u2019s Tutor/Coach section, or use Kipt\u2019s cards with [BRACKETED] fields to fill in.",
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
    "summary": '1\u20135 scoring rubrics, "no fluff" ruthless editors, edge-case checkers and loops where the AI critiques its own answer.',
    "license": "MIT / Apache-2.0",
    "format": "Docs + GitHub",
    "sources": "Promptfoo, Fabric rate_content",
    "how": "Copy a grading rubric from Promptfoo\u2019s docs, or read Fabric\u2019s rate_content/system.md for a ready scorer.",
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
    "summary": 'Write-like-me voice profiles, rules against generic "AI-sounding" text, consulting memo skeletons and visual design tokens.',
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
    "how": "Open a tool folder (e.g. Cursor) in the GitHub repo to read its real system prompt, or copy Anthropic\u2019s prompt generator.",
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
var BEST_FOR = { "p1": "Everyday office work by role (marketing, sales, finance, ops), plus examples of getting structured JSON answers.", "p2": "Polished Claude prompts for writing, summarizing and pulling data out of text; good templates to learn from.", "p3": 'Turning the AI into any expert ("act as\u2026"): 3,000+ role prompts across business, writing, coding and images.', "p4": "Repeatable one-job tasks: summarize a talk, extract key ideas, check claims, threat-model. About 270 sharp patterns.", "p5": "Claude-specific prompts: marketing copy, emails, decision-making, plus Claude Code and system-prompt examples.", "p6": "Microsoft 365 work: meeting recaps, proposals, Excel analysis and scheduling in Word, Excel and Teams.", "p7": "Fill-in-the-blank templates for project plans, roadmaps, blog outlines and brand voice.", "p8": "B2B content marketing: articles, case studies, webinar scripts and email sequences, with real output examples.", "p9": "Sales reps: cold outreach, objection handling, discovery-call prep and competitive positioning.", "p10": "Setting up AI coding tools: ready rule files per tech stack (Next.js, Python, React) for Cursor and Windsurf.", "p11": "Learning prompt engineering hands-on: 9 chapters of exercises with bad vs. good prompt examples.", "p12": "Developer tasks: debugging, architecture and DevOps, with prompts shown next to sample code.", "p13": "Making decks look designed: 120+ slide styles (pitch, consulting, finance) with colors, fonts and a ready prompt.", "p14": "Starting a deck, website or app screen from a ready design system, previewed live and exportable.", "p15": "Picking a website or UI look fast: thousands of styles (bento, minimal, editorial) with live previews.", "p16": "Making your site look like a famous brand (Stripe, Linear, Apple\u2026): drop-in DESIGN.md files for AI coding tools.", "p17": "Giving AI-built apps a distinct look: 67 visual styles (glassmorphism, editorial, corporate) as design files.", "p18": "Image inspiration with the exact prompt behind each picture: posters, logos, product shots, slides.", "p19": "Brand visuals: logos, packaging, product renders, ads and UI mockups, each with a copyable prompt.", "p20": "Product and industrial-design renders: studio shots, exploded views, materials and lighting settings.", "p21": "Searching 500+ image prompts by keyword, e.g. minimalist logo, 3D mockup, eBook cover.", "p22": "Physical product and packaging renders: 24 templates for materials, finish, scale and lighting.", "p23": "Pressure-testing a plan or decision: pre-mortems, devil's advocate, red-teaming and decision matrices.", "p24": "Turning messy input into something usable: transcripts to action items, text to tables or JSON, re-tone for an audience.", "p25": "When you don't know what to ask: the AI interviews you to build a PRD, tutor you or rehearse a negotiation.", "p26": "Quality control: scoring rubrics, ruthless editors and self-critique loops to improve a draft.", "p27": "Keeping output on-brand: voice profiles, rules against AI-sounding text, memo skeletons and design tokens.", "p28": "Writing better prompts: turn one sentence into a full structured prompt, and study real system prompts of top AI tools." };
var PROMPT_LIB_ADDITIONS_VERSION = "20 Nov 2026 tools-to-prompts";
var PROMPT_LIB_ADDITIONS = [
  {
    fromTool: 150,
    title: "Lyra Prompt (AI Prompt Generator & Directory)",
    sec: "patterns",
    kind: "free",
    license: "Free",
    format: "Website",
    summary: "Prompt optimizer that uses a four-step method to turn vague requests into precise, effective prompts, plus a directory of prompts.",
    bestFor: "Turning a vague request into a sharp prompt with Lyra's 4-step method, or browsing ready prompts.",
    how: "Describe what you want and let Lyra rewrite it into a precise prompt, or browse its prompt directory.",
    links: [["Lyra Prompt", "https://lyraprompt.com/"]]
  },
  {
    fromTool: 128,
    title: "320 ChatGPT image shortcuts (320 \u05E4\u05E7\u05D5\u05D3\u05D5\u05EA \u05EA\u05DE\u05D5\u05E0\u05D4 \u05DC\u05BEChatGPT)",
    sec: "images",
    kind: "community",
    license: "Free",
    format: "Website (Hebrew)",
    summary: "Hebrew catalog of 320 copyable ChatGPT image-prompt shortcuts across 12 visual style families.",
    bestFor: "Fast ChatGPT image styles: 320 copy-ready shortcuts in 12 visual style families (Hebrew).",
    how: "Pick one of the 12 style families and copy a shortcut into ChatGPT's image generation.",
    links: [["Guide", "https://chatgpt-image-slash-guide.royecr.chatgpt.site/"]]
  },
  {
    fromTool: 196,
    title: "3D Style Atlas (Futurepedia)",
    sec: "design",
    kind: "free",
    license: "Free",
    format: "Visual gallery",
    summary: "Atlas of 37 three.js looks for 3D animated explainers, each with a copy-prompt button to rebuild it in Claude on your own topic.",
    bestFor: "3D animated explainers: 37 looks, each with a copy-prompt button to recreate it in Claude on your topic.",
    how: "Browse the 37 styles and use a style's copy-prompt button, then paste it into Claude with your topic.",
    links: [["Futurepedia", "https://www.futurepedia.io/resources/3d-style-atlas/view"]]
  },
  {
    fromTool: 36,
    title: "10 NotebookLM prompts (10 \u05E4\u05E8\u05D5\u05DE\u05E4\u05D8\u05D9\u05DD \u05DC\u05BENotebookLM)",
    sec: "general",
    kind: "community",
    license: "Free",
    format: "Article (Hebrew)",
    summary: "Ten copy-paste Hebrew prompts for getting more from Google's NotebookLM, with tips on sources and citations.",
    bestFor: "Getting more out of NotebookLM: 10 copy-paste prompts with tips on sources and citations (Hebrew).",
    how: "Scroll the article: each prompt is shown ready to copy, with a short tip.",
    links: [["eilon.co", "https://eilon.co/10-%d7%a4%d7%a8%d7%95%d7%9e%d7%a4%d7%98%d7%99%d7%9d-%d7%9c-notebooklm-%d7%a9%d7%a9%d7%99%d7%a0%d7%95/"]]
  },
  {
    fromTool: 17,
    title: "Lovable Israel prompts (\u05E4\u05E8\u05D5\u05DE\u05E4\u05D8\u05D9\u05DD | Lovable Israel)",
    sec: "coding",
    kind: "community",
    license: "Free",
    format: "Website (Hebrew)",
    summary: "Hebrew collection of ready-made prompts for building apps with Lovable, including a detailed accessibility-toolbar prompt.",
    bestFor: "Building apps in Lovable: ready-made prompts, including a detailed accessibility-toolbar prompt (Hebrew).",
    how: "Open the prompts page and copy a ready prompt into Lovable.",
    links: [["Lovable Israel", "https://lovable-ai.co.il/prompts"]]
  },
  {
    fromTool: 63,
    title: "Gemini stock analysis prompts",
    sec: "business",
    kind: "community",
    license: "Free",
    format: "Facebook post",
    summary: "Ten Gemini prompts for analysing a stock like a Wall Street analyst, as a free alternative to expensive terminals.",
    bestFor: "Analyzing a stock like an analyst with Gemini: 10 ready prompts.",
    how: "Open the post to read the 10 prompts (Facebook may ask you to sign in).",
    links: [["Facebook post", "https://facebook.com/61571991616735/posts/pfbid02g9Fk5iWkhucB8v5ptETFfBJRtUZkcx6rkvDTzmzV27FTYMTaGLetYksFx1QixWbtl/"]]
  },
  {
    fromTool: 2,
    title: "Claude anti-sycophancy prompt",
    sec: "patterns",
    kind: "community",
    license: "Free",
    format: "Facebook post (Hebrew)",
    summary: "A Claude settings prompt telling it to contradict you instead of flattering you, turning it into a genuine sparring partner.",
    bestFor: "Making Claude a real sparring partner: a settings prompt that tells it to push back instead of flatter.",
    how: "Open the post and paste the prompt into Claude's settings (personal instructions).",
    links: [["Facebook post", "https://facebook.com/100002717045940/posts/pfbid0YbYQht5K5Darmt7KtZASH29yAxQwa1yqo3TC8UdtUQccmLmM4E6eqgijxWmvgbjHl/"]]
  },
  {
    fromTool: 85,
    title: "Claude anti-glazing prompt",
    sec: "patterns",
    kind: "community",
    license: "Free",
    format: "Facebook reel",
    summary: "Prompt and settings tweak to stop Claude flattering you, making it stress-test ideas and lead with weaknesses instead.",
    bestFor: "Stopping Claude from flattering you: it stress-tests ideas and leads with weaknesses.",
    how: "Watch the reel and copy the prompt into Claude's settings.",
    links: [["Facebook reel", "https://facebook.com/reel/955735520376190/"]]
  },
  {
    fromTool: 32,
    title: "OpenClaw security hardening prompt",
    sec: "coding",
    kind: "community",
    license: "Free",
    format: "Facebook post (Hebrew)",
    summary: "A hardening prompt for OpenClaw so it refuses to leak sensitive data, resists manipulation, and warns then blocks attackers.",
    bestFor: "Protecting an OpenClaw agent: a system prompt that refuses to leak secrets and resists manipulation.",
    how: "Open the post and add the prompt to your OpenClaw agent's instructions.",
    links: [["Facebook post", "https://facebook.com/100002717045940/posts/pfbid02jwe8ahZx9zBd9HCPAi35agyCPWzwDPH3crgwhuex234QGQceW5WdtZQWH3p6ukvil/"]]
  },
  {
    fromTool: 8,
    title: "Beautiful apps in 3 prompts (Cursor)",
    sec: "design",
    kind: "community",
    license: "Free",
    format: "YouTube video",
    summary: "Chris Ashby's three-prompt method for creating a reusable design system in Cursor so AI-built apps avoid generic-looking UIs.",
    bestFor: "Making AI-built apps look designed: a 3-prompt method to set up a reusable design system in Cursor.",
    how: "Watch the video; the three prompts are shown as he builds.",
    links: [["YouTube", "https://www.youtube.com/watch?v=Be5IAxyxa6g"]]
  }
];

// convex/snapshot.ts
import { v } from "convex/values";

// convex/kinds.ts
var KINDS = ["skill", "connector", "plugin", "webapp", "app", "devtool", "model", "learn", "news"];
var KIND_LABEL = {
  skill: "Skill",
  connector: "Connector (MCP)",
  plugin: "Plugin / extension",
  webapp: "Web app",
  app: "Desktop / phone app",
  devtool: "Developer tool",
  model: "AI model",
  learn: "Learn",
  news: "News"
};
function guessKind(it) {
  if (KINDS.includes(it?.kind)) return it.kind;
  const t = `${it?.title || ""} ${it?.summary || ""}`.toLowerCase();
  const url = String(it?.url || "").toLowerCase();
  const type = String(it?.type || "");
  if (type === "news") return "news";
  if (["guide", "course", "video", "post"].includes(type) || /youtube\.com|youtu\.be/.test(url)) return "learn";
  const gh = /github\.com/.test(url) || type === "open-source-repo";
  if (/\bskills?\b|skill\.md/.test(t)) return "skill";
  if (/desktop app|mac app|menu bar|iphone|android|ios app|app store|windows, macos|for windows|desktop meeting|video editor|image editor|on-device/.test(t)) return "app";
  if (/\bmcp server\b|\bconnector\b/.test(t) && !/\bcli\b/.test(t)) return "connector";
  if (/extension|plugin|add-on/.test(t) || /chromewebstore|marketplace\.visualstudio/.test(url)) return "plugin";
  if (/open-weight|open weights|text-to-speech model|image model|diarization model/.test(t) || /huggingface\.co/.test(url)) return "model";
  if (gh || /\bcli\b|library|sdk|self-hosted|framework|api\b|apis\b/.test(t)) return "devtool";
  if (/\bnews\b|report|benchmark/.test(t)) return "news";
  return "webapp";
}

// convex/snapshot.ts
var REPO = () => process.env.SNAPSHOT_REPO || "guykoch/ai-toolbox-library-v2";
var BRANCH = () => process.env.SNAPSHOT_BRANCH || "main";
var PATH = "library-snapshot.md";
var DELAY_MS = () => Number(process.env.SNAPSHOT_DELAY_MS) || 6e4;
var SHELF = { "coding-agents": "Coding agents", "agent-skills": "Agent skills", "courses-guides": "Courses & guides", "productivity": "Productivity", "app-building": "App building", "video": "Video", "image": "Image", "audio": "Audio", "ai-models": "AI models", "news-analysis": "News & analysis", "translation": "Translation", "other": "Other" };
var SECTION = { general: "All-purpose libraries", business: "Business & productivity", coding: "Coding", design: "Slides, web & app design", images: "Images, logos & products", patterns: "Thinking patterns" };
var SOURCE = { official: "Official", open: "Open source", community: "Community", academic: "Academic", free: "Free" };
async function meta(ctx) {
  return await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "snapshot")).first();
}
async function snapshotSoon(ctx) {
  const m = await meta(ctx);
  const val = m?.value || {};
  if (val.pendingUntil && val.pendingUntil > Date.now()) return;
  const next = { ...val, pendingUntil: Date.now() + DELAY_MS() };
  if (m) await ctx.db.patch(m._id, { value: next });
  else await ctx.db.insert("meta", { key: "snapshot", value: next });
  await ctx.scheduler.runAfter(DELAY_MS(), internal.snapshot.write, {});
}
var request = internalMutation({ args: {}, handler: async (ctx) => {
  await snapshotSoon(ctx);
} });
var ensure = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const val = (await meta(ctx))?.value || {};
    if (!val.at || Date.now() - Date.parse(val.at) > 24 * 3600 * 1e3) await snapshotSoon(ctx);
    return null;
  }
});
var refreshNow = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await meta(ctx);
    const val = m?.value || {};
    if (val.pendingUntil && val.pendingUntil > Date.now() && val.pendingUntil - Date.now() < 1e4) return null;
    const next = { ...val, pendingUntil: Date.now() + 5e3 };
    if (m) await ctx.db.patch(m._id, { value: next });
    else await ctx.db.insert("meta", { key: "snapshot", value: next });
    await ctx.scheduler.runAfter(5e3, internal.snapshot.write, {});
    return null;
  }
});
var status = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const val = (await meta(ctx))?.value || {};
    return { at: val.at || "", ok: val.ok ?? null, error: val.error || "", url: `https://github.com/${REPO()}/blob/${BRANCH()}/${PATH}` };
  }
});
var record = internalMutation({
  args: { ok: v.boolean(), error: v.string() },
  handler: async (ctx, { ok, error }) => {
    const m = await meta(ctx);
    const value = { ...m?.value || {}, pendingUntil: 0, ok, error, ...ok ? { at: (/* @__PURE__ */ new Date()).toISOString() } : { failedAt: (/* @__PURE__ */ new Date()).toISOString() } };
    if (m) await ctx.db.patch(m._id, { value });
    else await ctx.db.insert("meta", { key: "snapshot", value });
  }
});
var data = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("items").collect();
    const libs = await ctx.db.query("plibs").collect();
    const cards = await ctx.db.query("tcards").collect();
    const pbs = await ctx.db.query("playbooks").collect();
    return {
      tools: items.map((r) => ({ status: r.status, ...pickTool(r.data) })),
      libs: libs.filter((l) => !l.deleting).map((l) => ({ id: l.libId, ...l.data, imp: l.imp })),
      cards: cards.filter((c) => !c.deleting).map((c) => ({ id: c.cid, tab: c.tab, title: c.data?.title, sec: c.data?.sec, kind: c.data?.kind, bestFor: c.data?.bestFor || c.data?.summary, link: c.data?.links?.[0]?.[1] || "", imp: c.imp })),
      playbooks: pbs.map((p) => ({ id: p.pbId, ...p.data }))
    };
  }
});
function pickTool(d) {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    date: d.date,
    iso: d.iso,
    cat: d.cat,
    kind: d.kind,
    type: d.type,
    os: d.os,
    pop: d.pop,
    url: d.url,
    host: d.host,
    alternativeTo: d.alternativeTo,
    private: d.private
  };
}
var cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
function render(tools, libs, cards = [], playbooks = []) {
  const active = tools.filter((t) => t.status === "active").sort((a, b) => (b.iso || "").localeCompare(a.iso || "") || b.id - a.id);
  const archived = tools.filter((t) => t.status === "archived").sort((a, b) => b.id - a.id);
  const secOrder = Object.keys(SECTION);
  const sortedLibs = [...libs].sort((a, b) => secOrder.indexOf(a.sec) - secOrder.indexOf(b.sec) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)));
  const promptsTotal = libs.reduce((n, l) => n + (l.imp?.state === "done" ? l.imp.count : 0), 0);
  const out = [];
  out.push("# AI Toolbox \u2014 library snapshot", "");
  out.push(`Updated automatically by the app: ${(/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 16)} UTC.`);
  out.push(`Tools: ${active.length} active, ${archived.length} archived. Prompt libraries: ${libs.length} (${libs.filter((l) => l.kind === "open").length} open source, ${promptsTotal.toLocaleString("en-US")} prompts copied into Find a prompt).`);
  out.push(`Rules: ${cards.filter((c) => c.tab === "rules").length}. Agents: ${cards.filter((c) => c.tab === "agents").length}. Automations: ${cards.filter((c) => c.tab === "autos").length}. Playbooks: ${playbooks.length}.`, "");
  out.push("## Tools (active)", "");
  out.push("| id | Name | Type | Shelf | Open source | Hype | Saved | Link | Alternative for |", "|---|---|---|---|---|---|---|---|---|");
  for (const t of active) {
    const kind = KIND_LABEL[t.kind || guessKind(t)] || "";
    out.push(`| ${t.id} | ${cell(t.title)}${t.private ? " (private, do not share)" : ""} | ${cell(kind)} | ${cell(SHELF[t.cat] || t.cat)} | ${t.os ? "yes" : "no"} | ${t.pop ?? ""} | ${cell(t.date)} | ${cell(t.url)} | ${cell((t.alternativeTo || []).join(", "))} |`);
  }
  out.push("", "## Tools (archived)", "");
  if (!archived.length) out.push("None.");
  else {
    out.push("| id | Name | Link |", "|---|---|---|");
    for (const t of archived) out.push(`| ${t.id} | ${cell(t.title)} | ${cell(t.url)} |`);
  }
  out.push("", "## Prompt libraries", "");
  out.push("| id | Name | Section | Source | Open source | Prompts in Find a prompt | Best for | Link |", "|---|---|---|---|---|---|---|---|");
  for (const l of sortedLibs) {
    const n = l.imp?.state === "done" ? String(l.imp.count) : l.imp?.state === "importing" ? "copying\u2026" : l.imp?.state === "failed" ? "copy failed" : "\u2014";
    out.push(`| ${l.id} | ${cell(l.title)} | ${cell(SECTION[l.sec] || l.sec)} | ${cell(SOURCE[l.kind] || l.kind)} | ${l.kind === "open" ? "yes" : "no"} | ${n} | ${cell(l.bestFor || l.summary)} | ${cell(l.links?.[0]?.[1] || "")} |`);
  }
  for (const [tab, name] of [["rules", "Rules"], ["agents", "Agents"], ["autos", "Automations"]]) {
    const list2 = cards.filter((c) => c.tab === tab).sort((a, b) => (TAB_SEC[tab] || []).indexOf(a.sec) - (TAB_SEC[tab] || []).indexOf(b.sec) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)));
    out.push("", `## ${name}`, "");
    if (!list2.length) {
      out.push("None yet.");
      continue;
    }
    out.push("| id | Name | Section | Source | Files copied | Best for | Link |", "|---|---|---|---|---|---|---|");
    for (const c of list2) {
      const n = c.imp?.state === "done" ? String(c.imp.count) : c.imp?.state === "importing" ? "copying\u2026" : c.imp?.state === "failed" ? "copy failed" : "\u2014";
      out.push(`| ${c.id} | ${cell(c.title)} | ${cell(c.sec)} | ${cell(SOURCE[c.kind] || c.kind)} | ${n} | ${cell(c.bestFor)} | ${cell(c.link)} |`);
    }
  }
  out.push("", "## Playbooks", "");
  if (!playbooks.length) out.push("None yet.");
  else {
    out.push("| id | Name | Type | Topics | Steps (items used) |", "|---|---|---|---|---|");
    for (const p of [...playbooks].sort((a, b) => String(a.type).localeCompare(String(b.type)) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)))) {
      const steps = (p.steps || []).map((s, i) => `${i + 1}. ${s.title}` + (s.use?.length ? ` (${s.use.map((u) => u.k + ":" + u.id).join(", ")})` : "")).join("; ");
      out.push(`| ${p.id} | ${cell(p.title)} | ${cell(p.type)} | ${cell((p.topics || []).join(", "))} | ${cell(steps)} |`);
    }
  }
  out.push("");
  return out.join("\n");
}
var TAB_SEC = { rules: ["standards", "coding", "collections", "design"], agents: ["subagents", "assistants", "teams"], autos: ["templates", "collections", "ai"] };
var b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
};
var write = internalAction({
  args: {},
  handler: async (ctx) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.snapshot.record, { ok: false, error: "GITHUB_TOKEN isn't set in Convex." });
      return;
    }
    try {
      const d = await ctx.runQuery(internal.snapshot.data, {});
      const md = render(d.tools, d.libs, d.cards, d.playbooks);
      const api = `https://api.github.com/repos/${REPO()}/contents/${PATH}`;
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ai-toolbox", "Content-Type": "application/json" };
      for (let attempt = 0; ; attempt++) {
        const cur = await fetch(`${api}?ref=${encodeURIComponent(BRANCH())}`, { headers });
        let sha;
        if (cur.ok) {
          const j = await cur.json();
          sha = j.sha;
          const old = j.content ? new TextDecoder().decode(Uint8Array.from(atob(String(j.content).replace(/\n/g, "")), (c) => c.charCodeAt(0))) : "";
          const strip = (s) => s.replace(/^Updated automatically.*$/m, "");
          if (strip(old) === strip(md)) break;
        } else if (cur.status !== 404) {
          throw new Error(cur.status === 401 ? "GitHub rejected the token (401)." : `GitHub said ${cur.status} reading the file.`);
        }
        const put = await fetch(api, { method: "PUT", headers, body: JSON.stringify({ message: "Update library snapshot", content: b64(md), branch: BRANCH(), ...sha ? { sha } : {} }) });
        if (put.ok) break;
        if ((put.status === 409 || put.status === 422) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(put.status === 403 || put.status === 404 ? "The GitHub token can't write to the repo (it needs Contents: Read and write)." : put.status === 409 ? "Two updates collided; the next one will catch up." : `GitHub said ${put.status}.`);
      }
      await ctx.runMutation(internal.snapshot.record, { ok: true, error: "" });
    } catch (e) {
      await ctx.runMutation(internal.snapshot.record, { ok: false, error: String(e?.message || e).slice(0, 300) });
    }
  }
});

// convex/promptLibs.ts
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
async function getMeta(ctx, key) {
  return await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", key)).first();
}
async function setMeta(ctx, key, value) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}
var list = query({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = await ctx.db.query("plibs").collect();
    const seed = (await getMeta(ctx, "plseed"))?.value || null;
    const libs = rows.filter((r) => !r.deleting).map((r) => ({ ...r.data, id: r.libId, imp: r.imp || { state: "none", count: 0, note: "", at: "" } }));
    const bestForMissing = libs.filter((l) => !l.bestFor).length;
    const additionsPending = rows.length > 0 && (await getMeta(ctx, "plAdditions"))?.value !== PROMPT_LIB_ADDITIONS_VERSION;
    return { libs, bestForMissing, additionsPending, seeded: rows.length > 0 || !!seed, seed, prompts: libs.reduce((n, l) => n + (l.imp.state === "done" ? l.imp.count : 0), 0) };
  }
});
var ensureSeeded = mutation({
  args: { key: v2.string(), origin: v2.string() },
  handler: async (ctx, { key, origin }) => {
    checkKey(key);
    if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(origin)) throw new ConvexError2("Bad site address.");
    if (await getMeta(ctx, "plseed")) return { started: false };
    if (await ctx.db.query("plibs").first() === null) {
      for (const lib of PROMPT_LIB_SEED) {
        const { id: id2, ...data2 } = lib;
        await ctx.db.insert("plibs", {
          libId: id2,
          data: data2,
          imp: lib.repo ? { state: "importing", count: 0, note: "Copying prompts\u2026", at: nowIso() } : { state: "none", count: 0, note: "", at: "" }
        });
      }
    }
    await setMeta(ctx, "plseed", { origin, shard: 0, shards: 0, finished: false, startedAt: nowIso() });
    await ctx.scheduler.runAfter(0, internal.promptLibs.seedStep, { origin, shard: 0 });
    return { started: true };
  }
});
var seedStep = internalAction({
  args: { origin: v2.string(), shard: v2.number() },
  handler: async (ctx) => {
    const libs = await ctx.runQuery(internal.promptLibs.libNames, {});
    for (const l of libs) if (l.repo && !l.imported) await ctx.runMutation(internal.promptLibs.startImportFor, { libId: l.libId });
    await ctx.runMutation(internal.promptLibs.seedProgress, { shard: 0, shards: 0, finished: true });
  }
});
var seedProgress = internalMutation({
  args: { shard: v2.number(), shards: v2.number(), finished: v2.optional(v2.boolean()) },
  handler: async (ctx, a) => {
    const m = await getMeta(ctx, "plseed");
    await setMeta(ctx, "plseed", { ...m?.value || {}, shard: a.shard, shards: a.shards, finished: !!a.finished, ...a.finished ? { finishedAt: nowIso() } : {} });
  }
});
var normLink = (u) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
var applyAdditions = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "plAdditions"))?.value === PROMPT_LIB_ADDITIONS_VERSION) return { added: 0 };
    const rows = await ctx.db.query("plibs").collect();
    const have = new Set(rows.flatMap((r) => [r.data?.repo, r.data?.links?.[0]?.[1]].filter(Boolean).map((u) => normLink(u))));
    let n = Math.max(28, ...rows.map((r) => Number(String(r.libId).replace(/\D/g, "")) || 0));
    const added = [];
    for (const card of PROMPT_LIB_ADDITIONS) {
      if (have.has(normLink(card.links[0][1]))) continue;
      const libId = "p" + ++n;
      await ctx.db.insert("plibs", { libId, data: { ...card, added: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) }, imp: { state: "none", count: 0, note: "", at: "" } });
      added.push(libId);
    }
    await setMeta(ctx, "plAdditions", PROMPT_LIB_ADDITIONS_VERSION);
    if (added.length) {
      await ctx.scheduler.runAfter(0, internal.siteCheck.run, { libIds: added });
      await snapshotSoon(ctx);
    }
    return { added: added.length };
  }
});
var fillBestFor = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    let needAi = false;
    for (const lib of await ctx.db.query("plibs").collect()) {
      if (lib.deleting || lib.data?.bestFor) continue;
      if (BEST_FOR[lib.libId]) await ctx.db.patch(lib._id, { data: { ...lib.data, bestFor: BEST_FOR[lib.libId] } });
      else needAi = true;
    }
    if (needAi) {
      const m = await getMeta(ctx, "bestForAt");
      if (!m || Date.now() - (m.value || 0) > 10 * 60 * 1e3) {
        await setMeta(ctx, "bestForAt", Date.now());
        await ctx.scheduler.runAfter(0, internal.promptAdd.bestForMissing, {});
      }
    }
    return { needAi };
  }
});
var setRepo = internalMutation({
  args: { libId: v2.string(), repo: v2.string(), license: v2.string() },
  handler: async (ctx, { libId, repo, license }) => {
    await snapshotSoon(ctx);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting) return;
    const data2 = { ...lib.data, repo, license, kind: lib.data?.kind === "official" ? "official" : "open" };
    await ctx.db.patch(lib._id, { data: data2 });
    await startImport(ctx, { ...lib, data: data2 });
  }
});
var missingBestFor = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("plibs").collect()).filter((r) => !r.deleting && !r.data?.bestFor).map((r) => ({ libId: r.libId, title: r.data?.title || "", summary: r.data?.summary || "", links: r.data?.links || [] }))
});
var setBestFor = internalMutation({
  args: { libId: v2.string(), bestFor: v2.string() },
  handler: async (ctx, { libId, bestFor }) => {
    await snapshotSoon(ctx);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib && !lib.data?.bestFor && bestFor) await ctx.db.patch(lib._id, { data: { ...lib.data, bestFor } });
  }
});
var addPrompts = internalMutation({
  args: { rows: v2.array(v2.object({ libId: v2.string(), title: v2.string(), desc: v2.string(), text: v2.string(), url: v2.string() })), runId: v2.optional(v2.string()) },
  handler: async (ctx, { rows, runId }) => {
    const seqRow = await getMeta(ctx, "plSeq");
    let pid = seqRow?.value || 0;
    const alive = /* @__PURE__ */ new Map();
    for (const r of rows) {
      if (!alive.has(r.libId)) {
        const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", r.libId)).first();
        alive.set(r.libId, !!lib && !lib.deleting && (!runId || lib.imp?.run === runId));
      }
      if (!alive.get(r.libId)) continue;
      pid++;
      await ctx.db.insert("plIndex", { libId: r.libId, pid, title: r.title.slice(0, 300), desc: r.desc.slice(0, 400) });
      await ctx.db.insert("plText", { libId: r.libId, pid, text: r.text, url: r.url });
    }
    await setMeta(ctx, "plSeq", pid);
  }
});
var countFor = internalQuery({
  args: { libId: v2.string() },
  handler: async (ctx, { libId }) => (await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).collect()).length
});
var setImp = internalMutation({
  args: { libId: v2.string(), state: v2.string(), count: v2.number(), note: v2.string(), runId: v2.optional(v2.string()) },
  handler: async (ctx, { libId, state, count, note, runId }) => {
    await snapshotSoon(ctx);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting) return;
    if (runId && lib.imp?.run !== runId) return;
    await ctx.db.patch(lib._id, { imp: { state, count, note, at: nowIso(), ...lib.imp?.run ? { run: lib.imp.run } : {} } });
  }
});
var progress = internalMutation({
  args: { libId: v2.string(), runId: v2.optional(v2.string()), note: v2.string() },
  handler: async (ctx, { libId, runId, note }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting || lib.imp?.state !== "importing" || runId && lib.imp?.run !== runId) return;
    await ctx.db.patch(lib._id, { imp: { ...lib.imp, note, at: nowIso() } });
  }
});
async function startImport(ctx, lib) {
  const run = Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (lib.data?.repo) {
    await ctx.db.patch(lib._id, { imp: { state: "importing", count: 0, note: "Copying prompts\u2026", at: nowIso(), run } });
    await ctx.scheduler.runAfter(0, internal.promptImport.run, { libId: lib.libId, repo: lib.data.repo, runId: run });
  } else {
    const old = await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", lib.libId)).first();
    if (old) await ctx.db.delete(old._id);
    await ctx.db.patch(lib._id, { imp: { state: "importing", count: 0, note: "Looking for prompt pages\u2026", at: nowIso(), run } });
    await ctx.scheduler.runAfter(0, internal.webcopy.discover, { libId: lib.libId, runId: run });
  }
}
var startImportFor = internalMutation({
  args: { libId: v2.string() },
  handler: async (ctx, { libId }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib && !lib.deleting && lib.data?.repo) await startImport(ctx, lib);
  }
});
var STALE_MS = 4 * 60 * 1e3;
var isStale = (imp) => imp?.state === "importing" && Date.now() - Date.parse(imp.at || 0) > STALE_MS;
var resumeStuck = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    let n = 0;
    for (const lib of await ctx.db.query("plibs").collect()) {
      if (!lib.deleting && lib.data?.repo && isStale(lib.imp)) {
        await startImport(ctx, lib);
        n++;
      }
    }
    const m = await getMeta(ctx, "plseed");
    if (m && !m.value?.finished && Date.now() - Date.parse(m.value?.startedAt || 0) > STALE_MS) await setMeta(ctx, "plseed", { ...m.value, finished: true, finishedAt: nowIso() });
    return { restarted: n };
  }
});
var indexPage = internalQuery({
  args: { cursor: v2.union(v2.string(), v2.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("plIndex").paginate({ numItems: 3e3, cursor });
    return { rows: page.page.map((r) => ({ pid: r.pid, libId: r.libId, title: r.title, desc: r.desc })), cursor: page.continueCursor, done: page.isDone };
  }
});
var libNames = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("plibs").collect()).filter((r) => !r.deleting).map((r) => ({ libId: r.libId, title: r.data?.title || r.libId, links: r.data?.links || [], repo: r.data?.repo || "", summary: r.data?.summary || "", bestFor: r.data?.bestFor || "", imported: r.imp?.state === "done", sec: r.data?.sec || "" }))
});
var titles = query({
  args: { key: v2.string(), libId: v2.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    const rows = await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).collect();
    return rows.map((r) => ({ pid: r.pid, title: r.title, desc: r.desc }));
  }
});
var promptText = query({
  args: { key: v2.string(), pid: v2.number() },
  handler: async (ctx, { key, pid }) => {
    checkKey(key);
    const t = await ctx.db.query("plText").withIndex("by_pid", (q) => q.eq("pid", pid)).first();
    if (!t) throw new ConvexError2("That prompt is no longer in the app.");
    return { text: t.text, url: t.url };
  }
});
var remove = mutation({
  args: { key: v2.string(), libId: v2.string() },
  handler: async (ctx, { key, libId }) => {
    await snapshotSoon(ctx);
    checkKey(key);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib) return { ok: true };
    await ctx.db.patch(lib._id, { deleting: true });
    const job = await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", libId)).first();
    if (job) {
      await ctx.db.delete(job._id);
      await ctx.scheduler.runAfter(0, internal.webjobs.kickNext, {});
    }
    await ctx.scheduler.runAfter(0, internal.promptLibs.purge, { libId });
    return { ok: true };
  }
});
var purge = internalMutation({
  args: { libId: v2.string() },
  handler: async (ctx, { libId }) => {
    const idx = await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).take(400);
    for (const r of idx) await ctx.db.delete(r._id);
    const txt = await ctx.db.query("plText").withIndex("by_lib", (q) => q.eq("libId", libId)).take(200);
    for (const r of txt) await ctx.db.delete(r._id);
    if (idx.length || txt.length) {
      await ctx.scheduler.runAfter(0, internal.promptLibs.purge, { libId });
      return;
    }
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib) await ctx.db.delete(lib._id);
  }
});
var insertLib = internalMutation({
  args: { data: v2.any(), importing: v2.boolean() },
  handler: async (ctx, { data: data2, importing }) => {
    await snapshotSoon(ctx);
    const rows = await ctx.db.query("plibs").collect();
    const n = Math.max(28, ...rows.map((r) => Number(String(r.libId).replace(/\D/g, "")) || 0)) + 1;
    const libId = "p" + n;
    const id2 = await ctx.db.insert("plibs", { libId, data: data2, imp: { state: "none", count: 0, note: "", at: "" } });
    if (importing) await startImport(ctx, { _id: id2, libId, data: data2 });
    return libId;
  }
});
var reimport = mutation({
  args: { key: v2.string(), libId: v2.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting) throw new ConvexError2("That library is no longer in your list.");
    if (lib.imp?.state === "importing" && !isStale(lib.imp)) return { ok: true };
    await startImport(ctx, lib);
    return { ok: true };
  }
});
var clearPrompts = internalMutation({
  args: { libId: v2.string(), runId: v2.optional(v2.string()) },
  handler: async (ctx, { libId, runId }) => {
    if (runId) {
      const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
      if (!lib || lib.imp?.run !== runId) return 0;
    }
    const idx = await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).take(400);
    for (const r of idx) await ctx.db.delete(r._id);
    const txt = await ctx.db.query("plText").withIndex("by_lib", (q) => q.eq("libId", libId)).take(200);
    for (const r of txt) await ctx.db.delete(r._id);
    return idx.length + txt.length;
  }
});
export {
  addPrompts,
  applyAdditions,
  clearPrompts,
  countFor,
  ensureSeeded,
  fillBestFor,
  indexPage,
  insertLib,
  libNames,
  list,
  missingBestFor,
  progress,
  promptText,
  purge,
  reimport,
  remove,
  resumeStuck,
  seedProgress,
  seedStep,
  setBestFor,
  setImp,
  setRepo,
  startImportFor,
  titles
};
