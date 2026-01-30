import multer from 'multer';
import path from 'path';
import { bucket } from '../../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

const uploadSingleFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate unique filename
    const fileName = `images/${uuidv4()}-${req.file.originalname}`;

    // Create file reference in Firebase Storage
    const file = bucket.file(fileName);

    // Create write stream
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(), // For public access
        },
      },
    });

    // Handle stream events
    stream.on('error', (err) => {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to upload file' });
    });

    stream.on('finish', async () => {
      try {
        // Make file publicly accessible
        await file.makePublic();

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        res.status(200).json({
          message: 'File uploaded successfully',
          fileName: fileName,
          url: publicUrl,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
      } catch (error) {
        console.error('Error making file public:', error);
        res.status(500).json({ error: 'File uploaded but failed to make public' });
      }
    });

    // Write file buffer to stream
    stream.end(req.file.buffer);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadMultipleFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const fileName = `images/${uuidv4()}-${file.originalname}`;
      const fileRef = bucket.file(fileName);

      return new Promise((resolve, reject) => {
        const stream = fileRef.createWriteStream({
          metadata: {
            contentType: file.mimetype,
            metadata: {
              firebaseStorageDownloadTokens: uuidv4(),
            },
          },
        });

        stream.on('error', reject);
        stream.on('finish', async () => {
          try {
            await fileRef.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            resolve({
              fileName,
              url: publicUrl,
              size: file.size,
              mimetype: file.mimetype,
            });
          } catch (error) {
            reject(error);
          }
        });

        stream.end(file.buffer);
      });
    });

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: results,
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
};

// Delete image endpoint
// app.delete('/delete/:fileName', async (req, res) => {
//   try {
//     const fileName = req.params.fileName;
//     const file = bucket.file(`images/${fileName}`);

//     await file.delete();

//     res.status(200).json({
//       message: 'File deleted successfully',
//       fileName: fileName,
//     });
//   } catch (error) {
//     console.error('Delete error:', error);
//     res.status(500).json({ error: 'Failed to delete file' });
//   }
// });

// // Get file metadata endpoint
// app.get('/metadata/:fileName', async (req, res) => {
//   try {
//     const fileName = req.params.fileName;
//     const file = bucket.file(`images/${fileName}`);

//     const [metadata] = await file.getMetadata();

//     res.status(200).json({
//       metadata: metadata,
//     });
//   } catch (error) {
//     console.error('Metadata error:', error);
//     res.status(404).json({ error: 'File not found' });
//   }
// });

export { uploadSingleFile, uploadMultipleFiles, upload, bucket };
