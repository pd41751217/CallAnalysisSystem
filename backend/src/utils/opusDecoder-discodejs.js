import opus from '@discordjs/opus';
const { OpusEncoder } = opus;
import { logger } from './logger.js';

class BackendOpusDecoder {
    constructor() {
        this.decoders = new Map(); // key (callId:audioType) -> decoder instance
    }

    // Initialize decoder for a call (using @discordjs/opus OpusEncoder.decode)
    async initializeDecoder(callId, sampleRate = 48000, channels = 1, audioType = 'mic') {
        try {
            const key = `${callId}:${audioType}`;
            if (this.decoders.has(key)) {
                logger.debug(`Decoder already exists for call ${callId} (${audioType})`);
                return;
            }

            // OpusEncoder provides a decode(opusFrame) method as well
            const decoder = new OpusEncoder(sampleRate, channels);
            
            this.decoders.set(key, decoder);
            logger.debug(`@discordjs/opus decoder initialized for call ${callId} (${audioType}) - SampleRate: ${sampleRate}, Channels: ${channels}`);
        } catch (error) {
            logger.error(`Error initializing Opus decoder for call ${callId}:`, error);
        }
    }

    // Decode Opus data to PCM
    async decodeOpusData(callId, opusData, sampleRate, channels, audioType = 'mic') {
        try {
            const key = `${callId}:${audioType}`;
            let decoder = this.decoders.get(key);
            if (!decoder) {
                logger.warn(`No decoder found for call ${callId} (${audioType}), initializing...`);
                await this.initializeDecoder(callId, sampleRate, channels, audioType);
                decoder = this.decoders.get(key);
                if (!decoder) {
                    logger.error(`Failed to initialize decoder for call ${callId} (${audioType})`);
                    return null;
                }
            }
            
            // Decode returns PCM S16LE Buffer
            const decodedBuffer = decoder.decode(opusData);
            if (!decodedBuffer || decodedBuffer.length === 0) {
                logger.debug(`No decoded data for call ${callId} (${audioType})`);
                return null;
            }

            // Convert Buffer (S16LE) to Int16Array for downstream consumers
            const pcmData = new Int16Array(
                decodedBuffer.buffer,
                decodedBuffer.byteOffset,
                Math.floor(decodedBuffer.byteLength / 2)
            );
            
            // Enhanced logging to debug frame size issues (assume provided sampleRate)
            const sr = sampleRate || 48000;
            const expectedSamples = Math.floor(sr * 0.01); // ~10ms frame
            const actualSamples = pcmData.length;
            const frameDuration = actualSamples / sr; // Duration in seconds
            const speedRatio = expectedSamples / actualSamples;
            
            logger.debug(`Opus decoded for call ${callId} (${audioType}): ${actualSamples} samples (expected: ${expectedSamples}), duration: ${frameDuration.toFixed(3)}s, speed ratio: ${speedRatio.toFixed(2)}, inputLength: ${opusData.length}, sampleRate: ${sr}`);
            
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
                    this.decoders.delete(key);
                    logger.info(`@discordjs/opus decoder cleaned up for call ${callId} (key=${key})`);
                }
            }
        } catch (error) {
            logger.error(`Error cleaning up decoder for call ${callId}:`, error);
        }
    }

    // Cleanup all decoders
    cleanup() {
        for (const [callId] of this.decoders.entries()) {
            logger.info(`@discordjs/opus decoder cleaned up for call ${callId}`);
        }
        this.decoders.clear();
    }
}

export default BackendOpusDecoder;
