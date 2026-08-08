# Job Finder — a daily job-match tracker for Claude Code

Say "new jobs for today" and it finds real job postings that match your resume, tailors a resume
for your best matches, and builds you a webpage listing everything, ranked, with click-to-open
links. Say it again tomorrow, or even later the same day — it never shows you the same listing
twice.

This repo ships pre-configured for AI engineering roles at companies with an H1B sponsorship
track record, since that's what it was originally built for. But say, hypothetically, you were
looking for gardening jobs instead — the mechanism itself doesn't care what role or industry you
search for. Only one file (`mcp-job-pipeline-node/seed_companies.example.json`) is AI/H1B-specific,
and that's the one thing you'd swap for a different target.

**Clone this whole repo.** Unlike a plain npm install, this flow needs a few files that live in
the repo itself (the subagent's instructions, the tracker page template) copied onto your machine,
not just the published package.

## What it does, in order

1. Checks the Department of Labor's own quarterly H1B disclosure data — real certified filings,
   not a scraped third-party site — for companies matching your target role/region.
2. Finds real, currently-open postings at those companies (Greenhouse, Lever, Workday, or a live
   web search).
3. Skips anything it's already shown you before, today or on any earlier day.
4. Scores what's left against your resume's actual skills and experience, not just title keywords.
5. Tailors a resume for your best matches (one file per company, covering every role found there),
   converts it to PDF, checks it's still one page.
6. Builds a webpage for that day listing everything, ranked by match, with a link straight to
   whichever tailored resume applies.

Optionally, on request only — it can also find a recruiter contact at a company and draft (never
send) a personalized outreach email. That's a separate ask, not part of the daily flow.

## Is this actually portable, or just "open source"?

Being honest about this upfront: the MCP server itself (`job-finder`, and `safe-docx` which it
depends on) is standard MCP over stdio, an open protocol, so it works in any MCP-compatible
client — Cursor, Windsurf, Cline, Continue, Zed, whatever you use.

But the daily flow as documented here is built specifically around **Claude Code**, and won't
fully work anywhere else: `JF-assistant.md` (the subagent that runs the whole thing) is a Claude
Code subagent file, that exact format only works in Claude Code. It's plain English inside though,
so you can read it and adapt the logic to whatever your own tool's equivalent feature is. The
optional recruiter-outreach add-on additionally needs Apollo.io and Gmail, wired in as claude.ai's
own hosted connectors — a different assistant would need its own separate integration for that part.

So: the underlying MCP tools, yes, portable anywhere. The turnkey daily flow described below,
Claude Code only.

## Get started

1. **Clone this repo** and `cd` into it.

2. **Install LibreOffice** — converts tailored resumes from Word to PDF:
   ```
   brew install --cask libreoffice
   ```
   (Windows/Linux: install however your OS normally installs software, just make sure `soffice`
   ends up on your PATH.)

3. **Add the two MCP tools**:
   ```
   claude mcp add job-finder -- npx -y @sharkbuilds/job-finder
   claude mcp add safe-docx -- npx -y @usejunior/safe-docx
   ```

4. **Install the subagent**:
   ```
   mkdir -p ~/.claude/agents
   cp JF-assistant.md ~/.claude/agents/JF-assistant.md
   ```
   (Want it available in one project only instead of everywhere? Copy it into that project's own
   `.claude/agents/` folder instead of your home directory's.)

5. **Restart Claude Code completely.** Newly added MCP tools and subagents don't show up in a
   session that was already running.

6. **Confirm it's all there**: run `/mcp`, you should see `job-finder` and `safe-docx` connected.

7. **Pick a workspace folder** — anywhere on your computer, one example: `~/JobSearch`. Every
   resume, every daily tracker page, everything this tool builds lives here from now on.

8. **Put your resume in that folder, as a Word file (`.docx`), not a PDF.** The tool edits the
   Word file and converts it to PDF at the end — it can't start from a PDF.

9. **Copy two files from this repo's `templates/` folder into your workspace folder**:
   - `tracker-template.html` — copy as-is, no editing needed.
   - `resume-tailoring-spec-template.md` — optional. Open it, fill in your own resume details and
     rules, save it in your workspace as `resume-tailoring-spec.md`. Skip this entirely and the
     tool falls back to a sensible generic ruleset instead — it still works, just less finely
     tuned to how you specifically write.

10. **Say "new jobs for today."** First time, it asks a few plain-English questions — your name,
    where your resume file and workspace folder are, what job title you want, what region — and
    remembers your answers after that.

11. **Open the page it builds you.** It tells you the file path. Every listing is ranked by match,
    with a link straight to a resume already tailored for your best matches.

**Optional — only if you also want recruiter outreach**: connect Apollo.io and Gmail via claude.ai's
connector settings (not a terminal command), then just ask, e.g. "reach out to Acme Corp."

**Checklist, all in one place:**

- [ ] Repo cloned
- [ ] `job-finder` + `safe-docx` MCP tools added, Claude Code restarted
- [ ] `JF-assistant.md` copied to `~/.claude/agents/`
- [ ] A workspace folder, picked once
- [ ] Your resume, as `.docx`, in that folder
- [ ] `tracker-template.html`, copied in as-is
- [ ] `resume-tailoring-spec.md`, optional — your own rules, or skip for the generic fallback
- [ ] A seed company list — the bundled example works, or swap in your own for a different role/region
- [ ] Say "new jobs for today" — target role/region asked in plain English on first run

## Folder structure

```
job-finder/
  README.md
  JF-assistant.md              subagent that runs the whole daily flow

  templates/                    copy these into your own workspace folder, see setup above
    tracker-template.html       the daily job-tracker page's shell, generic, copy as-is
    resume-tailoring-spec-template.md   fill in your own resume rules, or skip for the fallback

  mcp-job-pipeline-node/        the MCP server to actually use, published to npm
    index.js                    registers all the tools with Claude Code
    package.json
    seed_companies.example.json example target-company list, replace with your own
    lib/
      tracker.js                reads/writes a tracker workbook (Outreach + Assets sheets)
      h1b.js                    downloads and indexes DOL's H1B sponsorship data
      boards.js                 fetches live job postings from Greenhouse/Lever/Workday
      resumePdf.js               converts a tailored resume docx to PDF, checks page count

  mcp-job-pipeline/              original Python implementation, kept for reference
    server.py
    requirements.txt
    seed_companies.example.json
    lib/
```

## The H1B data cache

There's no bundled H1B dataset, the source file is 130MB+ and updates every quarter from the
Department of Labor. You build your own local copy — just ask, "refresh the H1B data," it's part
of the daily flow's first step and also safe to trigger on its own any time.

To trigger it manually without going through Claude:
```
cd mcp-job-pipeline-node
npm install
node -e "import('./lib/h1b.js').then(m => m.refreshH1bData()).then(console.log)"
```

This downloads the latest quarterly LCA disclosure file, filters it down to certified filings, and
saves an index to `~/.job-finder/data/h1b/`. Takes a couple minutes the first time. Only re-run
every few weeks — the government only publishes new data quarterly, and the call itself is cheap
to make often since it no-ops when nothing changed.

## Building your own target company list

`seed_companies.example.json` has a starter list. If you're targeting a different role or region,
this is the file to rebuild — either by hand, or let JF-assistant build one for you on first run
via web research. Everything else — H1B search, job board search, matching, tailoring — works the
same regardless of role or location.

## What stays local, not in this repo

Your actual resume, your tailored resumes, your daily tracker pages, your H1B data cache, and your
own filled-in tailoring spec are all yours to keep in your workspace folder, entirely local.
Nothing personal ships with this repo, and the pipeline never uploads or commits anything on your
behalf.
