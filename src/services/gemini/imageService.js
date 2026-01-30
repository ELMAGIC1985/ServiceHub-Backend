import geminiService from './geminiService.js';

class ImageService {
  constructor() {
    this.baseImageUrl = 'https://image.pollinations.ai/prompt';
  }

  async generateImageUrl(enhancedPrompt) {
    try {
      const encodedPrompt = encodeURIComponent(enhancedPrompt);
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `${this.baseImageUrl}/${encodedPrompt}?width=512&height=512&model=flux&seed=${seed}&enhance=true`;

      // Verify the image URL is accessible
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Image generation service returned status: ${response.status}`);
      }

      console.log(`🖼️  Image generated with seed: ${seed}`);
      return {
        url: imageUrl,
        metadata: {
          width: 512,
          height: 512,
          seed: seed,
        },
      };
    } catch (error) {
      console.error('❌ Error generating image:', error);
      throw new Error('Failed to generate image');
    }
  }

  async generateContent(prompt, generateAscii = false) {
    try {
      // Step 1: Enhance prompt with Gemini
      const enhancedPrompt = await geminiService.enhancePrompt(prompt);

      let result;

      if (generateAscii) {
        // Generate ASCII art using Gemini
        const asciiArt = await geminiService.generateAsciiArt(enhancedPrompt);
        result = {
          url: `data:text/plain;charset=utf-8,${encodeURIComponent(asciiArt)}`,
          type: 'ascii',
          model: 'gemini-ascii',
          metadata: {},
        };
      } else {
        // Generate actual image
        const imageData = await this.generateImageUrl(enhancedPrompt);
        result = {
          url: imageData.url,
          type: 'image',
          model: 'gemini-enhanced',
          metadata: imageData.metadata,
        };
      }

      return {
        originalPrompt: prompt,
        enhancedPrompt: enhancedPrompt,
        ...result,
      };
    } catch (error) {
      console.error('❌ Error in content generation:', error);
      throw error;
    }
  }
}

export default new ImageService();
