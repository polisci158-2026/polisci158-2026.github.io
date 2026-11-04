/* POLISCI 158 · Builds the left "On this page" sidebar on a section page (same look as Section 5).
   Include on a section page with:
     <link rel="stylesheet" href="../assets/section-nav.css">
     <script src="../assets/section-nav.js" defer></script>
   Items come from the top bar's #links (labelled with the heading they point to);
   a page with no #links (an assignment page) lists its h2 headings instead.
   The top bar's other links (Assignment, Lab page, …) go below a divider.
   Pages that already have their own sidebar (.sidenav) are left alone. */
(function () {
  "use strict";
  var main = document.querySelector("main");
  if (!main || document.querySelector(".sidenav, .snx-nav")) return;

  function text(node) { return (node.textContent || "").replace(/\s+/g, " ").trim(); }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "part"; }

  var barLinks = [].slice.call(document.querySelectorAll(".topbar nav a"));
  var onPage = [], pages = [];

  barLinks.forEach(function (a) {
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) === "#") {
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      var h = target.matches("h2") ? target : target.querySelector("h2");
      onPage.push({ href: href, label: h ? text(h) : text(a) });
    } else {
      pages.push({ href: href, label: text(a).replace(/^←\s*/, "") });
    }
  });

  if (!onPage.length) {
    [].slice.call(main.querySelectorAll("h2")).forEach(function (h) {
      if (!h.id) {
        var id = slug(text(h)), n = 2;
        while (document.getElementById(id)) id = slug(text(h)) + "-" + n++;
        h.id = id;
      }
      onPage.push({ href: "#" + h.id, label: text(h) });
    });
  }
  if (!onPage.length && !pages.length) return;

  if (!main.id) main.id = "top";
  onPage.unshift({ href: "#" + main.id, label: "Start" });

  /* Build the sidebar */
  var nav = document.createElement("nav");
  nav.className = "snx-nav";
  nav.setAttribute("aria-label", "On this page");
  var head = document.createElement("p");
  head.className = "sn-h";
  head.textContent = "On this page";
  var ol = document.createElement("ol");
  function item(it, sep) {
    var li = document.createElement("li");
    if (sep) li.className = "sn-sep";
    var a = document.createElement("a");
    a.href = it.href;
    a.textContent = it.label;
    li.appendChild(a);
    ol.appendChild(li);
  }
  onPage.forEach(function (it) { item(it, false); });
  pages.forEach(function (it, i) { item(it, i === 0); });
  nav.appendChild(head);
  nav.appendChild(ol);

  /* Wrap <main> in a two-column grid, keeping the page's own content width */
  var width = getComputedStyle(main).maxWidth;
  var layout = document.createElement("div");
  layout.className = "snx-layout";
  if (width && width !== "none") layout.style.setProperty("--snx-main", width);
  main.parentNode.insertBefore(layout, main);
  layout.appendChild(nav);
  layout.appendChild(main);
  document.body.classList.add("snx-on");

  /* Highlight the part of the page being read */
  var links = [].slice.call(ol.querySelectorAll("a[href^='#']"));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  function update() {
    var y = window.scrollY + 120, current = links[0];
    targets.forEach(function (t, i) {
      if (t && t !== main && t.getBoundingClientRect().top + window.scrollY <= y) current = links[i];
    });
    links.forEach(function (a) { a.setAttribute("aria-current", String(a === current)); });
  }
  var queued = false;
  window.addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }, { passive: true });
  update();
})();
