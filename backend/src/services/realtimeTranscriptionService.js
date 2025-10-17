import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import BackendOpusDecoder from '../utils/opusDecoder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build a 44-byte WAV header for PCM16 LE data
function buildWavHeader(totalPcmBytes, sampleRate, channels) {
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const subchunk2Size = totalPcmBytes;
    const chunkSize = 36 + subchunk2Size;

    const buffer = Buffer.alloc(44);
    // RIFF chunk descriptor
    buffer.write('RIFF', 0);                                  // ChunkID
    buffer.writeUInt32LE(chunkSize, 4);                        // ChunkSize
    buffer.write('WAVE', 8);                                   // Format
    // fmt subchunk
    buffer.write('fmt ', 12);                                  // Subchunk1ID
    buffer.writeUInt32LE(16, 16);                              // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);                               // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(channels, 22);                        // NumChannels
    buffer.writeUInt32LE(sampleRate, 24);                      // SampleRate
    buffer.writeUInt32LE(byteRate, 28);                        // ByteRate
    buffer.writeUInt16LE(blockAlign, 32);                      // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34);                   // BitsPerSample
    // data subchunk
    buffer.write('data', 36);                                  // Subchunk2ID
    buffer.writeUInt32LE(subchunk2Size, 40);                   // Subchunk2Size
    return buffer;
}

class RealtimeTranscriptionService {
    constructor() {
        this.activeSessions = new Map(); // callId -> session info
        this.openaiConnections = new Map(); // callId -> OpenAI WebSocket
        this.micTranscriptionSessions = new Map(); // callId -> mic transcription session
        this.speakerTranscriptionSessions = new Map(); // callId -> speaker transcription session
        this.opusDecoder = new BackendOpusDecoder();
    }

    // Connect to OpenAI Realtime API for a specific call and audio type
    connectRealtimeSession(callId, audioType = 'mic') {
        // const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
        // const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

        // const openaiWs = new WebSocket(url, {
        //     headers: {
        //         Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        //         'OpenAI-Beta': 'realtime=v1',
        //     },
        // });
        
        const openaiWs = new WebSocket(
            "wss://api.openai.com/v1/realtime?intent=transcription",
            [
                "realtime",
                `openai-insecure-api-key.${process.env.OPENAI_API_KEY}`,
                "openai-beta.realtime-v1",
            ]
        );

        // Store connection based on audio type
        if (audioType === 'mic') {
            this.micTranscriptionSessions.set(callId, openaiWs);
        } else if (audioType === 'speaker') {
            this.speakerTranscriptionSessions.set(callId, openaiWs);
        }

        openaiWs.on('open', () => {
            logger.info(`OpenAI Realtime connection opened for call ${callId} (${audioType})`);
            this.configureSession(callId, openaiWs, audioType);
        });

        openaiWs.on('message', (data) => {
            this.handleOpenAIResponse(callId, data, audioType);
        });

        openaiWs.on('close', () => {
            logger.info(`OpenAI Realtime connection closed for call ${callId} (${audioType})`);
            if (audioType === 'mic') {
                this.micTranscriptionSessions.delete(callId);
            } else if (audioType === 'speaker') {
                this.speakerTranscriptionSessions.delete(callId);
            }
        });

        openaiWs.on('error', (error) => {
            logger.error(`OpenAI Realtime error for call ${callId} (${audioType}):`, error);
            if (audioType === 'mic') {
                this.micTranscriptionSessions.delete(callId);
            } else if (audioType === 'speaker') {
                this.speakerTranscriptionSessions.delete(callId);
            }
        });

        return openaiWs;
    }

