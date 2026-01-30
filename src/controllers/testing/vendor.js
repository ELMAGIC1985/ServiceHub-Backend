import { Category } from '../../models/category.model.js';
import { ServiceTemplate } from '../../models/serviceTemplateSchema.js';
import Vendor, { USER_ROLES } from '../../models/vendor.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const registerMultipleVendorsNoVerification = asyncHandler(async (req, res) => {
  const { vendors } = req.body;

  if (!Array.isArray(vendors) || vendors.length === 0) {
    return res.status(400).json({
      message: 'An array of vendor data is required',
    });
  }

  const registrationResults = [];

  for (const vendorData of vendors) {
    const { firstName, lastName, phoneNumber, email, dob, password, firebaseUID } = vendorData;

    console.log(`Attempting to register vendor (no verification): ${email}`);
    try {
      // Validate required fields
      if (!firstName || !lastName || !phoneNumber || !email || !dob || !password) {
        registrationResults.push({ email, status: 'failed', message: 'Missing required fields' });
        continue;
      }

      // Check if vendor already exists
      const existingVendor = await Vendor.findOne({
        $or: [{ email }, { phoneNumber }],
      });

      if (existingVendor) {
        registrationResults.push({ email, status: 'skipped', message: 'Vendor already exists' });
        continue;
      }

      // Create new vendor
      const vendor = new Vendor({
        firebaseUID: firebaseUID || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.toLowerCase().trim(),
        dob,
        password,
        roles: [USER_ROLES.VENDOR],
        isVerified: true, // Set to false, as no verification process is run
        isEmailVerified: true, // Manually setting to false
        isMobileVerified: true,
        isKYCVerified: true,
      });

      // Save vendor to database
      const savedVendor = await vendor.save();

      // Return vendor data without sensitive information
      const vendorResponse = await Vendor.findById(savedVendor._id).select('-password -refreshToken').lean();
      registrationResults.push({
        email,
        status: 'success',
        message: 'Vendor registered successfully (no verification)',
        userId: vendorResponse._id,
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errorMessages = Object.values(error.errors).map((err) => err.message);
        registrationResults.push({ email, status: 'failed', message: 'Validation error', errors: errorMessages });
      } else if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        registrationResults.push({ email, status: 'failed', message: `${field} already exists` });
      } else {
        console.error(`Error registering vendor ${email}:`, error);
        registrationResults.push({ email, status: 'failed', message: 'Internal server error', error: error.message });
      }
    }
  }

  return res.status(200).json({
    message: 'Batch vendor registration process completed (no verification)',
    results: registrationResults,
  });
});

const addMultipleCategories = asyncHandler(async (req, res) => {
  const { categories } = req.body; // Expect an array of category objects

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new ApiError(400, 'An array of category data is required');
  }

  const results = [];

  for (const categoryData of categories) {
    const { name, description, type, parentCategory, image, isFeatured, seo } = categoryData;

    try {
      // Validate required fields for the current category in the batch
      if (!name || !type) {
        results.push({ name: name || 'N/A', status: 'failed', message: 'Name and type are required' });
        continue; // Skip to the next category
      }

      let newCategoryLevel = 1;
      // Validate parent category if provided
      if (parentCategory) {
        const parent = await Category.findById(parentCategory);
        if (!parent) {
          results.push({ name, status: 'failed', message: `Parent category with ID ${parentCategory} not found` });
          continue;
        }

        // Check if parent is at maximum depth
        if (parent.level === undefined || parent.level >= 3) {
          results.push({
            name,
            status: 'failed',
            message: `Cannot create subcategory. Maximum depth of 3 levels reached for parent ${parent.name}`,
          });
          continue;
        }
        newCategoryLevel = parent.level + 1; // Calculate level for the new category
      }

      // Check for duplicate category name at the same level
      const existingCategory = await Category.findOne({
        name: name.trim(),
        type,
        parentCategory: parentCategory || null,
        isDeleted: false,
      });

      if (existingCategory) {
        results.push({ name, status: 'skipped', message: 'Category with this name already exists at this level' });
        continue;
      }

      // Prepare data for creation
      const categoryToCreate = {
        name: name.trim(),
        description: description?.trim(),
        type,
        parentCategory: parentCategory || null,
        image,
        isFeatured: isFeatured || false,
        seo,
        level: newCategoryLevel, // Set the calculated level
      };

      const createdCategory = await Category.create(categoryToCreate);
      results.push({
        name,
        status: 'success',
        categoryId: createdCategory._id,
        message: 'Category created successfully',
      });
    } catch (error) {
      // Log individual errors for debugging
      console.error(`Error adding category ${name}:`, error);

      if (error instanceof ApiError) {
        results.push({ name, status: 'failed', message: error.message, statusCode: error.statusCode });
      } else {
        // Catch any unexpected errors during creation
        results.push({
          name,
          status: 'failed',
          message: 'Internal server error during creation',
          error: error.message,
        });
      }
    }
  }

  // Send a consolidated response for the batch operation
  res.status(200).json(new ApiResponse(200, results, 'Batch category creation process completed'));
});

