/* POLISCI 158 · Section 4 — a tiny transformer, run in plain JavaScript.
   The weights (tiny-transformer.js) were trained on the same 10,000 simulated answers
   as the counting model. The steps are the ones in a real LLM, just much smaller:
     1. each token becomes a list of 32 numbers (an embedding), plus its position;
     2. two layers, each with
          attention: every token looks back at earlier tokens and takes in what it needs,
          a feed-forward network: each token is processed on its own;
     3. the last token's numbers are compared with every word's embedding → a score per word,
        and the scores are turned into chances (softmax).
   GPT-3 does the same with 96 layers, 96 attention heads and 12,288 numbers per token. */
(function (global) {
  "use strict";

  function Transformer(W) {
    this.W = W; this.cfg = W.cfg; this.vocab = W.vocab;
    this.index = Object.create(null);
    for (var i = 0; i < W.vocab.length; i++) this.index[W.vocab[i]] = i;
  }

  function layerNorm(x, p) {
    var n = x.length, mean = 0, v = 0, out = new Array(n), i;
    for (i = 0; i < n; i++) mean += x[i];
    mean /= n;
    for (i = 0; i < n; i++) v += (x[i] - mean) * (x[i] - mean);
    var s = 1 / Math.sqrt(v / n + 1e-5);
    for (i = 0; i < n; i++) out[i] = (x[i] - mean) * s * p[0][i] + p[1][i];
    return out;
  }
  function linear(x, p, nOut) {  // weights stored (out, in), row-major
    var nIn = x.length, out = new Array(nOut);
    for (var o = 0; o < nOut; o++) {
      var s = p[1][o], row = o * nIn;
      for (var i = 0; i < nIn; i++) s += p[0][row + i] * x[i];
      out[o] = s;
    }
    return out;
  }
  function gelu(x) { return 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x))); }

  /* Words → token ids. Words the model never saw become <unk>. */
  Transformer.prototype.encode = function (words) {
    var self = this, ids = [this.index["<s>"]], unknown = [];
    words.forEach(function (w) {
      if (self.index[w] === undefined) { unknown.push(w); ids.push(self.index["<unk>"]); }
      else ids.push(self.index[w]);
    });
    if (ids.length > this.cfg.ctx) ids = [ids[0]].concat(ids.slice(ids.length - this.cfg.ctx + 1));
    return { ids: ids, unknown: unknown };
  };

  /* Runs the model on the text so far. Returns the chance of every next word and,
     for each layer and head, how much the LAST token attended to each earlier token. */
  Transformer.prototype.run = function (words) {
    var W = this.W, D = this.cfg.d, H = this.cfg.heads, hd = D / H;
    var enc = this.encode(words), ids = enc.ids, T = ids.length;
    var x = ids.map(function (id, t) {
      var v = new Array(D);
      for (var j = 0; j < D; j++) v[j] = W.tok[id * D + j] + W.pos[t * D + j];
      return v;
    });
    var attention = [];
    W.blocks.forEach(function (B) {
      var qkv = x.map(function (v) { return linear(layerNorm(v, B.ln1), B.qkv, 3 * D); });
      var mixed = x.map(function () { return new Array(D).fill(0); });
      var lastRows = [];
      for (var h = 0; h < H; h++) {
        for (var t = 0; t < T; t++) {
          // scores: this token's query against every earlier token's key
          var sc = [], mx = -Infinity;
          for (var u = 0; u <= t; u++) {
            var s = 0;
            for (var j = 0; j < hd; j++) s += qkv[t][h * hd + j] * qkv[u][D + h * hd + j];
            s /= Math.sqrt(hd); sc.push(s); if (s > mx) mx = s;
          }
          var z = 0;
          for (u = 0; u <= t; u++) { sc[u] = Math.exp(sc[u] - mx); z += sc[u]; }
          for (u = 0; u <= t; u++) {
            sc[u] /= z;  // attention weight; the weights for one token add up to 1
            for (j = 0; j < hd; j++) mixed[t][h * hd + j] += sc[u] * qkv[u][2 * D + h * hd + j];
          }
          if (t === T - 1) lastRows.push(sc);
        }
      }
      attention.push(lastRows);
      x = x.map(function (v, t) {
        var a = linear(mixed[t], B.proj, D), y = v.map(function (vi, i) { return vi + a[i]; });
        var f = linear(linear(layerNorm(y, B.ln2), B.fc1, B.fc1[1].length).map(gelu), B.fc2, D);
        return y.map(function (yi, i) { return yi + f[i]; });
      });
    });
    var last = layerNorm(x[T - 1], W.ln), V = this.vocab.length, logits = new Array(V), mx = -Infinity;
    for (var w = 0; w < V; w++) {
      var s = 0;
      for (var j = 0; j < D; j++) s += last[j] * W.tok[w * D + j];
      logits[w] = s; if (s > mx) mx = s;
    }
    var p = Object.create(null), z = 0;
    for (w = 0; w < V; w++) { logits[w] = Math.exp(logits[w] - mx); z += logits[w]; }
    for (w = 0; w < V; w++) if (this.vocab[w] !== "<s>" && this.vocab[w] !== "<unk>") p[this.vocab[w]] = logits[w] / z;
    var tokens = ["<s>"].concat(words.slice(words.length - (T - 1)));
    return { p: p, attention: attention, tokens: tokens, unknown: enc.unknown };
  };

  global.Transformer = Transformer;
})(this);
