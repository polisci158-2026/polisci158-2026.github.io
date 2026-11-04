/* POLISCI 158 · Section 6 (RL) lab — page behavior.
   Everything is stored in this browser's localStorage under the "ps158s6rl:" prefix. */
(function () {
  "use strict";

  var KEY = "ps158s6rl:";
  var QUESTIONS = ["q2a", "q2b", "q2c", "q3a", "q3b", "q4"];
  var Q_LABELS = {
    q2a: "2A · How it learns", q2b: "2B · Airtime", q2c: "2C · No penalty for scandal",
    q3a: "3A · Your reward", q3b: "3B · What your agent learned", q4: "Part 4 · Advise the campaign"
  };
  var IDEAS = {
    trail: { name: "Campaign Trail, your way", text: "Campaign Trail on a new map: a candidate on a 7×7 grid has 40 moves to get from headquarters to the Capitol. Add rallies (points when visited) and scandals (the game ends). Make the map different from the class example.", goal: "reaching the Capitol" },
    gotv: { name: "Get out the vote", text: "Get out the vote: a canvasser on a 5×5 grid with 3 houses has 25 moves before the polls close. Two houses are supporters, one is not. Knocking on a supporter's door turns them out to vote, once. The state is the canvasser's square plus which houses have already voted.", goal: "turning out both supporters" },
    feed: { name: "The feed", text: "The feed: each round, the agent picks one of 4 posts to show a simulated user (news, sports, outrage, local). Each post has a fixed chance of a click; outrage gets the most clicks but lowers a hidden trust score. 20 rounds per game. The state is the last post shown and whether trust is high, medium or low.", goal: "ending the game with trust still high" },
    whip: { name: "The whip", text: "The whip: a party whip on a 6×6 map of the Capitol building has 15 moves to visit 4 legislators before the roll call. Visiting a wavering member secures their vote; visiting a loyal one does nothing. The state is the whip's square plus which members are secured.", goal: "securing 3 of the 4 votes before the roll call" },
    own: { name: "Own idea", text: "", goal: "the goal I actually care about (say what it is)" }
  };

  function load(k, fallback) {
    try { var v = localStorage.getItem(KEY + k); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(x) { var s = (Math.round(x * 10) / 10).toFixed(1); return s.replace(/\.0$/, ""); }
  function signed(x) { return (x > 0 ? "+" : x < 0 ? "−" : "") + num(Math.abs(x)); }

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
  $$("[data-a]").forEach(function (el) {
    var k = el.getAttribute("data-a");
    el.value = answers[k] || "";
    el.addEventListener("input", function () { answers[k] = el.value; save("answers", answers); buildPrompt(); refresh(); });
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

  /* ---------- The board ---------- */
  var NS = "http://www.w3.org/2000/svg", CELL = 42;
  var FILL = { "#": "#3a3c40", ".": "#f6f2ec", H: "#e8e1da", C: "#e8c77f", S: "#f1d3d1", T: "#d6e2ee" };
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function qColor(v, scale) {
    var t = Math.max(-1, Math.min(1, v / scale));
    var from = [255, 255, 255], to = t >= 0 ? [47, 107, 69] : [140, 21, 21];
    var k = Math.abs(t) * 0.75;
    return "rgb(" + from.map(function (x, i) { return Math.round(x + (to[i] - x) * k); }).join(",") + ")";
  }
  // opts: { at: cell of the piece, agent: show Q heat and arrows, trail: cells visited }
  function drawBoard(svg, opts) {
    opts = opts || {};
    var W = RL.COLS * CELL, H = RL.ROWS * CELL;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var scale = 1;
    if (opts.agent) for (var s = 0; s < opts.agent.Q.length; s++) scale = Math.max(scale, Math.abs(Math.max.apply(null, opts.agent.Q[s])));
    for (var i = 0; i < RL.ROWS * RL.COLS; i++) {
      var r = Math.floor(i / RL.COLS), c = i % RL.COLS, t = RL.tile(i), x = c * CELL, y = r * CELL;
      var fill = FILL[t];
      if (opts.agent && t === ".") {
        var st = i * (RL.TV_COOLDOWN + 1);
        fill = qColor(Math.max.apply(null, opts.agent.Q[st]), scale);
      }
      el("rect", { x: x, y: y, width: CELL, height: CELL, fill: fill, stroke: "#d8d0c6", "stroke-width": 1 }, svg);
      if (t !== "." && t !== "#") {
        var lab = el("text", { x: x + CELL / 2, y: y + CELL / 2 + 5, "text-anchor": "middle", fill: t === "S" ? "#8c1515" : "#161719" }, svg);
        lab.textContent = t;
      }
      if (opts.agent && (t === "." || t === "H" || t === "T") && opts.agent.episodes > 0) {
        var a = opts.agent.bestFixed(i * (RL.TV_COOLDOWN + 1));
        var dx = [0, 0, -1, 1][a], dy = [-1, 1, 0, 0][a], cx = x + CELL / 2 + (t === "." ? 0 : 11), cy = y + CELL / 2 + (t === "." ? 0 : 11);
        el("line", { x1: cx - dx * 8, y1: cy - dy * 8, x2: cx + dx * 8, y2: cy + dy * 8, stroke: "#161719", "stroke-width": 2, "marker-end": "url(#ah)" }, svg);
      }
    }
    var defs = el("defs", {}, svg), m = el("marker", { id: "ah", markerWidth: 6, markerHeight: 6, refX: 3, refY: 3, orient: "auto" }, defs);
    el("path", { d: "M0,0 L6,3 L0,6 z", fill: "#161719" }, m);
    if (opts.trail && opts.trail.length > 1) {
      var d = opts.trail.map(function (cell, k) { return (k ? "L" : "M") + ((cell % RL.COLS) + 0.5) * CELL + "," + (Math.floor(cell / RL.COLS) + 0.5) * CELL; }).join("");
      el("path", { d: d, fill: "none", stroke: "#8c1515", "stroke-width": 3, "stroke-opacity": 0.5, "stroke-linejoin": "round" }, svg);
    }
    if (opts.at != null) {
      el("circle", { cx: ((opts.at % RL.COLS) + 0.5) * CELL, cy: (Math.floor(opts.at / RL.COLS) + 0.5) * CELL, r: CELL * 0.3, fill: "#8c1515", stroke: "#fff", "stroke-width": 2 }, svg);
    }
  }

  /* ---------- The reward (shared by Parts 1 and 2) ---------- */
  var settings = load("settings", { capitol: 10, step: -0.1, scandal: -5, tv: 0, eps: 0.2, gamma: 0.95, seed: 158 });
  function reward() { return { capitol: settings.capitol, step: settings.step, scandal: settings.scandal, tv: settings.tv }; }
  $$("[data-r]").forEach(function (s) { s.value = String(settings[s.getAttribute("data-r")]); });
  $("#k-eps").value = String(settings.eps); $("#k-gamma").value = String(settings.gamma); $("#k-seed").value = String(settings.seed);
  function onSetting() {
    $$("[data-r]").forEach(function (s) { settings[s.getAttribute("data-r")] = +s.value; });
    settings.eps = +$("#k-eps").value; settings.gamma = +$("#k-gamma").value; settings.seed = +$("#k-seed").value;
    save("settings", settings);
    newAgent(); resetPlay();
  }
  $$("[data-r], #k-eps, #k-gamma, #k-seed").forEach(function (s) { s.addEventListener("change", onSetting); });

  /* =====================================================================
     PART 1 · Play it yourself
     ===================================================================== */
  var play, playTrail, best = load("best", null);
  $("#legend1").innerHTML = [["H", "headquarters"], ["C", "Capitol"], ["T", "TV studio"], ["S", "scandal"], ["#", "closed road"]].map(function (x) {
    return '<span><i style="background:' + FILL[x[0]] + '"></i>' + x[1] + "</span>";
  }).join("");
  function rulesList() {
    var R = reward();
    return [["Reach the Capitol", R.capitol], ["Each move", R.step], ["Scandal (the campaign ends)", R.scandal], ["Each TV appearance", R.tv]].map(function (x) {
      return "<li>" + x[0] + ": <b>" + signed(x[1]) + "</b></li>";
    }).join("");
  }
  function resetPlay() { play = new RL.Game(reward()); playTrail = [play.cell]; drawPlay(); }
  function drawPlay() {
    drawBoard($("#board1"), { at: play.cell, trail: playTrail });
    $("#p1-score").textContent = num(play.total);
    $("#p1-steps").textContent = play.steps + " / " + RL.MAX_STEPS;
    $("#p1-status").textContent = play.reachedCapitol ? "Elected!" : play.scandal ? "Scandal" : play.done ? "Out of time" : play.cooldown ? "TV in " + play.cooldown : "On the trail";
    $("#p1-rules").innerHTML = rulesList();
    $("#p1-best").textContent = best === null ? "–" : num(best) + " points";
  }
  function move(a) {
    if (play.done) return;
    play.step(a); playTrail.push(play.cell);
    if (play.done && (best === null || play.total > best)) { best = play.total; save("best", best); }
    drawPlay();
  }
  $$("[data-move]").forEach(function (b) { b.addEventListener("click", function () { move(+b.getAttribute("data-move")); }); });
  $("#play-reset").addEventListener("click", resetPlay);
  document.addEventListener("keydown", function (e) {
    var k = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 }[e.key];
    if (k === undefined) return;
    var b = $("#board1").getBoundingClientRect();
    if (b.bottom < 0 || b.top > window.innerHeight) return;   // only while the board is on screen
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    e.preventDefault(); move(k);
  });

  /* =====================================================================
     PART 2 · Train the agent
     ===================================================================== */
  var agent, history, watching = null;
  function newAgent() {
    agent = new RL.Agent({ alpha: 0.2, gamma: settings.gamma, epsilon: settings.eps, seed: settings.seed });
    history = [];
    if (watching) { clearInterval(watching); watching = null; }
    drawAgent();
  }
  function describe(g) {
    if (g.capitol) return "Capitol in " + g.steps + " moves" + (g.tv ? " (" + g.tv + " TV)" : "");
    if (g.scandal) return "Scandal after " + g.steps + " moves";
    if (g.tv >= 3) return "Stayed in the TV studio: " + g.tv + " appearances";
    return "Wandered for " + g.steps + " moves" + (g.tv ? " (" + g.tv + " TV)" : "");
  }
  function drawAgent(trail, at) {
    drawBoard($("#board2"), { agent: agent, trail: trail, at: at == null ? RL.START : at });
    $("#a-games").textContent = agent.episodes.toLocaleString();
    if (agent.episodes) {
      var g = agent.playGreedy(reward());
      $("#a-result").textContent = describe(g);
      $("#a-points").textContent = num(g.total);
    } else { $("#a-result").textContent = "–"; $("#a-points").textContent = "–"; }
    drawCurve();
  }
  function train(n) {
    if (watching) { clearInterval(watching); watching = null; }
    var R = reward();
    for (var i = 0; i < n; i++) history.push(agent.trainEpisode(R));
    drawAgent();
  }
  $$("[data-train]").forEach(function (b) { b.addEventListener("click", function () { train(+b.getAttribute("data-train")); }); });
  $("#watch").addEventListener("click", function () {
    if (watching) { clearInterval(watching); watching = null; }
    var g = agent.playGreedy(reward()), k = 0;
    watching = setInterval(function () {
      k++;
      drawBoard($("#board2"), { agent: agent, trail: g.path.slice(0, k + 1), at: g.path[Math.min(k, g.path.length - 1)] });
      if (k >= g.path.length - 1) { clearInterval(watching); watching = null; }
    }, 110);
  });

  function drawCurve() {
    var W = 520, H = 210, L = 38, R = 38, T = 10, B = 26, BIN = 50;
    var bins = [];
    for (var i = 0; i + BIN <= history.length; i += BIN) {
      var sl = history.slice(i, i + BIN), pts = 0, cap = 0, tv = 0;
      sl.forEach(function (e) { pts += e.total; cap += e.capitol ? 1 : 0; tv += e.tv; });
      bins.push({ n: i + BIN, pts: pts / BIN, cap: cap / BIN, tv: tv / BIN });
    }
    var g = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Learning curve">';
    if (!bins.length) {
      g += '<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle">Train at least 50 games to see the curve.</text></svg>';
      $("#curve").innerHTML = g; return;
    }
    var lo = Math.min(-5, Math.min.apply(null, bins.map(function (b) { return b.pts; }))), hi = Math.max(12, Math.max.apply(null, bins.map(function (b) { return Math.max(b.pts, b.tv); })));
    var maxN = Math.max(1000, bins[bins.length - 1].n);
    var X = function (n) { return L + (W - L - R) * n / maxN; };
    var Y = function (v) { return T + (H - T - B) * (hi - v) / (hi - lo); };
    var Yp = function (p) { return T + (H - T - B) * (1 - p); };
    [lo, 0, hi].forEach(function (v) { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (v === 0 ? "#cfc6bc" : "#efe9e2") + '"/><text x="' + (L - 5) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + Math.round(v) + "</text>"; });
    [0, 0.5, 1].forEach(function (p) { g += '<text x="' + (W - R + 5) + '" y="' + (Yp(p) + 4) + '" style="fill:#2f6b45">' + Math.round(100 * p) + "%</text>"; });
    [0, maxN / 2, maxN].forEach(function (n, k) { g += '<text x="' + X(n) + '" y="' + (H - 8) + '" text-anchor="' + (k === 2 ? "end" : "middle") + '">' + Math.round(n).toLocaleString() + (k === 2 ? " games" : "") + "</text>"; });
    function line(f, Yf, col, w) { return '<polyline fill="none" stroke="' + col + '" stroke-width="' + w + '" points="' + bins.map(function (b) { return X(b.n) + "," + Yf(f(b)); }).join(" ") + '"/>'; }
    g += line(function (b) { return b.cap; }, Yp, "#2f6b45", 2.2);
    g += line(function (b) { return b.tv; }, Y, "#8c1515", 1.6);
    g += line(function (b) { return b.pts; }, Y, "#161719", 2.4);
    $("#curve").innerHTML = g + "</svg>";
  }

  var runs2 = load("runs2", []).filter(function (r) { return r && r.reward; });
  $("#record2").addEventListener("click", function () {
    if (!agent.episodes) return;
    var g = agent.playGreedy(reward());
    runs2.push({ reward: reward(), eps: settings.eps, gamma: settings.gamma, seed: settings.seed, games: agent.episodes, result: describe(g), points: g.total, capitol: g.capitol });
    save("runs2", runs2); renderRuns2(); refresh();
  });
  function rText(R) { return [R.capitol, R.step, R.scandal, R.tv].map(signed).join(" · "); }
  function renderRuns2() {
    $("#runs2 tbody").innerHTML = runs2.length ? runs2.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + rText(r.reward) + "</td><td>" + Math.round(100 * r.eps) + "% · " + r.gamma + " · " + r.seed + "</td><td>" + r.games.toLocaleString() + "</td><td>" + esc(r.result) + "</td><td>" + num(r.points) + '</td><td><button type="button" class="linkbtn" data-del="' + i + '">delete</button></td></tr>';
    }).join("") : '<tr><td colspan="7" class="muted">No runs recorded yet.</td></tr>';
  }
  $("#runs2").addEventListener("click", function (e) {
    var d = e.target.getAttribute("data-del");
    if (d !== null) { runs2.splice(+d, 1); save("runs2", runs2); renderRuns2(); refresh(); }
  });

  /* =====================================================================
     PART 3 · Build your own
     ===================================================================== */
  var idea = load("idea", "");
  $$('input[name="idea"]').forEach(function (r) {
    r.checked = r.value === idea;
    r.addEventListener("change", function () {
      idea = r.value; save("idea", idea);
      var ta = $("#idea-text");
      if (!ta.value.trim() || Object.keys(IDEAS).some(function (k) { return IDEAS[k].text === ta.value; })) {
        ta.value = IDEAS[idea].text; answers.ideaText = ta.value; save("answers", answers);
      }
      buildPrompt(); refresh();
    });
  });
  function buildPrompt() {
    var I = IDEAS[idea] || IDEAS.own, text = (answers.ideaText || "").trim() || "[Describe your game here, or pick one above.]";
    $("#bp1").textContent =
      "In this repository, create a folder rl-game/ with one file, index.html: plain HTML, CSS and JavaScript, no libraries, no build step. It's for a political science class on reinforcement learning.\n\n" +
      "The game: " + text + "\n\n" +
      "Build it in this order:\n" +
      "1. The game itself. A person can play it on the page (arrow keys or buttons) and sees their score. Keep it small: the agent will use a table, so the game should have at most about 500 states. Tell me how many states it has.\n" +
      "2. One function near the top called reward(), with a comment on each part, that gives the points for each move. Show these numbers on the page, with controls to change them.\n" +
      "3. A tabular Q-learning agent: epsilon-greedy exploration (epsilon = 0.2), learning rate 0.2, discount 0.95, Q-values start at 0, ties broken at random, and a seeded random number generator so results are reproducible. Buttons: Train 100 games, Train 1,000 games, Reset agent, and Watch it play (animates one game with no exploring).\n" +
      "4. A learning curve: the average reward per 50 training games, and on the same chart the share of games that achieve the real goal (" + I.goal + ").\n\n" +
      "Keep the code readable, with short comments. When you're done, tell me in plain language what you built. Don't commit or push yet.";
  }
  var cps = load("cps", {});
  $$("[data-cp]").forEach(function (c) {
    c.checked = !!cps[c.getAttribute("data-cp")];
    c.addEventListener("change", function () { cps[c.getAttribute("data-cp")] = c.checked; save("cps", cps); refresh(); });
  });

  /* =====================================================================
     Submission
     ===================================================================== */
  function items() {
    var tv = runs2.some(function (r) { return r.reward.tv >= 5; });
    var sc = runs2.some(function (r) { return r.reward.scandal === 0; });
    var nCp = Object.keys(cps).filter(function (k) { return cps[k]; }).length;
    var list = [
      ["Your name", !!nameIn.value.trim()],
      ["Part 2: at least 3 runs", runs2.length >= 3],
      ["Part 2: a run with TV +5", tv],
      ["Part 2: a run with scandal 0", sc],
      ["Part 3: link to your game", /^https?:\/\/\S+/.test((answers.url || "").trim())],
      ["Part 3: at least 3 checkpoints", nCp >= 3]
    ];
    QUESTIONS.forEach(function (q) { list.push([Q_LABELS[q], !!(answers[q] || "").trim()]); });
    return list;
  }
  function buildText() {
    var L = [];
    L.push("POLISCI 158 · Section 6 lab · Build a game, train an agent");
    L.push("Name: " + (nameIn.value.trim() || "(missing)"));
    if (partnerIn.value.trim()) L.push("Partner: " + partnerIn.value.trim());
    L.push("Saved: " + new Date().toLocaleString());
    L.push("");
    L.push("== Part 1 · Best game by hand ==");
    L.push(best === null ? "(not played)" : num(best) + " points");
    L.push("");
    L.push("== Part 2 · Agent runs (reward: Capitol · move · scandal · TV) ==");
    if (!runs2.length) L.push("(none)");
    runs2.forEach(function (r, i) {
      L.push((i + 1) + ". reward " + rText(r.reward) + "; explore " + Math.round(100 * r.eps) + "%, gamma " + r.gamma + ", seed " + r.seed + "; " + r.games + " games → " + r.result + " (" + num(r.points) + " points)");
    });
    L.push("");
    L.push("== Part 3 · My game ==");
    L.push("Link: " + ((answers.url || "").trim() || "(missing)"));
    L.push("Idea: " + (IDEAS[idea] ? IDEAS[idea].name : "(not chosen)") + " · " + ((answers.ideaText || "").trim() || "–"));
    $$("[data-cp]").forEach(function (c) { L.push("[" + (c.checked ? "x" : " ") + "] " + c.parentNode.textContent.trim()); });
    L.push("");
    L.push("== Answers ==");
    QUESTIONS.forEach(function (q) { L.push(Q_LABELS[q]); L.push((answers[q] || "").trim() || "(blank)"); L.push(""); });
    return L.join("\n");
  }
  function refresh() {
    var list = items(), done = list.filter(function (x) { return x[1]; }).length;
    $("#progress-fill").style.width = (100 * done / list.length) + "%";
    $("#progress-text").textContent = done + " of " + list.length + " items done";
    $("#checklist").innerHTML = list.map(function (x) { return '<li class="' + (x[1] ? "ok" : "") + '">' + esc(x[0]) + "</li>"; }).join("");
    $("#preview").textContent = buildText();
  }
  function fileName() {
    var n = (nameIn.value.trim() || "student").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "section6-rl-" + n + ".txt";
  }
  $("#download").addEventListener("click", function () {
    var blob = new Blob([buildText()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  function copyText(text, btn) {
    var done = function () { btn.classList.add("copied"); var t = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.classList.remove("copied"); btn.textContent = t; }, 1400); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {} ta.remove();
    }
  }
  $("#copy-sub").addEventListener("click", function () { copyText(buildText(), this); });
  $$("[data-copy]").forEach(function (b) { b.addEventListener("click", function () { copyText($("#" + b.getAttribute("data-copy")).textContent, b); }); });
  $("#reset-all").addEventListener("click", function () {
    if (!confirm("Clear your name, runs, game link and answers on this page?")) return;
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(KEY) === 0) localStorage.removeItem(k); }); } catch (e) {}
    location.reload();
  });

  /* ---------- Start ---------- */
  resetPlay();
  newAgent(); renderRuns2();
  buildPrompt(); refresh();
})();