const createMultipleServiceTemplates = asyncHandler(async (req, res, next) => {
  const { serviceTemplates } = req.body; // Expect an array of service template objects

  if (!Array.isArray(serviceTemplates) || serviceTemplates.length === 0) {
    return next(new ApiError(400, 'An array of service template data is required'));
  }

  const creationResults = [];

  for (const templateData of serviceTemplates) {
    const { title, description, category, subCategory, childCategory, pricingGuidelines, ...restOfData } = templateData;

    try {
      // Validate required fields
      if (!title || !category) {
        creationResults.push({ title: title || 'N/A', status: 'failed', message: 'Title and category are required' });
        continue;
      }

      // Validate main category exists
      const mainCategoryExists = await Category.findById(category);
      if (!mainCategoryExists) {
        creationResults.push({ title, status: 'failed', message: `Main category with ID ${category} not found` });
        continue;
      }

      // Validate subCategory if provided
      if (subCategory) {
        const subCatExists = await Category.findById(subCategory);
        if (!subCatExists) {
          creationResults.push({ title, status: 'failed', message: `Sub-category with ID ${subCategory} not found` });
          continue;
        }
        if (String(subCatExists.parentCategory) !== String(category)) {
          creationResults.push({
            title,
            status: 'failed',
            message: `Sub-category ${subCategory} is not a child of main category ${category}`,
          });
          continue;
        }
      }

      // Validate childCategory if provided
      if (childCategory) {
        const childCatExists = await Category.findById(childCategory);
        if (!childCatExists) {
          creationResults.push({
            title,
            status: 'failed',
            message: `Child category with ID ${childCategory} not found`,
          });
          continue;
        }
        // Optional: Add logic to ensure childCategory is a child of subCategory
        // if (String(childCatExists.parentCategory) !== String(subCategory)) {
        //   creationResults.push({ title, status: 'failed', message: `Child category ${childCategory} is not a child of sub-category ${subCategory}` });
        //   continue;
        // }
      }

      // Generate slug
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      // Check for duplicate slug (optional, but recommended for uniqueness)
      const existingTemplate = await ServiceTemplate.findOne({ slug });
      if (existingTemplate) {
        creationResults.push({
          title,
          status: 'skipped',
          message: `Service template with title "${title}" (slug: ${slug}) already exists.`,
        });
        continue;
      }

      const serviceTemplate = new ServiceTemplate({
        title: title.trim(),
        description: description?.trim(),
        category,
        subCategory, // Include subCategory and childCategory
        childCategory,
        pricingGuidelines,
        ...restOfData, // To include any other fields in the templateData
        slug,
        // createdBy: req.user._id, // Uncomment if you have user context
      });

      const savedTemplate = await serviceTemplate.save();

      const populatedTemplate = await ServiceTemplate.findById(savedTemplate._id).populate(
        'category subCategory childCategory',
        'name slug type'
      );

      creationResults.push({
        title,
        status: 'success',
        templateId: populatedTemplate._id,
        message: 'Service template created successfully',
        data: populatedTemplate,
      });
    } catch (error) {
      console.error(`Error creating service template for "${title}":`, error);
      if (error instanceof ApiError) {
        creationResults.push({
          title: title || 'N/A',
          status: 'failed',
          message: error.message,
          statusCode: error.statusCode,
        });
      } else {
        creationResults.push({
          title: title || 'N/A',
          status: 'failed',
          message: 'Internal server error during creation',
          error: error.message,
        });
      }
    }
  }

  res.status(200).json(new ApiResponse(200, creationResults, 'Batch service template creation process completed'));
});

export { registerMultipleVendorsNoVerification, addMultipleCategories, createMultipleServiceTemplates };
