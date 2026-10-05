# MyNaksh — Challenges at Scale & How I'd Help (Why Me)

Grounded in MyNaksh's real product and public info. Framed as: their problem → my solution → what
I bring. Use for R2 (CTO), or as a short written note. The goal: show I think about *their business*,
not just code.

## The situation
MyNaksh — AI Vedic astrology, Bengaluru, pre-seed funded (₹7.5 Cr, Eximius + Gemba). ~1M MAU → 10M in
6 months, $2M → $15M ARR, going global. AI + human astrologers, subscription. Currently in English,
Hindi, Hinglish, Marathi. Core is AI orchestration + personalization over an LLM.

---

## Challenge 1 — Multilingual & transliterated input (VALIDATED, revenue-relevant) ⭐
**Their reality:** Users love and *request* regional languages — real quotes: "chatting in Tamil made
all the difference — I didn't have to translate my problem into English first"; "Telugu language
support matters." Officially supports Hinglish (romanized), so transliteration is already core. Going
to 10M + global multiplies this.

**The problem:** Keyword/rule-based intent routing breaks on regional languages and transliterated
Tanglish/Hinglish ("en vela epdi irukum?"), sending the wrong context → weaker answers → lost trust
in exactly the languages users care most about.

**My solution (already built & tested):** A semantic LLM intent fallback that fires only when keyword
matching finds no signal — English path stays free/deterministic, while Tamil, Tanglish, and Hinglish
route correctly by meaning. Extends naturally to Telugu, Marathi, and new global languages with zero
new keyword lists.

**What I bring:** I built this end-to-end in my assignment and verified it against real inputs. This
is a direct, working answer to a need your users are literally asking for.

---

## Challenge 2 — LLM cost at 10M MAU (the biggest financial risk)
**The problem:** AI-first + per-token pricing means LLM cost scales with users. At 10M MAU, an
un-optimized pipeline burns margin fast — this is the #1 cost line for an AI astrology app.

**My solution:** (a) Context selection — send only the relevant, trimmed snippets, never raw payloads
(fewer input tokens); (b) response caching for similar question+context (many horoscope/panchang
queries repeat — huge hit rate); (c) per-tier model routing — premium gets the strong model, free
gets a cheaper/faster one; (d) token budgets + `maxWords` caps. I log token counts to *prove* the
savings, not just claim them.

**What I bring:** cost-aware AI orchestration is exactly the assignment's core, and scaling
high-concurrency backends is my day job (Neokred, 50M-account systems at BYJU'S).

---

## Challenge 3 — AI ↔ human astrologer economics (protect margin at scale)
**Their reality:** They pair AI with human experts. Humans build trust but don't scale to 10M and are
the expensive path.

**The problem:** Route too much to humans → margins collapse. Route weak AI answers to users → trust
collapses. You need to know *when the AI is good enough*.

**My solution (a genuinely clever fit):** My engine already computes a **confidence signal** (data
coverage + the model's self-assessment, taking the lower). Use it as a **routing gate**: HIGH-
confidence → serve the AI answer instantly and free; LOW-confidence → escalate to a human astrologer
(a paid, high-trust moment). Confidence becomes a lever that protects both margin *and* trust.

**What I bring:** I designed this confidence system; turning it into human-escalation routing is a
small, high-leverage addition.

---

## Challenge 4 — Trust, safety & hallucination (astrology touches sensitive topics)
**The problem:** Guidance on health, marriage, money, and children must never be a hallucinated,
confident-but-wrong LLM answer — that's a trust and even a liability risk.

**My solution:** Grounding — answer ONLY from real chart data, never invent; engine-derived sources
(the LLM can't fake what it used); honest confidence so weak answers are labeled, not oversold; and an
**eval harness** in CI (labeled questions → expected intent + sources) so quality can't silently
regress when prompts or models change.

**What I bring:** grounding, honest confidence, and unhallucinatable sources are already in my
assignment; the eval harness is the natural next step I'd own.

---

## Challenge 5 — Latency (daily engagement needs speed)
**The problem:** Daily-habit product; slow LLM answers hurt retention.

**My solution:** streaming (answer appears immediately — perceived latency near-zero), response
caching for instant repeats, and a fast small model for classification while the strong model handles
the answer.

---

## Challenge 6 — Personalization & retention (going deeper over time)
**The problem:** Their edge is AI that "learns from user behavior." That needs memory.

**My solution:** A memory layer — store and retrieve relevant past interactions as extra context
(same context-selection pattern, now with history), capped by a token budget. Makes each reading feel
continuous and personal, driving the daily habit.

---

## Why me (the one-paragraph pitch)
> "I don't just want to write backend code — I want to own the AI engine that decides your cost, your
> quality, and your reach. My assignment is a working version of that: context selection to control
> LLM cost, grounding and honest confidence for trust, and a multilingual intent fallback that already
> solves a need your Tamil and Telugu users are asking for. I've scaled high-concurrency backends and
> shipped end-to-end solo. Point me at the LLM engine and personalization, and I'll own it from cost to
> quality to the next language you launch in."

## The 3 things to say in R2
1. "Your users are asking for Tamil/Telugu — I built the multilingual routing that makes that scale."
2. "Confidence isn't just a number — it can be the gate that routes weak answers to human astrologers,
   protecting both margin and trust."
3. "At 10M MAU the LLM is your biggest cost — context selection, caching, and model tiering are how I'd
   keep it sane, and I can measure it."
