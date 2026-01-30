import axios from 'axios';
import config from '../../config/config.js';

class AddressSearchController {
  constructor() {
    this.googleApiKey = config.GOOGLE_MAP_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';

    if (!this.googleApiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
    }
  }

  searchAddresses = async (req, res) => {
    try {
      const {
        query,
        location,
        radius = 50000,
        types,
        language = 'en',
        components = '',
        sessiontoken,
        includeCoordinates = true,
      } = req.query;

      // Enhanced validation
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Query must be a string with at least 2 characters',
          data: [],
        });
      }

      // Log the search attempt for debugging
      console.log('Search attempt:', {
        query: query.trim(),
        location,
        includeCoordinates,
        hasApiKey: !!this.googleApiKey,
        apiKeyLength: this.googleApiKey ? this.googleApiKey.length : 0,
      });

      const params = {
        input: query.trim(),
        key: this.googleApiKey,
        language: language,
      };

      // Don't set types if not specified - let Google return all relevant results
      if (types) {
        params.types = types;
      }

      // Add session token for better billing (recommended by Google)
      if (sessiontoken) {
        params.sessiontoken = sessiontoken;
      }

      // Add location bias if provided
      if (location && typeof location === 'string') {
        const locationParts = location.split(',');
        if (locationParts.length === 2) {
          const [lat, lng] = locationParts.map((coord) => parseFloat(coord.trim()));
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            params.location = `${lat},${lng}`;
            params.radius = Math.min(parseInt(radius) || 50000, 50000);
          }
        }
      }

      // Add country/region restrictions
      if (components && typeof components === 'string') {
        params.components = components;
      }

      console.log('API Request params:', {
        ...params,
        key: params.key ? `${params.key.substring(0, 10)}...` : 'MISSING',
      });

      const response = await axios.get(`${this.baseUrl}/place/autocomplete/json`, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'AddressSearchAPI/1.0',
        },
      });

      console.log('Google API Response:', {
        status: response.data.status,
        predictionsCount: response.data.predictions ? response.data.predictions.length : 0,
        errorMessage: response.data.error_message,
      });

      // Handle different response statuses
      if (response.data.status === 'ZERO_RESULTS') {
        return res.json({
          success: true,
          message: 'No addresses found for the given query',
          data: [],
          count: 0,
          debug: {
            status: response.data.status,
            query: query.trim(),
          },
        });
      }

      if (response.data.status !== 'OK') {
        console.error('Google Places API Error:', {
          status: response.data.status,
          errorMessage: response.data.error_message,
        });

        return res.status(400).json({
          success: false,
          message: `Google Places API error: ${response.data.status}`,
          error: response.data.error_message || 'Unknown error',
          data: [],
        });
      }

      let formattedResults = response.data.predictions.map((prediction) => ({
        placeId: prediction.place_id,
        formattedAddress: prediction.description,
        structuredFormatting: {
          mainText: prediction.structured_formatting?.main_text || '',
          secondaryText: prediction.structured_formatting?.secondary_text || '',
        },
        // types: prediction.types || [],
        // matchedSubstrings: prediction.matched_substrings || [],
        // distanceMeters: prediction.distance_meters || null,
        // terms: prediction.terms || [],
      }));

      // If coordinates are requested, fetch them using Place Details API
      if (includeCoordinates === 'true' || includeCoordinates === true) {
        console.log('Fetching coordinates for', formattedResults.length, 'places');

        const coordinatePromises = formattedResults.map(async (result) => {
          try {
            const detailsResponse = await axios.get(`${this.baseUrl}/place/details/json`, {
              params: {
                place_id: result.placeId,
                fields: 'geometry,formatted_address',
                key: this.googleApiKey,
                sessiontoken: sessiontoken, // Use same session token
              },
              timeout: 5000,
            });

            if (detailsResponse.data.status === 'OK' && detailsResponse.data.result?.geometry?.location) {
              return {
                ...result,
                coordinates: {
                  lat: detailsResponse.data.result.geometry.location.lat,
                  lng: detailsResponse.data.result.geometry.location.lng,
                },
                // formattedAddress:  result.description,
              };
            } else {
              console.warn(`Failed to get coordinates for place_id: ${result.placeId}`, detailsResponse.data.status);
              return {
                ...result,
                coordinates: null,
                coordinateError: detailsResponse.data.status || 'Unknown error',
              };
            }
          } catch (error) {
            console.error(`Error fetching coordinates for place_id: ${result.placeId}`, error.message);
            return {
              ...result,
              coordinates: null,
              coordinateError: 'API request failed',
            };
          }
        });

        // Wait for all coordinate requests to complete
        try {
          formattedResults = await Promise.all(coordinatePromises);
        } catch (error) {
          console.error('Error fetching coordinates:', error.message);
          // Continue with results without coordinates
        }
      }

      res.json({
        success: true,
        message: 'Addresses fetched successfully',
        data: formattedResults,
        count: formattedResults.length,
        debug:
          process.env.NODE_ENV === 'development'
            ? {
                status: response.data.status,
                apiKeyUsed: !!this.googleApiKey,
                queryProcessed: query.trim(),
                coordinatesFetched: includeCoordinates === 'true' || includeCoordinates === true,
              }
            : undefined,
      });
    } catch (error) {
      console.error('Address search error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });

      // Handle specific error types
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'Unable to connect to Google Places API',
          error: 'Network connectivity issue',
        });
      }

      if (error.response?.status === 403) {
        return res.status(403).json({
          success: false,
          message: 'Google API key authentication failed',
          error: 'Invalid or restricted API key',
        });
      }

      if (error.response?.status === 429) {
        return res.status(429).json({
          success: false,
          message: 'Google API quota exceeded',
          error: 'Rate limit or quota exceeded',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to search addresses',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        debug:
          process.env.NODE_ENV === 'development'
            ? {
                errorType: error.constructor.name,
                apiKeyExists: !!this.googleApiKey,
              }
            : undefined,
      });
    }
  };
  /**
   * Get detailed information about a specific place
   */
  getPlaceDetails = async (req, res) => {
    try {
      const { placeId } = req.params;
      const { fields = 'formatted_address,geometry,name,place_id,types' } = req.query;

      if (!placeId) {
        return res.status(400).json({
          success: false,
          message: 'Place ID is required',
        });
      }

      const response = await axios.get(`${this.baseUrl}/place/details/json`, {
        params: {
          place_id: placeId,
          fields: fields,
          key: this.googleApiKey,
        },
        timeout: 5000,
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      const place = response.data.result;
      const formattedPlace = {
        placeId: place.place_id,
        name: place.name,
        formattedAddress: place.formatted_address,
        geometry: {
          location: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          },
        },
        types: place.types,
      };

      res.json({
        success: true,
        message: 'Place details fetched successfully',
        data: formattedPlace,
      });
    } catch (error) {
      console.error('Place details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch place details',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  };

  reverseGeocode = async (req, res) => {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          message: 'Valid latitude and longitude are required',
        });
      }

      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          latlng: `${lat},${lng}`,
          key: this.googleApiKey,
        },
        timeout: 5000,
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Geocoding API error: ${response.data.status}`);
      }

      const results = response.data.results.map((result) => ({
        placeId: result.place_id,
        formattedAddress: result.formatted_address,
        geometry: {
          location: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          },
        },
        types: result.types,
        addressComponents: result.address_components.map((component) => ({
          longName: component.long_name,
          shortName: component.short_name,
          types: component.types,
        })),
      }));

      res.json({
        success: true,
        message: 'Reverse geocoding successful',
        data: results,
        count: results.length,
      });
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reverse geocode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  };

  getNearbyPlaces = async (req, res) => {
    try {
      const { lat, lng, radius = 5000, type = 'restaurant', keyword = '', minprice = '', maxprice = '' } = req.query;

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          message: 'Valid latitude and longitude are required',
        });
      }

      const params = {
        location: `${lat},${lng}`,
        radius: Math.min(radius, 50000), // Max 50km
        type: type,
        key: this.googleApiKey,
      };

      if (keyword) params.keyword = keyword;
      if (minprice) params.minprice = minprice;
      if (maxprice) params.maxprice = maxprice;

      const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
        params,
        timeout: 5000,
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      const places = response.data.results.map((place) => ({
        placeId: place.place_id,
        name: place.name,
        vicinity: place.vicinity,
        geometry: {
          location: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          },
        },
        rating: place.rating || null,
        priceLevel: place.price_level || null,
        types: place.types,
        openingHours: place.opening_hours
          ? {
              openNow: place.opening_hours.open_now,
            }
          : null,
        photos: place.photos
          ? place.photos.slice(0, 3).map((photo) => ({
              photoReference: photo.photo_reference,
              width: photo.width,
              height: photo.height,
            }))
          : [],
      }));

      res.json({
        success: true,
        message: 'Nearby places fetched successfully',
        data: places,
        count: places.length,
      });
    } catch (error) {
      console.error('Nearby places error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch nearby places',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  };

  getDistanceMatrix = async (req, res) => {
    try {
      const { origins, destinations, mode = 'driving', units = 'metric' } = req.query;

      if (!origins || !destinations) {
        return res.status(400).json({
          success: false,
          message: 'Origins and destinations are required',
        });
      }

      const response = await axios.get(`${this.baseUrl}/distancematrix/json`, {
        params: {
          origins: origins,
          destinations: destinations,
          mode: mode, // driving, walking, bicycling, transit
          units: units,
          key: this.googleApiKey,
        },
        timeout: 10000,
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Distance Matrix API error: ${response.data.status}`);
      }

      const results = response.data.rows.map((row, rowIndex) => ({
        originIndex: rowIndex,
        elements: row.elements.map((element, colIndex) => ({
          destinationIndex: colIndex,
          distance: element.distance
            ? {
                text: element.distance.text,
                value: element.distance.value,
              }
            : null,
          duration: element.duration
            ? {
                text: element.duration.text,
                value: element.duration.value,
              }
            : null,
          status: element.status,
        })),
      }));

      res.json({
        success: true,
        message: 'Distance matrix calculated successfully',
        data: {
          originAddresses: response.data.origin_addresses,
          destinationAddresses: response.data.destination_addresses,
          rows: results,
        },
      });
    } catch (error) {
      console.error('Distance matrix error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate distance matrix',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  };
}

export default AddressSearchController;
