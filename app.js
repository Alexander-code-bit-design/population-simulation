const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");

const controls = {
  birthRate: document.getElementById("birthRate"),
  lifeExpectancy: document.getElementById("lifeExpectancy"),
  retirementAge: document.getElementById("retirementAge"),
};

const labels = {
  birthRate: document.getElementById("birthRateValue"),
  lifeExpectancy: document.getElementById("lifeExpectancyValue"),
  retirementAge: document.getElementById("retirementAgeValue"),
  retirementAxis: document.getElementById("retirementAxisLabel"),
  lifeAxis: document.getElementById("lifeAxisLabel"),
  growthRate: document.getElementById("growthRateMetric"),
  aging: document.getElementById("agingMetric"),
  population: document.getElementById("populationMetric"),
};

const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");

const YEAR_SECONDS = 0.22;
const MAX_VISIBLE_SPHERES = 1200;
const ROWS = 9;
const state = {
  people: [],
  birthCarry: 0,
  paused: false,
  lastTime: performance.now(),
  history: [],
};

function settings() {
  const lifeExpectancy = Number(controls.lifeExpectancy.value);
  const retirementAge = Math.min(Number(controls.retirementAge.value), lifeExpectancy - 1);
  return {
    birthRate: Number(controls.birthRate.value),
    lifeExpectancy,
    retirementAge,
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function addPerson(age = 0) {
  state.people.push({
    age,
    row: Math.floor(Math.random() * ROWS),
    offset: randomBetween(-0.34, 0.34),
    radius: randomBetween(4.2, 7.4),
    hueShift: randomBetween(-12, 12),
  });
}

function resetSimulation(seedPopulation = true) {
  state.people = [];
  state.birthCarry = 0;
  state.history = [];

  if (seedPopulation) {
    const { birthRate, lifeExpectancy } = settings();
    const target = Math.min(MAX_VISIBLE_SPHERES * 0.46, Math.round(birthRate * lifeExpectancy * YEAR_SECONDS * 2.4));
    for (let i = 0; i < target; i += 1) {
      addPerson(randomBetween(0, lifeExpectancy));
    }
  }
}

function updateLabels() {
  const { birthRate, lifeExpectancy, retirementAge } = settings();
  labels.birthRate.value = `${birthRate.toFixed(1)} births/sec`;
  labels.lifeExpectancy.value = `${lifeExpectancy} years`;
  labels.retirementAge.value = `${retirementAge} years`;
  labels.retirementAxis.textContent = `Retirement: ${retirementAge}`;
  labels.lifeAxis.textContent = `Life expectancy: ${lifeExpectancy}`;

  controls.retirementAge.max = String(Math.max(36, lifeExpectancy - 1));
  if (Number(controls.retirementAge.value) >= lifeExpectancy) {
    controls.retirementAge.value = String(lifeExpectancy - 1);
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawBackground(width, height, plot) {
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(plot.left, 0, plot.right, 0);
  gradient.addColorStop(0, "rgba(37, 99, 235, 0.10)");
  gradient.addColorStop(0.62, "rgba(22, 163, 74, 0.10)");
  gradient.addColorStop(1, "rgba(194, 65, 12, 0.13)");
  ctx.fillStyle = gradient;
  ctx.fillRect(plot.left, plot.top, plot.width, plot.height);

  ctx.strokeStyle = "#cfd8d3";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const x = plot.left + (plot.width * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
  }

  ctx.strokeStyle = "#16201d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.mid);
  ctx.lineTo(plot.right, plot.mid);
  ctx.stroke();
}

function drawMarkers(plot, lifeExpectancy, retirementAge) {
  const retirementX = plot.left + (retirementAge / lifeExpectancy) * plot.width;

  ctx.strokeStyle = "#c2410c";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(retirementX, plot.top);
  ctx.lineTo(retirementX, plot.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#c2410c";
  ctx.font = "600 13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Retirement", retirementX, plot.top - 12);
}

function drawPerson(person, plot, lifeExpectancy, retirementAge) {
  const progress = Math.min(1, person.age / lifeExpectancy);
  const x = plot.left + progress * plot.width;
  const bandHeight = plot.height / ROWS;
  const y = plot.top + bandHeight * (person.row + 0.5 + person.offset);
  const retired = person.age >= retirementAge;

  const color = retired
    ? `hsl(${18 + person.hueShift} 78% 50%)`
    : person.age > retirementAge * 0.72
      ? `hsl(${160 + person.hueShift} 68% 36%)`
      : `hsl(${218 + person.hueShift} 78% 55%)`;

  const sphere = ctx.createRadialGradient(x - person.radius * 0.35, y - person.radius * 0.45, 1, x, y, person.radius);
  sphere.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  sphere.addColorStop(0.28, color);
  sphere.addColorStop(1, "rgba(22, 32, 29, 0.45)");

  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(x, y, person.radius, 0, Math.PI * 2);
  ctx.fill();
}

function updateMetrics(now) {
  const { retirementAge } = settings();
  const total = state.people.length;
  const agingCount = state.people.filter((person) => person.age >= retirementAge).length;
  const agingRatio = total > 0 ? agingCount / total : 0;

  state.history.push({ time: now, total });
  state.history = state.history.filter((item) => now - item.time <= 5000);
  const oldest = state.history[0];
  const seconds = oldest ? Math.max(0.001, (now - oldest.time) / 1000) : 1;
  const growthPerSecond = oldest && oldest.total > 0
    ? ((total - oldest.total) / oldest.total / seconds) * 100
    : 0;

  labels.population.textContent = String(total);
  labels.aging.textContent = `${(agingRatio * 100).toFixed(1)}%`;
  labels.growthRate.textContent = `${growthPerSecond >= 0 ? "+" : ""}${growthPerSecond.toFixed(1)}% / sec`;
  labels.growthRate.style.color = growthPerSecond >= 0 ? "var(--green)" : "var(--accent-2)";
}

function step(deltaSeconds) {
  const { birthRate, lifeExpectancy } = settings();
  const yearsElapsed = deltaSeconds / YEAR_SECONDS;

  for (const person of state.people) {
    person.age += yearsElapsed;
  }

  state.people = state.people.filter((person) => person.age < lifeExpectancy);

  state.birthCarry += birthRate * deltaSeconds;
  let births = Math.floor(state.birthCarry);
  state.birthCarry -= births;

  while (births > 0 && state.people.length < MAX_VISIBLE_SPHERES) {
    addPerson();
    births -= 1;
  }
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const plot = {
    left: Math.max(34, width * 0.045),
    right: width - Math.max(34, width * 0.045),
    top: 62,
    bottom: height - 54,
  };
  plot.width = plot.right - plot.left;
  plot.height = plot.bottom - plot.top;
  plot.mid = plot.top + plot.height / 2;

  const { lifeExpectancy, retirementAge } = settings();
  drawBackground(width, height, plot);
  drawMarkers(plot, lifeExpectancy, retirementAge);

  for (const person of state.people) {
    drawPerson(person, plot, lifeExpectancy, retirementAge);
  }

  ctx.fillStyle = "#65736e";
  ctx.font = "13px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Births", plot.left, plot.bottom + 30);
  ctx.textAlign = "right";
  ctx.fillText("End of life", plot.right, plot.bottom + 30);
}

function animate(now) {
  const deltaSeconds = Math.min(0.06, (now - state.lastTime) / 1000);
  state.lastTime = now;

  if (!state.paused) {
    step(deltaSeconds);
  }

  updateLabels();
  updateMetrics(now);
  draw();
  requestAnimationFrame(animate);
}

for (const control of Object.values(controls)) {
  control.addEventListener("input", updateLabels);
}

pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-pressed", String(state.paused));
});

resetButton.addEventListener("click", () => resetSimulation(true));
window.addEventListener("resize", resizeCanvas);

updateLabels();
resizeCanvas();
resetSimulation(true);
requestAnimationFrame(animate);
