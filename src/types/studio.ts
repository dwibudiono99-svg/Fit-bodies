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

export type BodyConditionFlag =
  | "standar"
  | "bahu-miring"
  | "perut-berisi"
  | "torso-pendek"
  | "torso-panjang"
  | "dada-bidang";

export interface BodyProfile {
  gender: GenderType;
  bodyShape: BodyShapeType;
  bodyCondition: BodyConditionFlag;
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

export interface BodyLandmarks {
  neckY: number; // % from top (12 - 26)
  leftShoulderX: number; // % from left (22 - 42)
  leftShoulderY: number; // % from top (15 - 30)
  rightShoulderX: number; // % from left (58 - 78)
  rightShoulderY: number; // % from top (15 - 30)
  chestWidthPct: number; // % of canvas width (22 - 48)
  waistY: number; // % from top (34 - 50)
  waistWidthPct: number; // % of canvas width (18 - 46)
  hipY: number; // % from top (46 - 62)
  hipWidthPct: number; // % of canvas width (22 - 50)
  hemY: number; // % from top (76 - 96)
  brightness: number; // 0.85 - 1.15
  contrast: number; // 0.9 - 1.15
}

export interface GarmentOverlayAnchors {
  offsetXPct: number;
  offsetYPct: number;
  widthScalePct: number;
  heightScalePct: number;
  shoulderWidthRatio: number;
  waistTaper: number;
  opacity: number;
  landmarks: BodyLandmarks;
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
  landmarks: BodyLandmarks;
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
  landmarks: BodyLandmarks;
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
