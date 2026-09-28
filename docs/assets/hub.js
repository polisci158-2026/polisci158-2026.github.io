/* Renders the section hub from window.SECTIONS (see sections.js). No dependencies. */
(function () {
  "use strict";

  var sections = (window.SECTIONS || [])
    .filter(function (s) { return s.status !== "hidden"; })
    .sort(function (a, b) { return a.num - b.num; });
  var published = sections.filter(function (s) { return s.status === "published"; });

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function linkRow(links, big) {
    return el("div", { class: "btn-row" }, (links || []).map(function (l) {
      var cls = l.primary ? "btn" : "btn secondary";
      if (!big) cls += " small-btn";
      return el("a", { class: cls, href: l.href, text: l.label });
    }));
  }

  /* ---------- Featured: the most recent published section ---------- */
  var featured = document.getElementById("featured");
  var latest = published[published.length - 1];
  if (featured && latest) {
    featured.appendChild(el("p", { class: "eyebrow", text: "Latest · Section " + latest.num }));
    featured.appendChild(el("h2", { text: latest.title }));
    if (latest.summary) featured.appendChild(el("p", { class: "summary", text: latest.summary }));
    featured.appendChild(linkRow(latest.links, true));
    featured.hidden = false;
  }

  /* ---------- All sections ---------- */
  var list = document.getElementById("section-list");
  if (list) {
    list.textContent = "";
    sections.forEach(function (s) {
      var live = s.status === "published";
      var body = el("div", { class: "row-body" }, [
        live ? null : el("div", { class: "row-head" }, [el("span", { class: "tag", text: "Coming soon" })]),
        el("h3", { text: s.title }),
        s.summary ? el("p", { text: s.summary }) : null,
        live && s.links && s.links.length ? linkRow(s.links, false) : null
      ]);
      list.appendChild(el("li", { class: "row" + (live ? "" : " upcoming"), id: "section-" + s.num }, [
        el("span", { class: "num", "aria-hidden": "true", text: String(s.num) }),
        el("span", { class: "visually-hidden", text: "Section " + s.num + ": " }),
        body
      ]));
    });
  }

  /* ---------- Assignments table ---------- */
  var tbody = document.getElementById("assignment-rows");
  var withAssignment = published.filter(function (s) { return s.assignment; });
  if (tbody) {
    tbody.textContent = "";
    withAssignment.forEach(function (s) {
      var a = s.assignment;
      tbody.appendChild(el("tr", {}, [
        el("td", { text: String(s.num) }),
        el("td", {}, [a.href ? el("a", { href: a.href, text: a.title }) : document.createTextNode(a.title)]),
        el("td", { text: a.grading || "" }),
        el("td", { text: a.due || "" })
      ]));
    });
    if (!withAssignment.length) {
      tbody.appendChild(el("tr", {}, [el("td", { colspan: "4", class: "muted", text: "No assignments posted yet." })]));
    }
  }

  var count = document.getElementById("count");
  if (count) count.textContent = published.length + " of " + sections.length + " posted";
})();
