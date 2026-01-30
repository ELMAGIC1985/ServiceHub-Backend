import config from '../../../config/config.js';

export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${config.GOOGLE_MAP_API_KEY}`
    );

    const data = await response.json();

    // fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${config.GOOGLE_MAP_API_KEY}`, {
    //     method: 'POST'
    // })
    //     .then((response) => response.json())
    //     .then((data) => console.log('Accurate Location:', data))
    //     .catch((error) => console.error('Error:', error))

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];

      // Extract formatted address
      const formattedAddress = result.formatted_address;

      // Extract specific components
      let city, state, country, postalCode;
      result.address_components.forEach((component) => {
        if (component.types.includes('locality')) {
          city = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        } else if (component.types.includes('country')) {
          country = component.long_name;
        } else if (component.types.includes('postal_code')) {
          postalCode = component.long_name;
        }
      });

      return { formattedAddress, city, state, country, postalCode };
      // return result
    }

    throw new Error('No address found for given coordinates');
  } catch (error) {
    console.error('Error fetching address:', error.message);
    return null;
  }
};
