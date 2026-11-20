"""Build the prompt-finder data from open-source prompt libraries.

Outputs:
  convex/promptCatalog.ts  - compact catalog (id, library, title, short description, shard) used for search
  public/pl/<n>.json       - full prompt texts, sharded (~400 KB each), fetched by the browser on demand
"""
import csv, json, os, re, glob, sys

SRC = '/home/claude/srcs'
OUT = sys.argv[1]  # project root
csv.field_size_limit(10**9)

def clean(s):
    return re.sub(r'\s+', ' ', s or '').strip()

def short(s, n=220):
    s = clean(re.sub(r'[#*`>_|]', ' ', s or ''))
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + '…'

BAD = re.compile(r'jailbreak|\bDAN\b|uncensored|nsfw', re.I)
items = []  # dicts: lib, title, desc, text, url

# prompts.chat (CC0)
for r in csv.DictReader(open(f'{SRC}/prompts.chat/prompts.csv', encoding='utf-8')):
    t, p = clean(r['act']), (r['prompt'] or '').strip()
    if not t or len(p) < 40 or BAD.search(t) or BAD.search(p[:400]):
        continue
    items.append(dict(lib='pc', title=t, desc=short(p), text=p, url='https://prompts.chat/prompts?q=' + t.replace(' ', '+')))

# Fabric patterns (MIT)
for d in sorted(glob.glob(f'{SRC}/fabric/data/patterns/*/system.md')):
    name = d.split('/')[-2]
    text = open(d, encoding='utf-8').read().strip()
    m = re.search(r'#\s*IDENTITY( and|&)? PURPOSE\s*(.+?)(\n#|\Z)', text, re.S | re.I)
    desc = short(m.group(2) if m else text)
    items.append(dict(lib='fb', title=name.replace('_', ' '), desc=desc, text=text, url=f'https://github.com/danielmiessler/fabric/tree/main/data/patterns/{name}'))

# awesome-claude-prompts README sections
lines = open(f'{SRC}/awesome-claude-prompts/README.md', encoding='utf-8').read().split('\n')
start = next(i for i, l in enumerate(lines) if l.startswith('## Summarize this PDF'))
secs, cur = [], None
for l in lines[start:]:
    if l.startswith('## ') and not l.startswith('## #'):
        h = clean(l[3:])
        # sub-headings inside a prompt (Profile, Rules, Workflow...) belong to the current prompt
        if cur and re.match(r'^(Profile|Rules|Workflow|Initialization|Constrains|Skill|OutputFormat|If it|🧐|🛠|步骤|任务|技术|工作流)', h):
            cur[1].append(l); continue
        cur = [h, []]; secs.append(cur)
    elif cur:
        cur[1].append(l)
for h, body in secs:
    text = '\n'.join(body).strip()
    text = re.sub(r'^\s*\[?back to top\]?.*$', '', text, flags=re.M | re.I).strip()
    if len(text) < 60 or BAD.search(h) or re.search(r'maximum length|Contents|official prompt resource', h, re.I):
        continue
    if len(re.findall(r'[一-鿿]', text)) > 40:
        continue  # skip Chinese-only prompts
    items.append(dict(lib='acp', title=h, desc=short(text), text=text, url='https://github.com/langgptai/awesome-claude-prompts'))

# SlideSpeak slide-design prompts
for d in sorted(glob.glob(f'{SRC}/presentation-design-prompts/prompts/*/PROMPT.md')):
    name = d.split('/')[-2]
    text = open(d, encoding='utf-8').read().strip()
    rd = open(os.path.join(os.path.dirname(d), 'README.md'), encoding='utf-8').read()
    t = re.search(r'^# (.+)$', rd, re.M)
    tag = re.search(r'^> (.+)$', rd, re.M)
    meta = re.search(r'\*\*Category:\*\*(.+)$', rd, re.M)
    title = (t.group(1).strip() if t else name) + ' (slide deck style)'
    desc = short(' '.join(x for x in [tag.group(1) if tag else '', clean(re.sub(r'&nbsp;|\*\*', ' ', meta.group(1))) if meta else ''] if x)) or short(text)
    items.append(dict(lib='ss', title=title, desc='Slide deck / presentation design: ' + desc, text=text, url=f'https://github.com/SlideSpeak/presentation-design-prompts/tree/main/prompts/{name}'))

# awesome-design-md (brand DESIGN.md files)
for d in sorted(glob.glob(f'{SRC}/awesome-design-md/design-md/*/DESIGN.md')):
    name = d.split('/')[-2]
    text = open(d, encoding='utf-8').read().strip()
    brand = name.replace('-', ' ').title()
    items.append(dict(lib='dm', title=f'{brand}-style website design (DESIGN.md)', desc=f'Website / app UI design system inspired by {brand}: colors, fonts, spacing, components. ' + short(text, 140), text=text, url=f'https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/{name}'))

# awesome-design-skills (UI style skills)
for d in sorted(glob.glob(f'{SRC}/awesome-design-skills/skills/*/SKILL.md')):
    name = d.split('/')[-2]
    text = open(d, encoding='utf-8').read().strip()
    m = re.search(r'^description:\s*(.+)$', text, re.M)
    items.append(dict(lib='ds', title=f'{name.replace("-", " ").title()} UI style (design skill)', desc='Website / app UI visual style: ' + short(m.group(1) if m else text), text=text, url=f'https://github.com/bergside/awesome-design-skills/tree/main/skills/{name}'))

# shard full texts
os.makedirs(f'{OUT}/public/pl', exist_ok=True)
for f in glob.glob(f'{OUT}/public/pl/*.json'):
    os.remove(f)
shard, size, buf, cat = 0, 0, {}, []
def flush():
    global shard, size, buf
    if buf:
        json.dump(buf, open(f'{OUT}/public/pl/{shard}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        shard += 1; size = 0; buf = {}
for i, it in enumerate(items):
    buf[i] = {'t': it['title'], 'l': it['lib'], 'u': it['url'], 'x': it['text']}
    cat.append([i, it['lib'], it['title'], it['desc'], shard])
    size += len(it['text'].encode())
    if size > 400_000:
        flush()
flush()

with open(f'{OUT}/convex/promptCatalog.ts', 'w', encoding='utf-8') as f:
    f.write('// Prompt-finder catalog, built from open-source prompt libraries (see scripts in the project notes).\n')
    f.write('// Each row: [id, library, title, short description, shard]. Full texts live in public/pl/<shard>.json.\n')
    f.write('export const PROMPT_LIB_NAMES: Record<string, string> = ' + json.dumps({'pc': 'prompts.chat', 'fb': 'Fabric Patterns', 'acp': 'awesome-claude-prompts', 'ss': 'SlideSpeak Slide Design Prompts', 'dm': 'awesome-design-md', 'ds': 'awesome-design-skills'}) + ';\n')
    f.write('export const PROMPT_CATALOG: [number, string, string, string, number][] = ' + json.dumps(cat, ensure_ascii=False) + ';\n')

from collections import Counter
print(len(items), Counter(i['lib'] for i in items), 'shards', shard, 'catalog KB', os.path.getsize(f'{OUT}/convex/promptCatalog.ts') // 1024)
