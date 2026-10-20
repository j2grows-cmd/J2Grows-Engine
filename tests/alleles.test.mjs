import test from "node:test";
import assert from "node:assert/strict";
import { createGenome, inheritGenome, mutateGenomeLocus, normalizeGenome, phenotypeFromGenome } from "../src/game/alleles.ts";
import { createSeededRandom } from "../src/game/random.ts";

test("genomes have four diploid loci and bounded integer alleles", () => {
  const genome = createGenome(createSeededRandom("genome-test"));
  assert.deepEqual(Object.keys(genome).sort(), ["growth", "hiddenPotential", "stability", "variegation"]);
  for (const locus of Object.values(genome)) {
    assert.ok(Number(locus.maternal) >= 0 && Number(locus.maternal) <= 10);
    assert.ok(Number(locus.paternal) >= 0 && Number(locus.paternal) <= 10);
  }
});

test("offspring inherit one allele from each parent at every locus reproducibly", () => {
  const a = { variegation:{maternal:"2",paternal:"4"}, stability:{maternal:"1",paternal:"3"}, growth:{maternal:"5",paternal:"6"}, hiddenPotential:{maternal:"0",paternal:"8"} };
  const b = { variegation:{maternal:"7",paternal:"9"}, stability:{maternal:"4",paternal:"8"}, growth:{maternal:"1",paternal:"2"}, hiddenPotential:{maternal:"3",paternal:"10"} };
  const childA = inheritGenome(a, b, createSeededRandom(42));
  const childB = inheritGenome(a, b, createSeededRandom(42));
  assert.deepEqual(childA, childB);
  for (const name of Object.keys(a)) {
    assert.ok([a[name].maternal,a[name].paternal].includes(childA[name].maternal));
    assert.ok([b[name].maternal,b[name].paternal].includes(childA[name].paternal));
  }
});

test("phenotype is derived separately and save normalization rejects malformed alleles", () => {
  const genome = { variegation:{maternal:"10",paternal:"8"}, stability:{maternal:"6",paternal:"6"}, growth:{maternal:"4",paternal:"2"}, hiddenPotential:{maternal:"1",paternal:"3"} };
  assert.deepEqual(phenotypeFromGenome(genome), { variegationPotential:90, stability:60, growthPotential:30, hiddenPotential:20 });
  assert.deepEqual(normalizeGenome(genome), genome);
  assert.equal(normalizeGenome({...genome, growth:{maternal:"999",paternal:"1"}}), undefined);
});

test("locus mutations stay in range and alter the derived phenotype reproducibly", () => {
  const genome = { variegation:{maternal:"0",paternal:"10"}, stability:{maternal:"5",paternal:"5"}, growth:{maternal:"3",paternal:"4"}, hiddenPotential:{maternal:"6",paternal:"6"} };
  const mutated = mutateGenomeLocus(genome, "variegation", () => 0);
  assert.notDeepEqual(mutated.variegation, genome.variegation);
  assert.ok(Number(mutated.variegation.maternal) >= 0 && Number(mutated.variegation.maternal) <= 10);
  assert.ok(Number(mutated.variegation.paternal) >= 0 && Number(mutated.variegation.paternal) <= 10);
  assert.notEqual(phenotypeFromGenome(mutated).variegationPotential, phenotypeFromGenome(genome).variegationPotential);
});