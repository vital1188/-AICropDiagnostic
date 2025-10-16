const FEATURE_BOUNDS = {
  canopyTemperature: [15, 45],
  leafMoisture: [20, 95],
  soilMoisture: [5, 60],
  lesionArea: [0, 80],
  chlorophyll: [20, 60],
  diseasePressure: [0, 100],
  nutrientBalance: [0, 100],
  growthRate: [0, 100]
};

const DISEASE_PROFILES = [
  {
    name: 'Healthy',
    intercept: -0.6,
    weights: {
      canopyTemperature: -0.35,
      leafMoisture: 0.32,
      soilMoisture: 0.28,
      lesionArea: -0.5,
      chlorophyll: 0.44,
      diseasePressure: -0.25,
      nutrientBalance: 0.5,
      growthRate: 0.38
    },
    recommendations: [
      'Maintain irrigation cadence and scout weekly to confirm stability.',
      'Keep balanced nutrient applications to sustain vigor.',
      'Log this reading as a healthy baseline for comparison.'
    ]
  },
  {
    name: 'Leaf Blight',
    intercept: -0.1,
    weights: {
      canopyTemperature: 0.45,
      leafMoisture: -0.4,
      soilMoisture: -0.32,
      lesionArea: 0.82,
      chlorophyll: -0.35,
      diseasePressure: 0.36,
      nutrientBalance: -0.28,
      growthRate: -0.44
    },
    recommendations: [
      'Tighten scouting frequency and plan a targeted fungicide rotation.',
      'Improve airflow through canopy via selective pruning.',
      'Avoid overhead irrigation during evening hours.'
    ]
  },
  {
    name: 'Powdery Mildew',
    intercept: -0.2,
    weights: {
      canopyTemperature: 0.26,
      leafMoisture: -0.55,
      soilMoisture: -0.24,
      lesionArea: 0.52,
      chlorophyll: -0.28,
      diseasePressure: 0.48,
      nutrientBalance: -0.12,
      growthRate: -0.26
    },
    recommendations: [
      'Introduce a sulfur or potassium bicarbonate spray at dusk.',
      'Reduce humidity spikes by adjusting irrigation windows.',
      'Trim overcrowded leaves to encourage airflow.'
    ]
  },
  {
    name: 'Nutrient Deficiency',
    intercept: -0.35,
    weights: {
      canopyTemperature: 0.18,
      leafMoisture: 0.22,
      soilMoisture: 0.18,
      lesionArea: 0.24,
      chlorophyll: -0.68,
      diseasePressure: 0.1,
      nutrientBalance: -0.74,
      growthRate: -0.42
    },
    recommendations: [
      'Deploy foliar feeding with micronutrient blends.',
      'Soil test to confirm macro nutrient balance before next fertigation.',
      'Integrate organic matter to stabilize nutrient cycling.'
    ]
  }
];

const TEXT_SIGNATURES = {
  'leaf blight': {
    weight: 1.0,
    keywords: {
      lesion: 1.6,
      lesions: 1.6,
      streak: 1.5,
      streaks: 1.5,
      necrotic: 1.4,
      halo: 1.2,
      halos: 1.2,
      water: 0.4,
      soaked: 0.6,
      expanding: 0.6,
      wet: 0.5
    }
  },
  'powdery mildew': {
    weight: 1.0,
    keywords: {
      powder: 1.8,
      powdery: 2.1,
      fuzzy: 1.4,
      dust: 1.2,
      spores: 1.0,
      white: 0.8,
      coating: 1.1,
      grey: 0.7,
      mildew: 2.0
    }
  },
  'nutrient deficiency': {
    weight: 1.0,
    keywords: {
      yellow: 1.4,
      yellowing: 1.6,
      chlorosis: 2.0,
      pale: 1.2,
      stunted: 1.5,
      purple: 1.0,
      margin: 0.8,
      uniform: 0.6,
      deficiency: 1.8
    }
  },
  healthy: {
    weight: 0.9,
    keywords: {
      vigorous: 1.0,
      strong: 0.8,
      glossy: 0.9,
      consistent: 0.7,
      healthy: 1.6,
      vibrant: 1.2,
      intact: 0.8
    }
  }
};

