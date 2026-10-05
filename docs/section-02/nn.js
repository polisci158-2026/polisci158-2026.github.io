/* POLISCI 158 · Section 2 lab — a tiny neural network, written to be read.
   Fully connected layers, tanh "bend" in the hidden layers, sigmoid output (a probability),
   cross-entropy error, trained by gradient descent (the Adam variant). No libraries.
   Also: seeded random numbers, so everyone in section gets the same data. */
var NN = (function () {
  "use strict";

  /* ---------- Seeded random numbers (mulberry32) ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

  /* ---------- The network ----------
     sizes = [inputs, hidden1, hidden2, ..., 1]. W[l][j][i] is the weight from neuron i in
     layer l to neuron j in layer l+1. These weights (and the biases b) are what it learns. */
  function Net(sizes, seed) {
    var r = rng(seed);
    this.sizes = sizes;
    this.W = []; this.b = [];
    this.mW = []; this.vW = []; this.mb = []; this.vb = []; // Adam's running averages
    this.t = 0;
    for (var l = 0; l < sizes.length - 1; l++) {
      var nIn = sizes[l], nOut = sizes[l + 1], scale = Math.sqrt(1 / nIn);
      var W = [], z1 = [], z2 = [];
      for (var j = 0; j < nOut; j++) {
        var row = [];
        for (var i = 0; i < nIn; i++) row.push(gauss(r) * scale);
        W.push(row); z1.push(zeros(nIn)); z2.push(zeros(nIn));
      }
      this.W.push(W); this.mW.push(z1); this.vW.push(z2);
      this.b.push(zeros(nOut)); this.mb.push(zeros(nOut)); this.vb.push(zeros(nOut));
    }
  }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }

  /* Forward pass: weighted sum, then the bend, layer by layer. Returns every layer's output. */
  Net.prototype.forward = function (x) {
    var acts = [x], L = this.W.length;
    for (var l = 0; l < L; l++) {
      var W = this.W[l], b = this.b[l], prev = acts[l], out = [];
      for (var j = 0; j < W.length; j++) {
        var z = b[j], row = W[j];
        for (var i = 0; i < row.length; i++) z += row[i] * prev[i];
        out.push(l === L - 1 ? sigmoid(z) : Math.tanh(z));
      }
      acts.push(out);
    }
    return acts;
  };
  Net.prototype.predict = function (x) { var a = this.forward(x); return a[a.length - 1][0]; };

  /* Average cross-entropy error: small when the network is confident and right. */
  Net.prototype.loss = function (X, y) {
    var s = 0;
    for (var n = 0; n < X.length; n++) {
      var p = Math.min(1 - 1e-7, Math.max(1e-7, this.predict(X[n])));
      s += y[n] ? -Math.log(p) : -Math.log(1 - p);
    }
    return s / X.length;
  };
  Net.prototype.accuracy = function (X, y) {
    var c = 0;
    for (var n = 0; n < X.length; n++) if ((this.predict(X[n]) >= 0.5) === !!y[n]) c++;
    return c / X.length;
  };

  /* One epoch = one gradient step on all training examples:
     measure the error, work out which way each weight should move (backpropagation),
     and move every weight a little. */
  Net.prototype.step = function (X, y, lr) {
    var L = this.W.length, gW = [], gb = [], l, j, i, n;
    for (l = 0; l < L; l++) {
      gb.push(zeros(this.b[l].length));
      gW.push(this.W[l].map(function (row) { return zeros(row.length); }));
    }
    for (n = 0; n < X.length; n++) {
      var acts = this.forward(X[n]);
      var delta = [acts[L][0] - y[n]]; // sigmoid + cross-entropy: error signal is just p − y
      for (l = L - 1; l >= 0; l--) {
        var prev = acts[l], W = this.W[l];
        for (j = 0; j < delta.length; j++) {
          gb[l][j] += delta[j];
          for (i = 0; i < prev.length; i++) gW[l][j][i] += delta[j] * prev[i];
        }
        if (l > 0) { // pass the error back through the tanh bend
          var back = zeros(prev.length);
          for (i = 0; i < prev.length; i++) {
            var s = 0;
            for (j = 0; j < delta.length; j++) s += W[j][i] * delta[j];
            back[i] = s * (1 - prev[i] * prev[i]);
          }
          delta = back;
        }
      }
    }
    // Adam: gradient descent with momentum and a per-weight step size
    this.t++;
    var b1 = 0.9, b2 = 0.999, eps = 1e-8, N = X.length;
    var c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
    function upd(p, g, m, v, k) {
      var gk = g[k] / N;
      m[k] = b1 * m[k] + (1 - b1) * gk;
      v[k] = b2 * v[k] + (1 - b2) * gk * gk;
      p[k] -= lr * (m[k] / c1) / (Math.sqrt(v[k] / c2) + eps);
    }
    for (l = 0; l < L; l++) {
      for (j = 0; j < this.W[l].length; j++) {
        for (i = 0; i < this.W[l][j].length; i++) upd(this.W[l][j], gW[l][j], this.mW[l][j], this.vW[l][j], i);
        upd(this.b[l], gb[l], this.mb[l], this.vb[l], j);
      }
    }
  };

  return { Net: Net, rng: rng, gauss: gauss, sigmoid: sigmoid };
})();
