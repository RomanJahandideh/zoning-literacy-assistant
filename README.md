# Zoning Literacy Assistant

A chat-style tool that answers plain-language zoning questions using only a real bylaw excerpt, quoting the exact clause it used for every answer, and saying "not covered" instead of guessing when the excerpt doesn't address the question.

**Try it live:** open `index.html` in a browser, or serve the folder with any static file server.

## Why this, specifically

A lot of "AI reads zoning" demos are really design tools: useful once you already know what a setback or an FSR is. But improving regulatory literacy also means serving someone who doesn't, a homeowner wondering if they can add a unit, a renter trying to understand what's changing on their block. That's a different interface than sliders and a 3D model: it's a question and a trustworthy answer.

So this is deliberately not a generator. It's grounded question answering:

- Every answer is checked against a fixed knowledge base (the bylaw excerpt shown in the panel), never general knowledge about zoning conventions.
- Every answer is labeled **grounded** or **not covered**, and grounded answers show the exact sentence(s) they came from.
- The excerpt is real but incomplete on purpose. It permits laneway houses but doesn't detail their height limits, and one of the example questions asks about exactly that, so you can see the tool correctly decline to guess rather than fabricate a plausible-sounding number. That refusal is the actual point of the tool, not a bug to route around.

## Knowledge base

The built-in excerpt is the City of Vancouver's **R1-1 (Residential Inclusive)** district, the multiplex zoning that replaced single-family-only RS zoning citywide in November 2023, base provisions only: permitted uses, unit-count thresholds by frontage and lot area, setbacks, height, floor space ratio (including the conditional FSR bonus for secured rental), building dimensions, outdoor space, parking, and tree retention. It's simplified and may not reflect the current official bylaw, this is a demo, not planning or legal advice.

## Tech

- Plain JavaScript, no framework, no build step
- Calls Claude directly from the browser using **your own Anthropic API key**, via the `anthropic-dangerous-direct-browser-access` header, the documented "bring your own key" pattern for client-side apps. The key is kept in your browser's localStorage only, never sent anywhere but directly to Anthropic, and never touches this site, there is no backend, it's a static page.
- A prompt prefill (`{`) forces a bare JSON object back from the model every time: `{"answer": ..., "grounded": boolean, "quotes": [...]}`, parsed and rendered directly, no free-form text to sanitize
- Verified with a mocked request-interception test covering a grounded answer, a deliberately-uncovered answer, key persistence, and the no-key validation path, before ever touching a real API key

## Run it locally

No build step. Serve the folder and open `index.html`:

```
npx serve .
```
