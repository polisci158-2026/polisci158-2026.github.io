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
  {
    num: 2,
    status: "published",
    title: "Train a neural network, then question it",
    summary: "Train a small neural network in your browser, watch it overfit, then test a fraud-flagging model the way an auditor would.",
    links: [
      { label: "Lab", href: "section-02/index.html", primary: true },
      { label: "Assignment", href: "section-02/assignment.html" }
    ],
    assignment: {
      title: "Train a neural network, then question it",
      grading: "Pass / No-Pass",
      due: "End of your Section 2 meeting (see Canvas)",
      href: "section-02/assignment.html"
    }
  },
  {
    num: 3,
    status: "published",
    title: "From an empty folder to a figure",
    summary: "Start with an empty folder and a research question, and finish with real data and a first figure by talking it through with your coding agent.",
    links: [
      { label: "Workshop guide", href: "section-03/index.html", primary: true },
      { label: "Assignment", href: "section-03/assignment.html" }
    ],
    assignment: {
      title: "Reproduce a figure with your agent",
      grading: "Pass / No-Pass",
      due: "Before Section 4 (see Canvas)",
      href: "section-03/assignment.html"
    }
  },
  {
    num: 4,
    status: "published",
    title: "How a chatbot guesses public opinion",
    summary: "Look inside the kind of model a chatbot is built on, see why it guesses when it doesn't know, then test whether a chatbot can tell you what a Pew poll found.",
    links: [
      { label: "Lab", href: "section-04/index.html", primary: true },
      { label: "Assignment", href: "section-04/assignment.html" }
    ],
    assignment: {
      title: "How a chatbot guesses public opinion",
      grading: "Pass / No-Pass",
      due: "End of your Section 4 meeting (see Canvas)",
      href: "section-04/assignment.html"
    }
  },
  {
    num: 5,
    status: "published",
    title: "Can you train a neutral AI?",
    summary: "Argue about political neutrality and write your own neutrality rule, then use it the way AI companies do: rate replies, build a reward model, and train a model toward it.",
    links: [
      { label: "Lab", href: "section-05/index.html", primary: true },
      { label: "Submit", href: "section-05/index.html#submit" }
    ],
    assignment: {
      title: "Can you train a neutral AI? (lab submission)",
      grading: "Pass / No-Pass",
      due: "End of your Section 5 meeting (see Canvas)",
      href: "section-05/index.html#submit"
    }
  },
  { num: 6, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 7, status: "upcoming", title: "To be announced", summary: "", links: [] },
  { num: 8, status: "upcoming", title: "To be announced", summary: "", links: [] }
];
