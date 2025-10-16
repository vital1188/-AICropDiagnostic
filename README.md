# Crop Diagnostic Studio

A lightweight, privacy-first crop diagnostics experience that blends heuristic
ensemble scoring, semantic text analysis, and pixel insights directly in the
browser. No dependencies, servers, or installs required.

## Features

- **Sleek, modern interface** – glassmorphism styling, responsive layout, and
  keyboard shortcuts for power users.
- **Field Intelligence Console** – configurable sensor sliders feed an
  ensemble-style classifier to surface likely issues and yield risk.
- **Symptom Language Lab** – transformer-inspired keyword weighting performs
  semantic matching on scouting notes entirely in-browser.
- **Image Intel** – drag-and-drop photo analysis extracts green vitality,
  lesion contrast, and dryness scores to validate sensor and text findings.

## Getting Started

1. Open `web/index.html` in your browser.
2. Adjust field metrics, add notes, and drop an image to generate insights.
3. Toggle stability guardrails for conservative scoring when conditions are
   stable.

## Tech highlights

- Pure HTML/CSS/JavaScript with no external build tooling.
- Ensemble logic blends normalized features, image-derived boosts, and
  rule-based guardrails.
- Canvas-powered image sampling for instant color analytics.
- Semantic scoring with token/bigram weighting and softmax confidence.

## Folder structure

```
web/
├── index.html     # Main interface
├── styles.css     # Modern, glassy styling
└── script.js      # Heuristic ensemble + UI interactions
```

## License

MIT
