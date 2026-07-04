# ∠ AdAngle

**Every landing page argues. AdAngle finds the angle — then writes the ads.**

Paste a landing page URL and AdAngle reads it the way a senior media buyer would: it extracts the *persuasion brief* (the offer, the audience, the hook, the emotional angle, and where the pitch leaks), then writes platform-ready ad copy cut to each network's real character limits — Google RSA, Meta, TikTok, and Taboola — plus a prioritized A/B test plan and landing page fixes. Point it at a competitor and it maps the gaps between your argument and theirs, then drafts counter-angles to exploit them.

## Try it in 15 seconds (no API keys)

```bash
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000) and click **"View a sample report"** — a real, pre-generated analysis of ramp.com loads instantly with zero network calls. Every feature is explorable from it: the persuasion brief, the angle dial, all four platform tabs, the A/B plan, and the Ads Editor CSV download.

## Full setup

```bash
cp .env.example .env   # then fill in the two keys
pnpm dev
```

| Variable | Required | Default | Notes |
|---|---|---|---|
| `LLM_API_KEY` | yes | — | Key for any OpenAI-compatible endpoint |
| `FIRECRAWL_API_KEY` | yes | — | Page scraping + rendered screenshots |
| `LLM_BASE_URL` | no | Gemini's OpenAI-compat endpoint | Point at OpenAI, a proxy, or a local model |
| `LLM_MODEL` | no | `gemini-2.5-flash` | Primary model |
| `LLM_FALLBACK_MODELS` | no | `gemini-2.5-flash-lite,gemini-3-flash-preview,gemini-3.1-flash-lite-preview` | Comma-separated throttle-fallback chain (see below) |

```bash
pnpm test       # 53 unit tests (LLM retry/fallback logic, CSV format, scrape chain) — no API keys needed
bin/test        # smoke-test /api/analyze against ramp.com
bin/smoke       # smoke-test /api/generate with a canned brief
```

## What does it do?

1. **Analyze** — scrape the page and extract the persuasion brief: offer, audience, primary hook, pain points, proof elements, CTA and its placement, the dominant **emotional angle** (rendered on a dial: fear → urgency → value → trust → curiosity → aspiration), and up to five conversion weaknesses a buyer should fix before spending traffic on the page.
2. **Ship** — generate the campaign kit: 8–15 RSA headlines (≤30 chars) and 3–4 descriptions (≤90), 3–5 Meta variants each attacking a different angle (shown as they'd render in-feed), TikTok spoken hooks, Taboola native headlines, a prioritized A/B test plan, and effort-rated landing page fixes. Every line has a live character meter, one-click copy, and a **rewrite button with a tone selector** (punchier / more concrete / more urgent / softer) that regenerates just that line, on-brief.
3. **Compare** — analyze a competitor's page and get the asymmetries: angle gaps (claims they make that you don't), proof gaps, open positions they can't credibly contest, and ready-to-run counter-angles with example hooks.
4. **Export** — download the Google copy as an **Ads Editor bulk-import CSV** (one responsive search ad, `Status: Paused` so an import never spends money by accident), or copy any tab as plain text.

## Why did we build THIS one?

"LLM writes your ads" is the most crowded wrapper category there is — and almost every entry in it starts at the wrong end. Copy is the *last* step of a media buyer's job. The first step is the argument: what is this page actually selling, to whom, on which emotional lever, and where does the pitch leak? Skip that and you get fluent, generic copy that tests like it. So AdAngle makes the **persuasion brief a first-class artifact**: the analysis is the product, the copy is its output, and every generated line traces back to a named pain point, proof element, or weakness. It's also why competitor comparison was worth building — angles only matter relative to what the ad auction's other bidders are claiming.

The second reason is that the workflow details are where tools earn trust, and they're cheap to get right if you respect them: character limits enforced as hard constraints (with a violation-fed retry, not hope), a CSV that imports into Ads Editor *paused*, Meta copy cut to truncation-safe lengths, TikTok hooks written to be spoken not read. None of that is AI. All of it is the difference between a demo and a tool.

And third: under the hood this is a genuinely interesting engineering slice — hostile, arbitrary web pages in; strictly-typed, length-constrained structured output out; running on free-tier infrastructure that rate-limits by the day. Every layer of the pipeline (scrape → vision fallback → JSON defense → quota-aware model chain) exists because something real broke without it. The engineering notes below are the receipts.

## How it works

```
URL ──► scrape (Firecrawl markdown)
          │ empty/blocked?            ┌──────────────────────────────┐
          ├──► raw fetch + tag-strip  │  LLM layer (lib/llm.ts)      │
          │ still no text?            │  · OpenAI-compatible, no SDK │
          └──► headless-render        │  · model fallback chain      │
               screenshot ──► vision  │  · JSON repair + retry       │
                    │                 │  · length-violation retry    │
                    ▼                 └──────────────────────────────┘
            persuasion brief ──► ad copy + strategy (2 parallel calls)
                    │
                    └──► competitor brief ──► gap analysis
