(function () {
  "use strict";

  // ==========================================================================
  // Knowledge base: real base provisions of the City of Vancouver's R1-1
  // (Residential Inclusive) district, the multiplex zoning that replaced
  // single-family-only RS zoning citywide in November 2023. Numbers verified
  // against multiple current sources. Structured as individually addressable
  // clauses (not one flat blob of text) so the system can retrieve only the
  // clauses relevant to a given question, the way the lab's own description
  // of "retrieves source clauses" implies, rather than stuffing the whole
  // document into every prompt. Numeric fields on clauses 2-5 back the
  // deterministic feasibility checker below; the LLM narrates those numbers,
  // it never computes them, to keep the arithmetic hallucination-free.
  // ==========================================================================

  var CLAUSES = [
    {
      id: 1, title: "Permitted uses",
      text: "Permitted uses: one-family dwelling, duplex, or multi-dwelling building (multiplex) of up to six dwelling units on a standard lot, or up to eight units where all secondary units are secured rental, subject to the lot area and frontage thresholds in clause 2. A laneway house is permitted as an accessory building.",
    },
    {
      id: 2, title: "Lot area and frontage thresholds for multiplex unit count",
      text: "Lot area and frontage thresholds for multiplex unit count: minimum 10.0 m frontage and 306 m² lot area for 3 to 4 dwelling units; minimum 13.4 m frontage and 464 m² lot area for 4 to 5 dwelling units; minimum 15.1 m frontage and 557 m² lot area for 6 dwelling units (strata), or up to 8 dwelling units where all secondary units are secured rental. Lots below the 10.0 m / 306 m² threshold may still develop under the one-family dwelling or duplex provisions of this district.",
      tiers: [
        { minFrontage: 15.1, minArea: 557, units: "6 units (strata), or up to 8 with secured rental" },
        { minFrontage: 13.4, minArea: 464, units: "4 to 5 units" },
        { minFrontage: 10.0, minArea: 306, units: "3 to 4 units" },
      ],
    },
    {
      id: 3, title: "Setbacks",
      text: "Setbacks: front yard minimum 4.9 m; side yard minimum 1.2 m each side; rear yard minimum 10.7 m where a single principal building occupies the site. Where a separate rear building is provided in a courtyard configuration, the rear yard for that building may be reduced to a minimum of 0.9 m, and a minimum separation of 6.1 m must be maintained between the front and rear buildings.",
      data: { front: 4.9, side: 1.2, rearSingle: 10.7, rearCourtyard: 0.9 },
    },
    {
      id: 4, title: "Height and storeys",
      text: "Height and storeys: a principal building at the front of the site, or a single building occupying the full site, is limited to a maximum height of 11.5 m and 3 storeys. A rear building in a courtyard configuration is limited to a maximum height of 8.5 m and 2 storeys. Side-by-side buildings on the same site must maintain a minimum separation of 2.4 m.",
      data: { frontMaxH: 11.5, frontStoreys: 3, rearMaxH: 8.5, rearStoreys: 2 },
    },
    {
      id: 5, title: "Floor space ratio (FSR)",
      text: "Floor space ratio (FSR): base maximum FSR is 0.70. Maximum FSR increases to 1.00 where at least one secondary dwelling unit is secured as rental housing, or where the development includes a below-market homeownership unit secured through a partnership with BC Housing.",
      data: { base: 0.70, rentalBonus: 1.00 },
    },
    {
      id: 6, title: "Building dimensions",
      text: "Building dimensions: maximum building depth 19.8 m; maximum building width 17.4 m.",
    },
    {
      id: 7, title: "Outdoor space",
      text: "Outdoor space: each dwelling unit must be provided with a minimum of 7.4 m² of private outdoor space, such as a balcony, deck, roof deck, or patio.",
    },
    {
      id: 8, title: "Parking",
      text: "Parking: no vehicle parking is required for developments in the R1-1 district.",
    },
    {
      id: 9, title: "Trees",
      text: "Trees: for multiplex development, a minimum of two trees with an 8 inch trunk diameter must be retained in the front yard where feasible; where retention is not feasible, replacement planting is required.",
    },
    {
      id: 10, title: "Laneway houses",
      text: "Laneway houses: where a lane exists, a laneway house may be permitted as an accessory dwelling in addition to the principal building(s), subject to separate siting and size regulations not detailed in this excerpt.",
    },
  ];

  var BYLAW_HEADER = "R1-1 RESIDENTIAL INCLUSIVE DISTRICT — Base Provisions (simplified excerpt, City of Vancouver, adopted November 2023)";
  var BYLAW_FOOTER = "This excerpt summarizes base provisions only and omits many conditional and discretionary provisions in the full bylaw, including heritage retention incentives, view corridors, tree protection bylaws, and site-specific rezoning conditions. It is simplified for demonstration purposes and may not reflect the current official bylaw.";

  document.getElementById("bylaw-box").textContent = BYLAW_HEADER + "\n\n" +
    CLAUSES.map(function (c) { return c.id + ". " + c.text; }).join("\n\n") + "\n\n" + BYLAW_FOOTER;

  function clauseById(id) { return CLAUSES.filter(function (c) { return c.id === id; })[0]; }

  var tabChatBtn = document.getElementById("tab-chat");
  var tabFeasBtn = document.getElementById("tab-feas");
  var chatViewEl = document.getElementById("chat-view");
  var feasViewEl = document.getElementById("feas-view");
  tabChatBtn.addEventListener("click", function () {
    tabChatBtn.classList.add("active"); tabFeasBtn.classList.remove("active");
    chatViewEl.style.display = "flex"; feasViewEl.style.display = "none";
  });
  tabFeasBtn.addEventListener("click", function () {
    tabFeasBtn.classList.add("active"); tabChatBtn.classList.remove("active");
    feasViewEl.style.display = "block"; chatViewEl.style.display = "none";
  });

  // ==========================================================================
  // Shared Claude caller. Anthropic's API blocks direct browser requests
  // unless this header opts in, meant for exactly this "bring your own key"
  // pattern: a visitor's own key, used only in their own browser session,
  // never seen by this site or any server it runs (there is no server; this
  // is a static site).
  // ==========================================================================

  function callClaude(key, systemPrompt, userContent, maxTokens) {
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: "{" }, // prefill forces a bare JSON object back
        ],
      }),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (body) {
          var msg = (body && body.error && body.error.message) || (res.status + " " + res.statusText);
          throw new Error(msg);
        });
      }
      return res.json();
    }).then(function (data) {
      var block = data.content && data.content[0];
      var content = block && block.text;
      if (!content) throw new Error("No content in response.");
      try { return JSON.parse("{" + content); } catch (e) { throw new Error("Model did not return valid JSON."); }
    });
  }

  function getKey() {
    var key = document.getElementById("key-input").value.trim();
    if (key) { try { localStorage.setItem("zla_anthropic_key", key); } catch (e) { /* ignore */ } }
    return key;
  }

  try {
    var savedKey = localStorage.getItem("zla_anthropic_key");
    if (savedKey) document.getElementById("key-input").value = savedKey;
  } catch (e) { /* localStorage unavailable, ignore */ }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ==========================================================================
  // Three-stage grounded Q&A pipeline: retrieve the relevant clause IDs,
  // synthesize an answer from only those clauses' full text, then an
  // independent verification pass checks the answer against the quotes it
  // used and flags any clause the retrieval step may have missed. Mirrors
  // the retrieve -> generate -> review pattern the lab's own project
  // description uses for massing proposals, applied here to a question
  // instead of a 3D form.
  // ==========================================================================

  var RETRIEVAL_SYSTEM = "You are the retrieval stage of a zoning question-answering system. Given a " +
    "question and a list of available bylaw clauses (id and title only, not full text), select every " +
    "clause ID that could be relevant to answering the question, including clauses that interact with " +
    "or qualify each other, for example a question about unit count also needs the clause defining lot " +
    "thresholds, and a question about floor area also needs the FSR clause. Respond with a single JSON " +
    "object only, no prose: {\"clauseIds\": [number, ...]}. Be inclusive rather than narrow: a missed " +
    "clause produces a wrong answer, an extra clause is harmless. Return an empty array if nothing seems relevant.";

  var SYNTHESIS_SYSTEM = "You answer questions about a zoning bylaw, using ONLY the clause text provided, " +
    "never outside knowledge, general zoning conventions, or assumptions about what a bylaw \"probably\" " +
    "says. Respond with a single JSON object only, no prose, in this exact shape: " +
    "{\"answer\": string, \"grounded\": boolean, \"quotes\": string[]}. \"grounded\" is true only if the " +
    "provided clauses actually contain the information needed to answer the question. If they don't, or " +
    "only partly do, set \"grounded\" to false and say plainly in \"answer\" that this isn't covered, do " +
    "not guess or fill the gap. \"quotes\" is the exact sentence(s) from the provided clauses that " +
    "support the answer (empty if not grounded). Keep \"answer\" to two or three plain-language sentences.";

  var VERIFY_SYSTEM = "You are the verification stage of a zoning question-answering system, checking an " +
    "earlier retrieval-and-answer step's work. You'll get the question, the full list of available clause " +
    "titles, the clauses that were actually retrieved and used with their text, and the answer produced. " +
    "Check two things: (1) is the answer actually supported by the quoted text, not overstated or " +
    "misread, and (2) based on the full list of clause titles, does any clause that was NOT retrieved " +
    "look like it should have been considered for this question. Respond with a single JSON object only, " +
    "no prose: {\"verified\": boolean, \"missedClauses\": number[], \"note\": string}. \"verified\" is " +
    "true only if the answer is well-supported and nothing looks missed. \"note\" is one short sentence.";

  var chatEl = document.getElementById("chat");
  var chatEmptyEl = document.getElementById("chat-empty");
  var qInput = document.getElementById("q-input");
  var askBtn = document.getElementById("ask-btn");

  function renderBusyTurn(question) {
    var turn = document.createElement("div");
    turn.className = "turn";
    turn.innerHTML = "<div class=\"q-bubble\">" + escapeHtml(question) + "</div>" +
      "<div class=\"a-wrap\"><div class=\"a-busy\">Retrieving relevant clauses…</div></div>";
    chatEmptyEl.style.display = "none";
    chatEl.appendChild(turn);
    chatEl.scrollTop = chatEl.scrollHeight;
    return turn;
  }

  function setBusyStage(turn, text) {
    var busy = turn.querySelector(".a-busy");
    if (busy) busy.textContent = text;
  }

  function renderAnswer(turn, result, retrievedIds, verify) {
    var grounded = !!result.grounded;
    var quotes = Array.isArray(result.quotes) ? result.quotes : [];
    var quotesHtml = quotes.length
      ? "<div class=\"a-quotes\">" + quotes.map(function (q) {
          return "<div class=\"quote-row\">“" + escapeHtml(q) + "”</div>";
        }).join("") + "</div>"
      : "";
    var traceHtml = "<div class=\"a-trace\">Retrieved clause" + (retrievedIds.length === 1 ? "" : "s") + ": " +
      (retrievedIds.length ? retrievedIds.map(function (id) { return "#" + id; }).join(", ") : "none") +
      (verify ? " &middot; Verification: " + (verify.verified
        ? "✓ checked, no gaps found"
        : "⚠ " + escapeHtml(verify.note || "possible gap") +
          (verify.missedClauses && verify.missedClauses.length ? " (see clause" + (verify.missedClauses.length === 1 ? "" : "s") + " " + verify.missedClauses.map(function (id) { return "#" + id; }).join(", ") + ")" : ""))
        : "") + "</div>";
    turn.querySelector(".a-wrap").innerHTML =
      "<div class=\"a-badge " + (grounded ? "grounded" : "not-covered") + "\">" +
      (grounded ? "✓ grounded in the excerpt" : "⚠ not covered by this excerpt") + "</div>" +
      "<div class=\"a-text\">" + escapeHtml(result.answer || "") + "</div>" + quotesHtml + traceHtml;
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderError(turn, message) {
    turn.querySelector(".a-wrap").innerHTML = "<div class=\"a-badge not-covered\">⚠ error</div>" +
      "<div class=\"a-text\">" + escapeHtml(message) + "</div>";
  }

  function askQuestion() {
    var question = qInput.value.trim();
    var key = getKey();
    if (!key) { alert("Enter your Anthropic API key first."); return; }
    if (!question) return;

    askBtn.disabled = true;
    qInput.value = "";
    var turn = renderBusyTurn(question);

    var clauseIndex = CLAUSES.map(function (c) { return { id: c.id, title: c.title }; });
    var retrievedIds = [];

    callClaude(key, RETRIEVAL_SYSTEM, "AVAILABLE CLAUSES:\n" + JSON.stringify(clauseIndex, null, 2) + "\n\nQUESTION:\n" + question, 200)
      .then(function (retrieval) {
        retrievedIds = Array.isArray(retrieval.clauseIds) ? retrieval.clauseIds.filter(function (id) { return clauseById(id); }) : [];
        setBusyStage(turn, "Answering from " + retrievedIds.length + " retrieved clause" + (retrievedIds.length === 1 ? "" : "s") + "…");

        if (retrievedIds.length === 0) {
          return { answer: "This doesn't appear to be covered by the R1-1 excerpt.", grounded: false, quotes: [] };
        }
        var retrievedText = retrievedIds.map(function (id) { var c = clauseById(id); return "Clause " + c.id + " (" + c.title + "): " + c.text; }).join("\n\n");
        return callClaude(key, SYNTHESIS_SYSTEM, "RETRIEVED CLAUSES:\n" + retrievedText + "\n\nQUESTION:\n" + question, 400);
      })
      .then(function (synthesis) {
        setBusyStage(turn, "Verifying the answer…");
        if (retrievedIds.length === 0) {
          renderAnswer(turn, synthesis, retrievedIds, null);
          return;
        }
        var retrievedText = retrievedIds.map(function (id) { var c = clauseById(id); return "Clause " + c.id + " (" + c.title + "): " + c.text; }).join("\n\n");
        var verifyContent = "ALL CLAUSE TITLES:\n" + JSON.stringify(clauseIndex, null, 2) +
          "\n\nRETRIEVED AND USED:\n" + retrievedText +
          "\n\nQUESTION:\n" + question + "\n\nANSWER PRODUCED:\n" + JSON.stringify(synthesis, null, 2);
        return callClaude(key, VERIFY_SYSTEM, verifyContent, 250)
          .then(function (verify) { renderAnswer(turn, synthesis, retrievedIds, verify); })
          .catch(function () { renderAnswer(turn, synthesis, retrievedIds, null); }); // verification failing shouldn't hide the answer
      })
      .catch(function (err) {
        renderError(turn, "Couldn't get an answer: " + err.message);
      })
      .finally(function () {
        askBtn.disabled = false;
      });
  }

  askBtn.addEventListener("click", askQuestion);
  qInput.addEventListener("keydown", function (e) { if (e.key === "Enter") askQuestion(); });
  document.querySelectorAll(".example-q").forEach(function (btn) {
    btn.addEventListener("click", function () { qInput.value = btn.getAttribute("data-q"); askQuestion(); });
  });

  // ==========================================================================
  // Structured feasibility checker: unlike the open-ended chat above, this
  // takes a specific site (lot width, depth, rental bonus) and computes
  // compliance deterministically in code, the same rectangle setback/FAR
  // arithmetic used in the parametric massing generator, then asks Claude
  // only to narrate the already-computed result in plain language with
  // citations. The LLM never does the arithmetic itself, which removes the
  // most likely source of a wrong number.
  // ==========================================================================

  var NARRATE_SYSTEM = "You write a short, plain-language feasibility summary for a zoning compliance " +
    "result that was already computed deterministically, given to you as JSON. Do not recalculate or " +
    "alter any number given to you, only explain what they mean in plain language and cite which clause " +
    "number each figure comes from (clause numbers are included in the data). Respond with a single JSON " +
    "object only, no prose: {\"summary\": string}. 3 to 4 sentences a non-expert could follow.";

  function computeFeasibility(width, depth, rentalBonus) {
    var lotArea = width * depth;
    var c2 = clauseById(2), c3 = clauseById(3), c4 = clauseById(4), c5 = clauseById(5);
    var tier = c2.tiers.filter(function (t) { return width >= t.minFrontage && lotArea >= t.minArea; })[0];
    var far = rentalBonus ? c5.data.rentalBonus : c5.data.base;
    var buildableW = Math.max(0, width - 2 * c3.data.side);
    var buildableD = Math.max(0, depth - c3.data.front - c3.data.rearSingle);
    var footprintArea = buildableW * buildableD;
    var maxGFA = far * lotArea;
    var floorsByFAR = footprintArea > 0 ? Math.floor(maxGFA / footprintArea) : 0;
    var floors = Math.max(0, Math.min(c4.data.frontStoreys, floorsByFAR));
    var estimatedGFA = floors * footprintArea;
    return {
      lotWidth: width, lotDepth: depth, lotArea: round1(lotArea),
      qualifiesFor: tier ? tier.units : "below the multiplex minimum (needs at least " + c2.tiers[c2.tiers.length - 1].minFrontage + "m frontage and " + c2.tiers[c2.tiers.length - 1].minArea + "m²); duplex or single-family provisions would apply instead (clause 1)",
      qualifiesClause: 2,
      setbacksUsed: { front: c3.data.front, side: c3.data.side, rear: c3.data.rearSingle, clause: 3 },
      buildableFootprint: round1(footprintArea),
      maxStoreys: c4.data.frontStoreys, maxHeight: c4.data.frontMaxH, heightClause: 4,
      farUsed: far, farClause: 5, rentalBonusApplied: !!rentalBonus,
      estimatedFloors: floors, estimatedGFA: round1(estimatedGFA),
    };
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  var feasBtn = document.getElementById("feas-btn");
  var feasResultEl = document.getElementById("feas-result");

  feasBtn.addEventListener("click", function () {
    var key = getKey();
    if (!key) { alert("Enter your Anthropic API key first."); return; }
    var width = parseFloat(document.getElementById("feas-width").value);
    var depth = parseFloat(document.getElementById("feas-depth").value);
    var rental = document.getElementById("feas-rental").checked;
    if (!width || !depth) { alert("Enter a lot width and depth first."); return; }

    feasBtn.disabled = true;
    var computed = computeFeasibility(width, depth, rental);
    feasResultEl.innerHTML = "<div class=\"a-busy\">Computing compliance, then asking Claude to explain it…</div>";
    feasResultEl.style.display = "block";

    callClaude(key, NARRATE_SYSTEM, "COMPUTED RESULT:\n" + JSON.stringify(computed, null, 2), 350)
      .then(function (narration) {
        var dataRows = [
          "Lot: " + computed.lotWidth + "m × " + computed.lotDepth + "m (" + computed.lotArea + " m²)",
          "Qualifies for: " + computed.qualifiesFor + " (clause " + computed.qualifiesClause + ")",
          "Setbacks applied: front " + computed.setbacksUsed.front + "m, side " + computed.setbacksUsed.side + "m, rear " + computed.setbacksUsed.rear + "m (clause " + computed.setbacksUsed.clause + ")",
          "Buildable footprint: " + computed.buildableFootprint + " m²",
          "Max storeys / height: " + computed.maxStoreys + " / " + computed.maxHeight + "m (clause " + computed.heightClause + ")",
          "FSR used: " + computed.farUsed + (computed.rentalBonusApplied ? " (rental bonus applied)" : " (base rate)") + " (clause " + computed.farClause + ")",
          "Estimated floors: " + computed.estimatedFloors + " · Estimated GFA: " + computed.estimatedGFA + " m²",
        ];
        feasResultEl.innerHTML = "<div class=\"a-text\" style=\"margin-bottom:10px;\">" + escapeHtml(narration.summary || "") + "</div>" +
          "<div class=\"feas-data\">" + dataRows.map(function (r) { return "<div>" + escapeHtml(r) + "</div>"; }).join("") + "</div>";
      })
      .catch(function (err) {
        feasResultEl.innerHTML = "<div class=\"a-badge not-covered\">⚠ error</div><div class=\"a-text\">" + escapeHtml(err.message) + "</div>";
      })
      .finally(function () {
        feasBtn.disabled = false;
      });
  });
})();
