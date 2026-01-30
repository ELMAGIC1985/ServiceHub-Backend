import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  line1: { type: String, trim: true, required: true },
  line2: { type: String, trim: true },
  street: { type: String, trim: true },
  city: { type: String, required: true, trim: true, index: true },
  state: { type: String, required: true, trim: true, index: true },
  country: { type: String, required: true, trim: true, index: true },
  postalCode: { type: String, required: true, trim: true },
  landmark: { type: String, trim: true },
  completeAddress: { type: String, trim: true },
  addressType: {
    type: String,
    trim: true,
    enum: ['home', 'work', 'office', 'other'],
    default: 'home',
  },
  googleMapUrl: { type: String, trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
});

AddressSchema.index({ location: '2dsphere' });

AddressSchema.pre('save', function (next) {
  const parts = [
    this.line1,
    this.line2,
    this.street,
    this.landmark,
    this.city,
    this.state,
    this.country,
    this.postalCode,
  ].filter(Boolean);

  this.completeAddress = parts.join(', ');

  if (this.location && Array.isArray(this.location.coordinates) && this.location.coordinates.length === 2) {
    const [lng, lat] = this.location.coordinates;
    this.googleMapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  }

  next();
});

export const Address = mongoose.model('Address', AddressSchema);
