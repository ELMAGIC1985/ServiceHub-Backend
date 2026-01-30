import { Router } from 'express';
import { getFullAddressFromLAtLong } from '../../controllers/google/google.controller.js';
import AddressSearchController from '../../controllers/google/AddressSearchController.js';

const router = Router();
const addressController = new AddressSearchController();

router.route('/location').get(getFullAddressFromLAtLong);

router.get('/search', addressController.searchAddresses);
router.get('/place/:placeId', addressController.getPlaceDetails);
router.get('/reverse-geocode', addressController.reverseGeocode);
router.get('/nearby', addressController.getNearbyPlaces);
router.get('/distance', addressController.getDistanceMatrix);

export default router;