const state = {
  imageInsights: null
};

const rangeOutputs = document.querySelectorAll('input[type="range"]');
rangeOutputs.forEach((input) => {
  const output = document.querySelector(`output[data-for="${input.id}"]`);
  if (!output) return;
  const update = () => {
    const unit = input.id.toLowerCase().includes('temperature')
      ? '°C'
      : input.id.toLowerCase().includes('moisture')
      ? '%'
      : input.id.toLowerCase().includes('lesion')
      ? '%'
      : '';
    output.textContent = `${input.value}${unit ? ` ${unit}` : ''}`.trim();
  };
  input.addEventListener('input', update);
  update();
});

function normalizeValue(key, value) {
  const [min, max] = FEATURE_BOUNDS[key];
  return (value - min) / (max - min);
}

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function softmax(scores) {
  const expScores = scores.map((score) => Math.exp(score - Math.max(...scores)));
  const total = expScores.reduce((acc, val) => acc + val, 0);
  return expScores.map((val) => val / total);
}

function computeDrivers(weights, features) {
  const contributions = Object.entries(weights).map(([feature, weight]) => ({
    feature,
    weight,
    contribution: weight * features[feature]
  }));
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return contributions.slice(0, 3).map((item) => {
    const descriptors = {
      canopyTemperature: 'Canopy heat load',
      leafMoisture: 'Leaf moisture',
      soilMoisture: 'Soil moisture',
      lesionArea: 'Lesion coverage',
      chlorophyll: 'Chlorophyll index',
      diseasePressure: 'Regional pressure',
      nutrientBalance: 'Nutrient balance',
      growthRate: 'Growth momentum'
    };
    const direction = item.contribution > 0 ? '↑' : '↓';
    return `${descriptors[item.feature]} ${direction}`;
  });
}

function gatherFieldFeatures() {
  const result = {};
  Object.keys(FEATURE_BOUNDS).forEach((key) => {
    const input = document.getElementById(key === 'chlorophyll' ? 'chlorophyll' : key);
    if (!input) return;
    result[key] = Number.parseFloat(input.value);
  });
  return result;
}

