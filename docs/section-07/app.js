/* POLISCI 158 · Section 7 (research with an agent) workshop: page behavior (copied from Section 3).
   Progress, tool choice and the reflection are stored in this browser's localStorage under "ps158s7:". */
(function () {
  "use strict";

  var KEY = "ps158s7:";
  var NAMES = {
    claude: { instr: "CLAUDE.md", skilldir: ".claude/skills", pfx: "/" },
    codex:  { instr: "AGENTS.md", skilldir: ".agents/skills", pfx: "$" }
  };

  function load(k, d) { try { var v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- Route ---------- */
  function setRoute(route) {
    document.body.setAttribute("data-route", route);
    $$(".segmented [data-route-btn]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-route-btn") === route)); });
    var n = NAMES[route];
    $$(".u-instr").forEach(function (el) { el.textContent = n.instr; });
    $$(".u-skilldir").forEach(function (el) { el.textContent = n.skilldir; });
    $$(".u-pfx").forEach(function (el) { el.textContent = n.pfx; });
    save("route", route);
  }
  $$("[data-route-btn]").forEach(function (b) { b.addEventListener("click", function () { setRoute(b.getAttribute("data-route-btn")); }); });

  /* ---------- Steps ---------- */
  var steps = $$(".step");
  var done = load("done", {});
  function renderProgress() {
    var n = 0;
    steps.forEach(function (li) {
      var i = li.getAttribute("data-step"), d = !!done[i];
      if (d) n++;
      li.classList.toggle("done", d);
      var btn = $(".done-toggle", li);
      btn.setAttribute("aria-pressed", String(d));
      btn.textContent = d ? "✓ Done (click to undo)" : "Mark step done";
      $(".num", li).textContent = d ? "✓" : i;
    });
    $("#progress-fill").style.width = (100 * n / steps.length) + "%";
    $("#progress-text").textContent = n + " of " + steps.length + " steps done";
  }
  $$(".done-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var i = btn.getAttribute("data-done");
      done[i] = !done[i]; save("done", done); renderProgress();
      if (done[i]) {
        var li = btn.closest(".step");
        $("details", li).open = false;
        var next = li.nextElementSibling;
        while (next && done[next.getAttribute("data-step")]) next = next.nextElementSibling;
        if (next) { $("details", next).open = true; next.scrollIntoView({ block: "start" }); }
      }
    });
  });

  /* ---------- Copy buttons ---------- */
  function copyText(text, btn) {
    function ok() {
      var old = btn.textContent;
      btn.classList.add("copied"); btn.textContent = "Copied";
      setTimeout(function () { btn.classList.remove("copied"); btn.textContent = old; }, 1400);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(text); ok(); });
    } else { fallback(text); ok(); }
  }
  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  $$(".copy").forEach(function (btn) {
    btn.addEventListener("click", function () { copyText($("pre", btn.closest(".prompt")).innerText, btn); });
  });

  $$("[data-copy-chip]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var t = chip.textContent.trim();
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(function () { fallback(t); }); else fallback(t);
      $$("[data-copy-chip]").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      chip.setAttribute("aria-pressed", "true");
      $("#chip-status").textContent = "Copied. Paste it into your agent.";
    });
  });

  /* ---------- Troubleshooting search ---------- */
  var q = $("#faq-q");
  q.addEventListener("input", function () {
    var term = q.value.trim().toLowerCase(), shown = 0;
    $$("#faq > details").forEach(function (d) {
      var hay = (d.getAttribute("data-keys") + " " + d.textContent).toLowerCase();
      var match = !term || term.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
      d.style.display = match ? "" : "none";
      if (match) shown++;
      d.open = !!term && match && shown <= 2;
    });
    $("#faq-empty").style.display = shown ? "none" : "block";
  });

  /* ---------- Reflection (Submit) ---------- */
  var R = { name: $("#r-name"), answer: $("#r-answer") };
  var saved = load("reflection", {});
  Object.keys(R).forEach(function (k) { if (saved[k]) R[k].value = saved[k]; });
  function val(k) { return R[k].value.trim(); }
  function words(t) { return t ? t.split(/\s+/).length : 0; }
  function reflectionText() {
    return [
      "POLISCI 158 · Section Assignment 7 · Reflection",
      "Name: " + (val("name") || "(missing)"),
      "Saved: " + new Date().toLocaleString(),
      "Words: " + words(val("answer")),
      "",
      val("answer") || "(blank)"
    ].join("\n");
  }
  function renderReflection() {
    var n = words(val("answer"));
    $("#r-count").textContent = n + (n === 1 ? " word" : " words") + " so far · aim for about 200";
    var list = [["Your name", !!val("name")], ["Your reflection", !!val("answer")]];
    var ul = $("#r-checklist");
    ul.textContent = "";
    list.forEach(function (x) {
      var li = document.createElement("li");
      li.textContent = x[0];
      if (x[1]) li.className = "ok";
      ul.appendChild(li);
    });
    $("#r-preview").textContent = reflectionText();
  }
  Object.keys(R).forEach(function (k) {
    R[k].addEventListener("input", function () {
      saved[k] = R[k].value; save("reflection", saved); renderReflection();
    });
  });
  $("#r-download").addEventListener("click", function () {
    var who = (val("name") || "student").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var blob = new Blob([reflectionText()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "section7-reflection-" + who + ".txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $("#r-copy").addEventListener("click", function () { copyText(reflectionText(), this); });
  renderReflection();

  /* ---------- Reset ---------- */
  $("#reset-all").addEventListener("click", function () {
    if (!confirm("Reset your progress, tool choice and reflection on this page?")) return;
    Object.keys(localStorage).forEach(function (k) { if (k.indexOf(KEY) === 0) localStorage.removeItem(k); });
    location.reload();
  });

  /* ---------- Init ---------- */
  setRoute(load("route", "claude"));
  renderProgress();
  var first = steps.filter(function (li) { return !done[li.getAttribute("data-step")]; })[0];
  if (first) $("details", first).open = true;
})();
