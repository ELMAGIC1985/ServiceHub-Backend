import mongoose, { Schema } from 'mongoose';

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
      index: true,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    type: {
      type: String,
      enum: {
        values: ['product', 'service'],
        message: 'Type must be either product or service',
      },
      default: 'service',
      required: true,
    },

    // Main category level (e.g., "Home Appliance Repair")
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 3,
      required: true,
    },

    // Parent category reference for hierarchical structure
    parentCategory: {
      type: mongoose.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },

    // Child categories (subcategories and sub-subcategories)
    childCategories: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Category',
      },
    ],

    // Services associated with this category
    services: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Service', // Changed from 'Services' to 'Service' (singular)
      },
    ],

    // Products associated with this category (if type is 'product')
    products: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
      },
    ],

    image: {
      type: String, // or [String] if multiple
      default: null,
    },

    // SEO and metadata
    seo: {
      metaTitle: { type: String, maxlength: 60 },
      metaDescription: { type: String, maxlength: 160 },
      keywords: [{ type: String, trim: true }],
    },

    // Category ordering and display
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    // Featured category flag
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Status flags
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Statistics (can be updated via aggregation)
    stats: {
      totalServices: { type: Number, default: 0 },
      totalProducts: { type: Number, default: 0 },
      totalBookings: { type: Number, default: 0 },
    },

    // Audit fields
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      //   required: true,
    },

    updatedBy: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
categorySchema.index({ name: 1, type: 1 });
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentCategory: 1, level: 1 });
categorySchema.index({ isActive: 1, isDeleted: 1 });
categorySchema.index({ type: 1, isFeatured: 1 });
categorySchema.index({ sortOrder: 1 });

// Virtual for full hierarchy path
categorySchema.virtual('fullPath').get(function () {
  // This would need to be populated or calculated
  return this.name; // Placeholder - implement hierarchy path logic
});

// Virtual for checking if category has children
categorySchema.virtual('hasChildren').get(function () {
  return this.childCategories && this.childCategories.length > 0;
});

// Pre-save middleware to generate slug
categorySchema.pre('save', function (next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  }
  next();
});

// Pre-save middleware to validate hierarchy
categorySchema.pre('save', async function (next) {
  if (this.parentCategory) {
    const parent = await this.constructor.findById(this.parentCategory);
    if (!parent) {
      return next(new Error('Parent category not found'));
    }

    // Set level based on parent
    this.level = parent.level + 1;

    // Validate maximum depth
    if (this.level > 3) {
      return next(new Error('Maximum category depth of 3 levels exceeded'));
    }
  }
  next();
});

// Post-save middleware to update parent's children array
categorySchema.post('save', async function (doc, next) {
  if (doc.parentCategory) {
    await this.constructor.findByIdAndUpdate(doc.parentCategory, { $addToSet: { childCategories: doc._id } });
  }
  next();
});

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function (type = 'service') {
  return await this.aggregate([
    { $match: { level: 1, type, isActive: true, isDeleted: false } },
    {
      $lookup: {
        from: 'categories',
        localField: 'childCategories',
        foreignField: '_id',
        as: 'subcategories',
        pipeline: [
          { $match: { isActive: true, isDeleted: false } },
          {
            $lookup: {
              from: 'categories',
              localField: 'childCategories',
              foreignField: '_id',
              as: 'childCategories',
              pipeline: [{ $match: { isActive: true, isDeleted: false } }],
            },
          },
        ],
      },
    },
    { $sort: { sortOrder: 1, name: 1 } },
  ]);
};

// Static method to get breadcrumb path
categorySchema.statics.getBreadcrumbPath = async function (categoryId) {
  const category = await this.findById(categoryId);
  if (!category) return [];

  const path = [category];
  let current = category;

  while (current.parentCategory) {
    current = await this.findById(current.parentCategory);
    if (current) {
      path.unshift(current);
    } else {
      break;
    }
  }

  return path;
};

// Instance method to get all descendants
categorySchema.methods.getDescendants = async function () {
  const descendants = [];

  const getChildren = async (categoryId) => {
    const children = await this.constructor.find({
      parentCategory: categoryId,
      isActive: true,
      isDeleted: false,
    });

    for (const child of children) {
      descendants.push(child);
      await getChildren(child._id);
    }
  };

  await getChildren(this._id);
  return descendants;
};

export const Category = mongoose.model('Category', categorySchema);
