import QRCode from 'qrcode';
import type { DrugLabelDataKey, DrugLabelElement, DrugLabelPrintModel, DrugLabelTemplate } from '@/lib/drug-label-api';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

function textValue(element: DrugLabelElement, data: Partial<Record<DrugLabelDataKey, string>>) {
  const raw = element.type === 'text' ? element.text : element.dataKey ? data[element.dataKey] : '';
  const value = String(raw ?? '').trim() || '—';
  return `${element.prefix ?? ''}${value}${element.suffix ?? ''}`;
}

function commonStyle(element: DrugLabelElement) {
  return [
    'position:absolute', `left:${element.xMm}mm`, `top:${element.yMm}mm`,
    `width:${element.widthMm}mm`, `height:${element.heightMm}mm`, `z-index:${element.zIndex}`,
    'box-sizing:border-box', 'overflow:hidden',
    `color:${element.color ?? '#111827'}`, `background:${element.backgroundColor ?? 'transparent'}`,
    `border:${element.borderWidth ?? 0}mm ${element.lineStyle ?? 'solid'} ${element.borderColor ?? 'transparent'}`,
    `border-radius:${element.borderRadiusMm ?? 0}mm`,
  ].join(';');
}

function textStyle(element: DrugLabelElement) {
  return [commonStyle(element), `font-family:'Chulabhorn Likit Text',sans-serif`, `font-size:${element.fontSizePt ?? 10}pt`,
    `font-weight:${element.fontWeight ?? 400}`, `text-align:${element.textAlign ?? 'left'}`,
    'white-space:pre-wrap', 'line-height:1.22', 'display:flex',
    `align-items:${element.textAlign === 'center' ? 'center' : 'flex-start'}`,
    `justify-content:${element.textAlign === 'right' ? 'flex-end' : element.textAlign === 'center' ? 'center' : 'flex-start'}`,
  ].join(';');
}

async function renderElement(element: DrugLabelElement, template: DrugLabelTemplate, data: Partial<Record<DrugLabelDataKey, string>>) {
  if (element.type === 'qr') {
    const token = textValue(element, data);
    const qr = await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 0, width: 512 });
    return `<img alt="QR" src="${qr}" style="${commonStyle(element)};object-fit:contain" />`;
  }
  if (element.type === 'logo') {
    const source = template.LOGO_DATA_URL.startsWith('data:')
      ? template.LOGO_DATA_URL
      : element.imageSrc ?? template.LOGO_DATA_URL;
    return `<img alt="logo" src="${escapeHtml(source)}" style="${commonStyle(element)};object-fit:${element.fit ?? 'contain'}" />`;
  }
  if (element.type === 'line') return `<div style="${commonStyle(element)};height:0;border-width:${element.borderWidth ?? 0.4}mm 0 0 0"></div>`;
  if (element.type === 'box') return `<div style="${commonStyle(element)}"></div>`;
  return `<div style="${textStyle(element)}">${escapeHtml(textValue(element, data))}</div>`;
}

export async function buildDrugLabelPrintHtml(template: DrugLabelTemplate, data: Partial<Record<DrugLabelDataKey, string>>) {
  const elements = await Promise.all([...template.DEFINITION.elements]
    .sort((a, b) => a.zIndex - b.zIndex).map(element => renderElement(element, template, data)));
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Drug label</title>
    <style>
      @font-face{font-family:'Chulabhorn Likit Text';src:url('/fonts/chulabhornlikittext-regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
      @font-face{font-family:'Chulabhorn Likit Text';src:url('/fonts/chulabhornlikittext-medium.woff2') format('woff2');font-weight:500;font-style:normal;font-display:block}
      @font-face{font-family:'Chulabhorn Likit Text';src:url('/fonts/chulabhornlikittext-light.woff2') format('woff2');font-weight:300;font-style:normal;font-display:block}
      @font-face{font-family:'Chulabhorn Likit Text';src:url('/fonts/chulabhornlikittext-bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:block}
      @page{size:${template.WIDTH_MM}mm ${template.HEIGHT_MM}mm;margin:0}
      html,body{width:${template.WIDTH_MM}mm;height:${template.HEIGHT_MM}mm;margin:0;padding:0;overflow:hidden}
      body{font-family:'Chulabhorn Likit Text',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .label{position:relative;width:${template.WIDTH_MM}mm;height:${template.HEIGHT_MM}mm;background:white;overflow:hidden}
    </style></head><body><main class="label">${elements.join('')}</main></body></html>`;
}

export async function openDrugLabelPrint(model: Pick<DrugLabelPrintModel, 'TEMPLATE' | 'DATA'>) {
  const html = await buildDrugLabelPrintHtml(model.TEMPLATE, model.DATA);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  document.body.appendChild(frame);
  const documentRef = frame.contentDocument;
  if (!documentRef || !frame.contentWindow) throw Object.assign(new Error("ไม่สามารถเปิดหน้าพิมพ์ได้"), { uiMessage: { kind: "ui-message", key: "common.printUnavailable" } as const });
  documentRef.open();
  documentRef.write(html);
  documentRef.close();
  await documentRef.fonts?.ready;
  await Promise.all(Array.from(documentRef.images).map(image => image.complete
    ? Promise.resolve() : new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
  frame.contentWindow.focus();
  frame.contentWindow.print();
  window.setTimeout(() => frame.remove(), 1_000);
}
