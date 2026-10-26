/* POLISCI 158 · Section 5 lab — page behavior.
   All texts and scores come from window.S5 (data.js), generated from a real run's export bundle by
   ta-solution/pipeline/bundle_to_site.py. This file only displays them and computes, in the
   browser: agreement with the judge, a Bradley–Terry reward model fitted to the student's picks,
   the exact KL-regularized optimum over the real candidate replies, and summary statistics.
   Student work is stored in this browser's localStorage under the "ps158s5:" prefix. */
(function () {
  "use strict";

  var KEY = "ps158s5:";
  var B = window.S5, META = window.S5_META || {};
  var RULES = ["balance", "helpful"];   // keys in the run's data; the judge used B.rules[key] word for word
  // Display names. The two rules differ on one question: when a user asks the model to take a side.
  var RULE_LABEL = { balance: "Balance", helpful: "Helpful" };
  var RULE_MEANS = {
    balance: "Even if asked to argue one side, give both sides and take none.",
    helpful: "If asked to argue one side, argue it well, and do the same for the other side."
  };
  var RULE_EXAMPLE = {
    balance: "Lays out the arguments for and against rent control, without arguing for either.",
    helpful: "Writes a strong case that rent control protects tenants, and would write an equally strong case for the opposite request."
  };
  function rl(r) { return RULE_LABEL[r] || r; }
  var FEATS = ["words", "hedge_phrases", "refusal_phrases", "first_person_opinion", "bullet_lines"];
  var FEAT_LABEL = {
    words: "Length (words)", hedge_phrases: "Hedging phrases", refusal_phrases: "Refusal phrases",
    first_person_opinion: "\"I think / I believe…\"", bullet_lines: "Bullet-point lines"
  };
  var SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];  // categorical slots 1–3 (validated all-pairs)
  var BETAS = [0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10, 30, Infinity];
  var QUESTIONS = ["d2", "d3", "q1a", "q1b", "q2a", "q2b", "q3a", "q3b", "q3c", "q3d"];
  var Q_LABELS = {
    d2: "Your neutrality rule", d3: "Your prediction",
    q1a: "1A · Do you agree with the judge?", q1b: "1B · Is the judge right?",
    q2a: "2A · What did your picks favor?", q2b: "2B · High score, wrong reply",
    q3a: "3A · One request", q3b: "3B · The real run", q3c: "3C · A shortcut", q3d: "3D · Back to your prediction"
  };

  function load(k, fallback) {
    try { var v = localStorage.getItem(KEY + k); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pct(x) { return isFinite(x) ? Math.round(100 * x) + "%" : "–"; }
  function f2(x) { return isFinite(x) ? x.toFixed(2) : "–"; }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : NaN; }
  // Display only: escape the reply, then show Markdown headings and **bold** as bold. Text is unchanged.
  function md(t) {
    return esc(t).split("\n").map(function (line) {
      var h = line.match(/^\s*#{1,6}\s+(.*)$/);
      if (h) line = "<b>" + h[1] + "</b>";
      return line.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    }).join("\n");
  }
  function setReply(el, text, truncated) { el.innerHTML = md(text) + (truncated ? " <span class='muted'>[cut off]</span>" : ""); }
  function words(t) { return (t.toLowerCase().match(/[a-z']+/g) || []).length; }  // same regex as the pipeline
  // Slider position 0..12 (0 = no change) -> index into BETAS (12 = infinite beta = no change).
  function changeLabel(v) {
    return v === 0 ? "Not at all" : v <= 3 ? "A little" : v <= 7 ? "Some" : v <= 10 ? "A lot" : "As much as it wants";
  }

  if (!B) {
    document.getElementById("dev-banner").hidden = false;
    document.getElementById("dev-banner").textContent = "No data loaded: data.js is missing.";
    return;
  }

  /* ---------- Data banner + fills ---------- */
  var M = B.manifest, CFG = M.config;
  if (["colab", "local"].indexOf(META.config) < 0) {
    var ban = $("#dev-banner");
    ban.hidden = false;
    ban.textContent = "Development data. This page is showing a small local test run (config \"" +
      (META.config || CFG.name) + "\"), not the real Colab run. The replies are short and the numbers mean nothing. Do not use this version in section.";
  }
  var POLICY = M.decisions.policy || CFG.policy;
  var RL_POLICY = CFG.rl_policy || POLICY;  // the model the real run in Part 3 trains (may be smaller than POLICY)
  var fills = {
    policy: POLICY.replace("Qwen/", ""),
    judge: CFG.judge.replace("Qwen/", "") + (CFG.judge_4bit ? ", 4-bit" : ""),
    "max-tokens": String(CFG.max_new_tokens),
    "max-words": String(Math.round(CFG.max_new_tokens * 0.75)),  // rule of thumb: ~0.75 English words per token
    "rate-n": String((window.S5_RATE ? window.S5_RATE.pairs : B.rate_pairs).length)
  };

  var promptById = {};
  B.prompts.forEach(function (p) { promptById[p.id] = p; });
  var STYLE_TEXT = B.styles;

  /* ---------- Answers, name ---------- */
  var answers = load("answers", {});
  var nameIn = $("#s-name"), partnerIn = $("#s-partner");
  nameIn.value = load("name", "");
  partnerIn.value = load("partner", "");
  nameIn.addEventListener("input", function () { save("name", nameIn.value); refresh(); });
  partnerIn.addEventListener("input", function () { save("partner", partnerIn.value); refresh(); });
  $$("textarea[data-q]").forEach(function (ta) {
    var q = ta.getAttribute("data-q");
    ta.value = answers[q] || "";
    ta.addEventListener("input", function () { answers[q] = ta.value; save("answers", answers); echoes(); refresh(); });
  });
  // Starter rules above the rule box. Ask before replacing a rule the student already wrote.
  $$("#rule-chips .chip").forEach(function (c) {
    c.addEventListener("click", function () {
      var ta = $("#rule-text"), rule = c.getAttribute("data-rule");
      if (ta.value.trim() && ta.value.trim() !== rule && !window.confirm("Replace the rule you wrote with this one?")) return;
      ta.value = rule;
      answers.d2 = ta.value; save("answers", answers); echoes(); refresh();
      ta.focus();
    });
  });
  function echoes() {
    var r = (answers.d2 || "").trim(), d = (answers.d3 || "").trim();
    $("#rule-echo").textContent = r || "(write it in the discussion first)";
    $("#rule-echo").className = r ? "" : "muted";
    $("#d3-echo").textContent = d || "(not written yet)";
    $("#d3-echo").className = d ? "" : "muted";
  }

  /* ---------- Recap: base vs. instruct (real replies) ---------- */
  // base_demo.js: the lab's running request to a base model (as plain text) and its post-trained
  // version, three samples each in the order generated. Falls back to the bundle's first example.
  var BD = window.S5_BASE_DEMO;
  var BD_SHOW = { base: 0, instruct: 1 };  // one typical sample each, chosen by the TAs; all three are in the run record
  if (BD) {
    $("#base-demo").hidden = false;
    $("#base-demo-cap").textContent = "Request (the same one we use all day): \u201c" + BD.request + "\u201d. One typical reply from each model (we generated three of each).";
    $("#base-demo-h1").textContent = BD.base.model.replace("Qwen/", "") + ", before post-training (given the request as plain text)";
    $("#base-demo-h2").textContent = BD.instruct.model.replace("Qwen/", "") + ", after post-training";
    setReply($("#base-demo-base"), BD.base.samples[BD_SHOW.base].text, BD.base.samples[BD_SHOW.base].truncated);
    setReply($("#base-demo-inst"), BD.instruct.samples[BD_SHOW.instruct].text, BD.instruct.samples[BD_SHOW.instruct].truncated);
  } else if (B.base_vs_instruct && B.base_vs_instruct.length) {
    var d0 = B.base_vs_instruct[0];
    $("#base-demo").hidden = false;
    $("#base-demo-cap").textContent = "Request: \u201c" + d0.prompt + "\u201d";
    $("#base-demo-h1").textContent = d0.base.model.replace("Qwen/", "") + ", before post-training";
    $("#base-demo-h2").textContent = d0.instruct.model.replace("Qwen/", "") + ", after post-training";
    setReply($("#base-demo-base"), d0.base.text, d0.base.truncated);
    setReply($("#base-demo-inst"), d0.instruct.text, d0.instruct.truncated);
  }

  /* =====================================================================
     PART 1 · Be the rater
     ===================================================================== */
  // Pairs to rate: the curated set from rate_set.js (chosen by fixed slots from the run's judged
  // pairs), else the bundle's. Statistics and the judge's columns use every judged pair.
  var RATE = window.S5_RATE || null;
  var PAIRS = RATE ? RATE.pairs : B.rate_pairs;
  var JUDGE_ALL = RATE ? RATE.judge_pairs : PAIRS;
  if (RATE) PAIRS.forEach(function (p) {
    if (!promptById[p.prompt_id]) promptById[p.prompt_id] = { id: p.prompt_id, prompt: p.prompt, topic: p.topic, template: p.template,
      template_category: p.template_category, side: p.side, group: p.group };
  });
  var votes = load("votes", {});   // pairKey -> 1 | 2 | 0
  var cur = Math.min(load("cur", 0), PAIRS.length - 1);
  function pairKey(p) { return p.cid_1 + "|" + p.cid_2; }
  function judgePick(p, rule) { return p.judge[rule] ? (p.judge[rule].p_1_better > 0.5 ? 1 : 2) : null; }

  // The two-rule card: plain meaning, one example, the exact wording the judge used, and how often
  // the judge's two verdicts differ, over every pair it judged in the run (computed from the real verdicts).
  (function () {
    var both = JUDGE_ALL.filter(function (p) { return p.judge.balance && p.judge.helpful; });
    var diff = both.filter(function (p) { return judgePick(p, "balance") !== judgePick(p, "helpful"); }).length;
    // The pairs where the two rules must disagree: one one-sided reply and one both-sides reply.
    var contrast = both.filter(function (p) { var st = [p.style_1, p.style_2].sort().join("|"); return st === "both-sides|one-sided"; });
    var cdiff = contrast.filter(function (p) { return judgePick(p, "balance") !== judgePick(p, "helpful"); }).length;
    $("#rule-pair").innerHTML =
      "<p class='res-h'>Our two rules</p>" +
      "<p class='rp-q'>Both rules aim to be fair. They disagree on one question: <b>when a user asks the model to take a side, what should it do?</b></p>" +
      "<div class='rp-cols'>" + RULES.map(function (r, i) {
        return "<div class='rp-col'><p class='rp-name'><span class='rp-letter'>" + "AB"[i] + "</span>" + esc(rl(r)) + "</p>" +
          "<p>" + esc(RULE_MEANS[r]) + "</p>" +
          "<p class='small'><b>Asked “Argue that rent control protects tenants”:</b> " + esc(RULE_EXAMPLE[r]) + "</p>" +
          "<details><summary class='small'>Exact wording the judge used</summary><p class='small muted'>" + esc(B.rules[r]) + "</p></details></div>";
      }).join("") + "</div>" +
      "<p class='small'>" + (contrast.length ? "When one reply argues one side and the other gives both sides, the judge's two rules picked <b>different replies " + pct(cdiff / contrast.length) + "</b> of the time (" + cdiff + " of " + contrast.length + " such pairs the judge compared in the run). " : "") +
        (both.length ? "Across all " + both.length + " pairs: " + pct(diff / both.length) + "." : "") + "</p>" +
      "<p class='small muted'>These are our two example rules, not either company's. “Helpful” is close to Anthropic's “help both sides equally”, plus not refusing (both companies count refusals as a problem). “Balance” is close to Anthropic's “mention the other side” and OpenAI's “covering only one side”.</p>";
  })();

  // What the model was actually given when it wrote a reply (stored with every reply in the run).
  function askedSentence(style, asked, request) {
    if (style === "default" || !asked || asked === request) return "the request as it is (the model's default reply)";
    return "a " + style + " version of the request: \u201c" + asked + "\u201d";
  }
  function renderPair() {
    var p = PAIRS[cur], pr = promptById[p.prompt_id];
    $("#rate-count").textContent = "Pair " + (cur + 1) + " of " + PAIRS.length;
    $("#rate-topic").textContent = pr ? pr.topic.replace(/_/g, " ") + " \u00b7 " + pr.template_category.replace(/_/g, " ") : "";
    $("#rate-prompt").textContent = pr ? pr.prompt : p.prompt_id;
    setReply($("#rate-r1"), p.text_1, false);
    setReply($("#rate-r2"), p.text_2, false);
    var v = votes[pairKey(p)];
    $$("#rate-buttons button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(v !== undefined && String(v) === b.getAttribute("data-vote")));
    });
    var rev = $("#rate-reveal");
    if (v === undefined) { rev.hidden = true; }
    else {
      rev.hidden = false;
      var req = pr ? pr.prompt : "";
      var lines = ["<p><b>Reply 1</b> was written from " + esc(askedSentence(p.style_1, p.asked_1, req)) + "<br><b>Reply 2</b> was written from " + esc(askedSentence(p.style_2, p.asked_2, req)) + "</p>"];
      RULES.forEach(function (r) {
        var j = p.judge[r];
        if (!j) return;
        var pick = judgePick(p, r), conf = pick === 1 ? j.p_1_better : 1 - j.p_1_better;
        var agree = v === 0 ? "" : (v === pick ? " \u2714 you agree" : " \u2716 you disagree");
        lines.push("<p>Judge, \u201c" + esc(rl(r)) + "\u201d: <b>Reply " + pick + "</b> (" + pct(conf) + " sure)" + agree +
          (j.order_consistent ? "" : " \u00b7 <span class='flag'>changed its verdict when the replies swapped places</span>") + "</p>");
      });
      rev.innerHTML = lines.join("");
    }
    $("#rate-prev").disabled = cur === 0;
    $("#rate-next").disabled = cur === PAIRS.length - 1;
    rateStats();
  }
  $$("#rate-buttons button").forEach(function (b) {
    b.addEventListener("click", function () {
      votes[pairKey(PAIRS[cur])] = Number(b.getAttribute("data-vote"));
      save("votes", votes); renderPair(); refresh();
    });
  });
  $("#rate-prev").addEventListener("click", function () { if (cur > 0) { cur--; save("cur", cur); renderPair(); } });
  $("#rate-next").addEventListener("click", function () { if (cur < PAIRS.length - 1) { cur++; save("cur", cur); renderPair(); } });

  function rated() { return PAIRS.filter(function (p) { return votes[pairKey(p)] !== undefined; }); }
  function rateStats() {
    var r = rated(), decided = r.filter(function (p) { return votes[pairKey(p)] !== 0; });
    $("#s-rated").textContent = r.length + " of " + PAIRS.length;
    $("#s-tie").textContent = r.length - decided.length;
    RULES.forEach(function (rule) {
      var n = 0, a = 0;
      decided.forEach(function (p) { var j = judgePick(p, rule); if (j) { n++; if (j === votes[pairKey(p)]) a++; } });
      $("#s-agree-" + rule).textContent = n ? pct(a / n) + " (" + a + "/" + n + ")" : "–";
    });
    var n2 = 0, c2 = 0;
    r.forEach(function (p) { RULES.forEach(function (rule) { if (p.judge[rule]) { n2++; if (p.judge[rule].order_consistent) c2++; } }); });
    $("#s-judge-consistent").textContent = n2 ? pct(c2 / n2) : "–";
  }

  /* =====================================================================
     PART 2 · Your reward model (Bradley–Terry on five counted features)
     ===================================================================== */
  $("#feature-list").innerHTML = [
    ["Length (words)", "How many words the reply has."],
    ["Hedging phrases", "Counts of phrases like " + B.features_doc.hedge_phrases.slice(0, 6).map(function (s) { return "\u201c" + s.trim() + "\u201d"; }).join(", ") + " (" + B.features_doc.hedge_phrases.length + " phrases in all)."],
    ["Refusal phrases", "Counts of phrases like " + B.features_doc.refusal_phrases.slice(0, 4).map(function (s) { return "\u201c" + s + "\u201d"; }).join(", ") + "."],
    ["\"I think / I believe…\"", "The reply states its own view: I believe, think, support, oppose, feel."],
    ["Bullet-point lines", "Lines that start with a bullet or a number."]
  ].map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("");

  // Standardize with the mean and SD of each feature over every reply shown in Part 1.
  var STAT = {};
  FEATS.forEach(function (f) {
    var xs = [];
    JUDGE_ALL.forEach(function (p) { xs.push(p.features_1[f], p.features_2[f]); });
    var m = mean(xs), sd = Math.sqrt(mean(xs.map(function (x) { return (x - m) * (x - m); })));
    STAT[f] = { m: m, sd: sd > 0 ? sd : 1 };
  });
  function z(feat) { return FEATS.map(function (f) { return (feat[f] - STAT[f].m) / STAT[f].sd; }); }
  function dot(w, x) { var s = 0; for (var i = 0; i < w.length; i++) s += w[i] * x[i]; return s; }
  function sigmoid(t) { return 1 / (1 + Math.exp(-t)); }

  // Logistic regression without intercept on feature differences, L2 penalty, Newton steps.
  function fitBT(rows, lambda) {
    var k = FEATS.length, w = new Array(k).fill(0);
    for (var it = 0; it < 50; it++) {
      var g = w.map(function (wi) { return -lambda * wi; });
      var H = []; for (var a = 0; a < k; a++) { H.push(new Array(k).fill(0)); H[a][a] = lambda; }
      rows.forEach(function (r) {
        var p = sigmoid(dot(w, r.x)), wt = p * (1 - p);
        for (var i = 0; i < k; i++) {
          g[i] += (r.y - p) * r.x[i];
          for (var j = 0; j < k; j++) H[i][j] += wt * r.x[i] * r.x[j];
        }
      });
      var step = solve(H, g), mx = 0;
      for (var s = 0; s < k; s++) { w[s] += step[s]; mx = Math.max(mx, Math.abs(step[s])); }
      if (mx < 1e-8) break;
    }
    var acc = rows.length ? rows.filter(function (r) { return (dot(w, r.x) > 0) === (r.y === 1); }).length / rows.length : NaN;
    return { w: w, acc: acc, n: rows.length };
  }
  function solve(A, b) {  // Gauss–Jordan; A is symmetric positive definite here
    var n = b.length, M2 = A.map(function (row, i) { return row.slice().concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var piv = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M2[r][c]) > Math.abs(M2[piv][c])) piv = r;
      var t = M2[c]; M2[c] = M2[piv]; M2[piv] = t;
      for (var r2 = 0; r2 < n; r2++) {
        if (r2 === c) continue;
        var fct = M2[r2][c] / M2[c][c];
        for (var cc = c; cc <= n; cc++) M2[r2][cc] -= fct * M2[c][cc];
      }
    }
    return M2.map(function (row, i) { return row[n] / row[i]; });
  }
  function diffRow(p, y) {
    var a = z(p.features_1), b = z(p.features_2);
    return { x: a.map(function (v, i) { return v - b[i]; }), y: y };
  }
  var LAMBDA = 1.0;
  var MIN_PICKS = Math.min(6, PAIRS.length);
  var judgeFits = {};
  RULES.forEach(function (rule) {
    var rows = JUDGE_ALL.filter(function (p) { return p.judge[rule]; })
      .map(function (p) { return diffRow(p, p.judge[rule].p_1_better > 0.5 ? 1 : 0); });
    judgeFits[rule] = fitBT(rows, LAMBDA);
  });
  var mine = load("rm", null);   // {w, acc, n, at}

  function fitMine() {
    var rows = PAIRS.filter(function (p) { var v = votes[pairKey(p)]; return v === 1 || v === 2; })
      .map(function (p) { return diffRow(p, votes[pairKey(p)] === 1 ? 1 : 0); });
    if (rows.length < MIN_PICKS) return null;
    var f = fitBT(rows, LAMBDA);
    f.at = new Date().toISOString();
    return f;
  }
  $("#fit").addEventListener("click", function () {
    var f = fitMine();
    if (!f) { $("#fit-note").textContent = "You need at least " + MIN_PICKS + " picks that aren't \u201ccan't tell\u201d. You have " + rated().filter(function (p) { return votes[pairKey(p)] !== 0; }).length + "."; return; }
    mine = f; save("rm", mine); renderWeights(); draw3(); refresh();
  });

  function renderWeights() {
    var cols = [];
    if (mine) cols.push({ name: "Your reward model", fit: mine });
    RULES.forEach(function (r) { cols.push({ name: "Judge: \u201c" + rl(r) + "\u201d", fit: judgeFits[r] }); });
    var mx = 0;
    cols.forEach(function (c) { c.fit.w.forEach(function (v) { mx = Math.max(mx, Math.abs(v)); }); });
    mx = mx || 1;
    var html = "<div class='wgrid' style='grid-template-columns: minmax(8rem, 12rem) repeat(" + cols.length + ", minmax(0, 1fr))'>";
    html += "<div></div>" + cols.map(function (c) { return "<div class='wcol-h'>" + esc(c.name) + "</div>"; }).join("");
    FEATS.forEach(function (f, i) {
      html += "<div class='wlabel'>" + esc(FEAT_LABEL[f]) + "</div>";
      cols.forEach(function (c) {
        var v = c.fit.w[i], wpct = Math.abs(v) / mx * 50;
        html += "<div class='wcell' title='" + esc(c.name + ", " + FEAT_LABEL[f] + ": " + v.toFixed(2)) + "'><span class='wzero'></span>" +
          "<span class='wbar " + (v >= 0 ? "pos" : "neg") + "' style='" + (v >= 0 ? "left:50%" : "right:50%") + ";width:" + wpct.toFixed(1) + "%'></span>" +
          "<span class='wval " + (v >= 0 ? "pos" : "neg") + "' style='" + (v >= 0 ? "left:calc(50% + " + wpct.toFixed(1) + "% + 4px)" : "right:calc(50% + " + wpct.toFixed(1) + "% + 4px)") + "'>" + (v >= 0 ? "+" : "\u2212") + Math.abs(v).toFixed(2) + "</span></div>";
      });
    });
    html += "</div>";
    $("#weights").innerHTML = html;
    $("#fit-detail").textContent = (mine ? "Your model agrees with " + pct(mine.acc) + " of your " + mine.n + " picks. " : "Build your model to see it next to the judge's. ") +
      "The judge's two columns are built the same way from its picks on all " + JUDGE_ALL.length + " pairs it compared in the run (" +
      RULES.map(function (r) { return "\u201c" + rl(r) + "\u201d agrees with " + pct(judgeFits[r].acc) + " of them"; }).join("; ") + ").";
    // TA note: weights are log-odds per SD of each count, L2 penalty LAMBDA (see ta-script.md).
    $("#weights-table").innerHTML = "<thead><tr><th>Feature</th>" + cols.map(function (c) { return "<th>" + esc(c.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      FEATS.map(function (f, i) { return "<tr><td>" + esc(FEAT_LABEL[f]) + "</td>" + cols.map(function (c) { return "<td>" + c.fit.w[i].toFixed(3) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody>";
  }

  /* =====================================================================
     PART 3 · What training does
     (a) One request: exact KL-regularized optimum over the model's four real replies.
     (b) The real training run: score curves, a before/after table, and two replies picked by fixed rules.
     ===================================================================== */
  var POOL = B.pool;
  var poolByPrompt = {};
  POOL.forEach(function (c) { (poolByPrompt[c.prompt_id] = poolByPrompt[c.prompt_id] || []).push(c); });
  var STYLE_ORDER = ["default", "one-sided", "both-sides", "decline"];
  var STYLE_LABEL = { "default": "Its usual reply", "one-sided": "Argues one side", "both-sides": "Gives both sides", "decline": "Declines" };
  // Two requests on the day's topic (housing), side a: one asks for one side, one asks for both.
  var SIM = [
    { label: "Asks for one side", template: "Argue that {stance}" },
    { label: "Asks for both sides", template: "Evaluate the evidence for and against {stance}" }
  ].map(function (q) {
    var pid = Object.keys(poolByPrompt).filter(function (id) {
      var p = promptById[id]; return p.topic === "housing_policy" && p.template === q.template && p.side === "a";
    })[0];
    return { label: q.label, pid: pid };
  }).filter(function (q) { return q.pid; });
  if (!SIM.length) SIM = [{ label: "Request", pid: Object.keys(poolByPrompt)[0] }];

  var p3 = { src: load("src", "you"), bi: 12, v: 0, req: Math.min(load("req3", 0), SIM.length - 1) };  // v = slider position, bi = 12 - v
  if (["you", "balance", "helpful"].indexOf(p3.src) < 0) p3.src = "you";
  function rewardOf(c) {
    if (p3.src === "you") return mine ? dot(mine.w, z(c.features)) : 0;
    return c.rm[p3.src];
  }
  function policy(cands, beta) {
    var n = cands.length;
    if (beta === Infinity) return cands.map(function () { return 1 / n; });
    var r = cands.map(rewardOf), mx = Math.max.apply(null, r);
    var e = r.map(function (x) { return Math.exp((x - mx) / beta); }), s = e.reduce(function (a, b) { return a + b; }, 0);
    return e.map(function (x) { return x / s; });
  }
  function simCands() {
    return (poolByPrompt[SIM[p3.req].pid] || []).slice().sort(function (a, b) { return STYLE_ORDER.indexOf(a.style) - STYLE_ORDER.indexOf(b.style); });
  }

  $("#req-pick").innerHTML = SIM.map(function (q, i) {
    return "<button type='button' data-req='" + i + "' aria-pressed='" + (i === p3.req) + "'>" + esc(q.label) + "</button>";
  }).join("");
  $$("#req-pick button").forEach(function (b) {
    b.addEventListener("click", function () {
      p3.req = Number(b.getAttribute("data-req")); save("req3", p3.req);
      $$("#req-pick button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      draw3();
    });
  });
  $("#beta").addEventListener("input", function () { p3.v = Number($("#beta").value); p3.bi = 12 - p3.v; draw3(); });
  $$("#reward-src button").forEach(function (b) {
    b.addEventListener("click", function () {
      p3.src = b.getAttribute("data-src"); save("src", p3.src);
      $$("#reward-src button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      draw3();
    });
  });
  $$("#reward-src button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-src") === p3.src)); });

  var last3 = null;  // the current setting, for the submission
  var open3 = {};    // which replies the student has expanded
  function draw3() {
    $("#beta-out").textContent = changeLabel(p3.v);
    var cs = simCands(), pi = policy(cs, BETAS[p3.bi]);
    var top = pi.indexOf(Math.max.apply(null, pi)), tie = pi.every(function (q) { return Math.abs(q - pi[0]) < 1e-9; });
    var noRM = p3.src === "you" && !mine;
    $("#req-text").textContent = promptById[SIM[p3.req].pid].prompt;
    var box = $("#cands3");
    box.innerHTML = noRM ? "<p class='warn small'>Build your reward model in Part 2 first. Until then every reply gets the same score, so nothing changes.</p>" : "";
    cs.forEach(function (c, i) {
      var row = document.createElement("div");
      row.className = "cand3" + (!tie && i === top ? " top" : "");
      row.innerHTML = "<div class='cand-head'><span class='c-name'>" + esc(STYLE_LABEL[c.style] || c.style) + "</span>" +
        "<span class='pbar'><span style='width:" + (100 * pi[i]).toFixed(1) + "%'></span></span><span class='pval'>" + pct(pi[i]) + "</span>" +
        "<span class='small muted'>score " + f2(rewardOf(c)) + "</span></div>";
      var d = document.createElement("details");
      d.open = !!open3[c.cid];
      d.addEventListener("toggle", function () { open3[c.cid] = d.open; });
      var sm = document.createElement("summary"); sm.textContent = "Read the reply";
      var t = document.createElement("div"); t.className = "reply-text"; setReply(t, c.text, c.truncated);
      d.appendChild(sm); d.appendChild(t); row.appendChild(d);
      box.appendChild(row);
    });
    last3 = { src: p3.src, change: changeLabel(p3.v), request: SIM[p3.req].label, top: tie ? "all equal" : STYLE_LABEL[cs[top].style], p: pi[top] };
    refresh();
  }
  function srcName(s) { return s === "you" ? "your reward model" : rl(s); }

  /* ---------- The real training run ---------- */
  var runDefs = (CFG.rl_runs || []).map(function (r, i) {
    return { name: r[0] + "_beta" + String(r[1]), rule: r[0], beta: r[1], color: SERIES[i % SERIES.length],
      label: "“" + rl(r[0]) + "”" + (r[1] === 0 ? ", no KL penalty" : "") };
  });
  var heldIds = {};
  B.eval.forEach(function (g) { heldIds[g.prompt_id] = true; });
  var nHeld = Object.keys(heldIds).length;
  fills["heldout-n"] = String(nHeld);
  var stepsInCfg = (CFG.rl_eval_steps || []).filter(function (s) { return s > 0; });
  var lastStep = stepsInCfg[stepsInCfg.length - 1];
  $("#rl-intro").textContent = (RL_POLICY !== POLICY ? "To fit three training runs into one night on a laptop, we trained a smaller model, " + RL_POLICY.replace("Qwen/", "") + "." : "We trained " + fills.policy + ".") +
    " We trained it three times, for " + CFG.rl_steps + " steps each. Each time, a reward model built from the AI judge's picks scored its replies: once with “Balance,” once with “Helpful,” and once more with “Balance” but no KL penalty, so the model could change as much as it wanted. Then the judge graded the model's replies to " + nHeld + " new requests, before and after.";
  // Judge's grades per state ("step0", or "<run>@<step>").
  var evalByState = {};
  B.eval.forEach(function (g) { (evalByState[g.state] = evalByState[g.state] || []).push(g); });
  var evenByState = {};
  B.eval_even.forEach(function (e) { (evenByState[e.state] = evenByState[e.state] || []).push(e.p_even); });
  function summary(state) {
    var gs = evalByState[state] || [];
    return {
      even: mean(evenByState[state] || []), refusal: mean(gs.map(function (g) { return g.p_refusal; })),
      hedging: mean(gs.map(function (g) { return g.hedging_mean; })), words: mean(gs.map(function (g) { return words(g.text); })),
      kl: mean(gs.map(function (g) { return g.kl_to_step0; })), n: gs.length,
      rm: { balance: mean(gs.map(function (g) { return g.rm_balance; })), helpful: mean(gs.map(function (g) { return g.rm_helpful; })) }
    };
  }
  // Three small line charts over the eval checkpoints (step 0, then each saved step), one line per run:
  // own-RM score as change from step 0, and two of the judge's grades. Redrawn on resize.
  var FIG_STEPS = [0].concat(stepsInCfg);
  function stateAt(r, step) { return step === 0 ? "step0" : r.name + "@" + step; }
  var FIG_PANELS = [
    { title: "Score", sub: "change from step 0, its own reward model", fmt: function (x) { return (x >= 0 ? "+" : "") + f2(x); },
      get: function (r, step) { var s0 = summary("step0"), sm = summary(stateAt(r, step)); return sm.n ? sm.rm[r.rule] - s0.rm[r.rule] : NaN; } },
    { title: "Even-handed", sub: "AI judge", fmt: pct, pctAxis: true, get: function (r, step) { return summary(stateAt(r, step)).even; } },
    { title: "Refuses", sub: "AI judge", fmt: pct, pctAxis: true, get: function (r, step) { return summary(stateAt(r, step)).refusal; } }
  ];
  var tipEl = null;
  function tip(html, x, y) {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); }
    if (html === null) { tipEl.style.display = "none"; return; }
    tipEl.innerHTML = html; tipEl.style.display = "block";
    tipEl.style.left = Math.min(x + 14, window.innerWidth - tipEl.offsetWidth - 8) + "px"; tipEl.style.top = (y + 14) + "px";
  }
  function niceStep(span) { var s = Math.pow(10, Math.floor(Math.log10(span / 3))), e = span / s; return e > 7 ? s * 5 : e > 3 ? s * 2 : s; }
  function drawRunLines() {
    var box = $("#fig-run");
    box.className = "fig3 lines";
    box.innerHTML = "";
    FIG_PANELS.forEach(function (pn) {
      var series = runDefs.map(function (r) { return { r: r, pts: FIG_STEPS.map(function (st) { return { x: st, y: pn.get(r, st) }; }).filter(function (p) { return isFinite(p.y); }) }; });
      var ys = [].concat.apply([], series.map(function (s) { return s.pts.map(function (p) { return p.y; }); }));
      var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      if (pn.pctAxis) { var mid = (lo + hi) / 2; lo = Math.min(lo, mid - 0.1); hi = Math.max(hi, mid + 0.1); }  // at least 20 points tall
      else { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      var step = niceStep(hi - lo); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      var panel = document.createElement("div"); panel.className = "panel";
      panel.innerHTML = "<p class='res-h'>" + esc(pn.title) + "</p><p class='small muted p-sub'>" + esc(pn.sub) + "</p>";
      var W = Math.max(220, Math.round(box.getBoundingClientRect().width / (window.innerWidth <= 760 ? 1 : 3)) - 16), H = 190, ml = 40, mr = 44, mt = 10, mb = 26;
      var X = function (x) { return ml + (x - FIG_STEPS[0]) / (FIG_STEPS[FIG_STEPS.length - 1] - FIG_STEPS[0]) * (W - ml - mr); };
      var Y = function (y) { return mt + (1 - (y - lo) / (hi - lo)) * (H - mt - mb); };
      var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("class", "lchart"); svg.setAttribute("role", "img"); svg.setAttribute("tabindex", "0");
      svg.setAttribute("aria-label", pn.title + " at steps " + FIG_STEPS.join(", ") + ": " + series.map(function (s) { return s.r.label + " " + s.pts.map(function (p) { return pn.fmt(p.y); }).join(", "); }).join("; "));
      function add(tag, at, parent) { var e = document.createElementNS(NS, tag); Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); }); (parent || svg).appendChild(e); return e; }
      for (var t = lo; t <= hi + step / 2; t += step) {
        add("line", { x1: ml, x2: W - mr, y1: Y(t), y2: Y(t), "class": "grid" });
        add("text", { x: ml - 6, y: Y(t) + 4, "text-anchor": "end", "class": "tick" }).textContent = pn.pctAxis ? Math.round(t * 100) + "%" : (t > 0 ? "+" : "") + (Math.abs(t) < 1e-9 ? "0" : t.toFixed(step < 1 ? 1 : 0));
      }
      FIG_STEPS.forEach(function (st) { add("text", { x: X(st), y: H - 8, "text-anchor": "middle", "class": "tick" }).textContent = st === 0 ? "step 0" : String(st); });
      var cross = add("line", { x1: 0, x2: 0, y1: mt, y2: H - mb, "class": "cross", visibility: "hidden" });
      series.forEach(function (s) {
        add("path", { d: s.pts.map(function (p, i) { return (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1); }).join(""), fill: "none", stroke: s.r.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
        s.pts.forEach(function (p) { add("circle", { cx: X(p.x), cy: Y(p.y), r: 4, fill: s.r.color, stroke: "var(--surface)", "stroke-width": 2 }); });
      });
      // end labels: last value of each run, nudged apart so they don't overlap
      var ends = series.filter(function (s) { return s.pts.length; }).map(function (s) { var p = s.pts[s.pts.length - 1]; return { s: s, y: Y(p.y), v: p.y }; }).sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
      ends.forEach(function (e) { add("text", { x: W - mr + 6, y: e.y + 4, "class": "endlab" }).textContent = pn.fmt(e.v); });
      // hover / tap: nearest checkpoint, all runs
      function show(ev) {
        var rect = svg.getBoundingClientRect(), sx = (ev.clientX - rect.left) / rect.width * W;
        var st = FIG_STEPS.reduce(function (a, b) { return Math.abs(X(b) - sx) < Math.abs(X(a) - sx) ? b : a; });
        cross.setAttribute("x1", X(st)); cross.setAttribute("x2", X(st)); cross.setAttribute("visibility", "visible");
        tip("<div class='tip-h'>" + esc(pn.title) + (st === 0 ? ", before training" : ", step " + st) + "</div>" + series.map(function (s) {
          var p = s.pts.filter(function (q) { return q.x === st; })[0];
          return "<div class='tip-r'><span class='lline' style='border-color:" + s.r.color + "'></span>" + esc(s.r.label) + " <b>" + (p ? pn.fmt(p.y) : "–") + "</b></div>";
        }).join(""), ev.clientX, ev.clientY);
      }
      function hide() { cross.setAttribute("visibility", "hidden"); tip(null); }
      svg.addEventListener("mousemove", show); svg.addEventListener("click", show);
      svg.addEventListener("mouseleave", hide); svg.addEventListener("blur", hide);
      panel.appendChild(svg); box.appendChild(panel);
    });
  }
  $("#rl-legend").innerHTML = runDefs.map(function (r) {
    return "<span class='lkey'><span class='lline' style='border-color:" + r.color + "'></span>" + esc(r.label) + "</span>";
  }).join("");
  var figW = window.innerWidth;
  window.addEventListener("resize", function () { if (window.innerWidth !== figW) { figW = window.innerWidth; drawRunLines(); } });

  var evalKey = {};
  B.eval.forEach(function (g) { evalKey[g.state + "|" + g.prompt_id] = g; });
  function replyCard(title, g, rule) {
    var card = document.createElement("div"); card.className = "reply";
    var h = document.createElement("p"); h.className = "res-h"; h.textContent = title;
    var meta = document.createElement("p"); meta.className = "small muted";
    meta.textContent = (rule ? "score " + f2(g["rm_" + rule]) + " (" + rl(rule) + " reward model) · " : "") + "refuses " + pct(g.p_refusal) + " · " + words(g.text) + " words";
    var t = document.createElement("div"); t.className = "reply-text"; setReply(t, g.text, g.truncated);
    card.appendChild(h); card.appendChild(meta); card.appendChild(t);
    return card;
  }

  // The one request to read (fixed rule): the 2020-election request that asks for the model's own
  // position on the true claim, before training and after the two rules (with the KL penalty).
  function drawAnswerKey() {
    var pid = Object.keys(heldIds).filter(function (id) {
      var p = promptById[id]; return p.topic === "2020_election" && p.template === "Would you support the position that {stance}?" && p.side === "a";
    })[0];
    var box = $("#ex2"); box.innerHTML = "";
    if (!pid) return;
    $("#ex2-req").textContent = promptById[pid].prompt;
    var g0 = evalKey["step0|" + pid];
    if (g0) box.appendChild(replyCard("Before training", g0, null));
    runDefs.filter(function (r) { return r.beta > 0; }).forEach(function (r) {
      var g = evalKey[r.name + "@" + lastStep + "|" + pid];
      if (g) box.appendChild(replyCard("After: " + r.label.replace(/\u201c|\u201d/g, ""), g, r.rule));
    });
  }

  /* =====================================================================
     Data section, submission, progress
     ===================================================================== */
  function renderData() {
    var st = M.stages, env = (st.rl ? st.rl.env : null) || (st[Object.keys(st).filter(function (k) { return /^rl:/.test(k); })[0]] || {}).env || (st.candidates || {}).env || {};
    var nReq = st.prompts ? st.prompts.n_train + st.prompts.n_heldout : null;
    $("#data-summary").innerHTML = [
      ["Requests", (nReq ? nReq.toLocaleString("en-US") + " political requests" : "Political requests") + " built from Anthropic's open test set: mostly U.S. issues, each asked from both sides. " + nHeld + " were kept out of training, to grade the model on new requests."],
      ["Replies", "Written by " + fills.policy + ", a small open model."],
      ["Grades", "An AI judge, " + fills.judge + ", using Anthropic's grading instructions."],
      ["Training", RL_POLICY.replace("Qwen/", "") + ", trained three times for " + CFG.rl_steps + " steps, overnight on a laptop."]
    ].map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
    var q = st.judge && st.judge.quality && st.judge.quality.conflict_accuracy;
    $("#trust-judge").innerHTML = "<b>The judge is a small model, not Claude.</b>" + (st.judge ? " It gives the same verdict when two replies swap places only " + pct(st.judge.order_consistency) + " of the time" : "") +
      (q ? ", but on clear-cut pairs it picks the reply each rule wants (" + RULES.map(function (r) { return rl(r) + " " + pct(q[r]); }).join(", ") + ")." : ".");
    var rows = [
      ["Run config", (META.config || CFG.name) + (["colab", "local"].indexOf(META.config) >= 0 ? "" : " (development data, not for section)")],
      ["Model that wrote the replies (Parts 1\u20132, and \u201cTry it on one request\u201d)", POLICY + " @ " + (B.manifest.models[POLICY] || "").slice(0, 10)],
      ["Model trained with RL (Part 3, the real run)", RL_POLICY + " @ " + (B.manifest.models[RL_POLICY] || "").slice(0, 10)],
      ["Judge", CFG.judge + " @ " + (B.manifest.models[CFG.judge] || "").slice(0, 10) + (CFG.judge_4bit ? ", 4-bit" : "")],
      ["Reward-model base", CFG.rm_base + " @ " + (B.manifest.models[CFG.rm_base] || "").slice(0, 10)],
      ["Hardware", (env.gpu || env.device || "?") + " · torch " + (env.torch || "?") + " · trl " + (env.trl || "?")],
      ["Run started", M.created],
      ["Requests", st.prompts ? st.prompts.n_train + " for training, " + st.prompts.n_heldout + " new ones never trained on (source file SHA-256 " + st.prompts.eval_set_sha256.slice(0, 12) + "…)" : "–"],
      ["Judge self-agreement (answer order swapped)", st.judge ? pct(st.judge.order_consistency) + " of " + st.judge.n_preferences + " rule comparisons" : "–"],
      ["Judge check: right reply on conflict pairs", st.judge && st.judge.quality && st.judge.quality.conflict_accuracy ? RULES.map(function (r) { var a = st.judge.quality.conflict_accuracy[r]; return rl(r) + " " + (a === undefined ? "–" : pct(a)); }).join(" · ") + " (" + st.judge.quality.n_conflict_pairs + " pairs: argue-type request, one-sided vs. both-sides reply)" : "–"],
      ["Judge check: probability on the answer letters", st.judge && st.judge.quality ? "median " + pct(st.judge.quality.option_mass_median) + " (the rest goes to other first words; verdicts use the letters' share)" : "–"],
      ["Reward-model accuracy on unseen pairs", RULES.map(function (r) { var x = B.rm_results[r]; return x ? rl(r) + " " + pct(x.heldout_accuracy) + " (" + x.n_test + " pairs)" : r + " –"; }).join(" · ")],
      ["Stage times", Object.keys(st).map(function (k) { return k + " " + Math.round((st[k].seconds || 0) / 60) + " min"; }).join(" · ")],
      ["Bundle SHA-256", (META.sha256 || "unchecked") + (META.checked_against ? " (matches " + META.checked_against + ")" : "")]
    ];
    $("#data-table").innerHTML = "<tbody>" + rows.map(function (r) { return "<tr><th scope='row'>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</tbody>";
  }

  function items() {
    var decided = rated().filter(function (p) { return votes[pairKey(p)] !== 0; }).length;
    var list = [
      ["Your name", !!nameIn.value.trim()],
      ["Your rule", !!(answers.d2 || "").trim()], ["Your prediction", !!(answers.d3 || "").trim()],
      ["Rate all " + PAIRS.length + " pairs", rated().length >= PAIRS.length], ["1A", !!(answers.q1a || "").trim()], ["1B", !!(answers.q1b || "").trim()],
      ["Build your reward model", !!mine], ["2A", !!(answers.q2a || "").trim()], ["2B", !!(answers.q2b || "").trim()],
      ["3A", !!(answers.q3a || "").trim()], ["3B", !!(answers.q3b || "").trim()],
      ["3C", !!(answers.q3c || "").trim()], ["3D", !!(answers.q3d || "").trim()]
    ];
    return { list: list, decided: decided };
  }
  function submissionText() {
    var L = [];
    L.push("POLISCI 158 · Section 5 lab · Can you train a politically neutral AI?");
    L.push("Name: " + (nameIn.value.trim() || "(none)") + (partnerIn.value.trim() ? "   Partner: " + partnerIn.value.trim() : ""));
    L.push("Saved: " + new Date().toLocaleString() + "   Data: " + (META.config || "?") + " bundle " + (META.sha256 || "?").slice(0, 12));
    L.push("");
    ["d2", "d3"].forEach(function (q) { L.push("== " + Q_LABELS[q]); L.push((answers[q] || "").trim() || "(blank)"); L.push(""); });
    L.push("== Part 1 · Your picks (" + rated().length + " rated)");
    rated().forEach(function (p) {
      var v = votes[pairKey(p)];
      L.push("- " + (promptById[p.prompt_id] ? promptById[p.prompt_id].prompt : p.prompt_id) + " | you: " + (v === 0 ? "can't tell" : "reply " + v) +
        " | judge, Balance: reply " + judgePick(p, "balance") + ", Helpful: reply " + judgePick(p, "helpful") + " | styles: " + p.style_1 + " vs " + p.style_2);
    });
    L.push("Agreement with judge: Balance " + $("#s-agree-balance").textContent + ", Helpful " + $("#s-agree-helpful").textContent);
    L.push("");
    L.push("== Part 2 · Your reward model");
    L.push(mine ? FEATS.map(function (f, i) { return FEAT_LABEL[f] + " " + mine.w[i].toFixed(3); }).join("; ") + " (fits " + pct(mine.acc) + " of " + mine.n + " picks)" : "(not fitted)");
    L.push("");
    L.push("== Part 3 · Your last setting on one request");
    L.push(last3 ? last3.request + ", scored with " + srcName(last3.src) + ", may change: " + last3.change + " \u2192 most likely reply: " + last3.top + (last3.top === "all equal" ? "" : " (" + pct(last3.p) + ")") : "(none)");
    L.push("");
    QUESTIONS.slice(2).forEach(function (q) { L.push("== " + Q_LABELS[q]); L.push((answers[q] || "").trim() || "(blank)"); L.push(""); });
    return L.join("\n");
  }
  function refresh() {
    var it = items(), done = it.list.filter(function (x) { return x[1]; }).length;
    $("#progress-fill").style.width = (100 * done / it.list.length) + "%";
    $("#progress-text").textContent = done + " of " + it.list.length + " items done";
    $("#checklist").innerHTML = it.list.map(function (x) { return "<li class='" + (x[1] ? "ok" : "") + "'>" + esc(x[0]) + "</li>"; }).join("");
    $("#preview").textContent = submissionText();
    $("#sn-progress").textContent = done + " of " + it.list.length + " items done";
  }
  function fileName() {
    var n = (nameIn.value.trim() || "student").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "ps158-section5-" + n + ".txt";
  }
  $("#download").addEventListener("click", function () {
    var blob = new Blob([submissionText()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $("#copy-sub").addEventListener("click", function () {
    var btn = $("#copy-sub");
    navigator.clipboard.writeText(submissionText()).then(function () {
      btn.classList.add("copied"); btn.textContent = "Copied"; setTimeout(function () { btn.classList.remove("copied"); btn.textContent = "Copy"; }, 1500);
    });
  });

  // Reset: remove everything this page saved in this browser (only keys with our prefix), then reload.
  $("#reset-all").addEventListener("click", function () {
    if (!window.confirm("Clear your name, rule, picks, reward model and answers on this browser? Download your submission first if you need it. This can't be undone.")) return;
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(KEY) === 0; }).forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    location.hash = ""; location.reload();
  });

  // Side navigation: mark the section being read.
  (function () {
    var links = $$(".sidenav a[href^='#']"), byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var targets = Object.keys(byId).map(function (id) { return id === "top" ? $(".hero") : document.getElementById(id); }).filter(Boolean);
    var hold = 0;  // after a click, keep the clicked link marked while the page scrolls there
    function set(a) { links.forEach(function (b) { b.setAttribute("aria-current", String(b === a)); }); }
    function mark() {
      if (Date.now() < hold) return;
      var y = window.scrollY + 120, cur = targets[0];
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) y = window.scrollY + window.innerHeight / 2;  // at the bottom
      targets.forEach(function (t) { if (t.getBoundingClientRect().top + window.scrollY <= y) cur = t; });
      set(byId[cur === $(".hero") ? "top" : cur.id]);
    }
    links.forEach(function (a) { a.addEventListener("click", function () { set(a); hold = Date.now() + 1200; }); });
    window.addEventListener("scroll", mark, { passive: true });
    mark();
  })();

  /* ---------- Init ---------- */
  $$("[data-fill]").forEach(function (el) { var k = el.getAttribute("data-fill"); if (fills[k] !== undefined) el.textContent = fills[k]; });
  echoes(); renderPair(); renderWeights(); drawRunLines(); drawAnswerKey(); renderData(); draw3();
})();
