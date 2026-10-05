# 🎯 Walk-In Checklist — R1, 4:00 PM

Keep this open in a side tab. You've done the work. This is just your anchor.

---

## ⏰ Before the call (by 3:45)
- [ ] `npm test` → 23 pass. `npm run typecheck` → clean. (So you can say "tests green.")
- [ ] Repo open at `pipeline.ts`. `README.md` in another tab.
- [ ] Camera, mic, internet tested. Quiet room. Water. Phone silent.
- [ ] This file + `QA_BANK.md` open.
- [ ] 3:45 — stop studying. Breathe. Walk around for 2 minutes.

---

## 🗣️ THE 5 ANCHOR SENTENCES (if nerves hit, fall back to one of these)
1. **Big idea:** "Context selection is the product — everything else is plumbing."
2. **Intent:** "Keyword scoring — deterministic, free, testable; ambiguity widens to general."
3. **Confidence:** "Two signals — data coverage and the model's self-assessment — I take the lower."
4. **sourcesUsed:** "Engine-derived, never from the LLM, so it can't hallucinate a source."
5. **Failure:** "An upstream failure lowers confidence, it never crashes the request."

---

## 🎬 Your opening answer (if they say "walk me through it")
> "It's the intelligence layer between MyNaksh's services — User, Kundli, Horoscope, Panchang — and
> the LLM. When someone asks about their career, it figures out it's a career question, fetches only
> the relevant data, trims it into snippets, and sends a focused prompt to the AI for a grounded,
> personalized answer. The core idea: context selection is the product — everything else is plumbing."

Then STOP. Let them ask the next thing.

---

## ✅ 4 RULES FOR THE ROOM
1. **Answer in 2-3 sentences, then STOP.** Let them pull the thread. Don't monologue.
2. **Answer the question they asked** — don't default to confidence. Unsure what they mean? Ask.
3. **Don't know it? Say so, then reason:** "I didn't build that, but here's how I'd approach it..."
   Reasoning out loud beats bluffing — for this team it IS the audition.
4. **Say service names slowly:** User, Kundli, Horoscope, Panchang.

---

## 💬 Your honesty answer (if AI / Python / AI-ML comes up)
> "Yes, I built it AI-assisted, and I was upfront about being light on Python and AI/ML. What I made
> sure of is that I understand the design and can defend every decision. On the gaps — when I started
> I only knew C, no JavaScript or React, and I learned them by understanding how things work
> underneath. Python and AI/ML are the same story. AI is a tool I use well, but I own the thinking."

Calm, honest, ends on ownership. This is your strongest card.

---

## 🔧 If they say "change the code" (you've done this — you added 'education'!)
> "Most changes are config, not code. Adding an intent is a row in `rules.config.ts` — and TypeScript's
> `Record<Intent, IntentRule>` makes the build fail until I've handled it everywhere, so the type
> system is my checklist. I actually added an 'education' intent while prepping — happy to show it."

The 4 seams: new intent → rules.config | new context key → catalog | new LLM → implement LlmProvider |
new service → implement ServiceGateway.

---

## ❓ YOUR questions for them (ask 2-3 — it signals seriousness)
- "At 1M→10M MAU in 6 months, what's the bottleneck that worries you most right now?"
- "How's the AI stack split today — orchestration, models, retrieval — and where would I own?"
- "What does the first 90 days look like in this seat?"
- "For someone strong in Node ramping on Python and deeper AI/ML, how do you see that going here?"

---

## 🧠 Mindset
- They advanced you knowing your gaps → they're betting on **learning speed + ownership**, not a résumé.
- You went from "I don't know" to modifying and testing the codebase in one day. That's the exact trait
  they're hiring for. Show them that person.
- One conversation. Be honest, be curious, reason out loud. You've got this.
