import { OpusDecoder } from 'opus-decoder';
import { logger } from './logger.js';

class BackendOpusDecoder {
    constructor() {
        this.decoders = new Map(); // key (callId:audioType) -> decoder instance
    }

    // Initialize decoder for a call
    async initializeDecoder(callId, sampleRate = 48000, channels = 1, audioType = 'mic') {
        try {
            const key = `${callId}:${audioType}`;
            if (this.decoders.has(key)) {
                logger.debug(`Decoder already exists for call ${callId} (${audioType})`);
                return;
            }

            const decoder = new OpusDecoder({
                sampleRate,
                channels,
                preSkip: 0
            });

            // Wait for decoder to be ready
            await decoder.ready;
            
            this.decoders.set(key, decoder);
            logger.info(`Opus decoder initialized for call ${callId} (${audioType}) - SampleRate: ${sampleRate}, Channels: ${channels}`);
        } catch (error) {
            logger.error(`Error initializing Opus decoder for call ${callId}:`, error);
        }
    }

    // Decode Opus data to PCM
    async decodeOpusData(callId, opusData, audioType = 'mic') {
        try {
            const key = `${callId}:${audioType}`;
            let decoder = this.decoders.get(key);
            if (!decoder) {
                logger.warn(`No decoder found for call ${callId} (${audioType}), initializing...`);
                await this.initializeDecoder(callId, undefined, undefined, audioType);
                decoder = this.decoders.get(key);
                if (!decoder) {
                    logger.error(`Failed to initialize decoder for call ${callId} (${audioType})`);
                    return null;
                }
            }
            
            const decodedData = decoder.decodeFrame(opusData);
            
            if (!decodedData || decodedData.channelData.length === 0) {
                logger.debug(`No decoded data for call ${callId} (${audioType})`);
                return null;
            }

            // Convert Float32Array to Int16 PCM for OpenAI
            const pcmData = this.convertFloat32ToInt16(decodedData.channelData[0]);
            
            logger.debug(`Opus decoded for call ${callId} (${audioType}): ${pcmData.length} samples`);
            return pcmData;
        } catch (error) {
            logger.error(`Error decoding Opus data for call ${callId} (${audioType}):`, error);
            return null;
        }
    }

    // Convert Float32Array to Int16 PCM
    convertFloat32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            // Convert from [-1, 1] to [-32768, 32767]
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = Math.round(sample * 32767);
        }
        return int16Array;
    }

    // Cleanup decoders for a call (all streams)
    cleanupDecoder(callId) {
        try {
            // Remove any decoders whose key starts with `${callId}:`
            for (const [key, decoder] of this.decoders.entries()) {
                if (key.startsWith(`${callId}:`)) {
                    try { decoder.free(); } catch {}
                    this.decoders.delete(key);
                    logger.info(`Opus decoder cleaned up for call ${callId} (key=${key})`);
                }
            }
        } catch (error) {
            logger.error(`Error cleaning up decoder for call ${callId}:`, error);
        }
    }

    // Cleanup all decoders
    cleanup() {
        for (const [callId, decoder] of this.decoders.entries()) {
            try {
                decoder.free();
                logger.info(`Opus decoder cleaned up for call ${callId}`);
            } catch (error) {
                logger.error(`Error cleaning up decoder for call ${callId}:`, error);
            }
        }
        this.decoders.clear();
    }
}

export default BackendOpusDecoder;
