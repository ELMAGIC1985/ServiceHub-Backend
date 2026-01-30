import { excelUploadService } from './excelUpload.service.js';

class AddonsUploadService {
  async uploadAddonsFromExcel(buffer) {
    return excelUploadService.bulkUpload({
      buffer,
      config: {
        requiredFields: ['name', 'price'],
        fieldTypes: {
          name: 'string',
          price: 'number',
          isActive: 'boolean',
        },
        defaults: {
          isActive: true,
        },
        customValidator: (row) => {
          const errors = [];
          if (row.price <= 0) errors.push('price must be greater than 0');
          return errors;
        },
      },
    });
  }
}

const addonsUploadService = new AddonsUploadService();

export { addonsUploadService };