    // Configure the OpenAI session for transcription
    configureSession(callId, openaiWs, audioType = 'mic') {
        const language = process.env.TRANSCRIPTION_LANGUAGE || 'en';
        const transcriptionModel = process.env.TRANSCRIPTION_MODEL || 'gpt-4o-transcribe';
        const vadThreshold = Number(process.env.VAD_THRESHOLD || 0.5);
        const vadPrefixPaddingMs = Number(process.env.VAD_PREFIX_PADDING_MS || 300);
        const vadSilenceDurationMs = Number(process.env.VAD_SILENCE_DURATION_MS || 500);
        const rate = Number(process.env.AUDIO_RATE || 24000);

        // Use clean transcription prompt without descriptive text
        const audioTypePrompt = process.env.TRANSCRIPTION_PROMPT || 'Transcribe the speech accurately.';

        // const sessionUpdate = {
        //     type: 'session.update',
        //     session: {
        //         // Configure transcription-only behavior
        //         model: transcriptionModel,
        //         input_audio_format: 'pcm16',
        //         input_audio_transcription: {
        //             model: transcriptionModel,
        //             language: 'en',
        //             prompt: audioTypePrompt
        //         },
        //         turn_detection: process.env.VAD_ENABLED === 'false' ? null : {
        //             type: 'server_vad',
        //             threshold: vadThreshold,
        //             prefix_padding_ms: vadPrefixPaddingMs,
        //             silence_duration_ms: vadSilenceDurationMs,
        //         }
        //     }
        // };
        const sessionUpdate = {
            type: "transcription_session.update",
            session: {
                input_audio_transcription: {
                    model: "gpt-4o-transcribe",
                    language: "en",
                },
                input_audio_noise_reduction: { type: "near_field" },
                turn_detection: {
                    type: "semantic_vad",
                    eagerness: "low",
                },
            },
        };

        this.safeSend(openaiWs, JSON.stringify(sessionUpdate));
        logger.info(`Session configured for call ${callId} (${audioType})`);
    }

    // Handle OpenAI responses and extract transcription
    handleOpenAIResponse(callId, data, audioType = 'mic') {
        try {
            const response = JSON.parse(data.toString());
            
            if (response.type === 'conversation.item.input_audio_buffer.speech_started') {
                logger.info(`Speech started for call ${callId} (${audioType})`);
            } else if (response.type === 'conversation.item.input_audio_buffer.speech_stopped') {
                logger.info(`Speech stopped for call ${callId} (${audioType})`);
            } else if (response.type === 'conversation.item.input_audio_transcription.delta') {
                // Handle partial transcription
                if (response.delta) {
                    logger.debug(`[TRANSCRIPTION] Call ${callId} (${audioType}): ${response.delta}`);
                    // Emit partial transcription with audio type
                    // this.emitTranscriptionUpdate(callId, {
                    //     type: 'partial',
                    //     text: response.delta,
                    //     audioType: audioType,
                    //     timestamp: new Date().toISOString()
                    // });
                }
            } else if (response.type === 'conversation.item.input_audio_transcription.completed') {
                // Handle completed transcription
                if (response.transcript) {
                    logger.info(`[FINAL TRANSCRIPT] Call ${callId} (${audioType}): ${response.transcript}`);
                    // Emit final transcription with audio type
                    this.emitTranscriptionUpdate(callId, {
                        type: 'final',
                        text: response.transcript,
                        audioType: audioType,
                        timestamp: new Date().toISOString()
                    });
                }
            } else if (response.type === 'error') {
                logger.error(`OpenAI error for call ${callId} (${audioType}):`, response.error);
            }
        } catch (error) {
            logger.error(`Error parsing OpenAI response for call ${callId} (${audioType}):`, error);
        }
    }

    // Emit transcription updates (to be implemented with Socket.IO integration)
    emitTranscriptionUpdate(callId, transcriptionData) {
        // This will be called by the WebRTC server to emit to clients
        // The actual emission will be handled by the WebRTC server
        logger.debug(`Transcription update for call ${callId}:`, transcriptionData);
    }

    // Send audio data to OpenAI for transcription
    async sendAudioData(callId, audioData, sampleRate = 24000, channels = 1, audioType = 'mic') {
        let openaiWs;
        
        // Get the appropriate WebSocket connection based on audio type
        if (audioType === 'mic') {
            openaiWs = this.micTranscriptionSessions.get(callId);
        } else if (audioType === 'speaker') {
            openaiWs = this.speakerTranscriptionSessions.get(callId);
        }
        
        if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
            logger.warn(`No active OpenAI connection for call ${callId} (${audioType})`);
            return;
        }

