# AI Toolbox Library — deploy guide

Your library, now live on the web, with these features:
- **"What would you like to do?"**: type a goal in plain words (e.g. "I want to generate a video"). You get the best tools **from your library**, ranked, with reasons. Ask follow-ups like a chat. If nothing fits, it says so.
- **Install prompt** on every card: it researches how to fully set up that tool and opens a pop-up with a complete prompt to paste into any AI agent. The pop-up has **Copy** and **Exit** buttons, plus **Regenerate**. The prompt is saved, so it opens instantly next time.
- **Add to the library**: paste a link, a tool name or any context, and it's saved as a card in the same format as the others.
- **Archive** or **Delete** any card. In the **Archive** section you can **Bring back** or **Delete** each item.
- **Cards stay compact**: you see the title, a short summary, the hype score, the shelf, the open-source mark, **Read more** and **Install prompt**. Everything else opens with **Read more**.
- **A background job prepares the whole library, once**:
  1. Cards that point to a Facebook or LinkedIn post are researched, and switched to the **tool's own page** with a fresh title and summary. The post stays under **Read more → Saved from**. If the post itself is the content (tips, news) or the tool can't be found confidently, the card keeps the post.
  2. An **install prompt** is written for every card in advance. A green dot on the button means it's ready.

  New items you add get their install prompt automatically.

How it fits together:
- **Vercel** hosts the page (`public/index.html`).
- **Convex** stores the library and runs the "add" step.
- **Gemini 3.8 Flash** (Google) powers the advisor and the install prompts. It's Google's most capable Flash model, cheap, and has Google Search built in, so install steps come from current official docs.
- **Claude** (optional) writes new cards when you add something. If you don't add a Claude key, Gemini does it.

The first time you open the site, your 208 existing items are imported automatically.

---

## What you need (about 15 minutes)

1. A **GitHub** account (Vercel deploys from a GitHub repo)
2. Your **Vercel** account
3. Your **Convex** account
4. A **Gemini API key** (required):
   - Go to https://aistudio.google.com/apikey and click **Create API key**.
   - Then turn on billing for that key's project: in AI Studio, open **Billing** and click **Set up billing**.
   - Billing is required because Google Search grounding, which the install prompts use, isn't available on the free tier.
   - Typical cost: under a cent per question, and a few cents per install prompt. Search includes 5,000 free requests a month.
5. An **Anthropic API key** (optional): get one at https://console.anthropic.com → API Keys. Use it if you want Claude, not Gemini, writing new cards.

---

## Step 1 — Put the project on GitHub

1. Unzip `ai-toolbox-library.zip`.
2. On GitHub, click **New repository** and name it `ai-toolbox-library`. Make it **Private**. Click **Create**.
3. On the empty repo page, click **uploading an existing file**.
4. Drag in **everything inside** the unzipped folder: the `convex`, `public` and `scripts` folders, plus `package.json`, `vercel.json`, `README.md` and `.gitignore`.
   - On a Mac, press Cmd+Shift+. in Finder to see `.gitignore`.
   - Don't upload `node_modules` if it shows up.
5. Click **Commit changes**.

If you use git instead:
```bash
cd ai-toolbox-library
git init && git add . && git commit -m "AI Toolbox Library"
git remote add origin https://github.com/<you>/ai-toolbox-library.git
git push -u origin main
```

## Step 2 — Create the Convex backend

1. Go to https://dashboard.convex.dev and click **Create Project**. Name it `ai-toolbox-library`.
2. Open the project and switch to the **Production** deployment (top-left dropdown).
3. Go to **Settings → Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `ADMIN_KEY` | A password you make up, e.g. `guy-library-7f3k9q`. You'll type this once in your browser to open the library. |
   | `GEMINI_API_KEY` | Your key from aistudio.google.com |
   | `ANTHROPIC_API_KEY` *(optional)* | Your Claude key (starts with `sk-ant-`). If set, Claude writes new cards; if not, Gemini does. |
   | `GITHUB_TOKEN` *(optional)* | A GitHub token with no scopes. Helps read star counts if you add many repos. |

   Optional model overrides (leave them out to use the defaults):
   - `GEMINI_MODEL_INSTALL`, `GEMINI_MODEL_ADVISOR` and `GEMINI_MODEL_ADD` all default to `gemini-3.8-flash`. For the advisor, you could use `gemini-3.5-flash-lite` to save money, at some cost in quality.
   - `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`.

4. Go to **Settings → General → Deploy Key** (it may be labeled "Generate Production Deploy Key"). Click **Generate** and copy the key. It starts with `prod:`.

## Step 3 — Deploy on Vercel

1. Go to https://vercel.com/new and **Import** the `ai-toolbox-library` repo.
2. Set **Framework Preset** to **Other**. Leave the build settings as they are, because `vercel.json` already sets them.
3. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `CONVEX_DEPLOY_KEY` | The `prod:...` key from Step 2 |

4. Click **Deploy**.

