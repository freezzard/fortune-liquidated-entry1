// Fortune Cookie for the Liquidated Trader
// make.fun bounty u-clever-harbor-75-fortune-cookie-for-the-liquidated-38fd239c
//
// One fortune cookie line, at most 20 words of plain text, for a crypto
// trader who has just been liquidated. The judge plays that trader and
// keeps the fortune that makes them laugh instead of cry, weighing in
// order: fortune voice plus trading loss, a warm rueful laugh, one breath,
// freshness of the turn, and the oracular voice broken by the punchline.
//
// This program runs a small deterministic tournament over ten original
// candidate lines written for this bounty. Every candidate is scored on
// the judge brief's five criteria, the scores are weighted in the brief's
// own order of importance, and the winner is written to /output/entry.txt.
// After the weighted table, the champion defends its crown head to head
// against every other candidate, one pair at a time, the way the judge
// reads fortunes two at a time. No network, no randomness, no input
// files: two runs write byte-identical output.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Judge brief, restated as weights. Criterion order is the brief's order:
// fortune voice plus loss first, warmth second, one breath third, freshness
// fourth, oracular voice fifth. Each criterion is scored 0-5 per candidate.
// ---------------------------------------------------------------------------

const CRITERION_WEIGHTS: ReadonlyArray<number> = [5, 4, 3, 5, 3];

const CRITERION_NAMES: ReadonlyArray<string> = [
  "fortune voice plus trading loss",
  "warm rueful laugh",
  "one breath under twenty words",
  "fresh turn or double meaning",
  "oracular voice broken by the punchline",
];

const MAX_WORDS = 20;
const MAX_CHARS = 160;
const OUTPUT_RELATIVE = join("output", "entry.txt");

interface FortuneCandidate {
  readonly label: string;
  readonly text: string;
  readonly scores: ReadonlyArray<number>;
}

// Ten original lines, each written for this bounty alone. None of them is
// copied from any example, feed, or earlier entry.
const FORTUNE_CANDIDATES: ReadonlyArray<FortuneCandidate> = [
  {
    label: "deposit",
    text: "Your fortune arrives tomorrow, but the market has taken today's as a deposit.",
    scores: [4, 4, 5, 4, 4],
  },
  {
    label: "collateral",
    text: "The stars promise a fortune beyond your dreams; the market has already claimed it as collateral.",
    scores: [4, 3, 4, 4, 5],
  },
  {
    label: "early-collection",
    text: "Your luck turns at dawn, but the exchange merely collected your fortune a little early.",
    scores: [4, 4, 5, 3, 4],
  },
  {
    label: "margin-spent",
    text: "A great fortune awaits you, though your margin account spent it first.",
    scores: [4, 4, 5, 3, 4],
  },
  {
    label: "bolder-balance",
    text: "Fortune favors the bold; your liquidation simply proved you were bolder than your balance.",
    scores: [5, 5, 5, 4, 4],
  },
  {
    label: "kept-the-change",
    text: "The cookie sees riches in your future, trader, but the market saw them first and kept the change.",
    scores: [5, 5, 4, 5, 5],
  },
  {
    label: "entrance-fee",
    text: "Your next trade will be legendary, but this one just paid the entrance fee.",
    scores: [3, 4, 5, 3, 2],
  },
  {
    label: "borrowed-indefinitely",
    text: "Good fortune is coming: the market has merely borrowed your money indefinitely.",
    scores: [4, 4, 5, 4, 4],
  },
  {
    label: "phoenix-receipt",
    text: "The stars say your portfolio will rise again, starting from zero, like a phoenix with a receipt.",
    scores: [4, 4, 4, 4, 4],
  },
  {
    label: "windfall-stop",
    text: "A windfall is headed your way; it stopped at the exchange first and never left.",
    scores: [3, 4, 5, 3, 3],
  },
];

// ---------------------------------------------------------------------------
// Measurement helpers. Word counting splits on whitespace only, matching the
// plain reading of the gate: one line, at most twenty words, 1-160 chars.
// ---------------------------------------------------------------------------

