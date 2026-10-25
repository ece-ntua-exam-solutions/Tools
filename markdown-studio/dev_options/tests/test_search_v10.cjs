const assert = require("node:assert/strict"),
  S = require("../../search.js");
const idx = S.index([
  "Γραμμική Άλγεβρα",
  "Εισαγωγή στον Προγραμματισμό",
  "Ανάλυση Κυκλωμάτων",
  "Συστήματα Ηλεκτρικής Ενέργειας",
]);
assert.equal(S.norm("ΓΡΑΜΜΙΚΉ_Άλγεβρα"), S.norm("γραμμικη αλγεβρα"));
assert.equal(S.rank("γραμικη αλγερα", idx)[0].value, "Γραμμική Άλγεβρα");
assert.equal(S.rank("κυκλωματ", idx)[0].value, "Ανάλυση Κυκλωμάτων");
assert.equal(S.rank("grammiki", idx)[0].value, "Γραμμική Άλγεβρα");
assert.equal(
  S.rank("ενεργιας", idx)[0].value,
  "Συστήματα Ηλεκτρικής Ενέργειας",
);
assert.equal(S.rank("φυσικη", S.index(["Γραμμική Άλγεβρα"])).length, 0);
assert.equal(S.distance("abcdef", "abdcef"), 1);
console.log(
  "PASS: Greek normalization, spelling, prefix, Greeklish, scoped vocabulary, transposition",
);
