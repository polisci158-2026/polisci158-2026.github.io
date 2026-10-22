/* POLISCI 158 · Section 4 lab — simulated open-ended survey answers.
   Question: "In your own words, why do you feel the way you do about AI?"
   Every answer is made up by the grammar below from a fixed seed, so every student
   trains on exactly the same text. The poll numbers inside the answers are random
   on purpose: respondents half-remember things they read. */
(function (global) {
  "use strict";

  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var G = {
    worry: [
      "i am {deg}worried that ai will {take}",
      "i {wdeg}worry that ai will {harm}",
      "i am afraid ai will {harm}",
      "i do not trust {actor} to {duty}",
      "{actor} cannot be trusted to {duty}",
      "nobody asked us if we wanted it",
      "it is moving too fast for the rules to keep up",
      "i have seen too many fake {media} already",
      "{users} and {usersbad}",
      "i do not know what happens when {workers} are replaced by machines"
    ],
    hope: [
      "i am {deg}excited that ai will help {helps}",
      "ai already helps me {task}",
      "i think ai will make {thing} {better}",
      "it saves me {time} every week",
      "{users} and {usersgood}",
      "used the right way it could help a lot of people"
    ],
    mixed: [
      "it could help {helps} , but i worry that it will {harm}",
      "it depends on who controls it",
      "i am excited and worried at the same time",
      "it is useful for {task2} , but i do not trust {actor} to {duty}",
      "it helps me {task} , but {actor} cannot be trusted to {duty}"
    ],
    heard: [
      "a recent poll found that {n} percent of {pop} {claim}",
      "i read that {n} percent of {pop} {claim}",
      "i saw a study saying {n} percent of {jobs} could be replaced",
      "the news said {n} percent of {pop} {claim}"
    ],
    deg: ["", "", "really ", "very ", "a little ", "kind of "],
    wdeg: ["", "", "really ", "also "],
    take: ["take jobs from people like me", "take away good jobs", "take over {jobs}", "take jobs in my town", "take the jobs young people need"],
    jobs: ["customer service jobs", "office jobs", "driving jobs", "factory jobs", "writing jobs", "call center jobs"],
    workers: ["teachers", "nurses", "drivers", "cashiers", "translators", "call center workers", "factory workers", "artists"],
    harm: ["spread fake news before elections", "make it harder to know what is true", "be used to watch us", "replace {workers}", "make kids lazy", "put artists out of work", "make scams easier", "get out of control", "be used against voters", "make people lonely", "be used by criminals", "decide things about us without a human"],
    media: ["videos", "pictures", "news stories", "ads", "voices"],
    actor: ["the companies", "big tech", "the government", "congress", "the people who build it", "the tech billionaires", "silicon valley", "my state"],
    duty: ["use it responsibly", "keep my data safe", "regulate it", "tell us the truth", "put people first", "protect workers", "slow down", "follow the rules"],
    helps: ["doctors find diseases earlier", "nurses find diseases earlier", "scientists do research faster", "students learn at their own pace", "teachers grade faster", "farmers plan better", "{who} {gain}", "{who} {gain}", "{who} {gain}"],
    who: ["doctors", "teachers", "nurses", "scientists", "small businesses", "students", "farmers", "lawyers", "people with disabilities", "city governments"],
    gain: ["save time", "work more efficiently", "cut paperwork", "answer questions faster", "find mistakes", "plan better", "reach more people"],
    task: ["write emails", "plan my week", "fix my code", "understand my bills", "translate for my parents", "study for exams", "find recipes", "write cover letters", "learn new things", "organize my notes"],
    task2: ["writing emails", "planning trips", "simple questions", "summarizing documents", "studying", "finding information"],
    thing: ["health care", "school", "customer service", "government services", "shopping", "driving", "banking", "research"],
    better: ["better and cheaper", "faster", "safer", "easier for everyone", "more fair"],
    time: ["hours", "an hour", "a lot of time", "two hours"],
    users: ["my kids use it for homework", "my students use it for homework", "my classmates use it for homework", "my coworkers use it at work", "my friends use it every day", "my parents talk to it all the time"],
    usersbad: ["do not learn anything", "stopped thinking for themselves", "believe everything it says"],
    usersgood: ["learn faster", "get more done", "say it helps a lot"],
    pop: ["americans", "people", "voters", "workers", "parents", "young people", "teachers", "republicans", "democrats"],
    claim: ["are more worried than excited", "are more excited than worried", "do not trust ai companies", "want more control over ai", "use chatbots every week", "think ai will hurt jobs", "want the government to regulate ai", "think ai will help the economy", "have used chatgpt", "worry about fake news"],
    open: ["", "", "", "", "honestly , ", "to be honest , ", "mostly because ", "well , ", "for me , "]
  };

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function fill(r, s) {
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      if (k === "n") return String(5 * (2 + Math.floor(r() * 18))); // 10 … 95
      return fill(r, pick(r, G[k]));
    });
  }

  /* One respondent: a mood, then 1–3 sentences in that mood. */
  function answer(r) {
    var u = r(), mood = u < 0.5 ? "worry" : u < 0.62 ? "hope" : "mixed";
    var k = 1 + Math.floor(r() * 3), out = [];
    for (var i = 0, tries = 0; out.length < k && tries < 20; tries++) {
      var pool = r() < 0.18 ? "heard" : mood;
      var s = fill(r, pick(r, G[pool])) + " .";
      if (out.some(function (o) { return o.indexOf(s) >= 0; })) continue;  // no sentence twice in one answer
      out.push((out.length === 0 ? pick(r, G.open) : "") + s);
    }
    return out.join(" ");
  }

  function corpus(n, seed) {
    var r = rng(seed), out = [];
    for (var i = 0; i < n; i++) out.push(answer(r));
    return out;
  }

  /* The guessing game: 200 short factual questions about polls on AI. For each one the
     model has a confidence (its chance of being right if it answers), and the page decides
     once, with a fixed seed, whether its answer would be right. The model is "calibrated":
     when it is 70% sure, it is right about 70% of the time. */
  function quiz(n, seed) {
    var r = rng(seed), out = [];
    for (var i = 0; i < n; i++) {
      var u = r(), c = u < 0.35 ? 0.75 + 0.23 * r() : u < 0.6 ? 0.4 + 0.35 * r() : 0.02 + 0.38 * r();
      out.push({ conf: c, right: r() < c });
    }
    return out.sort(function (a, b) { return b.conf - a.conf; });
  }

  global.DATA = {
    quiz: quiz(200, 7),
    train: corpus(10000, 158),  // the model uses the first 100, 1,000 or all 10,000
    test: corpus(1000, 2026),   // new answers it never trains on
    tokenize: function (s) {
      return String(s).toLowerCase().replace(/%/g, " percent").replace(/[^a-z0-9.,' ]+/g, " ")
        .replace(/([.,])/g, " $1 ").split(/\s+/).filter(Boolean);
    }
  };
})(this);