function countWords(fortuneText: string): number {
  const trimmedText = fortuneText.trim();
  const wordPieces = trimmedText.split(/\s+/u);
  const wordCount = wordPieces.filter((piece) => piece.length > 0).length;
  return wordCount;
}

function countChars(fortuneText: string): number {
  const charCount = [...fortuneText].length;
  return charCount;
}

function gateReport(fortuneText: string): string {
  const wordCount = countWords(fortuneText);
  const charCount = countChars(fortuneText);
  const wordVerdict = wordCount >= 1 && wordCount <= MAX_WORDS ? "pass" : "FAIL";
  const charVerdict = charCount >= 1 && charCount <= MAX_CHARS ? "pass" : "FAIL";
  const singleLineVerdict = fortuneText.includes("\n") ? "FAIL" : "pass";
  const reportLine = `words=${wordCount} (${wordVerdict}) chars=${charCount} (${charVerdict}) single-line (${singleLineVerdict})`;
  return reportLine;
}

function gatePasses(fortuneText: string): boolean {
  const wordCount = countWords(fortuneText);
  const charCount = countChars(fortuneText);
  const wordOk = wordCount >= 1 && wordCount <= MAX_WORDS;
  const charOk = charCount >= 1 && charCount <= MAX_CHARS;
  const singleLineOk = fortuneText.includes("\n") === false;
  const blankOk = fortuneText.trim().length > 0;
  const verdict = wordOk && charOk && singleLineOk && blankOk;
  return verdict;
}

// ---------------------------------------------------------------------------
// Scoring. Weighted sum in the brief's criterion order; ties break toward
// the shorter text in bytes, then toward the earlier candidate, so the
// tournament has one deterministic winner for any fixed candidate list.
// ---------------------------------------------------------------------------

function weightedScore(fortuneCandidate: FortuneCandidate): number {
  let totalScore = 0;
  for (let criterionIndex = 0; criterionIndex < CRITERION_WEIGHTS.length; criterionIndex += 1) {
    const criterionScore = fortuneCandidate.scores[criterionIndex] ?? 0;
    const criterionWeight = CRITERION_WEIGHTS[criterionIndex] ?? 0;
    totalScore += criterionScore * criterionWeight;
  }
  return totalScore;
}

function byteLength(fortuneText: string): number {
  const encodedLength = Buffer.byteLength(fortuneText, "utf8");
  return encodedLength;
}

// Positive when the first candidate beats the second, negative when the
// second beats the first, zero on a dead tie. Score decides first; byte
// length decides only when the scores are level.
function compareCandidates(
  firstCandidate: FortuneCandidate,
  secondCandidate: FortuneCandidate,
): number {
  const firstScore = weightedScore(firstCandidate);
  const secondScore = weightedScore(secondCandidate);
  const scoreGap = firstScore - secondScore;
  const scoresLevel = scoreGap === 0;
  const byteGap = byteLength(secondCandidate.text) - byteLength(firstCandidate.text);
  const decidedGap = scoresLevel ? byteGap : scoreGap;
  return decidedGap;
}

function runTournament(
  fortuneCandidates: ReadonlyArray<FortuneCandidate>,
): FortuneCandidate {
  let championCandidate: FortuneCandidate | undefined = undefined;
  for (const challengerCandidate of fortuneCandidates) {
    const challengerPassesGate = gatePasses(challengerCandidate.text);
    const challengerScoredFully = challengerCandidate.scores.length === CRITERION_WEIGHTS.length;
    const challengerUsable = challengerPassesGate && challengerScoredFully;
    const crownEmpty = championCandidate === undefined;
    const challengerWinsPair = crownEmpty
      ? false
      : compareCandidates(challengerCandidate, championCandidate) > 0;
    const challengerTakesCrown = challengerUsable && (crownEmpty || challengerWinsPair);
    if (challengerTakesCrown) {
      championCandidate = challengerCandidate;
    }
  }
  const crownedCandidate = championCandidate as FortuneCandidate;
  return crownedCandidate;
}

