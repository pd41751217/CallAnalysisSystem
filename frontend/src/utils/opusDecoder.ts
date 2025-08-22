// Opus decoder utility for frontend
// Note: This is a simplified implementation since we don't have a native Opus decoder in the browser
// We'll use Web Audio API to handle the decoded audio

export interface OpusAudioPacket {
  data: Uint8Array;
  timestamp: number;
  isMic: boolean;
}

export class OpusDecoder {
  private audioContext: AudioContext;
  private sampleRate: number;
  private channels: number;
  
  constructor(audioContext: AudioContext, sampleRate: number = 48000, channels: number = 1) {
    this.audioContext = audioContext;
    this.sampleRate = sampleRate;
    this.channels = channels;
  }
  
  // Decode Opus packet to PCM audio
  async decodeOpusPacket(opusData: Uint8Array): Promise<Float32Array> {
    try {
      // Since we don't have a native Opus decoder in the browser,
      // we'll use a workaround by treating the Opus data as compressed audio
      // and using Web Audio API's decodeAudioData with a custom format
      

      // Create a simple PCM-like buffer from Opus data
      // This is a simplified approach - in a real implementation, you'd need a proper Opus decoder
      const decodedSamples = this.simplifiedOpusDecode(opusData);
      
      return decodedSamples;
    } catch (error) {
      console.error('Error decoding Opus packet:', error);
      return new Float32Array(0);
    }
  }
  
  // Simplified Opus decoding (placeholder implementation)
  private simplifiedOpusDecode(opusData: Uint8Array): Float32Array {
    // This is a placeholder implementation
    // In a real scenario, you would:
    // 1. Use a WebAssembly Opus decoder
    // 2. Or send the Opus data to a server for decoding
    // 3. Or use a native browser API if available
    
    // For now, we'll create a simple audio buffer from the Opus data
    // This is not proper decoding, but it allows us to test the pipeline
    
    const frameSize = 480; // 10ms at 48kHz
    const decodedSamples = new Float32Array(frameSize);
    
    // Simple conversion: use the first few bytes as audio samples
    for (let i = 0; i < Math.min(frameSize, opusData.length); i++) {
      // Convert byte to float sample (-1 to 1)
      decodedSamples[i] = (opusData[i] - 128) / 128.0;
    }
    
    return decodedSamples;
  }
  
  // Create audio buffer from decoded samples
  createAudioBuffer(decodedSamples: Float32Array): AudioBuffer {
    const audioBuffer = this.audioContext.createBuffer(
      this.channels,
      decodedSamples.length,
      this.sampleRate
    );
    
    // Fill the buffer with decoded samples
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < decodedSamples.length; i++) {
      channelData[i] = decodedSamples[i];
    }
    
    return audioBuffer;
  }
  
  // Process Opus packet and return audio buffer
  async processOpusPacket(opusData: Uint8Array): Promise<AudioBuffer | null> {
    try {
      const decodedSamples = await this.decodeOpusPacket(opusData);
      if (decodedSamples.length > 0) {
        return this.createAudioBuffer(decodedSamples);
      }
      return null;
    } catch (error) {
      console.error('Error processing Opus packet:', error);
      return null;
    }
  }
}

// Utility function to detect if data is Opus-encoded
export function isOpusEncoded(data: Uint8Array): boolean {
  // Opus packets typically have a specific size range and pattern
  // This is a simplified detection method
  
  if (data.length < 10) return false;
  
  // Check for common Opus packet sizes (10ms frames at different bitrates)
  const commonSizes = [13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85, 89, 93, 97, 101, 105, 109, 113, 117, 121, 125, 129, 133, 137, 141, 145, 149, 153, 157, 161, 165, 169, 173, 177, 181, 185, 189, 193, 197, 201, 205, 209, 213, 217, 221, 225, 229, 233, 237, 241, 245, 249, 253, 257, 261, 265, 269, 273, 277, 281, 285, 289, 293, 297, 301, 305, 309, 313, 317, 321, 325, 329, 333, 337, 341, 345, 349, 353, 357, 361, 365, 369, 373, 377, 381, 385, 389, 393, 397, 401, 405, 409, 413, 417, 421, 425, 429, 433, 437, 441, 445, 449, 453, 457, 461, 465, 469, 473, 477, 481, 485, 489, 493, 497, 501, 505, 509, 513, 517, 521, 525, 529, 533, 537, 541, 545, 549, 553, 557, 561, 565, 569, 573, 577, 581, 585, 589, 593, 597, 601, 605, 609, 613, 617, 621, 625, 629, 633, 637, 641, 645, 649, 653, 657, 661, 665, 669, 673, 677, 681, 685, 689, 693, 697, 701, 705, 709, 713, 717, 721, 725, 729, 733, 737, 741, 745, 749, 753, 757, 761, 765, 769, 773, 777, 781, 785, 789, 793, 797, 801, 805, 809, 813, 817, 821, 825, 829, 833, 837, 841, 845, 849, 853, 857, 861, 865, 869, 873, 877, 881, 885, 889, 893, 897, 901, 905, 909, 913, 917, 921, 925, 929, 933, 937, 941, 945, 949, 953, 957, 961, 965, 969, 973, 977, 981, 985, 989, 993, 997];
  
  return commonSizes.includes(data.length) || data.length < 1000;
}

// Utility function to convert base64 to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