function runFieldAnalysis() {
  const raw = gatherFieldFeatures();
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, normalizeValue(key, value)])
  );

  const stabilityMode = document.getElementById('stabilityMode')?.checked ?? false;

  const imageBoost = state.imageInsights
    ? {
        lesionArea: state.imageInsights.lesionContrast * 0.18,
        chlorophyll: state.imageInsights.greenVitality * 0.12,
        canopyTemperature: (1 - state.imageInsights.drynessScore) * -0.06
      }
    : {};

  const scores = DISEASE_PROFILES.map((profile) => {
    const adjustments = Object.entries(profile.weights).reduce((acc, [feature, weight]) => {
      const featureValue = normalized[feature] ?? 0;
      const boost = imageBoost[feature] ?? 0;
      return acc + weight * (featureValue + boost);
    }, profile.intercept);
    const guard = stabilityMode ? Math.min(0, adjustments) * 0.35 : 0;
    return adjustments + guard;
  });

  const probabilities = softmax(scores);
  const bestIndex = probabilities.indexOf(Math.max(...probabilities));
  const bestProfile = DISEASE_PROFILES[bestIndex];
  const bestProbability = probabilities[bestIndex];

  const yieldScore = (() => {
    const weights = {
      canopyTemperature: 0.32,
      leafMoisture: -0.24,
      soilMoisture: -0.22,
      lesionArea: 0.45,
      diseasePressure: 0.36,
      nutrientBalance: -0.28,
      growthRate: -0.34
    };
    const base = 0.35;
    const rawScore = Object.entries(weights).reduce((acc, [feature, weight]) => {
      const value = normalized[feature] ?? 0.5;
      return acc + weight * value;
    }, base);

    const drynessPenalty = state.imageInsights ? state.imageInsights.drynessScore * 0.2 : 0;
    const clipped = Math.min(Math.max(rawScore + drynessPenalty, 0), 1);
    return clipped * 100;
  })();

  const fieldResults = document.getElementById('field-results');
  const label = fieldResults.querySelector('.results__label');
  const riskMetric = fieldResults.querySelector('[data-metric="risk"]');
  const confidenceMetric = fieldResults.querySelector('[data-metric="confidence"]');
  const chipList = fieldResults.querySelector('[data-list="drivers"]');

  label.innerHTML = `Diagnosis: <strong>${bestProfile.name}</strong>`;
  const suggestions = bestProfile.recommendations
    .map((tip) => `<li>${tip}</li>`)
    .join('');
  fieldResults.querySelector(
    '.results__primary'
  ).innerHTML = `<h3>Primary Diagnosis</h3><p class="results__label">Diagnosis: <strong>${bestProfile.name}</strong></p><ul class="results__list">${suggestions}</ul>`;

  riskMetric.textContent = `${yieldScore.toFixed(0)}%`;
  confidenceMetric.textContent = `${Math.round(bestProbability * 100)}%`;

  chipList.innerHTML = '';
  computeDrivers(bestProfile.weights, normalized).forEach((chip) => {
    const li = document.createElement('li');
    li.textContent = chip;
    chipList.appendChild(li);
  });
}

function tokenize(text) {
  const sanitized = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ') // collapse
    .trim();
  const tokens = sanitized.split(' ').filter(Boolean);
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return { tokens, bigrams };
}

function analyzeSymptomText() {
  const notes = document.getElementById('symptomNotes').value.trim();
  const results = document.getElementById('symptom-results');
  const label = results.querySelector('.results__label');
  const scoreMetric = results.querySelector('[data-metric="score"]');
  const chipList = results.querySelector('[data-list="keywords"]');

  if (!notes) {
    label.textContent = 'Enter scouting notes to see AI matches.';
    scoreMetric.textContent = '–';
    chipList.innerHTML = '';
    return;
  }

  const { tokens, bigrams } = tokenize(notes);
  const tokenCounts = tokens.reduce((acc, token) => {
    acc[token] = (acc[token] ?? 0) + 1;
    return acc;
  }, {});

  const scores = Object.entries(TEXT_SIGNATURES).map(([labelName, profile]) => {
    let score = profile.weight * 0.05;
    const matchedKeywords = new Map();
    Object.entries(profile.keywords).forEach(([keyword, weight]) => {
      const count = tokenCounts[keyword] ?? 0;
      const bigramHit = bigrams.includes(keyword) ? 1 : 0;
      if (count || bigramHit) {
        matchedKeywords.set(keyword, (count + bigramHit) * weight);
        score += (count + bigramHit) * weight;
      }
    });

    if (profile === TEXT_SIGNATURES['powdery mildew']) {
      // penalize if humidity cues are absent
      if (!tokens.includes('humid') && !tokens.includes('damp')) {
        score -= 0.2;
      }
    }

    const normalization = tokens.length ? Math.log(tokens.length + 1) : 1;
    return {
      label: labelName,
      score: score / normalization,
      keywords: Array.from(matchedKeywords.keys())
    };
  });

  scores.sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scores;

  const blendedScore = logistic(best.score - (runnerUp?.score ?? 0));
  label.innerHTML = `Likely match: <strong>${titleCase(best.label)}</strong>`;
  scoreMetric.textContent = `${Math.round(blendedScore * 100)}%`;

  chipList.innerHTML = '';
  (best.keywords.length ? best.keywords : ['no obvious signal terms']).forEach((keyword) => {
    const li = document.createElement('li');
    li.textContent = keyword;
    chipList.appendChild(li);
  });
}

