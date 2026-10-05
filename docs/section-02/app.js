/* POLISCI 158 · Section 2 lab — page behavior.
   Everything is stored in this browser's localStorage under the "ps158s2:" prefix. */
(function () {
  "use strict";

  var KEY = "ps158s2:";
  var QUESTIONS = ["q1a", "q1b", "q1c", "q2a", "q2b", "q2c", "q3"];
  var Q_LABELS = {
    q1a: "1A · One neuron", q1b: "1B · Just big enough", q1c: "1C · Too much, too little data",
    q2a: "2A · Judge it by the records", q2b: "2B · Judge it by the truth", q2c: "2C · No truth button",
    q3: "Part 3 · Is a model that predicts well good enough to use in policymaking?"
  };
  var C = { pass: [43, 92, 138], fail: [192, 113, 43], fg: "#161719", muted: "#62666c", line: "#e8e1da", accent: "#8c1515" };

  function load(k, fallback) {
    try { var v = localStorage.getItem(KEY + k); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pct(x) { return isFinite(x) ? (100 * x).toFixed(1) + "%" : "–"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

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
     PART 1 · Decision map + loss chart
     ===================================================================== */
  var LR = 0.01, MAX_EPOCH = 3000;
  var p1 = { set: "large", layers: 1, neurons: 1, speed: 250, seed: 1, running: false }; // speed: epochs per second
  var lastTick = 0, owed = 0;
  var net, epoch, hist, best;
  var map = $("#map"), mctx = map.getContext("2d");
  var chart = $("#chart"), cctx = chart.getContext("2d");
  var GRID = 56;
  var cell = document.createElement("canvas"); cell.width = cell.height = GRID;
  var cellCtx = cell.getContext("2d"), cellImg = cellCtx.createImageData(GRID, GRID);

  function trainSet() { return p1.set === "large" ? DATA.billsLarge : DATA.billsSmall; }
  function sizes() {
    var s = [2];
    for (var i = 0; i < p1.layers; i++) s.push(p1.neurons);
    s.push(1);
    return s;
  }
  function netLabel(r) { return r.layers + " × " + r.neurons + (r.layers === 1 ? " (1 layer)" : " (" + r.layers + " layers)"); }

  function rebuild() {
    net = new NN.Net(sizes(), p1.seed);
    epoch = 0; hist = []; best = { loss: Infinity, epoch: 0 };
    measure();
    draw();
  }
  function measure() {
    var tr = trainSet(), te = DATA.billsTest;
    var m = { e: epoch, trl: net.loss(tr.X, tr.y), tel: net.loss(te.X, te.y), tra: net.accuracy(tr.X, tr.y), tea: net.accuracy(te.X, te.y) };
    if (epoch > 0 && m.tel < best.loss) best = { loss: m.tel, epoch: epoch };
    hist.push(m);
    return m;
  }
  function last() { return hist[hist.length - 1]; }

  function setRunning(on) {
    p1.running = on;
    $("#play").textContent = on ? "❚❚ Pause" : (epoch >= MAX_EPOCH ? "Done (epoch 3,000)" : "▶ Train");
    $("#play").disabled = !on && epoch >= MAX_EPOCH;
    if (on) { lastTick = performance.now(); owed = 0; setTimeout(tick, 16); }
  }
  /* Time-based, so training runs at the same speed on fast and slow laptops. */
  function tick() {
    if (!p1.running) return;
    var now = performance.now(), tr = trainSet();
    owed = Math.min(owed + p1.speed * (now - lastTick) / 1000, 200);
    lastTick = now;
    while (owed >= 1 && epoch < MAX_EPOCH && performance.now() - now < 40) { net.step(tr.X, tr.y, LR); epoch++; owed--; }
    measure();
    draw();
    if (epoch >= MAX_EPOCH) setRunning(false); else setTimeout(tick, 16);
  }

  function draw() { drawMap(); drawChart(); drawStats(); }

  function drawMap() {
    var W = map.width, H = map.height, d = cellImg.data;
    for (var j = 0; j < GRID; j++) {
      for (var i = 0; i < GRID; i++) {
        var x1 = -1 + 2 * (i + 0.5) / GRID, x2 = 1 - 2 * (j + 0.5) / GRID;
        var p = net.predict([x1, x2]);
        var a = Math.abs(p - 0.5) * 2, col = p >= 0.5 ? C.pass : C.fail, o = 4 * (j * GRID + i);
        var t = 0.12 + 0.33 * a; // tint strength grows with the network's confidence
        d[o] = 255 + (col[0] - 255) * t; d[o + 1] = 255 + (col[1] - 255) * t; d[o + 2] = 255 + (col[2] - 255) * t; d[o + 3] = 255;
      }
    }
    cellCtx.putImageData(cellImg, 0, 0);
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(cell, 0, 0, W, H);
    function px(x) { return (x + 1) / 2 * W; }
    function py(y) { return (1 - (y + 1) / 2) * H; }
    if ($("#show-test").checked) {
      var te = DATA.billsTest;
      for (var n = 0; n < te.X.length; n++) {
        mctx.fillStyle = "rgba(" + (te.y[n] ? C.pass : C.fail).join(",") + ",.35)";
        mctx.fillRect(px(te.X[n][0]) - 1.5, py(te.X[n][1]) - 1.5, 3, 3);
      }
    }
    var tr = trainSet(), r = p1.set === "small" ? 5.5 : 4;
    for (var m = 0; m < tr.X.length; m++) {
      mctx.beginPath();
      mctx.arc(px(tr.X[m][0]), py(tr.X[m][1]), r, 0, 2 * Math.PI);
      mctx.fillStyle = "rgb(" + (tr.y[m] ? C.pass : C.fail).join(",") + ")";
      mctx.fill();
      mctx.lineWidth = 1.2; mctx.strokeStyle = "#fff"; mctx.stroke();
    }
    mctx.strokeStyle = "rgba(22,23,25,.25)"; mctx.lineWidth = 1;
    mctx.beginPath(); mctx.moveTo(W / 2, 0); mctx.lineTo(W / 2, H); mctx.stroke(); // the median member
  }

  function drawChart() {
    var W = chart.width, H = chart.height, L = 44, R = 10, T = 10, B = 26;
    cctx.clearRect(0, 0, W, H);
    var xmax = Math.max(500, Math.ceil(epoch / 500) * 500);
    var ymax = 0.8;
    hist.forEach(function (h) { ymax = Math.max(ymax, Math.min(2, Math.max(h.trl, h.tel))); });
    ymax = Math.ceil(ymax * 5) / 5;
    function X(e) { return L + (W - L - R) * e / xmax; }
    function Y(v) { return T + (H - T - B) * (1 - Math.min(v, ymax) / ymax); }
    cctx.font = "12px 'Source Sans 3', system-ui, sans-serif";
    cctx.fillStyle = C.muted; cctx.strokeStyle = C.line; cctx.lineWidth = 1;
    for (var v = 0; v <= ymax + 1e-9; v += ymax > 1.2 ? 0.5 : 0.2) {
      cctx.beginPath(); cctx.moveTo(L, Y(v)); cctx.lineTo(W - R, Y(v)); cctx.stroke();
      cctx.textAlign = "right"; cctx.fillText(v.toFixed(1), L - 6, Y(v) + 4);
    }
    var step = xmax <= 1000 ? 100 : 500;
    cctx.textAlign = "center";
    for (var e = 0; e <= xmax; e += step) cctx.fillText(e.toLocaleString(), X(e), H - 8);
    if (best.epoch) {
      cctx.strokeStyle = C.muted; cctx.setLineDash([2, 3]);
      cctx.beginPath(); cctx.moveTo(X(best.epoch), T); cctx.lineTo(X(best.epoch), H - B); cctx.stroke();
      cctx.setLineDash([]);
    }
    function line(key, color, dash) {
      cctx.strokeStyle = color; cctx.lineWidth = 2; cctx.setLineDash(dash || []);
      cctx.beginPath();
      hist.forEach(function (h, i) { if (i) cctx.lineTo(X(h.e), Y(h[key])); else cctx.moveTo(X(h.e), Y(h[key])); });
      cctx.stroke(); cctx.setLineDash([]);
    }
    line("trl", C.fg);
    line("tel", C.accent, [6, 4]);
  }

  function drawStats() {
    var m = last();
    $("#st-epoch").textContent = epoch.toLocaleString();
    $("#st-trl").textContent = m.trl.toFixed(3);
    $("#st-tel").textContent = m.tel.toFixed(3);
    $("#st-tra").textContent = pct(m.tra);
    $("#st-tea").textContent = pct(m.tea);
    $("#st-best").textContent = best.epoch ? best.loss.toFixed(3) + " at epoch " + best.epoch.toLocaleString() : "–";
    $("#layers-out").textContent = p1.layers;
    $("#neurons-out").textContent = p1.neurons;
  }

  function changeSetup(fn) {
    setRunning(false);
    fn();
    p1.seed++;
    rebuild();
    setRunning(false);
  }
  $$("[data-set]").forEach(function (b) {
    b.addEventListener("click", function () {
      changeSetup(function () { p1.set = b.getAttribute("data-set"); });
      $$("[data-set]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    });
  });
  $$("[data-step]").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-step"), d = +b.getAttribute("data-d");
      var lim = k === "layers" ? [1, 3] : [1, 8];
      var nv = Math.max(lim[0], Math.min(lim[1], p1[k] + d));
      if (nv !== p1[k]) changeSetup(function () { p1[k] = nv; });
    });
  });
  $$("[data-speed]").forEach(function (b) {
    b.addEventListener("click", function () {
      p1.speed = +b.getAttribute("data-speed");
      $$("[data-speed]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    });
  });
  $("#play").addEventListener("click", function () { setRunning(!p1.running); });
  $("#reset").addEventListener("click", function () { changeSetup(function () {}); });
  $("#show-test").addEventListener("change", drawMap);

  /* ---------- Part 1 runs ---------- */
  var runs1 = load("runs1", []);
  $("#record1").addEventListener("click", function () {
    if (!epoch) { flash($("#record1"), "Train first"); return; }
    var m = last();
    runs1.push({ set: p1.set, layers: p1.layers, neurons: p1.neurons, epoch: epoch, tra: m.tra, tea: m.tea, trl: m.trl, tel: m.tel, bestE: best.epoch, bestL: best.loss });
    save("runs1", runs1);
    flash($("#record1"), "✓ Recorded");
    refresh();
  });
  function renderRuns1() {
    var tb = $("#runs1 tbody");
    tb.innerHTML = runs1.length ? runs1.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + (r.set === "large" ? "200 bills" : "25 messy") + "</td><td>" + netLabel(r) + "</td><td>" + r.epoch.toLocaleString() +
        "</td><td>" + pct(r.tra) + "</td><td><b>" + pct(r.tea) + "</b></td><td>" + r.trl.toFixed(3) + "</td><td>" + r.tel.toFixed(3) +
        "</td><td>epoch " + r.bestE.toLocaleString() + "</td><td><button type=\"button\" class=\"linkbtn\" data-del1=\"" + i + "\">delete</button></td></tr>";
    }).join("") : "<tr><td colspan=\"10\" class=\"muted\">No runs recorded yet.</td></tr>";
  }
  $("#runs1").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del1]");
    if (!b) return;
    runs1.splice(+b.getAttribute("data-del1"), 1); save("runs1", runs1); refresh();
  });

  /* =====================================================================
     PART 2 · Fraud-flagging model
     ===================================================================== */
  var P2 = { epochs: 300, lr: 0.03, hidden: 6, seed: 1, share: 0.10 };
  var res2 = null, training2 = false;

  $("#train2").addEventListener("click", function () {
    if (training2) return;
    training2 = true;
    var use = { area: $("#use-area").checked, noncit: $("#use-noncit").checked };
    var tr = DATA.claimsTrain;
    var X = tr.map(function (r) { return DATA.claimInputs(r, use); });
    var y = tr.map(function (r) { return r.recorded; });
    var model = new NN.Net([X[0].length, P2.hidden, 1], P2.seed); // same start every time, so results are comparable
    var e = 0, btn = $("#train2"), status = $("#train2-status");
    btn.disabled = true;
    (function chunk() {
      for (var k = 0; k < 15 && e < P2.epochs; k++, e++) model.step(X, y, P2.lr);
      status.textContent = "Training… epoch " + e + " of " + P2.epochs;
      if (e < P2.epochs) { setTimeout(chunk, 0); return; }
      res2 = evaluate2(model, use);
      showRes2();
      status.textContent = "Trained with: " + inputsLabel(use) + ".";
      btn.disabled = false; training2 = false;
    })();
  });

  function evaluate2(model, use) {
    var te = DATA.claimsTest;
    var scores = te.map(function (r) { return model.predict(DATA.claimInputs(r, use)); });
    var order = scores.map(function (s, i) { return i; }).sort(function (a, b) { return scores[b] - scores[a]; });
    var nFlag = Math.round(te.length * P2.share), flagged = [];
    order.forEach(function (i, rank) { flagged[i] = rank < nFlag; });
    function group(keep) {
      var g = { n: 0, flag: 0, flagRec: 0, flagFraud: 0, honest: 0, honestFlag: 0 };
      te.forEach(function (r, i) {
        if (!keep(r)) return;
        g.n++;
        if (flagged[i]) { g.flag++; g.flagRec += r.recorded; g.flagFraud += r.fraud; }
        if (!r.fraud) { g.honest++; if (flagged[i]) g.honestFlag++; }
      });
      return { flag: g.flag / g.n, rec: g.flagRec / g.flag, fraud: g.flagFraud / g.flag, fp: g.honestFlag / g.honest };
    }
    var Xte = te.map(function (r) { return DATA.claimInputs(r, use); }), yte = te.map(function (r) { return r.recorded; });
    return {
      use: use, loss: model.loss(Xte, yte),
      all: group(function () { return true; }),
      c: group(function (r) { return !r.noncit; }),
      n: group(function (r) { return r.noncit; })
    };
  }
  function inputsLabel(use) {
    var extra = [];
    if (use.area) extra.push("postcode");
    if (use.noncit) extra.push("citizenship");
    return "income, corrections" + (extra.length ? " + " + extra.join(" + ") : "");
  }
  function showRes2() {
    $("#res2").hidden = false;
    ["all", "c", "n"].forEach(function (g) {
      $("#m-flag-" + g).textContent = pct(res2[g].flag);
      $("#m-rec-" + g).textContent = pct(res2[g].rec);
      $("#m-true-" + g).textContent = pct(res2[g].fraud);
      $("#m-fp-" + g).textContent = pct(res2[g].fp);
    });
    $("#m-loss").textContent = res2.loss.toFixed(3);
  }
  var truthShown = load("truth", false);
  function renderTruth() {
    $("#truth").hidden = !truthShown;
    $("#truth-btn").textContent = truthShown ? "Hide the truth" : "Show the truth";
    $("#truth-btn").setAttribute("aria-expanded", String(truthShown));
    $("#runs2").classList.toggle("truth-hidden", !truthShown);
  }
  $("#truth-btn").addEventListener("click", function () { truthShown = !truthShown; save("truth", truthShown); renderTruth(); });

  var runs2 = load("runs2", []);
  $("#record2").addEventListener("click", function () {
    if (!res2) return;
    runs2.push(res2);
    save("runs2", runs2);
    flash($("#record2"), "✓ Recorded");
    refresh();
  });
  function renderRuns2() {
    var tb = $("#runs2 tbody");
    tb.innerHTML = runs2.length ? runs2.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + inputsLabel(r.use) + "</td><td>" + pct(r.c.flag) + " / " + pct(r.n.flag) + "</td><td>" + pct(r.all.rec) +
        "</td><td>" + r.loss.toFixed(3) + "</td><td class=\"t\">" + pct(r.all.fraud) + "</td><td class=\"t\"><b>" + pct(r.c.fp) + " / " + pct(r.n.fp) + "</b></td>" +
        "<td><button type=\"button\" class=\"linkbtn\" data-del2=\"" + i + "\">delete</button></td></tr>";
    }).join("") : "<tr><td colspan=\"8\" class=\"muted\">No runs recorded yet.</td></tr>";
  }
  $("#runs2").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del2]");
    if (!b) return;
    runs2.splice(+b.getAttribute("data-del2"), 1); save("runs2", runs2); refresh();
  });

  /* =====================================================================
     Submission
     ===================================================================== */
  function items() {
    var list = [
      { ok: runs1.length >= 3, text: "Part 1: at least 3 recorded runs (" + runs1.length + " so far)" },
      { ok: runs2.length >= 3, text: "Part 2: at least 3 recorded runs (" + runs2.length + " so far)" }
    ];
    QUESTIONS.forEach(function (q) { list.push({ ok: (answers[q] || "").trim().length >= 15, text: Q_LABELS[q].split(" · ")[0] + " answered" }); });
    return list;
  }
  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
  function submissionText() {
    var out = [];
    out.push("POLISCI 158 · Section 2 lab submission");
    out.push("Name: " + (nameIn.value.trim() || "(missing)"));
    if (partnerIn.value.trim()) out.push("Partner: " + partnerIn.value.trim());
    out.push("Created: " + new Date().toLocaleString());
    var miss = items().filter(function (it) { return !it.ok; });
    out.push("Checklist: " + (miss.length ? "missing " + miss.map(function (it) { return it.text; }).join("; ") : "complete"));
    out.push("");
    out.push("PART 1 · RECORDED RUNS");
    if (!runs1.length) out.push("(none)");
    runs1.forEach(function (r, i) {
      out.push((i + 1) + ". " + pad(r.set === "large" ? "200 bills" : "25 messy", 10) + pad(netLabel(r), 18) + "epoch " + pad(r.epoch, 6) +
        "train acc " + pad(pct(r.tra), 7) + "test acc " + pad(pct(r.tea), 7) + "train loss " + r.trl.toFixed(3) + "  test loss " + r.tel.toFixed(3) +
        "  lowest test loss at epoch " + r.bestE);
    });
    out.push("");
    out.push("PART 2 · RECORDED RUNS (flag 10% of 2,000 test claims)");
    if (!runs2.length) out.push("(none)");
    runs2.forEach(function (r, i) {
      out.push((i + 1) + ". " + inputsLabel(r.use));
      out.push("   flagged: citizens " + pct(r.c.flag) + ", non-citizens " + pct(r.n.flag) + " | records call fraud: " + pct(r.all.rec) + " | test loss " + r.loss.toFixed(3));
      out.push("   truth: really fraud " + pct(r.all.fraud) + " | honest flagged: citizens " + pct(r.c.fp) + ", non-citizens " + pct(r.n.fp));
    });
    out.push("Truth revealed on this page: " + (truthShown ? "yes" : "no"));
    QUESTIONS.forEach(function (q) {
      out.push("");
      out.push(Q_LABELS[q].toUpperCase());
      out.push((answers[q] || "").trim() || "(no answer)");
    });
    return out.join("\n");
  }

  function refresh() {
    renderRuns1(); renderRuns2();
    var list = items(), n = list.filter(function (it) { return it.ok; }).length;
    $("#progress-fill").style.width = (100 * n / list.length) + "%";
    $("#progress-text").textContent = n + " of " + list.length + " items done";
    $("#checklist").innerHTML = list.map(function (it) { return "<li class=\"" + (it.ok ? "ok" : "") + "\">" + esc(it.text) + "</li>"; }).join("") +
      "<li class=\"" + (nameIn.value.trim() ? "ok" : "") + "\">Your name at the top of the page</li>";
    $("#preview").textContent = submissionText();
  }

  function fileName() {
    var n = nameIn.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student";
    return "ps158-section2-lab-" + n + ".txt";
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
    if (!confirm("Clear your name, recorded runs and answers on this page? This can't be undone.")) return;
    ["answers", "name", "partner", "runs1", "runs2", "truth"].forEach(function (k) { try { localStorage.removeItem(KEY + k); } catch (e) {} });
    location.reload();
  });

  /* ---------- Start ---------- */
  rebuild();
  renderTruth();
  refresh();
})();
