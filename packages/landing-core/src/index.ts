/**
 * @danielexpandlogy/landing-core: lo que usa una landing del Landing Lab
 * (elegir la variante de cada visitante y registrar visitas, clics y agendas)
 * y el motor estadístico que comparte con el panel de Expandlogy Software.
 */

export { configureLandingLab, type LandingLabConfig } from "./client";
export {
  trackConversion,
  useExperiment,
  useLandingLab,
  useTrackConversion,
  type TrackMode,
} from "./experiment";
export { isTeamBrowser, readPreview } from "./params";
export {
  HEX_COLOR,
  readColor,
  readCta,
  readHeadline,
  readImage,
  readOrder,
  readText,
  validateValue,
  VARIABLE_KINDS,
  type ColorValue,
  type CtaValue,
  type HeadlineValue,
  type ImageValue,
  type VariableKind,
} from "./kinds";
export {
  chooseSelection,
  optionLetter,
  type PublicConfig,
  type PublicOption,
  type PublicVariable,
  type Selection,
} from "./assign";
export {
  analyzeVariable,
  credibleInterval,
  pickIndex,
  probabilityBest,
  sampleBeta,
  seededRng,
  visitorsPerOption,
  type BanditSettings,
  type OptionCounts,
  type Phase,
  type Rng,
  type VariableAnalysis,
} from "./bandit";
export { loadVisit, newVisitorId, readUtm, saveVisit, type StoredVisit } from "./visitor";
