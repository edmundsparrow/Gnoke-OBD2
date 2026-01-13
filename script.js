/**
 * Gnokestation Core Bootstrap v2.0
 * Production-ready modular OBD-II diagnostic platform
 *
 * Responsibilities:
 * 1. System logger
 * 2. Boot / shutdown sequence
 * 3. Plugin loader (core + optional plugins)
 * 4. Status updates & tab management
 */

// ============================================================================
// PLUGIN REGISTRY
// Core plugins MUST load first
// Optional plugins can be appended below
// ============================================================================
const PLUGINS = [
    'core/kernel.js',
    'core/pids.js',
    'core/dashboard.js',
    'core/diagnostics.js',
    // Optional plugins:
    'apps/timing.js',
     'apps/emissions.js',
     'apps/battery.js',
     'apps/readiness.js',
     'apps/freezeframe.js',
     'plugins/vin.js',
     'apps/recorder.js',
     'plugins/engine.js',
     'plugins/monitoring.js',
];

// ============================================================================
// CORE SYSTEM OBJECT
// ============================================================================
window.System = {
    version: '2.0.0',
    activeApps: {},        // Registered plugins
    logBuffer: [],         // Global log buffer

    /**
     * Universal logger
     */
    log(source, message) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `[${timestamp}] [${source}] ${message}`;
        this.logBuffer.push(entry);

        const logEl = document.getElementById('log-content');
        if (logEl) {
            logEl.innerHTML += `<br>${entry}`;
            logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
        }
        console.log(entry);
    },

    /**
     * Boot sequence - connect hardware or demo
     */
    async boot() {
        const mode = document.getElementById('mode').value;
        const connBtn = document.getElementById('conn-btn');

        if (window.obd?.connected) {
            await this.shutdown();
            return;
        }

        connBtn.disabled = true;
        connBtn.textContent = 'Connecting...';

        try {
            if (mode === 'demo') {
                window.isSimulating = true;
                window.obd = { connected: true };
                this.updateStatus('SIMULATING', 'green');
                this.log('System', 'Demo mode activated - synthetic data');
            } else if (mode === 'serial') {
                if (!navigator.serial) throw new Error('Web Serial not supported');
                if (!System.activeApps.kernel) throw new Error('Kernel not loaded');
                const success = await System.activeApps.kernel.connect('serial');
                if (!success) throw new Error('Serial connection failed');
                this.updateStatus('CONNECTED (Serial)', 'green');
                this.log('System', 'Hardware connected via Web Serial API');
            } else if (mode === 'ble') {
                if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported');
                if (!System.activeApps.kernel) throw new Error('Kernel not loaded');
                const success = await System.activeApps.kernel.connect('ble');
                if (!success) throw new Error('BLE connection failed');
                this.updateStatus('CONNECTED (BLE)', 'green');
                this.log('System', 'Hardware connected via Web Bluetooth API');
            }

            connBtn.textContent = 'Disconnect';
            this.switchToTab('dash');

        } catch (err) {
            this.log('Error', err.message);
            alert(err.message);
            await this.shutdown();
        } finally {
            connBtn.disabled = false;
        }
    },

    /**
     * Shutdown all active apps and disconnect hardware
     */
    async shutdown() {
        this.log('System', 'Shutting down...');
        Object.values(this.activeApps).forEach(app => app.shutdown?.());

        if (window.obd?.disconnect) {
            await window.obd.disconnect();
            this.log('System', 'Hardware disconnected');
        }

        window.obd = null;
        window.isSimulating = false;
        this.updateStatus('DISCONNECTED', '#ccc');
        document.getElementById('conn-btn').textContent = 'Connect';
    },

    /**
     * Status indicator update
     */
    updateStatus(text, color) {
        const statusText = document.getElementById('conn-status');
        const statusDot = document.getElementById('status-dot');

        if (statusText) statusText.innerText = text;
        if (statusDot) statusDot.style.background = color;
    },

    /**
     * Tab switcher
     */
    switchToTab(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        const view = document.getElementById(viewId);
        if (view) view.classList.add('active');

        const btnMap = { dash: 0, dtc: 1, config: 2, logs: 3 };
        const btn = document.querySelectorAll('.tab-btn')[btnMap[viewId]];
        if (btn) btn.classList.add('active');
    }
};

// ============================================================================
// GLOBAL UI HELPERS
// ============================================================================

window.showTab = function(viewId, btn) {
    System.switchToTab(viewId);
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

window.clearLog = function() {
    const logEl = document.getElementById('log-content');
    System.logBuffer = [];
    if (logEl) logEl.innerHTML = '[System] Log cleared.';
    System.log('System', 'Ready for input');
};

window.exportLog = function() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `gnokestation-log-${timestamp}.txt`;

    const header = `Gnokestation OBD-II Diagnostic Log
Generated: ${new Date().toLocaleString()}
Mode: ${window.isSimulating ? 'Simulation' : 'Hardware'}
Version: ${System.version}
========================================\n\n`;

    const content = header + System.logBuffer.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    System.log('System', `Log exported as ${filename}`);
};

window.readDTCs = function() {
    System.activeApps.diagnostics?.readCodes?.();
};

window.clearDTCs = function() {
    System.activeApps.diagnostics?.clearCodes?.();
};

// ============================================================================
// PLUGIN LOADER
// ============================================================================
(async function loadPlugins() {
    System.log('System', `Gnokestation v${System.version} initializing...`);
    System.log('System', `Loading ${PLUGINS.length} plugins...`);

    for (const plugin of PLUGINS) {
        try {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = plugin;
                s.onload = resolve;
                s.onerror = () => reject(new Error(`Failed to load ${plugin}`));
                document.head.appendChild(s);
            });
            System.log('Loader', `✓ ${plugin}`);
        } catch (err) {
            System.log('Error', err.message);
        }
    }

    System.log('System', `${Object.keys(System.activeApps).length} apps registered`);
    System.log('System', 'Ready for connection');
})();


