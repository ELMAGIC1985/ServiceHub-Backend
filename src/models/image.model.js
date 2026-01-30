import mongoose from 'mongoose';

const imageSizeSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    key: {
      type: String,
      required: true,
    },
    cdnUrl: {
      type: String,
    },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
    },
    imageType: {
      type: String,
      required: true,
      enum: ['avatar', 'icon', 'product', 'service', 'category', 'poster', 'banner'],
    },
    folder: {
      type: String,
      required: true,
    },
    sizes: [imageSizeSchema],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

imageSchema.index({ imageType: 1, isActive: 1 });
imageSchema.index({ uploadedAt: -1 });
imageSchema.index({ 'metadata.entityId': 1 });

const Image = mongoose.model('Image', imageSchema);

export default Image;
