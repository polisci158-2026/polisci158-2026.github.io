/* POLISCI 158 · Section 4 lab — page behavior.
   Everything is stored in this browser's localStorage under the "ps158s4v2:" prefix.
   (v2: the first draft of this page saved runs in a different shape under "ps158s4:".) */
(function () {
  "use strict";

  var KEY = "ps158s4v2:";
  var QUESTIONS = ["q1a", "q1b", "q1c", "q2a", "q2b", "q3a", "q3b", "q3c", "q4"];
  var Q_LABELS = {
    q1a: "1A · Same last words, different meaning", q1b: "1B · More text or a better design?", q1c: "1C · The number neither model can know",
    q2a: "2A · Find the best rule", q2b: "2B · Leaderboards",
    q3a: "3A · The overall number", q3b: "3B · The party gap", q3c: "3C · Guess or abstain?",
    q4: "Part 4 · Advise the campaign"
  };

  function load(k, fallback) {
    try { var v = localStorage.getItem(KEY + k); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pct(x) { return isFinite(x) ? Math.round(100 * x) + "%" : "–"; }
  function pct1(x) { return isFinite(x) ? (100 * x).toFixed(1) + "%" : "–"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function word(w) { return w === LM.END ? "(end)" : w; }

  /* ---------- Name, answers ---------- */
  var answers = load("answers", {});
  var nameIn = $("#s-name"), partnerIn = $("#s-partner");
  nameIn.value = load("name", "");
  partnerIn.value = load("partner", "");
  nameIn.addEventListener("input", function () { save("name", nameIn.value); refresh(); });
  partnerIn.addEventListener("input", function () { save("partner", partnerIn.value); refresh(); });
  $$("textarea[data-q]").forEach(function (ta) {
    var q = ta.getAttribute("data-q");
    ta.value = answers[q] || "";
    ta.addEventListener("input", function () { answers[q] = ta.value; save("answers", answers); refresh(); });
  });
  $$("[data-a]").forEach(function (el) {  // Part 3 citation-check fields
    var k = el.getAttribute("data-a");
    el.value = answers[k] || "";
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () { answers[k] = el.value; save("answers", answers); refresh(); });
  });

  /* ---------- Recap sorter ---------- */
  $$("#sorter .scenario").forEach(function (sc) {
    $$("button[data-pick]", sc).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", sc).forEach(function (x) { x.removeAttribute("data-picked"); });
        b.setAttribute("data-picked", "");
        var right = b.getAttribute("data-pick") === sc.getAttribute("data-answer");
        sc.classList.add("answered");
        sc.classList.toggle("right", right);
        sc.classList.toggle("wrong", !right);
      });
    });
  });

  /* =====================================================================
     PART 1 · Counting model vs. tiny transformer
     ===================================================================== */
  var TF = new Transformer(TT_WEIGHTS);
  var p1 = { size: 10000, ctx: 2, temp: 0.8, head: [1, 1] };
  var models = {}, errors = {};   // counting models, trained once per (size, context)
  var textIn = $("#lm-text"), writing = false;

  $("#samples").innerHTML = DATA.train.slice(0, 5).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");

  /* The recap's attention example, computed live from the same model. */
  (function () {
    var r = TF.run(DATA.tokenize("i am worried that ai will"));
    $("#att-demo").innerHTML = attStrip(r.tokens, r.attention[1][1]);
  })();

  function modelKey() { return p1.size + "|" + p1.ctx; }
  function counting() {
    var k = modelKey();
    if (!models[k]) models[k] = new LM.Model(DATA.train.slice(0, p1.size), p1.ctx, DATA.tokenize);
    return models[k];
  }
  function countingError() {
    var k = modelKey();
    if (errors[k] === undefined) errors[k] = counting().error(DATA.test, DATA.tokenize);
    return errors[k];
  }
  /* Training the 10,000-answer counting model takes a moment, so show a status first. */
  function withModel(fn) {
    if (models[modelKey()] && errors[modelKey()] !== undefined) { fn(); return; }
    $("#lm-status").textContent = "Training the counting model on " + p1.size.toLocaleString() + " answers…";
    setTimeout(function () { counting(); countingError(); $("#lm-status").textContent = ""; fn(); }, 30);
  }

  function history() { return DATA.tokenize(textIn.value); }
  function topOf(p, n) {
    return Object.keys(p).sort(function (a, b) { return p[b] - p[a]; }).slice(0, n).map(function (w) { return { word: w, p: p[w] }; });
  }
  function countTop() { return counting().top(history(), 5, 1); }
  function tfRun() { return TF.run(history()); }

  function bars(top) {
    var rest = 1, rows = top.map(function (t) { rest -= t.p; return bar(word(t.word), t.p, false); });
    rows.push(bar("every other word", Math.max(0, rest), true));
    return rows.join("");
  }
  function bar(label, p, muted) {
    return "<div class=\"bar-row" + (muted ? " muted" : "") + "\"><span class=\"bw\">" + esc(label) + "</span><span class=\"bt\"><span style=\"width:" +
      (100 * p).toFixed(1) + "%\"></span></span><span class=\"bp\">" + (100 * p).toFixed(0) + "%</span></div>";
  }
  function attStrip(tokens, weights) {
    var last = tokens.length - 1;
    return tokens.map(function (t, i) {
      var w = weights[i], a = Math.min(1, w * 1.15);
      return "<span class=\"att-tok" + (i === last ? " is-last" : "") + "\" style=\"background:rgba(140,21,21," + a.toFixed(3) + ");color:" + (a > 0.45 ? "#fff" : "var(--fg)") +
        "\" title=\"" + esc(t) + ": " + (100 * w).toFixed(0) + "%\"><span>" + esc(t) + "</span><small>" + (100 * w).toFixed(0) + "%</small></span>";
    }).join("");
  }
  function topAttended(r) {
    var w = r.attention[p1.head[0]][p1.head[1]], best = 0;
    for (var i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    return { token: r.tokens[best], w: w[best] };
  }

  function draw() {
    var h = history(), m = counting(), r = tfRun();
    var unknown = h.filter(function (w) { return m.vocab.indexOf(w) < 0; });
    $("#next-h-c").textContent = "Chances for the next word" + (h.length ? ", seeing only “" + h.slice(-p1.ctx).join(" ") + "”" : "");
    $("#bars-c").innerHTML = bars(countTop());
    $("#bars-t").innerHTML = bars(topOf(r.p, 5));
    $("#att").innerHTML = attStrip(r.tokens, r.attention[p1.head[0]][p1.head[1]]) +
      (unknown.length ? "<p class=\"small muted\" style=\"margin:.3rem 0 0;width:100%\">Never seen in training: “" + esc(unknown.join("”, “")) + "” (shown as &lt;unk&gt;).</p>" : "");
    $("#att-last").textContent = "(" + ["layer 1", "layer 2"][p1.head[0]] + ", head " + (p1.head[1] + 1) + "; shading = attention weight)";
    $("#st-err-c").textContent = countingError().toFixed(2) + " bits";
    $("#st-err-t").textContent = TF.cfg.error.toFixed(2) + " bits";
  }
  function update() { withModel(draw); }

  /* Sampling with temperature, for either model. */
  function sample(p, T) {
    var keys = Object.keys(p), z = 0, q = keys.map(function (w) { var v = Math.pow(p[w], 1 / T); z += v; return v; });
    var u = Math.random() * z, acc = 0;
    for (var i = 0; i < keys.length; i++) { acc += q[i]; if (u <= acc) return keys[i]; }
    return keys[keys.length - 1];
  }
  function addWord(which) {
    var p = which === "t" ? tfRun().p : counting().dist(history());
    var w = sample(p, p1.temp);
    if (w === LM.END) return false;
    textIn.value = textIn.value.replace(/\s+$/, "") + " " + w;
    save("lmtext", textIn.value);
    return true;
  }
  $$("[data-write]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (writing) { writing = false; return; }
      var which = b.getAttribute("data-write");
      withModel(function () {
        writing = true;
        $$("[data-write]").forEach(function (x) { x.textContent = x === b ? "Stop" : "Write with this model"; x.disabled = x !== b; });
        var n = 0;
        (function step() {
          var more = writing && addWord(which); n++;
          draw();
          if (more && n < 40) { setTimeout(step, 110); return; }
          $("#lm-status").textContent = !writing ? "Stopped." : more ? "Stopped after 40 words." : "The model ended the answer.";
          writing = false;
          $$("[data-write]").forEach(function (x) { x.textContent = "Write with this model"; x.disabled = false; });
        })();
      });
    });
  });
  textIn.value = load("lmtext", "i am worried that ai will");
  textIn.addEventListener("input", function () { save("lmtext", textIn.value); $("#lm-status").textContent = ""; update(); });
  $$("[data-start]").forEach(function (b) {
    b.addEventListener("click", function () {
      writing = false;
      textIn.value = b.getAttribute("data-start"); save("lmtext", textIn.value);
      $("#lm-status").textContent = ""; update();
    });
  });
  function segmented(attr, fn) {
    $$("[" + attr + "]").forEach(function (b) {
      b.addEventListener("click", function () {
        writing = false;
        fn(b.getAttribute(attr));
        $$("[" + attr + "]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        update();
      });
    });
  }
  segmented("data-size", function (v) { p1.size = +v; });
  segmented("data-ctx", function (v) { p1.ctx = +v; });
  segmented("data-temp", function (v) { p1.temp = +v; });
  segmented("data-head", function (v) { p1.head = v.split(",").map(Number); });

  /* ---------- Part 1 runs ---------- */
  var runs1 = load("runs1", []).filter(function (r) { return r && r.cTop && r.tTop && r.head; });
  function short(top) { return top.slice(0, 3).map(function (t) { return word(t.word) + " " + Math.round(100 * t.p) + "%"; }); }
  $("#record1").addEventListener("click", function () {
    withModel(function () {
      var r = tfRun(), a = topAttended(r);
      runs1.push({ text: textIn.value.trim(), size: p1.size, ctx: p1.ctx, cErr: countingError(), cTop: short(countTop()),
        tErr: TF.cfg.error, tTop: short(topOf(r.p, 3)), head: p1.head.slice(), att: a.token + " " + Math.round(100 * a.w) + "%" });
      save("runs1", runs1);
      flash($("#record1"), "✓ Recorded");
      refresh();
    });
  });
  function cLabel(r) { return r.size.toLocaleString() + " answers, last " + r.ctx + " word" + (r.ctx > 1 ? "s" : ""); }
  function hLabel(r) { return "L" + (r.head[0] + 1) + " H" + (r.head[1] + 1); }
  function renderRuns1() {
    var tb = $("#runs1 tbody");
    tb.innerHTML = runs1.length ? runs1.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td class=\"txt\">" + esc(r.text) + "</td><td>" + esc(r.cTop.join(", ")) + "<br><span class=\"muted\">" + cLabel(r) + "</span></td><td>" +
        r.cErr.toFixed(2) + " / " + r.tErr.toFixed(2) + "</td><td>" + esc(r.tTop.join(", ")) + "</td><td>" + hLabel(r) + ": <b>" + esc(r.att) + "</b></td>" +
        "<td><button type=\"button\" class=\"linkbtn\" data-del1=\"" + i + "\">delete</button></td></tr>";
    }).join("") : "<tr><td colspan=\"7\" class=\"muted\">No runs recorded yet.</td></tr>";
  }
  $("#runs1").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del1]");
    if (!b) return;
    runs1.splice(+b.getAttribute("data-del1"), 1); save("runs1", runs1); refresh();
  });

  /* =====================================================================
     PART 2 · The guessing game
     ===================================================================== */
  var game = { t: 0, pen: 1 };
  var grid = $("#quiz-grid");
  grid.innerHTML = DATA.quiz.map(function (q) { return "<span title=\"confidence " + Math.round(100 * q.conf) + "%\"></span>"; }).join("");
  function gameStats() {
    var n = DATA.quiz.length, r = 0, w = 0, a = 0;
    DATA.quiz.forEach(function (q) { if (q.conf >= game.t - 1e-9) { if (q.right) r++; else w++; } else a++; });
    return { t: game.t, pen: game.pen, abst: a / n, right: r / n, wrong: w / n, s0: r / n, s1: (r - game.pen * w) / n };
  }
  function drawGame() {
    var cells = grid.children;
    DATA.quiz.forEach(function (q, i) {
      cells[i].className = q.conf >= game.t - 1e-9 ? (q.right ? "qk-r" : "qk-w") : "qk-a";
    });
    var s = gameStats();
    $("#thresh-out").textContent = Math.round(100 * game.t) + "%";
    $("#g-abst").textContent = pct1(s.abst); $("#g-right").textContent = pct1(s.right); $("#g-wrong").textContent = pct1(s.wrong);
    $("#g-s0").textContent = (100 * s.s0).toFixed(1);
    $("#g-s1").textContent = (100 * s.s1).toFixed(1);
  }
  $("#thresh").addEventListener("input", function () { game.t = +this.value / 100; drawGame(); });
  segmented("data-pen", function (v) { game.pen = +v; drawGame(); });

  var runs2 = load("runs2", []).filter(function (r) { return r && isFinite(r.t) && isFinite(r.s1); });
  $("#record2").addEventListener("click", function () {
    runs2.push(gameStats()); save("runs2", runs2);
    flash($("#record2"), "✓ Recorded"); refresh();
  });
  function renderRuns2() {
    var tb = $("#runs2 tbody");
    tb.innerHTML = runs2.length ? runs2.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + Math.round(100 * r.t) + "%</td><td>" + pct1(r.abst) + "</td><td>" + pct1(r.right) + "</td><td>" + pct1(r.wrong) +
        "</td><td>" + (100 * r.s0).toFixed(1) + "</td><td>" + (100 * r.s1).toFixed(1) + " <span class=\"muted\">(wrong −" + r.pen + ")</span></td>" +
        "<td><button type=\"button\" class=\"linkbtn\" data-del2=\"" + i + "\">delete</button></td></tr>";
    }).join("") : "<tr><td colspan=\"8\" class=\"muted\">No settings recorded yet.</td></tr>";
  }
  $("#runs2").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del2]");
    if (!b) return;
    runs2.splice(+b.getAttribute("data-del2"), 1); save("runs2", runs2); refresh();
  });

  /* =====================================================================
     PART 3 · Silicon sample vs. Pew
     ===================================================================== */
  var guess = load("guess", {});
  $$("[data-guess]").forEach(function (el) {
    var k = el.getAttribute("data-guess");
    el.value = guess[k] === undefined ? "" : guess[k];
    el.addEventListener("input", function () {
      if (el.value === "") delete guess[k]; else guess[k] = Math.max(0, Math.min(100, +el.value));
      save("guess", guess); refresh();
    });
  });
  var botIn = $("#bot-name");
  botIn.value = load("bot", "");
  botIn.addEventListener("input", function () { save("bot", botIn.value); });

  function counts() {
    var c = {};
    $$("[data-cnt]").forEach(function (el) { c[el.getAttribute("data-cnt")] = Math.max(0, Math.round(+el.value || 0)); });
    return c;
  }
  function totals() {
    var c = counts();
    $("#tot-d").textContent = c.dc + c.de + c.dq;
    $("#tot-r").textContent = c.rc + c.re + c.rq;
  }
  $$("[data-cnt]").forEach(function (el) { el.addEventListener("input", totals); });

  var runs3 = load("runs3", []).filter(function (r) { return r && isFinite(r.dc) && isFinite(r.rc); });
  $("#add-sample").addEventListener("click", function () {
    var c = counts(), nd = c.dc + c.de + c.dq, nr = c.rc + c.re + c.rq, msg = $("#sample-msg");
    if (!nd || !nr) { msg.textContent = "Enter the counts for both parties first."; return; }
    if (!botIn.value.trim()) { msg.textContent = "Say which chatbot you used first."; return; }
    c.bot = botIn.value.trim();
    runs3.push(c); save("runs3", runs3);
    $$("[data-cnt]").forEach(function (el) { el.value = ""; }); totals();
    msg.textContent = (nd !== 20 || nr !== 20) ? "Added. (Its totals weren't 20 per party; percentages use its own totals.)" : "Added.";
    refresh();
  });
  function shares(r) {
    var nd = r.dc + r.de + r.dq, nr = r.rc + r.re + r.rq;
    return { dem: r.dc / nd, rep: r.rc / nr, all: (r.dc + r.rc) / (nd + nr) };
  }
  function avgShares() {
    if (!runs3.length) return null;
    var s = { dem: 0, rep: 0, all: 0 };
    runs3.forEach(function (r) { var x = shares(r); s.dem += x.dem; s.rep += x.rep; s.all += x.all; });
    return { dem: s.dem / runs3.length, rep: s.rep / runs3.length, all: s.all / runs3.length };
  }
  function triple(a, b, c) { return a + " / " + b + " / " + c; }
  function renderRuns3() {
    var tb = $("#runs3 tbody");
    tb.innerHTML = runs3.length ? runs3.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.bot) + "</td><td>" + triple(r.dc, r.de, r.dq) + "</td><td>" + triple(r.rc, r.re, r.rq) +
        "</td><td><b>" + pct(shares(r).all) + "</b></td><td><button type=\"button\" class=\"linkbtn\" data-del3=\"" + i + "\">delete</button></td></tr>";
    }).join("") : "<tr><td colspan=\"6\" class=\"muted\">No samples added yet.</td></tr>";
  }
  $("#runs3").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del3]");
    if (!b) return;
    runs3.splice(+b.getAttribute("data-del3"), 1); save("runs3", runs3); refresh();
  });

  /* Pew's trend, "more concerned than excited", 2021–2026 (parties include leaners). */
  var TREND = [
    { name: "all adults", vals: [37, 38, 52, 51, 50, 52], col: "#8c1515", dash: "" },
    { name: "Democrats", vals: [31, 31, 46, 46, 51, 56], col: "#2b5c8a", dash: "6 4" },
    { name: "Republicans", vals: [45, 45, 59, 55, 50, 49], col: "#a8621f", dash: "2 4" }
  ];
  (function drawTrend() {
    function X(i) { return 60 + 80 * i; }
    function Y(v) { return (170 - (v - 20) * 3.5).toFixed(1); }
    var g = [];
    [20, 40, 60].forEach(function (v) {
      g.push("<line x1=\"44\" y1=\"" + Y(v) + "\" x2=\"470\" y2=\"" + Y(v) + "\" stroke=\"" + (v === 20 ? "#cfc6bc" : "#e8e1da") + "\"/><text x=\"38\" y=\"" + (+Y(v) + 4) + "\" text-anchor=\"end\" fill=\"#62666c\">" + v + "%</text>");
    });
    for (var i = 0; i < 6; i++) g.push("<text x=\"" + X(i) + "\" y=\"192\" text-anchor=\"middle\" fill=\"#62666c\">" + (2021 + i) + "</text>");
    TREND.forEach(function (s) {
      g.push("<polyline points=\"" + s.vals.map(function (v, i) { return X(i) + "," + Y(v); }).join(" ") + "\" fill=\"none\" stroke=\"" + s.col + "\" stroke-width=\"2.2\"" + (s.dash ? " stroke-dasharray=\"" + s.dash + "\"" : "") + "/>");
      s.vals.forEach(function (v, i) { g.push("<circle cx=\"" + X(i) + "\" cy=\"" + Y(v) + "\" r=\"3\" fill=\"" + s.col + "\"/>"); });
      g.push("<text x=\"472\" y=\"" + (+Y(s.vals[5]) + 4) + "\" fill=\"" + s.col + "\">" + s.vals[5] + " " + s.name + "</text>");
      g.push("<text x=\"" + X(0) + "\" y=\"" + (+Y(s.vals[0]) - 7) + "\" text-anchor=\"middle\" fill=\"" + s.col + "\">" + s.vals[0] + "</text>");
    });
    $("#trend").innerHTML = "<p class=\"res-h\">The share “more concerned than excited”, 2021–2026</p>" +
      "<svg viewBox=\"0 0 580 200\" role=\"img\" aria-label=\"Share more concerned than excited, 2021 to 2026. All adults: 37, 38, 52, 51, 50, 52. Democrats: 31, 31, 46, 46, 51, 56. Republicans: 45, 45, 59, 55, 50, 49.\"><g font-family=\"Source Sans 3, sans-serif\" font-size=\"12\">" +
      g.join("") + "</g></svg>" +
      "<p class=\"small muted\" style=\"margin:.2rem 0 .6rem\">Until 2024, Republicans were the more concerned party. In 2025 the two were even; in 2026 Democrats were more concerned. Age flipped too: in 2023, 42% of adults under 30 said “more concerned” vs. 61% of those 65 and older; in 2026, 55% of adults under 30 did, more than adults 50–64 (47%).</p>";
  })();

  var truthShown = load("truth", false);
  function canReveal() { return ["all", "dem", "rep"].every(function (k) { return guess[k] !== undefined; }) && runs3.length > 0; }
  function renderTruth() {
    var ok = canReveal() || truthShown;
    $("#truth-btn").disabled = !ok;
    $("#truth-lock").hidden = ok;
    $("#truth").hidden = !truthShown;
    $("#truth-btn").textContent = truthShown ? "Hide the real poll" : "Compare with the real poll";
    $("#truth-btn").setAttribute("aria-expanded", String(truthShown));
    var a = avgShares();
    ["all", "dem", "rep"].forEach(function (k) {
      $("#cmp-g-" + k).textContent = guess[k] === undefined ? "–" : guess[k] + "%";
      $("#cmp-s-" + k).textContent = a ? pct(a[k]) : "–";
    });
    $("#cmp-n").textContent = runs3.length ? "(average of " + runs3.length + ")" : "";
  }
  $("#truth-btn").addEventListener("click", function () { truthShown = !truthShown; save("truth", truthShown); renderTruth(); });

  /* =====================================================================
     Submission
     ===================================================================== */
  function items() {
    var list = [
      { ok: runs1.length >= 3, text: "Part 1: at least 3 recorded runs (" + runs1.length + " so far)" },
      { ok: runs2.length >= 3, text: "Part 2: at least 3 recorded settings (" + runs2.length + " so far)" },
      { ok: runs3.length >= 1, text: "Part 3: at least 1 chatbot sample (" + runs3.length + " so far)" },
      { ok: ["all", "dem", "rep"].every(function (k) { return guess[k] !== undefined; }), text: "Part 3: your three guesses" },
      { ok: !!(answers.cite_num && answers.cite_link), text: "Part 3: citation check filled in" }
    ];
    QUESTIONS.forEach(function (q) { list.push({ ok: (answers[q] || "").trim().length >= 15, text: Q_LABELS[q].split(" · ")[0] + " answered" }); });
    return list;
  }
  function submissionText() {
    var out = [];
    out.push("POLISCI 158 · Section 4 lab submission");
    out.push("Name: " + (nameIn.value.trim() || "(missing)"));
    if (partnerIn.value.trim()) out.push("Partner: " + partnerIn.value.trim());
    out.push("Created: " + new Date().toLocaleString());
    var miss = items().filter(function (it) { return !it.ok; });
    out.push("Checklist: " + (miss.length ? "missing " + miss.map(function (it) { return it.text; }).join("; ") : "complete"));
    out.push("");
    out.push("PART 1 · RECORDED RUNS (counting model vs. tiny transformer)");
    if (!runs1.length) out.push("(none)");
    runs1.forEach(function (r, i) {
      out.push((i + 1) + ". text: " + r.text);
      out.push("   counting (" + cLabel(r) + ", error " + r.cErr.toFixed(2) + "): " + r.cTop.join(", "));
      out.push("   transformer (error " + r.tErr.toFixed(2) + "): " + r.tTop.join(", ") + " | attention from last word, " + hLabel(r) + ": " + r.att);
    });
    out.push("");
    out.push("PART 2 · GUESSING GAME (200 questions)");
    if (!runs2.length) out.push("(none)");
    runs2.forEach(function (r, i) {
      out.push((i + 1) + ". answer when >= " + Math.round(100 * r.t) + "% | I don't know " + pct1(r.abst) + ", right " + pct1(r.right) + ", wrong " + pct1(r.wrong) +
        " | accuracy score " + (100 * r.s0).toFixed(1) + " | penalty score " + (100 * r.s1).toFixed(1) + " (wrong -" + r.pen + ")");
    });
    out.push("");
    out.push("PART 3 · SILICON SAMPLE");
    out.push("My guess (more concerned than excited): all " + (guess.all === undefined ? "–" : guess.all + "%") + ", Democrats " + (guess.dem === undefined ? "–" : guess.dem + "%") + ", Republicans " + (guess.rep === undefined ? "–" : guess.rep + "%"));
    if (!runs3.length) out.push("(no samples)");
    runs3.forEach(function (r, i) {
      var s = shares(r);
      out.push((i + 1) + ". " + r.bot + " | Democrats concerned/excited/equally " + triple(r.dc, r.de, r.dq) + " | Republicans " + triple(r.rc, r.re, r.rq) +
        " | concerned: Dem " + pct(s.dem) + ", Rep " + pct(s.rep) + ", all " + pct(s.all));
    });
    out.push("Citation check: numbers given " + (answers.cite_num || "–") + " | searched the web: " + (answers.cite_web || "–") + " | link: " + (answers.cite_link || "–"));
    out.push("Real poll revealed on this page: " + (truthShown ? "yes" : "no"));
    QUESTIONS.forEach(function (q) {
      out.push("");
      out.push(Q_LABELS[q].toUpperCase());
      out.push((answers[q] || "").trim() || "(no answer)");
    });
    return out.join("\n");
  }

  function refresh() {
    renderRuns1(); renderRuns2(); renderRuns3(); renderTruth();
    var list = items(), n = list.filter(function (it) { return it.ok; }).length;
    $("#progress-fill").style.width = (100 * n / list.length) + "%";
    $("#progress-text").textContent = n + " of " + list.length + " items done";
    $("#checklist").innerHTML = list.map(function (it) { return "<li class=\"" + (it.ok ? "ok" : "") + "\">" + esc(it.text) + "</li>"; }).join("") +
      "<li class=\"" + (nameIn.value.trim() ? "ok" : "") + "\">Your name at the top of the page</li>";
    $("#preview").textContent = submissionText();
  }

  function fileName() {
    var n = nameIn.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student";
    return "ps158-section4-lab-" + n + ".txt";
  }
  $("#download").addEventListener("click", function () {
    var blob = new Blob([submissionText()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  function copyText(text, btn) {
    function done() { flash(btn, "Copied"); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      ta.remove();
    }
  }
  $("#copy-sub").addEventListener("click", function () { copyText(submissionText(), $("#copy-sub")); });
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () { copyText($("#" + b.getAttribute("data-copy")).textContent, b); });
  });

  function flash(btn, msg) {
    var old = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", old);
    btn.textContent = msg; btn.classList.add("copied");
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.textContent = old; btn.classList.remove("copied"); }, 1200);
  }

  $("#reset-all").addEventListener("click", function () {
    if (!confirm("Clear your name, recorded runs, samples and answers on this page? This can't be undone.")) return;
    ["answers", "name", "partner", "runs1", "runs2", "runs3", "truth", "guess", "bot", "lmtext"].forEach(function (k) { try { localStorage.removeItem(KEY + k); } catch (e) {} });
    location.reload();
  });

  /* ---------- Start ---------- */
  totals();
  drawGame();
  refresh();
  update();
})();