function titleCase(text) {
  return text.replace(/(^|\s)\w/g, (match) => match.toUpperCase());
}

async function loadImageInsights(file) {
  const canvas = document.getElementById('imagePreview');
  const ctx = canvas.getContext('2d');
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
  const width = bitmap.width * ratio;
  const height = bitmap.height * ratio;
  canvas.hidden = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const pixelCount = width * height;

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalLuminance = 0;
  let totalSquaredLuminance = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    totalR += r;
    totalG += g;
    totalB += b;
    totalLuminance += luminance;
    totalSquaredLuminance += luminance * luminance;
  }

  const avgR = totalR / pixelCount;
  const avgG = totalG / pixelCount;
  const avgB = totalB / pixelCount;
  const meanLuminance = totalLuminance / pixelCount;
  const variance = totalSquaredLuminance / pixelCount - meanLuminance ** 2;
  const stdLuminance = Math.sqrt(Math.max(variance, 0));

  const greenVitality = Math.min(avgG / (avgR + avgB + 1e-5), 1);
  const lesionContrast = Math.min(stdLuminance / 128, 1);
  const drynessScore = Math.min(Math.max((avgR - avgG) / 255 + (avgB / 255) * 0.3, 0), 1);

  state.imageInsights = {
    greenVitality,
    lesionContrast,
    drynessScore
  };

  const metrics = document.getElementById('image-metrics');
  metrics.querySelector('[data-metric="vitality"]').textContent = `${Math.round(
    greenVitality * 100
  )}%`;
  metrics.querySelector('[data-metric="contrast"]').textContent = `${Math.round(
    lesionContrast * 100
  )}%`;
  metrics.querySelector('[data-metric="dryness"]').textContent = `${Math.round(
    drynessScore * 100
  )}%`;
}

function resetImageInsights() {
  state.imageInsights = null;
  const canvas = document.getElementById('imagePreview');
  canvas.hidden = true;
  const metrics = document.getElementById('image-metrics');
  metrics.querySelector('[data-metric="vitality"]').textContent = '–';
  metrics.querySelector('[data-metric="contrast"]').textContent = '–';
  metrics.querySelector('[data-metric="dryness"]').textContent = '–';
}

const fieldButton = document.getElementById('run-field-analysis');
fieldButton?.addEventListener('click', runFieldAnalysis);

const analyzeNotesButton = document.getElementById('analyze-notes');
analyzeNotesButton?.addEventListener('click', analyzeSymptomText);

const imageInput = document.getElementById('leafImage');
imageInput?.addEventListener('change', async (event) => {
  const [file] = event.target.files ?? [];
  if (!file) {
    resetImageInsights();
    return;
  }
  await loadImageInsights(file);
});

const imageDrop = document.getElementById('image-drop');
if (imageDrop) {
  imageDrop.addEventListener('dragover', (event) => {
    event.preventDefault();
    imageDrop.classList.add('image-drop--active');
  });
  imageDrop.addEventListener('dragleave', () => {
    imageDrop.classList.remove('image-drop--active');
  });
  imageDrop.addEventListener('drop', async (event) => {
    event.preventDefault();
    imageDrop.classList.remove('image-drop--active');
    const [file] = event.dataTransfer.files ?? [];
    if (!file) return;
    await loadImageInsights(file);
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.metaKey) {
    runFieldAnalysis();
  }
});

// initialize placeholder text lists
(function bootstrapResults() {
  const fieldResults = document.getElementById('field-results');
  const primary = fieldResults.querySelector('.results__primary');
  primary.innerHTML = `
    <h3>Primary Diagnosis</h3>
    <p class="results__label">Ready when you are. Hit “Run Ensemble Analysis”.</p>
  `;
})();
