import type { FieldDefinition } from '@/types';

const DEFAULT_CHECKBOX_SIZE = 10;

interface ValidationError {
  fieldId: string;
  message: string;
}

export function validateFields(fields: FieldDefinition[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const nameCount = new Map<string, FieldDefinition[]>();

  for (const field of fields) {
    if (!field.name.trim()) {
      errors.push({
        fieldId: field.id,
        message: `フィールド (p${field.page}, ${field.x}, ${field.y}) の名前が空です`,
      });
      continue;
    }

    const existing = nameCount.get(field.name) ?? [];
    existing.push(field);
    nameCount.set(field.name, existing);
  }

  for (const [name, duplicates] of nameCount.entries()) {
    if (duplicates.length > 1) {
      for (const field of duplicates) {
        errors.push({
          fieldId: field.id,
          message: `フィールド名 "${name}" が重複しています (${duplicates.length}箇所)`,
        });
      }
    }
  }

  return errors;
}

export async function generateFormPdf(
  pdfArrayBuffer: ArrayBuffer,
  fields: FieldDefinition[],
): Promise<Uint8Array> {
  const { PDFDocument, TextAlignment } = await import('pdf-lib');

  const alignmentMap: Record<string, typeof TextAlignment[keyof typeof TextAlignment]> = {
    left: TextAlignment.Left,
    center: TextAlignment.Center,
    right: TextAlignment.Right,
  };

  const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    if (field.page < 1 || field.page > pages.length) {
      console.warn(`Invalid page number: ${field.page}, skipping field: ${field.name}`);
      continue;
    }

    const page = pages[field.page - 1];

    try {
      if (field.type === 'text') {
        const textField = form.createTextField(field.name);
        textField.addToPage(page, {
          x: field.x,
          y: field.y,
          width: field.width ?? 200,
          height: field.height ?? 20,
        });
        if (field.fontSize) {
          textField.setFontSize(field.fontSize);
        }
        if (field.align) {
          const alignment = alignmentMap[field.align];
          if (alignment !== undefined) {
            textField.setAlignment(alignment);
          }
        }
      } else if (field.type === 'checkbox') {
        const boxSize = field.fontSize || DEFAULT_CHECKBOX_SIZE;
        const checkBox = form.createCheckBox(field.name);
        checkBox.addToPage(page, {
          x: field.x,
          y: field.y,
          width: boxSize,
          height: boxSize,
        });
      }
    } catch (error) {
      console.warn(`Failed to create field: ${field.name}`, error);
    }
  }

  return pdfDoc.save();
}
