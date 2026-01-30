import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../../config/firebaseConfig';

export const customUpload = ({ file, onProgress, onSuccess, onError }, folder = 'images') => {
  // Validate file type
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    onError(new Error('You can only upload image files!'));
    return;
  }

  // Validate file size (5MB limit)
  const isLt5M = file.size / 1024 / 1024 < 5;
  if (!isLt5M) {
    onError(new Error('Image must be smaller than 5MB!'));
    return;
  }

  // Generate unique filename
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const storageRef = ref(storage, `${folder}/${fileName}`);

  // Start upload
  const uploadTask = uploadBytesResumable(storageRef, file);

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      // Progress callback
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress({ percent: Math.round(progress) });
    },
    (error) => {
      // Error callback
      console.error('Upload error:', error);
      onError(error);
    },
    async () => {
      // Success callback
      try {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        onSuccess(downloadURL, file);
      } catch (error) {
        onError(error);
      }
    }
  );

  // Return abort function for cancellation
  return () => {
    uploadTask.cancel();
  };
};
