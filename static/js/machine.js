const SYMBOLS = ["7", "BAR", "◆", "♣", "♦"];
const RECORD_KEY = "machine-player-record";

const PHASES = {
  day: {
    title: "낮 — Alpha 10판 (목표 80%), Beta 100판 (목표 70%)",
    advanceLabel: "밤으로 전환",
    nextPath: "/machine/night",
    caption: "해가 지고, 카지노 불이 켜집니다.",
    alpha: { rounds: 10, target: 0.8 },
    beta: { rounds: 100, target: 0.7 },
  },
  night: {
    title: "밤 — Alpha 100판 (목표 30%), Beta 10판 (목표 20%)",
    advanceLabel: "낮으로 전환",
    nextPath: "/machine/day",
    caption: "밤이 걷히고, 아침 빛이 들어옵니다.",
    alpha: { rounds: 100, target: 0.3 },
    beta: { rounds: 10, target: 0.2 },
  },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function buildReelStrip(stripEl, length = 24) {
  stripEl.innerHTML = "";
  for (let i = 0; i < length; i++) {
    const cell = document.createElement("div");
    cell.className = "reel-symbol";
    cell.textContent = randomSymbol();
    stripEl.appendChild(cell);
  }
}

function setReelSymbols(reels, symbols, win) {
  reels.forEach((reel, i) => {
    const strip = reel.querySelector(".reel-strip");
    const cells = strip.querySelectorAll(".reel-symbol");
    const mid = cells[Math.floor(cells.length / 2)];
    if (mid) {
      mid.textContent = symbols[i];
      mid.classList.toggle("reel-symbol--win", win);
    }
    strip.style.transform = "translateY(0)";
  });
}

async function spinReels(reels, win, durationMs = 420) {
  const target = win
    ? [SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]]
    : [randomSymbol(), randomSymbol(), randomSymbol()];
  if (!win) {
    while (target[0] === target[1] && target[1] === target[2]) {
      target[2] = randomSymbol();
    }
  }

  reels.forEach((reel) => {
    const strip = reel.querySelector(".reel-strip");
    strip.querySelectorAll(".reel-symbol").forEach((c) => c.classList.remove("reel-symbol--win"));
    buildReelStrip(strip, 20);
    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";
  });

  await sleep(16);
  reels.forEach((reel, idx) => {
    const strip = reel.querySelector(".reel-strip");
    const offset = 4.5 * (8 + idx * 2);
    strip.style.transition = `transform ${durationMs}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
    strip.style.transform = `translateY(-${offset}rem)`;
  });

  await sleep(durationMs + 40);
  setReelSymbols(reels, target, win);
}

function simulateOutcomes(rounds, winProb) {
  const outcomes = [];
  let wins = 0;
  for (let i = 0; i < rounds; i++) {
    const win = Math.random() < winProb;
    if (win) wins++;
    outcomes.push(win);
  }
  return { outcomes, wins, rounds };
}

function formatPct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function getPlayerRecord() {
  try {
    const stored = window.localStorage.getItem(RECORD_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed && typeof parsed.wins === "number") return parsed;
  } catch {
    /* ignore */
  }
  return { wins: 0, rounds: 0, alphaWins: 0, betaWins: 0 };
}

function savePlayerRecord(record) {
  window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
}

function pullLever(lever) {
  lever.classList.remove("is-pulling");
  void lever.offsetWidth;
  lever.classList.add("is-pulling");
}

function init() {
  const root = document.getElementById("machine-root");
  if (!root) return;

  const phase = root.dataset.phase === "night" ? "night" : "day";
  const cfg = PHASES[phase];

  const desc = document.getElementById("phase-desc");
  const alphaMeta = document.getElementById("alpha-meta");
  const betaMeta = document.getElementById("beta-meta");
  const alphaResult = document.getElementById("alpha-result");
  const betaResult = document.getElementById("beta-result");
  const progressWrap = document.getElementById("progress-wrap");
  const progressLabel = document.getElementById("progress-label");
  const progressBar = document.getElementById("progress-bar");
  const timeAdvance = document.getElementById("time-advance");
  const transition = document.getElementById("time-transition");
  const caption = document.getElementById("transition-caption");
  const playerTotalWins = document.getElementById("player-total-wins");
  const playerTotalDetail = document.getElementById("player-total-detail");
  const playerLive = document.getElementById("player-live");
  const levers = document.querySelectorAll(".slot-lever");

  desc.textContent = cfg.title;
  alphaMeta.textContent = `${cfg.alpha.rounds}판 · 목표 승률 ${formatPct(cfg.alpha.target)}`;
  betaMeta.textContent = `${cfg.beta.rounds}판 · 목표 승률 ${formatPct(cfg.beta.target)}`;
  timeAdvance.textContent = cfg.advanceLabel;
  caption.textContent = cfg.caption;

  const renderScoreboard = (liveWins = 0, liveRounds = 0) => {
    const record = getPlayerRecord();
    playerTotalWins.textContent = String(record.wins);
    playerTotalDetail.textContent = record.rounds
      ? `전체 ${record.rounds}판 · Alpha ${record.alphaWins}승 · Beta ${record.betaWins}승 · 승률 ${formatPct(record.wins / record.rounds)}`
      : "아직 플레이 기록이 없습니다.";
    playerLive.textContent = `이번 플레이: ${liveWins}승 / ${liveRounds}판`;
  };

  renderScoreboard();

  document.querySelectorAll(".slot-machine").forEach((machine) => {
    const reels = [...machine.querySelectorAll(".reel")];
    reels.forEach((reel) => buildReelStrip(reel.querySelector(".reel-strip")));
  });

  let busy = false;
  let ranAlpha = false;
  let ranBeta = false;

  const setLeversDisabled = (disabled) => {
    levers.forEach((lever) => {
      lever.disabled = disabled;
    });
  };

  const updateAdvance = () => {
    timeAdvance.disabled = busy || !(ranAlpha || ranBeta);
  };

  async function runMachine(key, lever) {
    if (busy) return;
    const spec = cfg[key];
    const machine = document.querySelector(`.slot-machine[data-key="${key}"]`);
    const resultEl = key === "alpha" ? alphaResult : betaResult;
    const reels = [...machine.querySelectorAll(".reel")];

    busy = true;
    machine.classList.add("is-running");
    pullLever(lever);
    setLeversDisabled(true);
    timeAdvance.disabled = true;

    progressWrap.hidden = false;
    progressBar.style.width = "0%";

    const { outcomes, wins, rounds } = simulateOutcomes(spec.rounds, spec.target);
    const spinMs = rounds <= 10 ? 380 : 120;
    const batchPause = rounds <= 10 ? 180 : 28;
    let liveWins = 0;

    for (let i = 0; i < rounds; i++) {
      const won = outcomes[i];
      if (won) liveWins += 1;
      progressLabel.textContent = `${i + 1} / ${rounds}판 · 이번 승리 ${liveWins}회`;
      progressBar.style.width = `${((i + 1) / rounds) * 100}%`;
      resultEl.textContent = won ? `${i + 1}판 승리` : `${i + 1}판 패배`;
      renderScoreboard(liveWins, i + 1);
      await spinReels(reels, won, spinMs);
      await sleep(batchPause);
    }

    const rate = wins / rounds;
    resultEl.innerHTML = `<strong>완료</strong> — 플레이어 ${wins}승 ${rounds - wins}패 (${formatPct(rate)})<br />목표 ${formatPct(spec.target)}`;

    const record = getPlayerRecord();
    savePlayerRecord({
      wins: record.wins + wins,
      rounds: record.rounds + rounds,
      alphaWins: record.alphaWins + (key === "alpha" ? wins : 0),
      betaWins: record.betaWins + (key === "beta" ? wins : 0),
    });
    renderScoreboard(wins, rounds);

    if (key === "alpha") ranAlpha = true;
    else ranBeta = true;

    busy = false;
    machine.classList.remove("is-running");
    setLeversDisabled(false);
    updateAdvance();
  }

  levers.forEach((lever) => {
    lever.addEventListener("click", () => runMachine(lever.dataset.key, lever));
  });

  timeAdvance.addEventListener("click", async () => {
    if (busy || !(ranAlpha || ranBeta)) return;
    busy = true;
    timeAdvance.disabled = true;
    setLeversDisabled(true);

    transition.hidden = false;
    transition.classList.remove("is-night-to-day", "is-day-to-night");
    transition.classList.add("is-active", phase === "day" ? "is-day-to-night" : "is-night-to-day");
    await sleep(3400);
    window.location.href = cfg.nextPath;
  });

  updateAdvance();
}

init();
