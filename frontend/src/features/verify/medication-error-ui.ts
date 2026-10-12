import { medicationErrorCategories, medicationErrorSeverities } from "@/features/medication-error/MedicationErrorReportModal";
import type { TranslationKey, Translator } from "@/i18n/messages";

const categoryKeys = {
  "prescribing": "verify.meCategory.prescribing",
  "pre-dispensing": "verify.meCategory.pre-dispensing",
  "dispensing": "verify.meCategory.dispensing"
} satisfies Record<string, TranslationKey>;

const optionKeys = {
  "prescribing:wrong-drug": "verify.meOption.prescribing.wrong-drug",
  "prescribing:wrong-quantity": "verify.meOption.prescribing.wrong-quantity",
  "prescribing:wrong-strength": "verify.meOption.prescribing.wrong-strength",
  "prescribing:dosage-too-low": "verify.meOption.prescribing.dosage-too-low",
  "prescribing:dosage-too-high": "verify.meOption.prescribing.dosage-too-high",
  "prescribing:wrong-administration": "verify.meOption.prescribing.wrong-administration",
  "prescribing:drug-interaction": "verify.meOption.prescribing.drug-interaction",
  "prescribing:duplicate-drug": "verify.meOption.prescribing.duplicate-drug",
  "prescribing:omitted-drug": "verify.meOption.prescribing.omitted-drug",
  "prescribing:allergy-risk": "verify.meOption.prescribing.allergy-risk",
  "prescribing:no-condition-adjustment": "verify.meOption.prescribing.no-condition-adjustment",
  "prescribing:discontinued-drug": "verify.meOption.prescribing.discontinued-drug",
  "prescribing:contraindicated-drug": "verify.meOption.prescribing.contraindicated-drug",
  "pre-dispensing:wrong-drug": "verify.meOption.pre-dispensing.wrong-drug",
  "pre-dispensing:wrong-quantity": "verify.meOption.pre-dispensing.wrong-quantity",
  "pre-dispensing:wrong-strength": "verify.meOption.pre-dispensing.wrong-strength",
  "pre-dispensing:omitted-drug": "verify.meOption.pre-dispensing.omitted-drug",
  "pre-dispensing:mixed-drug": "verify.meOption.pre-dispensing.mixed-drug",
  "pre-dispensing:wrong-label": "verify.meOption.pre-dispensing.wrong-label",
  "pre-dispensing:wrong-patient": "verify.meOption.pre-dispensing.wrong-patient",
  "dispensing:wrong-patient": "verify.meOption.dispensing.wrong-patient",
  "dispensing:wrong-drug": "verify.meOption.dispensing.wrong-drug",
  "dispensing:wrong-quantity": "verify.meOption.dispensing.wrong-quantity",
  "dispensing:wrong-strength": "verify.meOption.dispensing.wrong-strength",
  "dispensing:omitted-drug": "verify.meOption.dispensing.omitted-drug",
  "dispensing:mixed-drug": "verify.meOption.dispensing.mixed-drug",
  "dispensing:wrong-label": "verify.meOption.dispensing.wrong-label",
  "dispensing:wrong-patient-confirmation": "verify.meOption.dispensing.wrong-patient-confirmation"
} satisfies Record<string, TranslationKey>;

const severityKeys = {
  "A": "verify.meSeverity.A",
  "B": "verify.meSeverity.B",
  "C": "verify.meSeverity.C",
  "D": "verify.meSeverity.D",
  "E": "verify.meSeverity.E",
  "F": "verify.meSeverity.F",
  "G": "verify.meSeverity.G",
  "H": "verify.meSeverity.H",
  "I": "verify.meSeverity.I"
} satisfies Record<string, TranslationKey>;

const severityCategoryKeys = {
  "A": "verify.meSeverityCategory.NoError",
  "B": "verify.meSeverityCategory.NoHarm",
  "C": "verify.meSeverityCategory.NoHarm",
  "D": "verify.meSeverityCategory.NoHarm",
  "E": "verify.meSeverityCategory.Harm",
  "F": "verify.meSeverityCategory.Harm",
  "G": "verify.meSeverityCategory.Harm",
  "H": "verify.meSeverityCategory.Harm",
  "I": "verify.meSeverityCategory.Death"
} satisfies Record<string, TranslationKey>;

// Presentation copies for Verify only. The excluded ME catalog is never changed.
export function localizeVerifyMedicationErrorOptions(t: Translator) {
  const categories = medicationErrorCategories.map((item) => ({
    ...item,
    label: categoryKeys[item.id as keyof typeof categoryKeys],
    options: item.options.map((option) => ({
      ...option,
      label: optionKeys[`${item.id}:${option.id}` as keyof typeof optionKeys],
    })),
  }));
  const severities = medicationErrorSeverities.map((item) => ({
    ...item,
    th: t(severityKeys[item.key]),
    category: t(severityCategoryKeys[item.key]),
  }));
  return { categories, severities };
}