        try {
            // Initialize Opus decoder if not already done (per stream)
            await this.opusDecoder.initializeDecoder(callId, sampleRate, channels, audioType);
            
            // Convert base64 audio data to buffer
            let opusBuffer;
            if (typeof audioData === 'string') {
                opusBuffer = Buffer.from(audioData, 'base64');
            } else if (Buffer.isBuffer(audioData)) {
                opusBuffer = audioData;
            } else if (audioData instanceof Uint8Array) {
                opusBuffer = Buffer.from(audioData);
            } else {
                logger.error(`Unsupported audio data type: ${typeof audioData}`);
                return;
            }
            
            // Decode Opus data to PCM (per stream)
            const pcmData = await this.opusDecoder.decodeOpusData(callId, opusBuffer, audioType);
            if (!pcmData) {
                logger.warn(`[AUDIO DEBUG] No PCM data decoded for call ${callId} (${audioType})`);
                return;
            }
            
            // Ensure 16-bit alignment
            if (pcmData.length % 2 !== 0) {
                logger.warn(`PCM buffer length not 16-bit aligned for call ${callId}. Buffer Length: ${pcmData.length}`);
                return;
            }

            // Optionally save outgoing PCM to WAV file for debugging
            if (process.env.DEBUG_SAVE_OUTGOING_AUDIO === 'true') {
                try {
                    const session = this.activeSessions.get(callId) || {};
                    // Prepare debug directory and file path once per call
                    if (!session.debugAudioInitialized) {
                        const debugDir = path.join(__dirname, '../../uploads/audio/debug');
                        if (!fs.existsSync(debugDir)) {
                            fs.mkdirSync(debugDir, { recursive: true });
                        }
                        const debugFilePath = path.join(debugDir, `outgoing_call_${callId}.wav`);
                        // If file exists from a previous run, remove it to start fresh
                        if (fs.existsSync(debugFilePath)) {
                            try { fs.unlinkSync(debugFilePath); } catch {}
                        }
                        // Write placeholder WAV header (sizes will be fixed on finalize)
                        // We record mono (first channel only) in the WAV
                        const wavChannels = 1;
                        const placeholderHeader = buildWavHeader(0, sampleRate, wavChannels);
                        fs.writeFileSync(debugFilePath, placeholderHeader);

                        session.debugAudioInitialized = true;
                        session.debugAudioPath = debugFilePath;
                        session.debugBytesWritten = 0;
                        session.debugSampleRate = sampleRate;
                        session.debugChannels = 1;
                        this.activeSessions.set(callId, session);
                        logger.info(`Debug audio capture (WAV) enabled for call ${callId}: ${debugFilePath} (${sampleRate}Hz, 1ch, PCM16)`);
                    }
                    if (session.debugAudioPath) {
                        const pcmBuffer = Buffer.from(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
                        fs.appendFile(session.debugAudioPath, pcmBuffer, (err) => {
                            if (err) {
                                logger.error(`Failed appending debug audio for call ${callId}:`, err);
                            }
                        });
                        session.debugBytesWritten = (session.debugBytesWritten || 0) + pcmBuffer.length;
                        this.activeSessions.set(callId, session);
                    }
                } catch (dbgErr) {
                    logger.error(`Error during debug audio saving for call ${callId}:`, dbgErr);
                }
            }

            // Convert to base64 using the exact typed array slice
            const base64 = Buffer.from(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength).toString('base64');
            if (base64.length === 0) {
                logger.warn(`[AUDIO DEBUG] Empty base64 data for call ${callId} (${audioType})`);
                return;
            }

            // Wrap audio chunk into input_audio_buffer.append event
            const evt = {
                type: 'input_audio_buffer.append',
                audio: base64,
            };

            const msg = JSON.stringify(evt);
            this.safeSend(openaiWs, msg);
        } catch (error) {
            logger.error(`Error sending audio data for call ${callId}:`, error);
        }
    }

    // Commit the current audio buffer (end of turn)
    commitAudioBuffer(callId, audioType = 'mic') {
        let openaiWs;
        
        if (audioType === 'mic') {
            openaiWs = this.micTranscriptionSessions.get(callId);
        } else if (audioType === 'speaker') {
            openaiWs = this.speakerTranscriptionSessions.get(callId);
        }
         
        if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
            return;
        }

