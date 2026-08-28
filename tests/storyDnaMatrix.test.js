import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STORY_DNA_FIELDS,
  buildStoryDnaFingerprint,
  compareStoryDnaRows,
  evaluateStoryDnaCandidate,
  normalizeStoryDnaMatrix,
  normalizeStoryDnaRow,
  chooseUnusedStoryDnaRow,
  validateMatrixDiversity,
} from '../src/storyDnaMatrix.js';

function makeRow(overrides = {}) {
  return {
    id: 'story-001',
    formulaId: 'formula-1',
    titlePromise: 'public accusation hides a family secret',
    hook: 'the daughter is ordered to apologize before she can speak',
    victim: 'an exhausted daughter',
    antagonist: 'a respected older brother',
    falseAccusation: 'missing inheritance money',
    location: 'a rainy family restaurant',
    evidence: 'a sealed envelope',
    secret: 'the family changed one date in the records',
    midpointTwist: 'the witness protected the wrong person',
    finalTwist: 'the victim was not the only target',
    villainConsequence: 'the antagonist loses public trust',
    ending: 'the protagonist establishes a new boundary',
    moralDilemma: 'should the truth be public if it breaks the family',
    ...overrides,
  };
}

function makeDistinctRow(id, token) {
  return makeRow({
    id,
    status: 'planned',
    titlePromise: `promise ${token}`,
    hook: `hook ${token}`,
    victim: `victim ${token}`,
    antagonist: `antagonist ${token}`,
    falseAccusation: `accusation ${token}`,
    location: `location ${token}`,
    evidence: `evidence ${token}`,
    secret: `secret ${token}`,
    midpointTwist: `midpoint ${token}`,
    finalTwist: `final ${token}`,
    villainConsequence: `consequence ${token}`,
    ending: `ending ${token}`,
    moralDilemma: `dilemma ${token}`,
  });
}

test('normalizes a Matrix row to the DNA fields and lifecycle metadata', () => {
  const row = normalizeStoryDnaRow({
    ...makeRow(),
    apiKey: 'remove',
    rawSourceText: 'remove',
  });

  assert.deepEqual(
    STORY_DNA_FIELDS.every(field => Object.hasOwn(row, field)),
    true,
  );
  assert.equal(row.status, 'planned');
  assert.equal(row.formulaId, 'formula-1');
  assert.equal(row.usedAt, null);
  assert.equal(row.storyId, null);
  assert.ok(row.noveltyFingerprint);
  assert.equal('apiKey' in row, false);
  assert.equal('rawSourceText' in row, false);
});

test('normalizes Matrix metadata and bounds rows', () => {
  const matrix = normalizeStoryDnaMatrix({
    id: 'matrix-1',
    formulaId: 'formula-1',
    targetCount: 40,
    rows: [makeRow(), makeRow({ id: 'story-002' })],
    secret: 'remove',
  });

  assert.equal(matrix.schema, 'story-maker-story-dna-matrix-v1');
  assert.equal(matrix.targetCount, 40);
  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.rows[1].id, 'story-002');
  assert.equal('secret' in matrix, false);
});

test('builds a stable fingerprint from normalized DNA fields', () => {
  const first = buildStoryDnaFingerprint(makeRow());
  const second = buildStoryDnaFingerprint(makeRow({
    titlePromise: 'PUBLIC ACCUSATION HIDES A FAMILY SECRET',
  }));
  assert.equal(first, second);
  assert.match(first, /^fnv1a-/);
});

test('rejects a hard duplicate when hook, evidence, and midpoint twist match', () => {
  const result = compareStoryDnaRows(
    makeRow({ id: 'candidate' }),
    makeRow({ id: 'existing' }),
  );
  assert.equal(result.hardDuplicate, true);
  assert.equal(result.decision, 'reject');
  assert.ok(result.overlappingFields.includes('hook'));
  assert.ok(result.overlappingFields.includes('evidence'));
  assert.ok(result.overlappingFields.includes('midpointTwist'));
});

test('returns weighted overlap fields and a warning score', () => {
  const result = compareStoryDnaRows(
    makeRow({
      id: 'candidate',
      antagonist: 'a respected older brother',
      hook: 'the daughter is ordered to apologize before she can speak',
      midpointTwist: 'the witness protected the wrong person',
      falseAccusation: 'a forged medical bill',
      location: 'a winter mountain clinic',
      evidence: 'a missing audio recording',
      secret: 'the clinic changed a patient ledger',
      ending: 'the daughter opens a new clinic office',
      villainConsequence: 'the brother loses control of the family account',
      finalTwist: 'the quiet witness was another victim',
    }),
    makeRow({ id: 'existing' }),
  );
  assert.equal(result.hardDuplicate, false);
  assert.equal(result.decision, 'warning');
  assert.ok(result.score >= 0.35 && result.score <= 0.55);
  assert.ok(result.overlappingFields.length >= 2);
});