```

## Engineering notes

**The scrape never gives up early.** Firecrawl markdown first; if that's thin, a raw fetch with tag-stripping; if the page is a JS shell or bot-walled, Firecrawl renders it in a headless browser and the **full-page screenshot goes to the LLM as an image** — the model reads the copy, the fold line, and CTA placement off the pixels. The brief is honest about its provenance (`via Firecrawl` / `fallback scrape` / `screenshot + vision`).

**Structured output is defended in layers.** Prompt-level JSON guidance → strict `JSON.parse` → [`jsonrepair`](https://github.com/josdejong/jsonrepair) for near-misses → Zod schema validation → one retry with the *actual validation error* fed back to the model. Truncation is treated as a hard error, not a parse problem: `finish_reason: "length"` fails fast with token usage in the message instead of letting a half-object limp into repair.

**Character limits are enforced, not hoped for.** Models routinely overrun ad limits no matter what the prompt says. Generated copy passes a soft-validation layer that lists every violation precisely (`googleRSA.headlines[9] is 50 chars (limit 30): "…"`) and triggers one rewrite pass. Crucially, it can't reduce reliability: if the rewrite still overruns, the better of the two results is returned and the UI's character meters flag the rest honestly.

**Quota exhaustion is survivable and honest.** Free-tier Gemini quotas are *per-model-per-day* buckets, so a throttled primary hops instantly (~200 ms) through a fallback chain of sibling models — no blind waiting. The layer distinguishes per-minute throttles (wait once, capped, retry) from per-day caps (fail fast with a typed `LLMQuotaError`), and routes skip alternatives that share the same doomed quota — a rate-limited text analysis doesn't burn more quota on a vision attempt that can't succeed. Error messages tell users what's actually wrong: "the provider is rate-limiting this app, the page is fine" — never a false "your URL is too unusual."

**Provider-agnostic by construction.** The LLM layer speaks the OpenAI chat-completions dialect with no vendor SDK. Point `LLM_BASE_URL` at OpenAI, Gemini's compat endpoint, a proxy, or a local server and everything — including the multimodal screenshot path — comes along.

**Caching is layered and environment-aware.** Content-hashed keys (SHA-256 over model + prompts), in-memory in production, disk-backed in dev so restarts don't burn quota. Scrapes cache for 60 s, LLM results for an hour. Rewrite requests deliberately embed a random seed so repeat clicks give fresh takes instead of cache hits.

## API surface

| Route | Does |
|---|---|
| `POST /api/analyze` | `{url}` → persuasion brief (text path, screenshot+vision fallback) |
| `POST /api/generate` | `{title, brief}` → ad copy + strategy (two parallel LLM calls) |
| `POST /api/compare` | `{you, competitor}` → angle/proof gaps + counter-angles |
| `POST /api/rewrite` | `{text, kind, limit, tone, brief}` → one on-brief rewritten line |

## Known limitations

- **Scrape artifacts**: pages with animated counters can serialize as digit ribbons (`0123456789012…`). The extractor is instructed to ignore rendering artifacts rather than quote them or flag them as "weaknesses," but an unusually mangled page can still produce odd proof elements. The UI is hardened to render any of it without breaking.
- **Free-tier quotas are real**: the default setup runs on Gemini's free tier. The fallback chain multiplies headroom (each model is its own daily bucket), but a heavy day can exhaust it — at which point the app says so plainly, and demo mode still works.
- **Taboola's 60-char headline ceiling** is a best-practice figure; verify against the current spec before a real buy.
- **No persistence** — reports live in the page. Refresh and re-analyze (scrape + LLM caches make repeats cheap).

## What would we build next (if this were the full-time job)?

The generated copy is a hypothesis; the ad account is the experiment. The headline bet is an **MCP server exposing AdAngle's pipeline as tools** (`analyze_page`, `generate_kit`, `compare_competitors`) plus live **Meta and Google Ads API connectors** — push a paused campaign directly from the kit, then pull real CTR/CPA back per angle, so the A/B plan grades its own homework and the next generation round is briefed on what actually converted. That closes the loop this tool is pointed at: from "here's copy that should work" to "here's the angle that *did*."

On the way there, in order: saved reports with re-analysis diffing (watch a competitor's angle shift week over week), brand-voice constraints fed into every generation, and funnel-aware analysis (paste the whole click path — ad → LP → checkout — and find where the argument breaks between steps).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 + shadcn/base-ui · Zod 4 · Firecrawl · any OpenAI-compatible LLM (default: Gemini) · Geist + Archivo
