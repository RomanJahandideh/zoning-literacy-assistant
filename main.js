(function () {
  "use strict";

  // Real base provisions of the City of Vancouver's R1-1 (Residential
  // Inclusive) district, the multiplex zoning that replaced single-family-only
  // RS zoning citywide in November 2023. Numbers verified against multiple
  // current sources. Simplified and incomplete on purpose (see clause 10 and
  // the closing note) to demonstrate the assistant correctly saying "not
  // covered" instead of guessing, not just answering easy questions.
  var BYLAW_TEXT = [
    "R1-1 RESIDENTIAL INCLUSIVE DISTRICT — Base Provisions (simplified excerpt, City of Vancouver, adopted November 2023)",
    "",
    "1. Permitted uses: one-family dwelling, duplex, or multi-dwelling building (multiplex) of up to six dwelling units on a standard lot, or up to eight units where all secondary units are secured rental, subject to the lot area and frontage thresholds in clause 2. A laneway house is permitted as an accessory building.",
    "",
    "2. Lot area and frontage thresholds for multiplex unit count:",
    "   - Minimum 10.0 m frontage and 306 m² lot area: 3 to 4 dwelling units.",
    "   - Minimum 13.4 m frontage and 464 m² lot area: 4 to 5 dwelling units.",
    "   - Minimum 15.1 m frontage and 557 m² lot area: 6 dwelling units (strata), or up to 8 dwelling units where all secondary units are secured rental.",
    "   Lots below the 10.0 m / 306 m² threshold may still develop under the one-family dwelling or duplex provisions of this district.",
    "",
    "3. Setbacks:",
    "   - Front yard: minimum 4.9 m.",
    "   - Side yard: minimum 1.2 m each side.",
    "   - Rear yard: minimum 10.7 m where a single principal building occupies the site.",
    "   - Where a separate rear building is provided in a courtyard configuration, the rear yard for that building may be reduced to a minimum of 0.9 m, and a minimum separation of 6.1 m must be maintained between the front and rear buildings.",
    "",
    "4. Height and storeys:",
    "   - A principal building at the front of the site, or a single building occupying the full site, is limited to a maximum height of 11.5 m and 3 storeys.",
    "   - A rear building in a courtyard configuration is limited to a maximum height of 8.5 m and 2 storeys.",
    "   - Side-by-side buildings on the same site must maintain a minimum separation of 2.4 m.",
    "",
    "5. Floor space ratio (FSR):",
    "   - Base maximum FSR is 0.70.",
    "   - Maximum FSR increases to 1.00 where at least one secondary dwelling unit is secured as rental housing, or where the development includes a below-market homeownership unit secured through a partnership with BC Housing.",
    "",
    "6. Building dimensions: maximum building depth 19.8 m; maximum building width 17.4 m.",
    "",
    "7. Outdoor space: each dwelling unit must be provided with a minimum of 7.4 m² of private outdoor space, such as a balcony, deck, roof deck, or patio.",
    "",
    "8. Parking: no vehicle parking is required for developments in the R1-1 district.",
    "",
    "9. Trees: for multiplex development, a minimum of two trees with an 8 inch trunk diameter must be retained in the front yard where feasible; where retention is not feasible, replacement planting is required.",
    "",
    "10. Laneway houses: where a lane exists, a laneway house may be permitted as an accessory dwelling in addition to the principal building(s), subject to separate siting and size regulations not detailed in this excerpt.",
    "",
    "This excerpt summarizes base provisions only and omits many conditional and discretionary provisions in the full bylaw, including heritage retention incentives, view corridors, tree protection bylaws, and site-specific rezoning conditions. It is simplified for demonstration purposes and may not reflect the current official bylaw.",
  ].join("\n");

  document.getElementById("bylaw-box").textContent = BYLAW_TEXT;

  var chatEl = document.getElementById("chat");
  var chatEmptyEl = document.getElementById("chat-empty");
  var qInput = document.getElementById("q-input");
  var askBtn = document.getElementById("ask-btn");
  var keyInput = document.getElementById("key-input");

  try {
    var savedKey = localStorage.getItem("zla_anthropic_key");
    if (savedKey) keyInput.value = savedKey;
  } catch (e) { /* localStorage unavailable, ignore */ }

  document.querySelectorAll(".example-q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      qInput.value = btn.getAttribute("data-q");
      askQuestion();
    });
  });

  var SYSTEM_PROMPT = "You answer questions about a zoning bylaw excerpt, using ONLY the excerpt text " +
    "provided, never outside knowledge, general zoning conventions, or assumptions about what a bylaw " +
    "\"probably\" says. Respond with a single JSON object only, no prose, in this exact shape: " +
    "{\"answer\": string, \"grounded\": boolean, \"quotes\": string[]}. " +
    "\"grounded\" is true only if the excerpt actually contains the information needed to answer the " +
    "question. If the excerpt does not address the question, or only partly addresses it, set " +
    "\"grounded\" to false and say plainly in \"answer\" that this isn't covered by the excerpt, do not " +
    "guess or fill the gap with general knowledge. \"quotes\" is an array of the exact sentence(s) or " +
    "clause(s) from the excerpt that support the answer (empty array if not grounded). Keep \"answer\" to " +
    "two or three plain-language sentences a non-expert could follow.";

  function renderBusyTurn(question) {
    var turn = document.createElement("div");
    turn.className = "turn";
    turn.innerHTML = "<div class=\"q-bubble\">" + escapeHtml(question) + "</div>" +
      "<div class=\"a-wrap\"><div class=\"a-busy\">Reading the bylaw excerpt…</div></div>";
    chatEmptyEl.style.display = "none";
    chatEl.appendChild(turn);
    chatEl.scrollTop = chatEl.scrollHeight;
    return turn;
  }

  function renderAnswer(turn, result) {
    var grounded = !!result.grounded;
    var quotes = Array.isArray(result.quotes) ? result.quotes : [];
    var quotesHtml = quotes.length
      ? "<div class=\"a-quotes\">" + quotes.map(function (q) {
          return "<div class=\"quote-row\">“" + escapeHtml(q) + "”</div>";
        }).join("") + "</div>"
      : "";
    turn.querySelector(".a-wrap").innerHTML =
      "<div class=\"a-badge " + (grounded ? "grounded" : "not-covered") + "\">" +
      (grounded ? "✓ grounded in the excerpt" : "⚠ not covered by this excerpt") + "</div>" +
      "<div class=\"a-text\">" + escapeHtml(result.answer || "") + "</div>" + quotesHtml;
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderError(turn, message) {
    turn.querySelector(".a-wrap").innerHTML = "<div class=\"a-badge not-covered\">⚠ error</div>" +
      "<div class=\"a-text\">" + escapeHtml(message) + "</div>";
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function askQuestion() {
    var question = qInput.value.trim();
    var key = keyInput.value.trim();
    if (!key) { alert("Enter your Anthropic API key first."); return; }
    if (!question) return;

    try { localStorage.setItem("zla_anthropic_key", key); } catch (e) { /* ignore */ }

    askBtn.disabled = true;
    qInput.value = "";
    var turn = renderBusyTurn(question);

    var userContent = "BYLAW EXCERPT:\n" + BYLAW_TEXT + "\n\nQUESTION:\n" + question;

    // Anthropic's API blocks direct browser requests unless this header opts
    // in, meant for exactly this "bring your own key" pattern: a visitor's
    // own key, used only in their own browser session, never seen by this
    // site or any server it runs (there is no server; this is a static site).
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: "{" }, // prefill forces a bare JSON object back
        ],
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return null; }).then(function (body) {
            var msg = (body && body.error && body.error.message) || (res.status + " " + res.statusText);
            throw new Error(msg);
          });
        }
        return res.json();
      })
      .then(function (data) {
        var block = data.content && data.content[0];
        var content = block && block.text;
        if (!content) throw new Error("No content in response.");
        var result;
        try { result = JSON.parse("{" + content); } catch (e) { throw new Error("Model did not return valid JSON."); }
        renderAnswer(turn, result);
      })
      .catch(function (err) {
        renderError(turn, "Couldn't get an answer: " + err.message);
      })
      .finally(function () {
        askBtn.disabled = false;
      });
  }

  askBtn.addEventListener("click", askQuestion);
  qInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") askQuestion();
  });
})();