test('evaluates a candidate against all existing rows and selects the closest match', () => {
  const rows = [
    makeRow({
      id: 'used-1',
      status: 'used',
      hook: 'a landlord accuses a tenant in a crowded hallway',
      victim: 'a retired tenant',
      antagonist: 'a landlord',
      falseAccusation: 'a forged repair invoice',
      location: 'an old apartment hallway',
      evidence: 'a broken security camera',
      secret: 'the landlord hid a second contract',
      midpointTwist: 'the neighbor changed the timestamp',
      finalTwist: 'the tenant had protected another resident',
      villainConsequence: 'the landlord loses the building contract',
      ending: 'the tenant moves into a cooperative home',
      moralDilemma: 'should the tenant expose every neighbor who stayed silent',
    }),
    makeRow({
      id: 'planned-2',
      hook: 'a teacher is forced to apologize in front of the neighborhood',
      victim: 'a substitute teacher',
      antagonist: 'a school administrator',
      falseAccusation: 'a stolen scholarship',
      location: 'a public school gym',
      evidence: 'a missing audio recording',
      secret: 'the administrator moved a student file',
      midpointTwist: 'the ally erased the wrong message',
      finalTwist: 'the scholarship winner was coerced',
      villainConsequence: 'the administrator loses a public appointment',
      ending: 'the teacher starts a community class',
      moralDilemma: 'should the teacher reveal the student who helped erase the file',
    }),
  ];
  const candidate = makeRow({
    id: 'candidate',
    hook: 'a nurse is blamed during a public family meeting',
    evidence: 'a damaged receipt',
    midpointTwist: 'the quiet witness kept a second ledger',
    location: 'a public school gym',
    ending: 'the teacher starts a community class',
  });
  const evaluation = evaluateStoryDnaCandidate(candidate, rows);
  assert.equal(evaluation.decision, 'safe');
  assert.equal(evaluation.closestRowId, 'planned-2');
  assert.ok(Array.isArray(evaluation.comparisons));
});

test('chooses only unused planned rows from novelty-safe candidates', () => {
  const rows = [
    makeRow({
      id: 'used',
      status: 'used',
      hook: 'a landlord accuses a tenant in a crowded hallway',
      victim: 'a retired tenant',
      antagonist: 'a landlord',
      falseAccusation: 'a forged repair invoice',
      location: 'an old apartment hallway',
      evidence: 'a broken security camera',
      secret: 'the landlord hid a second contract',
      midpointTwist: 'the neighbor changed the timestamp',
      finalTwist: 'the tenant had protected another resident',
      villainConsequence: 'the landlord loses the building contract',
      ending: 'the tenant moves into a cooperative home',
      moralDilemma: 'should the tenant expose every neighbor who stayed silent',
    }),
    makeRow({
      id: 'warning',
      status: 'planned',
      hook: 'a nurse is blamed during a public family meeting',
      victim: 'a nurse',
      antagonist: 'a hospital director',
      falseAccusation: 'a forged medical bill',
      location: 'a winter mountain clinic',
      evidence: 'a missing audio recording',
      secret: 'the director changed a patient ledger',
      midpointTwist: 'the quiet witness kept a second ledger',
      finalTwist: 'the quiet witness was another victim',
      villainConsequence: 'the director loses a license',
      ending: 'the nurse opens a patient advocacy office',
      moralDilemma: 'should the nurse reveal the witness who lied',
    }),
    makeRow({
      id: 'safe',
      status: 'planned',
      hook: 'a baker is blamed during a town festival',
      victim: 'a baker',
      antagonist: 'a festival organizer',
      falseAccusation: 'a stolen donation box',
      location: 'a summer harbor market',
      evidence: 'a train station camera file',
      secret: 'the organizer hid a second receipt book',
      midpointTwist: 'the antagonist confessed to protect a stranger',
      finalTwist: 'the missing donor had chosen to disappear',
      villainConsequence: 'the organizer must return the donations',
      ending: 'the baker rebuilds the market stall',
      moralDilemma: 'should the baker protect the donor from public attention',
    }),
  ];
  const selected = chooseUnusedStoryDnaRow(rows, { random: () => 0.99 });
  assert.equal(selected.row.id, 'safe');
  assert.equal(selected.evaluation.decision, 'safe');
});

test('randomly chooses eligible planned rows and can reach more than the first row', () => {
  const rows = [
    makeDistinctRow('story-a', 'alpha'),
    makeDistinctRow('story-b', 'bravo'),
  ];
  assert.equal(chooseUnusedStoryDnaRow(rows, { random: () => 0 }).row.id, 'story-a');
  assert.equal(chooseUnusedStoryDnaRow(rows, { random: () => 0.99 }).row.id, 'story-b');
});

test('avoids the immediately previous row when another eligible row exists', () => {
  const rows = [
    makeDistinctRow('story-a', 'alpha'),
    makeDistinctRow('story-b', 'bravo'),
  ];
  const selected = chooseUnusedStoryDnaRow(rows, {
    excludeRowId: 'story-a',
    random: () => 0,
  });
  assert.equal(selected.row.id, 'story-b');
});

test('keeps the only eligible row even when it matches the previous row', () => {
  const rows = [makeDistinctRow('story-only', 'solo')];
  const selected = chooseUnusedStoryDnaRow(rows, {
    excludeRowId: 'story-only',
    random: () => 0,
  });
  assert.equal(selected.row.id, 'story-only');
});

test('reports Matrix diversity gaps and adjacent evidence-twist repetition', () => {
  const rows = Array.from({ length: 6 }, (_, index) => makeRow({
    id: `story-${index + 1}`,
    location: index < 5 ? 'same location' : 'different location',
    evidence: index < 5 ? 'same evidence' : 'different evidence',
    antagonist: index < 5 ? 'same antagonist' : 'different antagonist',
    midpointTwist: index < 5 ? 'same midpoint' : 'different midpoint',
  }));
  const report = validateMatrixDiversity(rows, { targetCount: 30 });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => /location|evidence|antagonist|twist/i.test(issue)));
});
