import XLSX from 'xlsx';

class ExcelUploadService {
  parseExcel(buffer, sheetIndex = 0) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // Convert all keys to lowercase
    return rows.map((row) =>
      Object.keys(row).reduce((acc, key) => {
        acc[key.trim().toLowerCase()] = row[key];
        return acc;
      }, {})
    );
  }

  validateAndTransformRow({
    row,
    rowIndex,
    requiredFields = [],
    fieldTypes = {},
    defaults = {},
    customValidator,
    transform,
  }) {
    const errors = [];
    const record = {};

    for (const field of requiredFields) {
      if (row[field] === null || row[field] === undefined || row[field] === '') {
        errors.push(`${field} is required`);
      }
    }

    // Type casting + defaults
    for (const key of Object.keys({ ...row, ...defaults })) {
      let value = row[key] ?? defaults[key];

      if (value !== null && fieldTypes[key]) {
        try {
          switch (fieldTypes[key]) {
            case 'number':
              value = Number(value);
              if (isNaN(value)) throw new Error();
              break;

            case 'boolean':
              value = value === true || value === 'true' || value === 1;
              break;

            case 'date':
              value = value ? new Date(value) : null;
              if (value && isNaN(value.getTime())) throw new Error();
              break;

            case 'string':
              value = String(value);
              break;
          }
        } catch {
          errors.push(`${key} must be a valid ${fieldTypes[key]}`);
        }
      }

      record[key] = value;
    }

    // Custom validator
    if (customValidator) {
      const customErrors = customValidator(record);
      if (customErrors?.length) errors.push(...customErrors);
    }

    // Transform row (final shape)
    const finalRecord = transform ? transform(record) : record;

    return errors.length ? { success: false, row: rowIndex + 1, errors } : { success: true, data: finalRecord };
  }

  async bulkUpload({ buffer, config }) {
    const rows = this.parseExcel(buffer);

    const validRecords = [];
    const failedRecords = [];

    rows.forEach((row, index) => {
      const result = this.validateAndTransformRow({
        row,
        rowIndex: index,
        ...config,
      });

      if (result.success) {
        validRecords.push(result.data);
      } else {
        failedRecords.push({
          row: result.row,
          errors: result.errors,
        });
      }
    });

    return {
      total: rows.length,
      successCount: validRecords.length,
      failedCount: failedRecords.length,
      validRecords,
      failedRecords,
    };
  }
}

export const excelUploadService = new ExcelUploadService();
