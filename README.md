# Zoning Literacy Assistant

A tool that answers plain-language zoning questions and checks specific sites for compliance, grounded entirely in a real bylaw excerpt: every answer traces back through retrieval, synthesis, and an independent verification pass, cites the exact clause it used, and says "not covered" instead of guessing when the excerpt doesn't address something.

**Try it live:** open `index.html` in a browser, or serve the folder with any static file server.

## Why this, specifically

A lot of "AI reads zoning" demos are really design tools: useful once you already know what a setback or an FSR is. But improving regulatory literacy also means serving someone who doesn't, a homeowner wondering if they can add a unit, a renter trying to understand what's changing on their block. That's a different interface than sliders and a 3D model: it's a question and a trustworthy answer.

So this is deliberately not a generator. It's a two-part system: grounded question answering, and structured site compliance.

## Ask a question: retrieve, answer, verify

Each question runs through three separate model calls, not one:

1. **Retrieval.** Claude sees only the *titles* of the bylaw's clauses, not their text, and picks which clause IDs are relevant to the question, including clauses that interact with each other (a question about unit count also needs the lot-threshold clause, for instance). If nothing looks relevant, the pipeline stops here and reports "not covered", no wasted synthesis call, no risk of the model reaching for outside knowledge to fill the gap.
2. **Synthesis.** A second call sees only the *full text* of the retrieved clauses (not the whole document) and answers from that, quoting the exact sentences it used.
3. **Verification.** A third, independent call checks the answer against its own quotes, and separately checks the *full list* of clause titles against what was actually retrieved, flagging if a clause that should have been considered was missed. This is the reviewer-agent pattern applied to a question instead of a design proposal.

Every answer shows its trace: which clauses were retrieved, and what verification found. One of the built-in example questions asks about laneway house height, which the excerpt deliberately doesn't detail, so you can watch the pipeline correctly return "not covered" instead of a plausible-sounding number.

## Check my site: deterministic compliance, AI narration

The second tab takes a specific lot (width, depth, whether a unit will be secured rental) and produces a structured feasibility report. The arithmetic, which unit-count tier the lot qualifies for, the buildable footprint after setbacks, floors allowed by FSR, estimated gross floor area, is computed **directly in code** from the bylaw's real numeric thresholds, the same rectangle setback/FAR logic used in the [parametric massing generator](https://github.com/RomanJahandideh/parametric-massing-generator). Claude never does the math; it's handed the already-computed numbers and asked only to narrate them in plain language with clause citations. That split matters: an LLM asked to do zoning arithmetic from scratch can get it wrong in ways that are hard to catch, deterministic code either has a bug you can test for, or it doesn't.

## Knowledge base

The built-in excerpt is the City of Vancouver's **R1-1 (Residential Inclusive)** district, the multiplex zoning that replaced single-family-only RS zoning citywide in November 2023, base provisions only: permitted uses, unit-count thresholds by frontage and lot area, setbacks, height, floor space ratio (including the conditional FSR bonus for secured rental), building dimensions, outdoor space, parking, and tree retention. It's structured as ten individually addressable clauses, not one flat block of text, specifically so retrieval can work on it. It's simplified and may not reflect the current official bylaw, this is a demo, not planning or legal advice.

## Tech

- Plain JavaScript, no framework, no build step
- Calls Claude directly from the browser using **your own Anthropic API key**, via the `anthropic-dangerous-direct-browser-access` header, the documented "bring your own key" pattern for client-side apps. The key is kept in your browser's localStorage only, never sent anywhere but directly to Anthropic, and never touches this site, there is no backend, it's a static page.
- A prompt prefill (`{`) forces a bare JSON object back from the model on every call, retrieval, synthesis, verification, and narration alike, parsed and rendered directly, no free-form text to sanitize
- Verified with mocked request-interception tests covering the full retrieve/answer/verify sequence, the short-circuit path when retrieval finds nothing, the deterministic feasibility math (hand-checked against the code independently before trusting the test), and the FSR-bonus branch, before ever touching a real API key

## Run it locally

No build step. Serve the folder and open `index.html`:

```
npx serve .
```
