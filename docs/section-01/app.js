/* POLISCI 158 · Section 1 workshop — page behavior.
   Everything is stored in this browser's localStorage under the "ps158s1:" prefix. */
(function () {
  "use strict";

  var KEY = "ps158s1:";
  var TOTAL_STEPS = 9;
  var TOOL_NAMES = { claude: "Claude Code", codex: "Codex" };

  function load(k, fallback) {
    try { var v = localStorage.getItem(KEY + k); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Route (Claude Code / Codex) ---------- */
  function setRoute(route) {
    document.body.setAttribute("data-route", route);
    $$(".segmented [data-route-btn]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-route-btn") === route));
    });
    $$(".u-tool").forEach(function (el) { el.textContent = TOOL_NAMES[route]; });
    save("route", route);
    renderPrompt();
  }
  $$("[data-route-btn]").forEach(function (b) {
    b.addEventListener("click", function () { setRoute(b.getAttribute("data-route-btn")); });
  });

  /* ---------- GitHub username personalization ---------- */
  var userInput = $("#gh-user");
  function cleanUser(v) { return (v || "").trim().replace(/^@/, "").replace(/\.github\.io$/i, "").replace(/[^A-Za-z0-9-]/g, ""); }
  function applyUser() {
    var u = cleanUser(userInput.value);
    var shown = u || "YOUR-USERNAME";
    $$(".u-user").forEach(function (el) { el.textContent = shown; });
    $$(".u-url").forEach(function (el) { el.textContent = "https://" + shown.toLowerCase() + ".github.io"; });
    $$(".u-link").forEach(function (a) {
      if (u) { a.href = "https://" + u.toLowerCase() + ".github.io"; a.removeAttribute("aria-disabled"); }
      else { a.href = "#steps"; a.setAttribute("aria-disabled", "true"); }
    });
    save("user", u);
    renderPrompt();
  }
  userInput.addEventListener("input", applyUser);

  /* ---------- Steps / progress ---------- */
  var done = load("done", {});
  function renderProgress() {
    var n = 0;
    $$(".step").forEach(function (li) {
      var i = li.getAttribute("data-step");
      var isDone = !!done[i];
      if (isDone) n++;
      li.classList.toggle("done", isDone);
      var btn = $(".done-toggle", li);
      btn.setAttribute("aria-pressed", String(isDone));
      btn.textContent = isDone ? "✓ Done (click to undo)" : "Mark step done";
      $(".num", li).textContent = isDone ? "✓" : i;
    });
    $("#progress-fill").style.width = (100 * n / TOTAL_STEPS) + "%";
    $("#progress-text").textContent = n + " of " + TOTAL_STEPS + " steps done";
  }
  $$(".done-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var i = btn.getAttribute("data-done");
      done[i] = !done[i];
      save("done", done);
      renderProgress();
      if (done[i]) {
        // close this step, open the next unfinished one
        var li = btn.closest(".step");
        $("details", li).open = false;
        var next = li.nextElementSibling;
        while (next && done[next.getAttribute("data-step")]) next = next.nextElementSibling;
        if (next) { $("details", next).open = true; next.scrollIntoView({ block: "start" }); }
      }
    });
  });

  /* ---------- Chat vs agent sorter ---------- */
  $$("#sorter .scenario").forEach(function (sc) {
    $$("button[data-pick]", sc).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button[data-pick]", sc).forEach(function (x) { x.removeAttribute("data-picked"); });
        b.setAttribute("data-picked", "");
        var right = b.getAttribute("data-pick") === sc.getAttribute("data-answer");
        sc.classList.add("answered");
        sc.classList.toggle("right", right);
        sc.classList.toggle("wrong", !right);
      });
    });
  });

  /* ---------- Pipeline diagram ---------- */
  var NODES = {
    folder: ["Project folder (on your laptop)",
      "A normal folder, e.g. <code>Documents/GitHub/username.github.io</code>. Git watches it and notices every change. This is where your real files live, and where the agent works.",
      "Created in step 1 (clone)."],
    agent: ["The agent edits files",
      "Claude Code or Codex reads what's in the folder, writes <code>index.html</code> and <code>style.css</code>, and shows you each change. The changes exist only on your laptop so far. The internet can't see them.",
      "Steps 2–5."],
    commit: ["Commit: a save point",
      "In GitHub Desktop, you write a short message and click <strong>Commit to main</strong>. Git records exactly what changed and why. You can go back to any commit later. It's still only on your laptop.",
      "Step 6, and again after every revision."],
    push: ["Push: upload your commits",
      "<strong>Push origin</strong> sends your new commits to GitHub. This is the moment your work leaves your laptop. Commit without push = nothing changes online.",
      "Step 6, after each commit."],
    github: ["The repository on github.com",
      "An online copy of your folder <em>and</em> its full history. It's a backup, a portfolio, and the thing you'll share when you submit work in this course.",
      "You created it in step 1."],
    pages: ["GitHub Pages: your live URL",
      "Because the repo is named <code>username.github.io</code>, GitHub serves its <code>index.html</code> as a public website. Every push republishes it within a few minutes.",
      "Step 7."]
  };
  function showNode(key) {
    $$("#pipeline button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-node") === key)); });
    var d = NODES[key];
    $("#pipeline-detail").innerHTML = "<h3>" + d[0] + "</h3><p style=\"margin:.2rem 0 .4rem\">" + d[1] + "</p><p class=\"muted small\" style=\"margin:0\">" + d[2] + "</p>";
  }
  $$("#pipeline button").forEach(function (b) {
    b.addEventListener("click", function () { showNode(b.getAttribute("data-node")); });
  });
  showNode("folder");

  /* ---------- Prompt builder ---------- */
  var form = $("#builder-form");
  var fields = load("fields", {});
  var styleSel = $("#f-style");
  var styleCustom = $("#f-style-custom");

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function val(k) { return (fields[k] || "").trim(); }
  function ph(text) { return "<span class=\"ph\">" + esc(text) + "</span>"; }
  function orPh(k, placeholder) { var v = val(k); return v ? esc(v) : ph(placeholder); }
  function listOrPh(k, placeholder) {
    var items = val(k).split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    return items.length ? items.map(function (s) { return "- " + esc(s); }).join("\n") : ph(placeholder);
  }

  function renderPrompt() {
    var out = $("#gen-prompt");
    if (!out) return;
    var route = document.body.getAttribute("data-route");
    var tool = TOOL_NAMES[route];
    var u = cleanUser(userInput.value);
    var url = u ? "https://" + u.toLowerCase() + ".github.io" : "https://" + "[my-username]" + ".github.io";
    var custom = val("style") === "custom";
    var style = custom ? val("stylecustom") : (val("style") || styleSel.options[0].value);
    var name = val("name");
    var links = val("links");

    var t = "";
    t += "This folder is my GitHub Pages repo for a college course (POLISCI 158, AI & Politics). It will be published at " + (u ? esc(url) : ph(url)) + ".\n\n";
    t += "Build a simple one-page personal website: an index.html with a linked style.css, plain HTML and CSS only (no frameworks, no build step).\n";
    t += "- Sections, in order: About, Interests, Project interests, with a simple top navigation.\n";
    t += "- Use only the text I give below. You may fix typos, but don't add facts, achievements, affiliations or links I didn't write. If something seems missing, leave it out and tell me.\n";
    t += "- Readable on a phone and a laptop, with good color contrast.\n";
    t += "- Style: " + (style ? esc(style) : ph("describe the look you want")) + ".\n";
    t += "- Footer: \"Built with " + tool + ". Text written by " + (name ? esc(name) : ph("my name")) + ".\"\n\n";
    t += "Before editing anything, show me your plan and wait for my OK. Ask me up to 3 questions if anything is unclear.\n\n";
    t += "MY CONTENT\n";
    t += "Name: " + orPh("name", "your name") + "\n\n";
    t += "About:\n" + orPh("about", "2–4 sentences about you, in your own words") + "\n\n";
    t += "Interests:\n" + listOrPh("interests", "a few interests, one per line") + "\n\n";
    t += "Project interests (kinds of course projects I'd like to work on):\n" + orPh("pint", "topics, questions, or the kind of work you enjoy") + "\n";
    if (val("pdone")) t += "\nSomething I've worked on:\n" + esc(val("pdone")) + "\n";
    if (links) t += "\nLinks:\n" + listOrPh("links", "") + "\n";
    out.innerHTML = t;
  }

  function fillForm() {
    $$("[data-field]", form).forEach(function (el) {
      var k = el.getAttribute("data-field");
      if (fields[k] !== undefined) el.value = fields[k];
    });
    styleCustom.style.display = styleSel.value === "custom" ? "block" : "none";
  }
  form.addEventListener("input", function (e) {
    var k = e.target.getAttribute("data-field");
    if (!k) return;
    fields[k] = e.target.value;
    styleCustom.style.display = styleSel.value === "custom" ? "block" : "none";
    save("fields", fields);
    renderPrompt();
  });
  $("#clear-form").addEventListener("click", function () {
    if (!confirm("Clear everything you typed in the prompt builder?")) return;
    fields = {}; save("fields", fields);
    $$("[data-field]", form).forEach(function (el) { el.value = el.tagName === "SELECT" ? el.options[0].value : ""; });
    fillForm(); renderPrompt();
  });


  /* ---------- Commit / push demo ---------- */
  (function () {
    var MSGS = ["Add first version", "Show interests as tags", "Fix phone layout", "Add a Now section", "Fix typo in About"];
    var st = { pending: 0, commits: [], pushed: 0, n: 0 };
    var root = $("#gitsim");
    if (!root) return;
    function chip(text, cls) { return "<span class=\"" + cls + "\">" + esc(text) + "</span>"; }
    function render(msg) {
      var local = st.commits.map(function (c, i) { return chip("● " + c, "gs-commit" + (i >= st.pushed ? " new" : "")); }).join("");
      if (st.pending) local += chip(st.pending + " unsaved change" + (st.pending > 1 ? "s" : ""), "gs-pending");
      $("#gs-local").innerHTML = local || chip("just the README", "gs-empty");
      var remote = st.commits.slice(0, st.pushed).map(function (c) { return chip("● " + c, "gs-commit"); }).join("");
      $("#gs-remote").innerHTML = remote || chip("just the README", "gs-empty");
      $("[data-gs=commit]", root).disabled = !st.pending;
      $("[data-gs=push]", root).disabled = st.pushed === st.commits.length;
      $("#gs-msg").innerHTML = msg || "Start by letting the agent edit a file.";
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gs]");
      if (!b) return;
      var a = b.getAttribute("data-gs");
      if (a === "edit") {
        st.pending++;
        render("The file changed <strong>on your laptop only</strong>. Nothing is saved as a version yet, and GitHub knows nothing about it.");
      } else if (a === "commit") {
        var m = MSGS[st.n % MSGS.length]; st.n++;
        st.commits.push(m); st.pending = 0;
        render("Snapshot saved with the message <em>“" + esc(m) + "”</em>. You can always return to it. But it's still <strong>only on your laptop</strong>: your live site hasn't changed.");
      } else if (a === "push") {
        var k = st.commits.length - st.pushed; st.pushed = st.commits.length;
        render("Uploaded " + k + " commit" + (k > 1 ? "s" : "") + " to GitHub. Your live site updates within a few minutes. ✓");
      } else { st = { pending: 0, commits: [], pushed: 0, n: 0 }; render(); }
    });
    render();
  })();

  /* ---------- Copy buttons ---------- */
  function copyText(text, btn, label) {
    function ok() {
      if (!btn) return;
      var old = btn.textContent;
      btn.classList.add("copied"); btn.textContent = label || "Copied";
      setTimeout(function () { btn.classList.remove("copied"); btn.textContent = old; }, 1400);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); ok(); });
    } else { fallbackCopy(text); ok(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  $$(".copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-copy-target");
      var pre = target ? document.getElementById(target) : $("pre", btn.closest(".prompt"));
      copyText(pre.innerText, btn);
    });
  });
  $$("#followups .chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      copyText(chip.getAttribute("data-copy-text"), null);
      $$("#followups .chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      chip.setAttribute("aria-pressed", "true");
      $("#chip-status").textContent = "Copied: “" + chip.getAttribute("data-copy-text") + "”. Paste it into your agent.";
    });
  });

  /* open the optional builder when linked to */
  $$("[data-open-builder]").forEach(function (a) {
    a.addEventListener("click", function () { $("#builder").open = true; });
  });
  if (location.hash === "#builder") $("#builder").open = true;

  /* ---------- Troubleshooting search ---------- */
  var faqQ = $("#faq-q");
  faqQ.addEventListener("input", function () {
    var q = faqQ.value.trim().toLowerCase();
    var shown = 0;
    $$("#faq details").forEach(function (d) {
      var hay = (d.getAttribute("data-keys") + " " + d.textContent).toLowerCase();
      var match = !q || q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
      d.style.display = match ? "" : "none";
      if (match) shown++;
      if (q && match && shown <= 2) d.open = true;
      if (!q) d.open = false;
    });
    $("#faq-empty").style.display = shown ? "none" : "block";
  });

  /* ---------- Reset ---------- */
  $("#reset-all").addEventListener("click", function () {
    if (!confirm("Reset your steps, username, tool choice and prompt-builder content on this page?")) return;
    Object.keys(localStorage).forEach(function (k) { if (k.indexOf(KEY) === 0) localStorage.removeItem(k); });
    location.reload();
  });

  /* ---------- Init ---------- */
  userInput.value = load("user", "");
  fillForm();
  applyUser();
  setRoute(load("route", "claude"));
  renderProgress();
  // open the first unfinished step
  var firstOpen = $$(".step").filter(function (li) { return !done[li.getAttribute("data-step")]; })[0];
  if (firstOpen) $("details", firstOpen).open = true;
})();