Each Vercel build pushes the backend code to Convex first, then publishes the page connected to it. You never run Convex commands yourself.

## Step 4 — Open it

1. Open your Vercel URL (e.g. `ai-toolbox-library.vercel.app`).
2. Enter your `ADMIN_KEY`. Your browser remembers it after that.
3. On first load you'll see "importing your 208 saved items…". This happens only once.
4. Try **What would you like to do?** by clicking one of the example chips. Then click **Install prompt** on any card. The first time takes 20–90 seconds while it researches.
5. Try the add box: paste `https://github.com/obra/superpowers`. It's already in your library, so the existing card gets marked "Saved again" and no duplicate is created. Then paste a new link to see a fresh card appear at the top, marked **Just added**.

---

## Ready-made install prompts and tool links (first visit)

The app ships with install prompts for all 208 existing tools, plus research that switched 71 Facebook/LinkedIn post links to the tool's own page. These were prepared by Claude ahead of time, so they use **no Gemini credit**.
- On the first visit after deploying, they load automatically. You'll briefly see "Loading ready-made install prompts…". Every Install prompt button then shows a green dot ● and opens instantly.
- About 70 cards still link to the post, because the post itself is the content (tips, news, lists) or the tool couldn't be identified for sure. For any of these, paste the post's text or a screenshot into the Add box to add the tool properly.
- **New tools** you add use Gemini, a few cents each, and get their install prompt written automatically.
- **Regenerate** in the pop-up rewrites a prompt with fresh Gemini research, if you ever want that.
- If an older version already started the paid background job, loading this data stops it.

## Using it

- **Ask** ("What would you like to do?"): press Enter to send, or Shift+Enter for a new line. Typos, Hebrew and short phrases are all fine.
  - Each pick has **Open**, **Show in library** (jumps to and highlights the card) and **Install prompt**.
  - Click **New question** to start a fresh conversation.
- **Install prompt**: it reads the item's links, searches the official docs, and works out what kind of thing it is. That could be a Claude skill, an MCP server, a CLI, a repo, an app, an extension, a website you sign up for, or a guide whose steps you apply. It then writes:
  - prerequisites
  - exact commands and config
  - steps marked 👤 that only you can do (sign in, pay), where the agent pauses
  - a test to confirm it works
  - fixes for common problems
  - the sources it checked
- **Regenerate** rewrites the prompt with fresh research. Use it if the tool has changed.

- **Add**: paste into the box and click **Add to library** (or press Cmd+Enter). It takes about 10–40 seconds.
  - **Links** (Facebook, GitHub, YouTube, any site) are opened to identify what they are.
  - **GitHub repos** also get live star and fork counts, and are marked open source if they have a licence.
  - **A tool name or a description** is looked up on the web to find the official link.
  - **Tracking parameters** like utm and fbclid are removed.
- **Facebook posts**: Facebook hides posts from servers, so a bare link can't be read. Use one of these instead:
  - **Screenshot:** paste it (Ctrl/Cmd+V), drag it in, or click **Add screenshot**. Up to 4 images; the AI reads them.
  - **Text:** paste the post's text along with the link.
  - If a link can't be read and there's nothing else to go on, nothing is saved. You're asked for the text or a screenshot instead.
- **Archive** hides a card. Open **Archive** below the library to **Bring back** or **Delete** it.
- **Delete** asks once ("Delete for good?"). Click again to confirm. This is permanent.

## Changing things later

- To change the page or logic, edit the files in GitHub. Vercel redeploys automatically.
- To see or edit raw data, use Convex dashboard → **Data** → `items`. Each row's `data` field is the card.
- To change the access key, update `ADMIN_KEY` in Convex. You'll be asked for the new key on your next visit.

## Files

```
convex/schema.ts     database tables
convex/items.ts      list, archive, restore, delete, first-run import
convex/ingest.ts     "Add to library": gathers context, asks Claude (or Gemini), checks every field
convex/advisor.ts    "What would you like to do?": ranked picks from your library only
convex/install.ts    "Install prompt": researches with Google Search, saves the result
convex/llm.ts        Gemini + Claude connections, and which model does what
convex/preparedData.ts  ready-made install prompts + tool links (prepared by Claude)
convex/pipeline.ts   optional paid background job (only runs if you press Resume)
convex/enrich.ts     turns a post link into the tool's own page
convex/web.ts        reads links and GitHub repos, cleans URLs
convex/seedData.ts   your original 208 items + collections/attachments
convex/auth.ts       access-key check
public/index.html    the page (same design as the original)
scripts/write-config.mjs   tells the page which Convex backend to use (run during build)
vercel.json          build settings for Vercel
```

## Running on your own computer (optional)

```bash
npm install
npx convex dev          # log in, pick the project, and keep this running
# in a second terminal:
echo "window.CONVEX_URL='https://<your-dev-deployment>.convex.cloud';" > public/config.js
npx serve public
```
Set `ADMIN_KEY` and `GEMINI_API_KEY` on the **dev** deployment as well.
