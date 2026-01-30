import config from '../../config/config.js';
import axios from 'axios';

export const getFullAddressFromLAtLong = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    // Validate input parameters
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: lat and lng',
      });
    }

    // Validate that lat and lng are valid numbers
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates: lat and lng must be valid numbers',
      });
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinate ranges: lat must be between -90 and 90, lng must be between -180 and 180',
      });
    }

    // Check if API key is configured
    if (!config.GOOGLE_MAP_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Google Maps API key not configured',
      });
    }

    // Make request to Google Maps Geocoding API
    const googleMapsUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const response = await axios.get(googleMapsUrl, {
      params: {
        latlng: `${latitude},${longitude}`,
        key: config.GOOGLE_MAP_API_KEY,
      },
      timeout: 10000, // 10 second timeout
    });

    // Handle Google Maps API response
    if (response.data.status !== 'OK') {
      return res.status(400).json({
        success: false,
        error: `Google Maps API error: ${response.data.status}`,
        message: response.data.error_message || 'Unknown error',
      });
    }

    if (!response.data.results || response.data.results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No results found for the provided coordinates',
      });
    }

    // Extract address components from the first result
    const result = response.data.results[0];
    const addressComponents = result.address_components;

    // Initialize location data
    const locationData = {
      city: null,
      state: null,
      country: null,
      postal_code: null,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
    };

    // Extract city, state, and country from address components
    addressComponents.forEach((component) => {
      const types = component.types;

      // City (locality or sublocality)
      if (types.includes('locality')) {
        locationData.city = component.long_name;
      } else if (types.includes('sublocality') && !locationData.city) {
        locationData.city = component.long_name;
      }

      // State/Province (administrative_area_level_1)
      if (types.includes('administrative_area_level_1')) {
        locationData.state = component.long_name;
      }

      // Country
      if (types.includes('country')) {
        locationData.country = component.long_name;
      }

      if (types.includes('postal_code')) {

        locationData.postal_code = component.long_name;
      }
    });

    // Return successful response
    return res.json({
      success: true,
      data: {
        // addressComponents,
        coordinates: {
          latitude: latitude,
          longitude: longitude,
        },
        location: locationData,
      },
    });
  } catch (error) {
    console.error('Geocoding error:', error);

    // Handle different types of errors
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        error: 'Request timeout - Google Maps API did not respond in time',
      });
    }

    if (error.response) {
      // Google Maps API returned an error response
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'External API error',
        message: error.response.data?.error_message || error.message,
      });
    }

    // General server error
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
