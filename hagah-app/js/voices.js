// Curated English-only Google Cloud Text-to-Speech voices.
// Standard voices are cheapest against the free tier (4M chars/mo);
// Wavenet voices sound more natural but draw from a smaller free
// allowance (1M chars/mo). Both are offered so the choice is explicit.
const ENGLISH_VOICES = [
  { name: "en-US-Standard-C", label: "US English — Standard (female)" },
  { name: "en-US-Standard-D", label: "US English — Standard (male)" },
  { name: "en-US-Wavenet-C", label: "US English — Wavenet (female)" },
  { name: "en-US-Wavenet-D", label: "US English — Wavenet (male)" },
  { name: "en-GB-Standard-A", label: "British English — Standard (female)" },
  { name: "en-GB-Standard-B", label: "British English — Standard (male)" },
  { name: "en-GB-Wavenet-A", label: "British English — Wavenet (female)" },
  { name: "en-GB-Wavenet-B", label: "British English — Wavenet (male)" },
  { name: "en-AU-Standard-A", label: "Australian English — Standard (female)" },
  { name: "en-AU-Wavenet-B", label: "Australian English — Wavenet (male)" },
  { name: "en-IN-Standard-A", label: "Indian English — Standard (female)" },
  { name: "en-IN-Wavenet-B", label: "Indian English — Wavenet (male)" },
];
