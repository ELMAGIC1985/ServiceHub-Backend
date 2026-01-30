import multer from 'multer'

// Configure multer storage to store files in memory
const storage = multer.memoryStorage()

// Create the multer instance
const upload = multer({ storage: storage })

// Middleware to handle multiple file uploads (for 'documentImage' and 'selfieImage')
const uploadKycImages = upload.fields([
    { name: 'documentImage', maxCount: 1 },
    { name: 'selfieImage', maxCount: 1 }
])

// Export the middleware to use in routes
export default uploadKycImages