        const commitMsg = JSON.stringify({ type: 'input_audio_buffer.commit' });
        this.safeSend(openaiWs, commitMsg);
        logger.debug(`Audio buffer committed for call ${callId} (${audioType})`);
    }

    // Start transcription for a call (legacy method - now starts both mic and speaker)
    startTranscription(callId) {
        if (this.activeSessions.has(callId)) {
            logger.warn(`Transcription already active for call ${callId}`);
            return;
        }

        logger.info(`Starting transcription for call ${callId}`);
        this.startSpeakerTranscription(callId);
        this.startMicTranscription(callId);
        
        this.activeSessions.set(callId, {
            callId,
            startTime: Date.now(),
            micActive: true,
            speakerActive: true
        });
    }

    // Start microphone transcription for a call
    startMicTranscription(callId) {
        if (this.micTranscriptionSessions.has(callId)) {
            logger.warn(`Mic transcription already active for call ${callId}`);
            return;
        }

        logger.info(`Starting mic transcription for call ${callId}`);
        this.connectRealtimeSession(callId, 'mic');
    }

    // Start speaker transcription for a call
    startSpeakerTranscription(callId) {
        if (this.speakerTranscriptionSessions.has(callId)) {
            logger.warn(`Speaker transcription already active for call ${callId}`);
            return;
        }

        logger.info(`Starting speaker transcription for call ${callId}`);
        this.connectRealtimeSession(callId, 'speaker');
    }

    // Stop transcription for a call (legacy method - stops both mic and speaker)
    stopTranscription(callId) {
        const session = this.activeSessions.get(callId);
        if (!session) {
            logger.warn(`No active transcription session for call ${callId}`);
            return;
        }

        logger.info(`Stopping transcription for call ${callId}`);
        
        // Stop both mic and speaker transcription
        this.stopMicTranscription(callId);
        this.stopSpeakerTranscription(callId);

        // Cleanup Opus decoder
        this.opusDecoder.cleanupDecoder(callId);

        // Finalize WAV header if debug capture was enabled
        try {
            if (session.debugAudioPath && typeof session.debugBytesWritten === 'number') {
                const totalBytes = session.debugBytesWritten;
                const header = buildWavHeader(totalBytes, session.debugSampleRate || 24000, session.debugChannels || 1);
                const fd = fs.openSync(session.debugAudioPath, 'r+');
                fs.writeSync(fd, header, 0, 44, 0);
                fs.closeSync(fd);
                logger.info(`Finalized WAV debug file for call ${callId}: ${session.debugAudioPath} (${totalBytes} bytes of PCM)`);
            }
        } catch (finalizeErr) {
            logger.error(`Failed to finalize WAV debug file for call ${callId}:`, finalizeErr);
        }

        this.activeSessions.delete(callId);
    }

    // Stop microphone transcription for a call
    stopMicTranscription(callId) {
        const micWs = this.micTranscriptionSessions.get(callId);
        if (!micWs) {
            logger.warn(`No active mic transcription session for call ${callId}`);
            return;
        }

        logger.info(`Stopping mic transcription for call ${callId}`);
        
        // Commit final audio buffer
        this.commitAudioBuffer(callId, 'mic');
        
        // Close OpenAI connection
        micWs.close();
        this.micTranscriptionSessions.delete(callId);
    }

    // Stop speaker transcription for a call
    stopSpeakerTranscription(callId) {
        const speakerWs = this.speakerTranscriptionSessions.get(callId);
        if (!speakerWs) {
            logger.warn(`No active speaker transcription session for call ${callId}`);
            return;
        }

        logger.info(`Stopping speaker transcription for call ${callId}`);
        
        // Commit final audio buffer
        this.commitAudioBuffer(callId, 'speaker');
        
        // Close OpenAI connection
        speakerWs.close();
        this.speakerTranscriptionSessions.delete(callId);
    }

    // Check if transcription is active for a call
    isTranscriptionActive(callId) {
        return this.activeSessions.has(callId);
    }

    // Check if mic transcription is active for a call
    isMicTranscriptionActive(callId) {
        return this.micTranscriptionSessions.has(callId);
    }

    // Check if speaker transcription is active for a call
    isSpeakerTranscriptionActive(callId) {
        return this.speakerTranscriptionSessions.has(callId);
    }

    // Safe send helper
    safeSend(ws, data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    }

    // Cleanup all sessions
    cleanup() {
        for (const [callId, session] of this.activeSessions.entries()) {
            this.stopTranscription(callId);
        }
        this.activeSessions.clear();
        this.openaiConnections.clear();
        this.micTranscriptionSessions.clear();
        this.speakerTranscriptionSessions.clear();
        this.opusDecoder.cleanup();
    }
}

export default RealtimeTranscriptionService;
