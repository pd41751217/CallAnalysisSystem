import { CallController } from '../controllers/CallController.js';
import { realtimeTranscriptionService } from './realtimeTranscriptionService.js';

/**
 * Speech-to-Text Service for Real-time Audio Processing
 * 
 * This service handles:
 * - Real-time transcript streaming
 * - Speaker identification
 */
export class SpeechToTextService {
  constructor() {
    this.realtimeTranscriptionStarted = new Map(); // callId -> Set of audio types
    this.audioSource = this.getAudioSourceConfig();
  }

  /**
   * Get audio source configuration from environment variable
   * @returns {Object} Audio source configuration
   */
  getAudioSourceConfig() {
    const audioSourceEnv = process.env.AUDIO_SOURCE || '3';
    const audioSource = parseInt(audioSourceEnv);
    
    const config = {
      mic: false,
      speaker: false,
      both: false
    };
    
    if (audioSource === 1) {
        config.mic = true;
    } else if (audioSource === 2) {
        config.speaker = true;
    } else if (audioSource === 3) {
        config.both = true;
        config.mic = true;
        config.speaker = true;
    }
    
    return config;
  }

  /**
   * Check if audio type should be processed based on AUDIO_SOURCE setting
   * @param {string} audioType - Audio type ('mic' or 'speaker')
   * @returns {boolean} Whether to process this audio type
   */
  shouldProcessAudioType(audioType) {
    if (audioType === 'mic') {
      return this.audioSource.mic;
    } else if (audioType === 'speaker') {
      return this.audioSource.speaker;
    }
    return false;
  }

  /**
   * Process incoming audio data from C++ client
   * @param {string} callId - Call identifier
   * @param {Object} audioData - Audio data object
   */
  async processAudioData(callId, audioData) {
    try {
      const { audioType } = audioData;
      
      if (!this.shouldProcessAudioType(audioType)) {
        return;
      }
      
        if (!this.realtimeTranscriptionStarted.has(callId)) {
          this.realtimeTranscriptionStarted.set(callId, new Set());
        }
        
        const startedTypes = this.realtimeTranscriptionStarted.get(callId);
        
        if (!startedTypes.has(audioType)) {
          startedTypes.add(audioType);
          await this.startRealtimeTranscription(callId, audioType);
        }
        
        await realtimeTranscriptionService.processAudioData(callId, audioData);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Handle transcript data from real-time transcription
   * @param {string} callId - Call identifier
   * @param {string} audioType - Audio type ('mic' or 'speaker')
   * @param {Object} transcript - Transcript data
   */
  async handleTranscript(callId, audioType, transcript) {
    try {
      const speaker = audioType === 'mic' ? 'agent' : 'customer';
      const transcriptData = {
        callId,
        speaker,
        text: transcript.text,
        confidence: transcript.confidence || 0.95,
        timestamp: new Date().toISOString(),
        audioType
      };

      await this.sendTranscriptToClient(callId, transcriptData);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Send transcript data to client via CallController
   * @param {string} callId - Call identifier
   * @param {Object} transcriptData - Transcript data
   */
  async sendTranscriptToClient(callId, transcriptData) {
    try {
      await CallController.handleTranscript(callId, transcriptData);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Start real-time transcription for a specific audio type
   * @param {string} callId - Call identifier
   * @param {string} audioType - Audio type ('mic' or 'speaker')
   */
  async startRealtimeTranscription(callId, audioType) {
    try {
      await realtimeTranscriptionService.startTranscription(
        callId,
        (transcript) => this.handleTranscript(callId, audioType, transcript),
        (error) => {
                // Silent error handling
        },
        audioType
      );
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Stop real-time transcription for a call
   * @param {string} callId - Call identifier
   */
  stopRealtimeTranscription(callId) {
    try {
      realtimeTranscriptionService.stopTranscription(callId);
      this.realtimeTranscriptionStarted.delete(callId);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Clean up resources for a call
   * @param {string} callId - Call identifier
   */
  cleanup(callId) {
    try {
      realtimeTranscriptionService.stopTranscription(callId);
      this.realtimeTranscriptionStarted.delete(callId);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Set up transcript callback for a call
   * @param {string} callId - Call identifier
   * @param {Function} callback - Callback function for transcripts
   */
  onTranscript(callId, callback) {
    // This method is kept for compatibility but not used in real-time mode
  }
}

// Create singleton instance
export const speechToTextService = new SpeechToTextService();