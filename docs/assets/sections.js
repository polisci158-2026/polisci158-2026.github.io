/* POLISCI 158 · Section materials — the only file you need to edit to add a section.

   Each entry becomes a row on the home page (and an assignment row, if it has one).
   Fields:
     num        section number (1, 2, …)
     status     "published" → links are live
                "upcoming"  → greyed out, shows "Coming soon" (use for placeholders)
                "hidden"    → not shown at all
     title      short title
     summary    one or two sentences, student-facing
     links      [{ label, href, primary? }]; hrefs are relative to docs/
     assignment optional { title, grading, due, href }

   To publish a new section: put its files in docs/section-NN/ (e.g. docs/section-02/),
   then fill in that section's entry below and set status to "published". */

window.SECTIONS = [
  {
    num: 1,
    status: "published",
    title: "Getting started: a coding agent + GitHub",
    summary: "Set up Claude Code or Codex and GitHub, learn the describe → review → revise → commit loop, and publish your personal website.",
    links: [
      { label: "Workshop guide", href: "section-01/index.html", primary: true },
      { label: "Assignment", href: "section-01/assignment.html" },
      { label: "Example site", href: "section-01/example/index.html" }
    ],
    assignment: {
      title: "Make your personal website",
      grading: "Pass / No-Pass",
      due: "Before Section 2 (see Canvas)",
      href: "section-01/assignment.html"
    }
  },

  /* ---- Placeholders: replace title/summary/links and set status to "published" when ready ---- */
  { num: 2, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 3, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 4, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 5, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 6, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 7, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 8, status: "upcoming", title: "To be announced", summary: "", links: [] }
];
