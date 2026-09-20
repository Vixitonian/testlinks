// Curated English-only Piper (VITS) neural voices, run entirely in the
// browser via WebAssembly/ONNX — see js/piper.js. All are "medium" quality
// (~60MB one-time download per voice, cached locally after) unless noted.
const ENGLISH_VOICES = [
  { id: "en_US-lessac-medium", label: "US English — Lessac (male)" },
  { id: "en_US-amy-medium", label: "US English — Amy (female)" },
  { id: "en_US-hfc_female-medium", label: "US English — HFC (female)" },
  { id: "en_US-hfc_male-medium", label: "US English — HFC (male)" },
  { id: "en_US-ryan-medium", label: "US English — Ryan (male)" },
  { id: "en_GB-alan-medium", label: "British English — Alan (male)" },
  { id: "en_GB-jenny_dioco-medium", label: "British English — Jenny (female)" },
  { id: "en_GB-southern_english_female-low", label: "British English — Southern (female, smaller download)" },
];
