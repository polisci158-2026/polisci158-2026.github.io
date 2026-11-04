/* POLISCI 158 · Section 6 (RL) · "Campaign Trail": a tiny game and a Q-learning agent, in plain JavaScript.
   No libraries. Read it top to bottom: the map, the rules, the reward, then the learner.
   Used by the lab page (app.js), the slides, and tools/check_rl.js. */
(function (root) {
  "use strict";

  /* ---------- 1 · The map ----------
     H = campaign headquarters (start)   C = the Capitol (election day: the goal)
     T = TV studio (airtime; reopens 3 steps after a visit)   S = scandal (the campaign ends)
     # = closed road   . = open road */
  var MAP = [
    "H....#.",
    ".##..#.",
    "...#...",
    ".S.#.##",
    ".#...#T",
    ".#.#...",
    "...S#.C"
  ];
  var ROWS = MAP.length, COLS = MAP[0].length;
  var MAX_STEPS = 40, TV_COOLDOWN = 3;
  var ACTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];   // up, down, left, right
  var ACTION_NAMES = ["up", "down", "left", "right"];
  var start = 0;
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (MAP[r][c] === "H") start = r * COLS + c;
  function tile(cell) { return MAP[Math.floor(cell / COLS)][cell % COLS]; }

  /* ---------- 2 · The reward: the only thing the agent is told about what we want ---------- */
  var DEFAULT_REWARD = { capitol: 10, step: -0.1, scandal: -5, tv: 0 };

  /* ---------- 3 · The rules ---------- */
  function Game(reward) {
    this.reward = reward || DEFAULT_REWARD;
    this.reset();
  }
  Game.prototype.reset = function () {
    this.cell = start; this.cooldown = 0; this.steps = 0; this.done = false;
    this.total = 0; this.tv = 0; this.reachedCapitol = false; this.scandal = false;
    return this.state();
  };
  // What the agent sees: where it is, and how long until the studio reopens. 49 cells × 4 = 196 states.
  Game.prototype.state = function () { return this.cell * (TV_COOLDOWN + 1) + this.cooldown; };
  Game.prototype.step = function (a) {
    var R = this.reward, r = Math.floor(this.cell / COLS) + ACTIONS[a][0], c = this.cell % COLS + ACTIONS[a][1];
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r][c] !== "#") this.cell = r * COLS + c;   // walls: stay put
    if (this.cooldown > 0) this.cooldown--;
    var gain = R.step, t = tile(this.cell);
    if (t === "T" && this.cooldown === 0) { gain += R.tv; this.tv++; this.cooldown = TV_COOLDOWN; }
    if (t === "C") { gain += R.capitol; this.reachedCapitol = true; this.done = true; }
    if (t === "S") { gain += R.scandal; this.scandal = true; this.done = true; }
    this.steps++;
    if (this.steps >= MAX_STEPS) this.done = true;
    this.total += gain;
    return { state: this.state(), reward: gain, done: this.done };
  };

  /* ---------- 4 · The learner: tabular Q-learning ----------
     Q[s][a] = how much total future reward the agent expects if it takes action a in state s.
     After each step:  Q[s][a] += alpha × (reward + gamma × max Q[next] − Q[s][a]). */
  function rng(seed) {   // a small seeded random number generator, so every run is reproducible
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function Agent(opts) {
    opts = opts || {};
    this.alpha = opts.alpha != null ? opts.alpha : 0.2;      // learning rate
    this.gamma = opts.gamma != null ? opts.gamma : 0.95;     // how much it cares about later rewards
    this.epsilon = opts.epsilon != null ? opts.epsilon : 0.2; // how often it tries a random move
    this.random = rng(opts.seed != null ? opts.seed : 158);
    var n = ROWS * COLS * (TV_COOLDOWN + 1);
    this.Q = [];
    for (var s = 0; s < n; s++) this.Q.push([0, 0, 0, 0]);
    this.episodes = 0;
  }
  Agent.prototype.best = function (s, random) {   // the highest-valued move; ties broken at random
    var q = this.Q[s], top = Math.max(q[0], q[1], q[2], q[3]), ties = [];
    for (var a = 0; a < 4; a++) if (q[a] === top) ties.push(a);
    return ties.length === 1 ? ties[0] : ties[Math.floor((random || this.random)() * ties.length)];
  };
  // The same, but ties go to the first move: for showing the policy without using up training randomness.
  Agent.prototype.bestFixed = function (s) {
    var q = this.Q[s], b = 0;
    for (var a = 1; a < 4; a++) if (q[a] > q[b]) b = a;
    return b;
  };
  Agent.prototype.act = function (s, explore) {
    if (explore && this.random() < this.epsilon) return Math.floor(this.random() * 4);
    return this.best(s);
  };
  // Play one game while learning. Returns what happened, for the learning curve.
  Agent.prototype.trainEpisode = function (reward) {
    var g = new Game(reward), s = g.state();
    while (!g.done) {
      var a = this.act(s, true), out = g.step(a), q = this.Q[s];
      var target = out.reward + (out.done ? 0 : this.gamma * Math.max.apply(null, this.Q[out.state]));
      q[a] += this.alpha * (target - q[a]);
      s = out.state;
    }
    this.episodes++;
    return { total: g.total, capitol: g.reachedCapitol, scandal: g.scandal, tv: g.tv, steps: g.steps };
  };
  // Play one game with no exploring and no learning: what the agent has actually learned.
  Agent.prototype.playGreedy = function (reward) {
    var g = new Game(reward), path = [g.cell], ties = rng(1);   // its own randomness, so watching never changes training
    while (!g.done) { g.step(this.best(g.state(), ties)); path.push(g.cell); }
    return { total: g.total, capitol: g.reachedCapitol, scandal: g.scandal, tv: g.tv, steps: g.steps, path: path };
  };

  root.RL = {
    MAP: MAP, ROWS: ROWS, COLS: COLS, MAX_STEPS: MAX_STEPS, TV_COOLDOWN: TV_COOLDOWN,
    ACTION_NAMES: ACTION_NAMES, START: start, DEFAULT_REWARD: DEFAULT_REWARD,
    tile: tile, Game: Game, Agent: Agent, rng: rng
  };
})(typeof window !== "undefined" ? window : globalThis);
