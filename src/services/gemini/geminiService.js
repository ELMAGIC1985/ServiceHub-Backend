import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    // It's good practice to ensure the API key is set.
    // Use a more descriptive error message.
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set. Please provide your API key.');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async enhancePrompt(userPrompt) {
    try {
      console.log('🔍 Enhancing prompt with Gemini...');

      // Specify the model directly to avoid unnecessary API calls for listing models.
      // 'gemini-pro' is a great choice for text-based tasks like this.
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-preview-image-generation' });

      const enhancementPrompt = `
      You are an expert at creating detailed, artistic prompts for AI image generation.
      Transform this simple user prompt into a detailed, vivid description that includes:

      - Artistic style and technique (oil painting, watercolor, digital art, etc.)
      - Lighting and atmosphere (golden hour, dramatic shadows, soft lighting, etc.)
      - Color palette and mood (vibrant colors, muted tones, specific color schemes)
      - Composition and perspective (close-up, wide shot, bird's eye view, etc.)
      - Specific details and textures (rough, smooth, glossy, matte, etc.)
      - Environmental elements (background, setting, weather, time of day)

      Keep it under 150 words and focus only on visual elements.
      Make it artistic and detailed but not overly complex.

      User prompt: "${userPrompt}"

      Enhanced artistic prompt:`;

      // Use the model to generate content based on the prompt.
      const result = await model.generateContent(enhancementPrompt);
      const response = result.response;
      const enhancedText = response.text().trim();

      console.log(`✨ Prompt enhanced: "${userPrompt}" -> "${enhancedText.substring(0, 100)}..."`);
      return enhancedText;
    } catch (error) {
      console.error('❌ Error enhancing prompt with Gemini:', error);
      // It's good to return the original prompt or throw an error
      // if the enhancement fails. Returning the original prompt is
      // a graceful fallback.
      return userPrompt;
    }
  }

  async generateAsciiArt(prompt) {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const asciiPrompt = `
      Create detailed ASCII art based on this description: "${prompt}"

      Requirements:
      - Use only standard ASCII characters (letters, numbers, symbols)
      - Make it detailed and recognizable
      - Size should be approximately 60 characters wide and 20-25 lines tall
      - Focus on the main subject described in the prompt
      - Use different characters to show depth and shading
      - Make it visually appealing and artistic

      Only return the ASCII art, no explanations:`;

      const result = await model.generateContent(asciiPrompt);
      const response = result.response;
      const asciiArt = response.text().trim();

      console.log(`🎨 ASCII art generated for: "${prompt}"`);
      return asciiArt;
    } catch (error) {
      console.error('❌ Error generating ASCII art:', error);
      // It's better to throw a new error with a clear message
      // so the calling function can handle it.
      throw new Error('Failed to generate ASCII art');
    }
  }
}

export default new GeminiService();