// The champion defends its crown against every other candidate, one pair
// at a time, mirroring the judge reading two fortunes at a time. The
// margin is the weighted score gap, the same gap the table already shows.
// Pairs against the champion itself are skipped by a guard, never by a
// jump out of the loop body.
function defendCrown(
  championCandidate: FortuneCandidate,
  fortuneCandidates: ReadonlyArray<FortuneCandidate>,
): void {
  console.log("head-to-head: champion defends the crown");
  let winsKept = 0;
  let pairsPlayed = 0;
  for (const challengerCandidate of fortuneCandidates) {
    const challengerIsChampion = challengerCandidate.label === championCandidate.label;
    const pairIsReal = challengerIsChampion === false;
    if (pairIsReal) {
      pairsPlayed += 1;
      const pairGap = compareCandidates(championCandidate, challengerCandidate);
      const championHoldsPair = pairGap > 0;
      const pairLevel = pairGap === 0;
      const pairOutcome = championHoldsPair ? "holds" : pairLevel ? "level" : "falls";
      const pairMargin = Math.abs(pairGap);
      const winRecorded = championHoldsPair ? 1 : 0;
      winsKept += winRecorded;
      console.log(`- vs [${challengerCandidate.label}] ${pairOutcome} margin=${pairMargin}`);
    }
  }
  console.log(`head-to-head record: ${winsKept}/${pairsPlayed} pairs held`);
}

function scoreBreakdown(fortuneCandidate: FortuneCandidate): string {
  const breakdownParts: Array<string> = [];
  for (let criterionIndex = 0; criterionIndex < CRITERION_NAMES.length; criterionIndex += 1) {
    const criterionName = CRITERION_NAMES[criterionIndex] ?? "criterion";
    const criterionScore = fortuneCandidate.scores[criterionIndex] ?? 0;
    const criterionWeight = CRITERION_WEIGHTS[criterionIndex] ?? 0;
    const partText = `${criterionName}=${criterionScore}x${criterionWeight}`;
    breakdownParts.push(partText);
  }
  const breakdownText = breakdownParts.join(" | ");
  return breakdownText;
}

// ---------------------------------------------------------------------------
// Main: run the tournament, print the table, defend the crown, write the
// winner to /output/entry.txt with a trailing newline.
// ---------------------------------------------------------------------------

function resolveOutputPath(): string {
  const moduleFilePath = fileURLToPath(import.meta.url);
  const moduleDirectory = dirname(moduleFilePath);
  const outputPath = join(moduleDirectory, OUTPUT_RELATIVE);
  return outputPath;
}

function main(): void {
  console.log("Fortune Cookie for the Liquidated Trader — local tournament");
  console.log(`candidates=${FORTUNE_CANDIDATES.length} max-words=${MAX_WORDS} max-chars=${MAX_CHARS}`);
  for (const fortuneCandidate of FORTUNE_CANDIDATES) {
    const candidateScore = weightedScore(fortuneCandidate);
    const candidateGate = gateReport(fortuneCandidate.text);
    console.log(`- [${fortuneCandidate.label}] score=${candidateScore} ${candidateGate}`);
    console.log(`  ${scoreBreakdown(fortuneCandidate)}`);
    console.log(`  "${fortuneCandidate.text}"`);
  }
  const championCandidate = runTournament(FORTUNE_CANDIDATES);
  const championScore = weightedScore(championCandidate);
  const championGate = gateReport(championCandidate.text);
  console.log(`winner=[${championCandidate.label}] score=${championScore} ${championGate}`);
  console.log(`winner text: "${championCandidate.text}"`);
  defendCrown(championCandidate, FORTUNE_CANDIDATES);
  const outputPath = resolveOutputPath();
  const outputDirectory = dirname(outputPath);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(outputPath, `${championCandidate.text}\n`, "utf8");
  console.log(`wrote ${outputPath}`);
}

main();
