// Server-side Firebase upload function for buffers/files
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { GoogleGenAI, Modality } from '@google/genai';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { storage } from '../../config/firebaseConfig.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server-side upload function for buffers (no temp file needed)
export const uploadBufferToFirebase = async (buffer, fileName, userId, folder = 'generated-images') => {
  try {
    // Generate unique filename with user context
    const timestamp = Date.now();
    const uniqueFileName = userId ? `${userId}/${timestamp}_${fileName}` : `${timestamp}_${fileName}`;

    // Create storage reference
    const storageRef = ref(storage, `${folder}/${uniqueFileName}`);

    // Upload the buffer directly
    const snapshot = await uploadBytes(storageRef, buffer, {
      contentType: 'image/png',
    });

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log(`✅ Image uploaded to Firebase: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error('❌ Firebase upload failed:', error);
    throw error;
  }
};

// Updated generateImage function using the new upload function
export const generateImage = async (req, res, next) => {
  try {
    const { prompt, userId, generateAscii = false } = req.body;

    // Validation
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and cannot be empty',
      });
    }

    if (prompt.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is too long. Maximum 500 characters allowed.',
      });
    }

    console.log(`🎨 Generating image for prompt: "${prompt}"`);

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Use the actual prompt from request instead of hardcoded one
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    let imageData = null;
    let textResponse = '';
    let firebaseUrl = '';
    let localFileName = '';

    // Process the response parts
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        textResponse = part.text;
        console.log(`💬 Gemini says: ${part.text}`);
      } else if (part.inlineData) {
        imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, 'base64');

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substr(2, 9);
        localFileName = `gemini-${timestamp}-${randomString}.png`;

        try {
          // Upload to Firebase Storage directly from buffer
          console.log(`☁️  Uploading to Firebase Storage...`);
          firebaseUrl = await uploadBufferToFirebase(buffer, localFileName, userId);
          console.log(`✅ Image uploaded to Firebase: ${firebaseUrl}`);
        } catch (uploadError) {
          console.error('❌ Firebase upload failed:', uploadError);
          // Fallback: save locally and create local URL
          const tempFilePath = path.join(process.cwd(), 'temp', localFileName);
          const tempDir = path.dirname(tempFilePath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          fs.writeFileSync(tempFilePath, buffer);
          firebaseUrl = `${req.protocol}://${req.get('host')}/api/temp/${localFileName}`;
          console.log(`🔄 Using fallback local URL: ${firebaseUrl}`);
        }
      }
    }

    if (!imageData) {
      return res.status(500).json({
        success: false,
        error: 'No image data received from Gemini',
      });
    }

    // Save to database with Firebase URL (commented out in your original)
    // const imageGeneration = new ImageGeneration({
    //   originalPrompt: prompt,
    //   enhancedPrompt: prompt,
    //   imageUrl: firebaseUrl,
    //   imageFileName: localFileName,
    //   model: 'gemini-2.0-flash-preview-image-generation',
    //   resultType: 'image',
    //   userId: userId,
    //   metadata: {
    //     mimeType: 'image/png',
    //     fileSize: Buffer.from(imageData, 'base64').length,
    //     firebaseUrl: firebaseUrl,
    //   },
    //   geminiResponse: textResponse,
    // });
    // await imageGeneration.save();
    // console.log(`✅ Image generated and saved with ID: ${imageGeneration._id}`);

    res.status(201).json({
      success: true,
      data: firebaseUrl,
      metadata: {
        fileName: localFileName,
        mimeType: 'image/png',
        size: Buffer.from(imageData, 'base64').length,
      },
      message: 'Image generated successfully',
    });
  } catch (error) {
    console.error('❌ Error in generateImage:', error);
    next(error);
  }
};
