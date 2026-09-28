export interface DrugLabelTemplateResponse {
  TEMPLATE_ID: string;
  TEMPLATE_NAME: string;
  VERSION_NO: number;
  TEMPLATE_STATUS: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  WIDTH_MM: number;
  HEIGHT_MM: number;
  DEFINITION: Record<string, unknown>;
  LOGO_DATA_URL: string;
  UPDATED_BY: string | null;
  UPDATED_AT: string;
  PUBLISHED_AT: string | null;
  ROW_VERSION: string;
}

export interface DrugLabelTemplatePairResponse {
  DRAFT: DrugLabelTemplateResponse;
  ACTIVE: DrugLabelTemplateResponse;
}

export interface DrugLabelPrintModelResponse {
  PACKAGE_ID: string;
  PACKAGE_ITEM_ID: string;
  TEMPLATE: DrugLabelTemplateResponse;
  DATA: Record<string, string>;
  PRINT_COUNT: number;
  PRINTED_AT: string;
}
