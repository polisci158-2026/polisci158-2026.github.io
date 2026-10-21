/* POLISCI 158 · Section 4 — a tiny next-word model, in plain JavaScript.
   It counts which word follows which in the training answers ("n-grams"), then turns
   the counts into a probability for every word it knows. Real language models use a
   neural network with billions of weights instead of a table of counts, but the job
   is the same: given the text so far, give every possible next word a probability. */
(function (global) {
  "use strict";

  var START = "<s>", END = "</s>";

  /* context: how many previous words the model may look at (1 or 2). */
  function Model(texts, context, tokenize) {
    this.k = context;
    this.counts = [];  // counts[n]: "previous n words" -> { next word: count }
    for (var n = 0; n <= 2; n++) this.counts.push(Object.create(null));
    var vocab = Object.create(null);
    for (var i = 0; i < texts.length; i++) {
      var w = [START, START].concat(tokenize(texts[i]), [END]);
      for (var t = 2; t < w.length; t++) {
        vocab[w[t]] = 1;
        for (n = 0; n <= 2; n++) add(this.counts[n], w.slice(t - n, t).join(" "), w[t]);
      }
    }
    this.vocab = Object.keys(vocab);
    this.tokens = texts.reduce(function (s, x) { return s + tokenize(x).length + 1; }, 0);
  }
  function add(table, h, next) {
    var row = table[h] || (table[h] = { total: 0, types: 0, next: Object.create(null) });
    if (!row.next[next]) { row.next[next] = 0; row.types++; }
    row.next[next]++; row.total++;
  }

  /* Probability of every known word after `history` (an array of words).
     Witten–Bell smoothing: trust the longest context in proportion to how much
     evidence there is for it, and fill the rest from shorter contexts. */
  Model.prototype.dist = function (history) {
    var h = [START, START].concat(history), V = this.vocab.length;
    var uni = this.counts[0][""], p = Object.create(null), self = this;
    this.vocab.forEach(function (w) { p[w] = (uni.next[w] + 1) / (uni.total + V + 1); });
    for (var n = 1; n <= this.k; n++) {
      var row = this.counts[n][h.slice(h.length - n).join(" ")];
      if (!row) continue;  // never saw these words: fall back to the shorter context
      var lam = row.total / (row.total + row.types);
      self.vocab.forEach(function (w) { p[w] = lam * ((row.next[w] || 0) / row.total) + (1 - lam) * p[w]; });
    }
    return p;
  };

  /* The top `n` next words, with chances, after applying the temperature. */
  Model.prototype.top = function (history, n, temperature) {
    var p = this.temper(this.dist(history), temperature);
    return Object.keys(p).sort(function (a, b) { return p[b] - p[a]; }).slice(0, n)
      .map(function (w) { return { word: w, p: p[w] }; });
  };
  Model.prototype.temper = function (p, T) {
    var out = Object.create(null), z = 0, w;
    for (w in p) { out[w] = Math.pow(p[w], 1 / T); z += out[w]; }
    for (w in out) out[w] /= z;
    return out;
  };
  Model.prototype.sample = function (history, T, rand) {
    var p = this.temper(this.dist(history), T), u = rand(), acc = 0, w;
    for (w in p) { acc += p[w]; if (u <= acc) return w; }
    return w;
  };

  /* Prediction error on new text: the average surprise per word, in bits.
     0 would mean it always knew the next word for sure. Lower is better. */
  Model.prototype.error = function (texts, tokenize) {
    var bits = 0, n = 0, unk = 1 / (this.counts[0][""].total + this.vocab.length + 1);
    for (var i = 0; i < texts.length; i++) {
      var w = tokenize(texts[i]).concat([END]);
      for (var t = 0; t < w.length; t++) {
        var p = this.dist(w.slice(Math.max(0, t - 2), t))[w[t]] || unk;
        bits -= Math.log(p) / Math.LN2; n++;
      }
    }
    return bits / n;
  };

  global.LM = { Model: Model, START: START, END: END };
})(this);
