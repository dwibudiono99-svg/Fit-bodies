export type OccasionType = "bepergian" | "resmi-biasa" | "kedinasan";
export type GenderType = "pria" | "wanita";
export type BodyShapeType =
  | "proporsional"
  | "atletis"
  | "ramping"
  | "berisi"
  | "bahu-lebar"
  | "jam-pasir";
export type FitPreferenceType = "slim" | "regular" | "relaxed";
export type BackdropType = "studio" | "perjalanan" | "rapat" | "kedinasan";

export interface BodyProfile {
  gender: GenderType;
  bodyShape: BodyShapeType;
  heightCm: number;
  weightKg: number;
  size: "S" | "M" | "L" | "XL" | "XXL";
  fitPreference: FitPreferenceType;
}

export interface StudioModelPreset {
  id: string;
  name: string;
  gender: GenderType;
  bodyShape: BodyShapeType;
  heightCm: number;
  weightKg: number;
  imageUrl: string;
  description: string;
}

export interface GarmentOverlayAnchors {
  offsetXPct: number;
  offsetYPct: number;
  widthScalePct: number;
  heightScalePct: number;
  shoulderWidthRatio: number;
  waistTaper: number;
  opacity: number;
}

export interface GarmentItem {
  id: string;
  title: string;
  subtitle: string;
  occasion: OccasionType;
  gender: GenderType | "uniseks";
  fabric: string;
  cut: string;
  colorName: string;
  imageUrl: string;
  travelScoreNote: string;
  protocolNote: string;
  defaultAnchors: GarmentOverlayAnchors;
}

export interface BodyAnalysisResponse {
  silhouetteSummary: string;
  anchors: {
    centerX: number;
    shoulderY: number;
    shoulderWidthPct: number;
    torsoHeightPct: number;
    waistTaperRatio: number;
  };
  tailoringSpecs: {
    shoulderCut: string;
    jacketLength: string;
    sleeveBreak: string;
    trouserCut: string;
    collarStyle: string;
    fabricWeight: string;
  };
  occasionGuidance: {
    readinessNote: string;
    etiquetteNote: string;
    packingOrCareTip: string;
  };
  recommendedColorways: string[];
}

export interface FittingCalibrationResponse {
  calibration: {
    offsetXPct: number;
    offsetYPct: number;
    widthScalePct: number;
    heightScalePct: number;
    fitTightness: string;
    drapeShadow: number;
  };
  fitAssessment: {
    fitVerdict: string;
    proportionNote: string;
    alterationAdvice: string;
  };
  pairingChecklist: Array<{
    category: string;
    recommendation: string;
    reason: string;
  }>;
}

export interface StylistMixResponse {
  headline: string;
  footwear: string;
  accessories: string;
  garmentCare: string;
  backupItem: string;
}

export interface SavedLookbookEntry {
  id: string;
  createdAt: string;
  occasion: OccasionType;
  garmentTitle: string;
  modelLabel: string;
  profileSummary: string;
  fitVerdict: string;
  previewDataUrl: string;
  notes: string;
}
