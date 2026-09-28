import { apiGet, apiPost, apiPut } from '@/lib/api-client';

export type DrugLabelElementType = 'text' | 'field' | 'qr' | 'logo' | 'line' | 'box';
export type DrugLabelDataKey = 'patientName' | 'patientHn' | 'visitVn' | 'visitDateTime' | 'doctorName'
  | 'itemCounter' | 'medicineCode' | 'medicineName' | 'medicinePronunciation' | 'quantity'
  | 'doseMemo' | 'indication' | 'qrToken' | 'expiryDate' | 'storageInstruction';

export type DrugLabelElement = {
  id: string;
  type: DrugLabelElementType;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  zIndex: number;
  dataKey?: DrugLabelDataKey;
  text?: string;
  prefix?: string;
  suffix?: string;
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadiusMm?: number;
  lineStyle?: 'solid' | 'dashed';
  fit?: 'contain' | 'cover';
  imageSrc?: string;
};

export type DrugLabelDefinition = { schemaVersion: 1; elements: DrugLabelElement[] };

export type DrugLabelTemplate = {
  TEMPLATE_ID: string;
  TEMPLATE_NAME: string;
  VERSION_NO: number;
  TEMPLATE_STATUS: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  WIDTH_MM: number;
  HEIGHT_MM: number;
  DEFINITION: DrugLabelDefinition;
  LOGO_DATA_URL: string;
  UPDATED_BY: string | null;
  UPDATED_AT: string;
  PUBLISHED_AT: string | null;
  ROW_VERSION: string;
};

export type DrugLabelTemplatePair = { DRAFT: DrugLabelTemplate; ACTIVE: DrugLabelTemplate };

export type DrugLabelPrintModel = {
  PACKAGE_ID: string;
  PACKAGE_ITEM_ID: string;
  TEMPLATE: DrugLabelTemplate;
  DATA: Record<DrugLabelDataKey, string>;
  PRINT_COUNT: number;
  PRINTED_AT: string;
};

export const sampleDrugLabelData: Record<DrugLabelDataKey, string> = {
  patientName: 'ชื่อ นาย เอ บีบ่อย',
  patientHn: '00000',
  visitVn: '0000',
  visitDateTime: '29/02/2567 (12.10 น.)',
  doctorName: 'นพ.ซี ดีด็อก',
  itemCounter: '#1/4',
  medicineCode: '1200000001',
  medicineName: 'Enalapril (Anapril) 5 mg tab',
  medicinePronunciation: 'อี-นา-ลา-พริล',
  quantity: '20 เม็ด',
  doseMemo: 'รับประทานครั้งละ 1 เม็ด\nวันละ 1 ครั้ง หลังอาหาร เช้า',
  indication: 'ยาลดความดันโลหิต',
  qrToken: 'QR-DEMO-JURAPORN-0001',
  expiryDate: '—',
  storageInstruction: 'ไม่ต้องกันแสง',
};

export function getDrugLabelTemplates() {
  return apiGet<DrugLabelTemplatePair>('/drug-label-templates/current');
}

export function saveDrugLabelDraft(input: {
  expectedRowVersion: string;
  widthMm: number;
  heightMm: number;
  definition: DrugLabelDefinition;
  actorName?: string;
}) {
  return apiPut<DrugLabelTemplatePair>('/drug-label-templates/draft', input);
}

export function saveDrugLabelLogo(input: {
  expectedRowVersion: string;
  mimeType: 'image/png' | 'image/jpeg';
  dataBase64: string;
  actorName?: string;
}) {
  return apiPut<DrugLabelTemplatePair>('/drug-label-templates/draft/logo', input);
}

export function publishDrugLabelDraft(expectedRowVersion: string, actorName?: string) {
  return apiPost<DrugLabelTemplatePair>('/drug-label-templates/draft/publish', { expectedRowVersion, actorName });
}

export function printPackageDrugLabel(packageId: string, itemId: string) {
  return apiPost<DrugLabelPrintModel>(`/packages/${packageId}/items/${itemId}/label/print`, {});
}
