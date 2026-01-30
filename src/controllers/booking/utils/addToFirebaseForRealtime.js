import { firestore, firebaseAdmin } from '../../../config/firebase.js';

function serializeForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function addToFirebaseForRealtime({ eligibleVendors, serviceRequestDetails }) {
  try {
    const batch = firestore.batch();

    const serializedServiceRequest = serializeForFirestore(serviceRequestDetails);

    const requestId = serializedServiceRequest._id || serializedServiceRequest.id;
    const requestIdString = requestId.toString();

    const requestRef = firestore.collection('serviceRequests').doc(requestIdString);

    const mainDocData = {
      ...serializedServiceRequest,
      _id: requestIdString, // Ensure _id is string
      id: requestIdString, // Add id field as well
      status: 'broadcasting',
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };

    batch.set(requestRef, mainDocData);

    eligibleVendors.forEach((v) => {
      const vendorIdString = v.vendorId.toString();

      const vendorRequestRef = firestore
        .collection('vendorActiveRequests')
        .doc(vendorIdString)
        .collection('requests')
        .doc(requestIdString);

      const vendorDocData = {
        ...serializedServiceRequest,
        _id: requestIdString,
        broadcastedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        responseDeadline: new Date(Date.now() + 30 * 1000),
      };

      batch.set(vendorRequestRef, vendorDocData);
    });

    await batch.commit();

    console.log('✅ Service request broadcasted to Firebase:', requestIdString);
    console.log(`   → Notified ${eligibleVendors.length} vendors`);

    return {
      ...serializedServiceRequest,
      id: requestIdString,
      notifiedVendors: eligibleVendors.length,
    };
  } catch (error) {
    console.error('❌ Error broadcasting service request to Firebase:', error);
    console.error('Error details:', error);
    throw new Error(`Firebase broadcast failed: ${error.message}`);
  }
}

export default addToFirebaseForRealtime;
