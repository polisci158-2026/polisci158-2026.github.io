/* POLISCI 158 · Section 2 lab — the two simulated datasets.
   Both are made up by this code, from fixed seeds, so every student sees the same points.
   Nothing here is real data about real bills or real people. */
var DATA = (function () {
  "use strict";
  var rng = NN.rng, gauss = NN.gauss, sigmoid = NN.sigmoid;

  /* ---------- Part 1: will a bill get out of committee? ----------
     x1: the sponsor's ideology, left (−1) to right (+1) of the chamber's median member
     x2: share of cosponsors from the majority party (0 to 1)
     The hidden rule: moderate sponsors need less majority support; sponsors far from the
     median need a lot. The boundary is a curve, not a straight line. Labels are noisy:
     bills near the curve can go either way. */
  var BILL_K = 14;
  function billTruth(x1, x2) { return sigmoid(BILL_K * (x2 - (0.22 + 0.62 * x1 * x1))); }
  function bills(n, seed, miscoded) {
    var r = rng(seed), X = [], y = [];
    for (var k = 0; k < n; k++) {
      var x1 = 2 * r() - 1, x2 = r();
      var passed = r() < billTruth(x1, x2) ? 1 : 0;
      if (r() < (miscoded || 0)) passed = 1 - passed; // a coding error in the dataset
      X.push([x1, 2 * x2 - 1]); // the network sees x2 rescaled to −1…1
      y.push(passed);
    }
    return { X: X, y: y };
  }

  /* ---------- Part 2: which benefit claims get flagged for a fraud check? ----------
     A fictional benefits agency, modeled loosely on the Dutch childcare-benefits case.
     Each claim has:
       irregular  income irregularity, 0 to 1 (jumps in reported income)
       priors     number of earlier corrections to the claim (0 to 4)
       area       share of non-citizens in the claimant's postcode (0 to 1)
       noncit     1 if the claimant is not a citizen
     The TRUTH: whether a claim is fraudulent depends only on irregular and priors,
     the same way for everyone.
     The RECORDS the model learns from: past investigators checked non-citizens' claims
     far more often (90% vs. 40%), so their fraud was found more often, and a few honest
     non-citizen claims were wrongly recorded as fraud. */
  function claims(n, seed) {
    var r = rng(seed), rows = [];
    for (var k = 0; k < n; k++) {
      var noncit = r() < 0.3 ? 1 : 0;
      var area = Math.min(1, Math.max(0, (noncit ? 0.55 : 0.25) + 0.15 * gauss(r)));
      var irregular = Math.min(1, Math.max(0, 0.35 + 0.22 * gauss(r)));
      var priors = Math.min(4, Math.floor(-Math.log(1 - r()) * 0.8));
      var fraud = r() < sigmoid(-4.2 + 4.5 * irregular + 0.7 * priors) ? 1 : 0;
      var checked = r() < (noncit ? 0.9 : 0.4);
      var falseRecord = !fraud && r() < (noncit ? 0.04 : 0.01);
      var recorded = (fraud && checked) || falseRecord ? 1 : 0;
      rows.push({ irregular: irregular, priors: priors, area: area, noncit: noncit, fraud: fraud, recorded: recorded });
    }
    return rows;
  }
  /* Turn a claim into the numbers the network sees (each scaled to roughly −1…1). */
  function claimInputs(row, use) {
    var x = [2 * row.irregular - 1, row.priors / 2 - 1];
    if (use.area) x.push(2 * row.area - 1);
    if (use.noncit) x.push(2 * row.noncit - 1);
    return x;
  }

  return {
    billTruth: billTruth,
    bills: bills,
    billsLarge: bills(200, 11),
    billsSmall: bills(25, 16, 0.15),
    billsTest: bills(1000, 13),
    claimsTrain: claims(2000, 21),
    claimsTest: claims(2000, 22),
    claimInputs: claimInputs
  };
})();
