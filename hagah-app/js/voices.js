// Curated English-only Piper (VITS) neural voices, run entirely in the
// browser via WebAssembly/ONNX — see js/piper.js. All are "medium" quality
// (~60MB one-time download per voice, cached locally after) unless noted.
const ENGLISH_VOICES = [
  { id: "en_US-amy-medium", label: "Amy — warm (recommended)" },
  { id: "en_US-lessac-medium", label: "Lessac (male)" },
  { id: "en_US-hfc_female-medium", label: "HFC (female)" },
  { id: "en_US-hfc_male-medium", label: "HFC (male)" },
  { id: "en_US-ryan-medium", label: "Ryan (male)" },
  { id: "en_GB-alan-medium", label: "Alan — British (male)" },
  { id: "en_GB-jenny_dioco-medium", label: "Jenny — British (female)" },
  { id: "en_GB-southern_english_female-low", label: "Southern — British (female, smaller download)" },
];
