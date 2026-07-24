export type ProductUnitType = "UNIT" | "MEASURE"

export type MeasurementUnit = "FEET" | "CENTIMETERS" | "INCHES" | "METERS"

export type ProductMeasurementMode = "UNIT" | MeasurementUnit

export interface ProductMeasurementLike {
  unitType?: ProductUnitType | string | null
  measurementUnit?: MeasurementUnit | string | null
}

export const PRODUCT_MEASUREMENT_OPTIONS: Array<{ value: ProductMeasurementMode; label: string; shortLabel: string }> = [
  { value: "UNIT", label: "Por unidad", shortLabel: "u" },
  { value: "FEET", label: "Por pies", shortLabel: "ft" },
  { value: "CENTIMETERS", label: "Por centímetros", shortLabel: "cm" },
  { value: "METERS", label: "Por metros", shortLabel: "m" },
  { value: "INCHES", label: "Por pulgadas", shortLabel: "in" },
]

export function isMeasurementUnit(value: unknown): value is MeasurementUnit {
  return value === "FEET" || value === "CENTIMETERS" || value === "INCHES" || value === "METERS"
}

export function getMeasurementModeFromProduct(product?: ProductMeasurementLike | null): ProductMeasurementMode {
  if (!product || product.unitType === "UNIT") {
    return "UNIT"
  }

  return isMeasurementUnit(product.measurementUnit) ? product.measurementUnit : "FEET"
}

export function measurementModeToPersistence(mode: ProductMeasurementMode): {
  unitType: ProductUnitType
  measurementUnit: MeasurementUnit | null
} {
  if (mode === "UNIT") {
    return {
      unitType: "UNIT",
      measurementUnit: null,
    }
  }

  return {
    unitType: "MEASURE",
    measurementUnit: mode,
  }
}

export function isMeasuredMode(value: ProductMeasurementMode | ProductMeasurementLike | null | undefined): boolean {
  if (!value) {
    return false
  }

  if (typeof value === "string") {
    return value !== "UNIT"
  }

  return getMeasurementModeFromProduct(value) !== "UNIT"
}

export function getMeasurementOption(mode: ProductMeasurementMode) {
  return PRODUCT_MEASUREMENT_OPTIONS.find((option) => option.value === mode) ?? PRODUCT_MEASUREMENT_OPTIONS[0]
}

export function getMeasurementLabel(mode: ProductMeasurementMode) {
  return getMeasurementOption(mode).label
}

export function getMeasurementShortLabel(mode: ProductMeasurementMode) {
  return getMeasurementOption(mode).shortLabel
}
