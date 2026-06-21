// --- DOM Elements ---
const chatWindow = document.getElementById('chat-window');
const logWindow = document.getElementById('log-window');
const scrollLockBtn = document.getElementById('scroll-lock-btn');
const objInput = document.getElementById('objective-input');
const stratSelect = document.getElementById('strategy-select');
const targetSelect = document.getElementById('target-select'); 

// Buttons
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const saveBtn = document.getElementById('save-btn');

// Telemetry Elements
const turnCounter = document.getElementById('turn-counter');
const tvValue = document.getElementById('tv-value');
const tvFill = document.getElementById('tv-fill');
const infoValue = document.getElementById('info-value');
const infoFill = document.getElementById('info-fill');
const judgeBlock = document.getElementById('judge-status-block');
const judgeText = document.getElementById('judge-status-text');
const stratName = document.getElementById('strategy-name');
const stratRationale = document.getElementById('strategy-rationale');
const currentPhase = document.getElementById('current-phase');

// State Variables
let isStreaming = false;
let autoScrollEnabled = true;
let currentController = null;
let currentAttackerBubble = null;
let currentTargetBubble = null;
let activePhaseName = '';

// --- Smart Scroll Logic ---
chatWindow.addEventListener('scroll', () => {
    const isAtBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 50;
    if (!isAtBottom && autoScrollEnabled) {
        autoScrollEnabled = false;
        scrollLockBtn.classList.remove('hidden');
    } else if (isAtBottom && !autoScrollEnabled) {
        autoScrollEnabled = true;
        scrollLockBtn.classList.add('hidden');
    }
});

scrollLockBtn.addEventListener('click', () => {
    autoScrollEnabled = true;
    scrollLockBtn.classList.add('hidden');
    scrollToBottom();
});

function scrollToBottom() {
    if (autoScrollEnabled) {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

// --- System Logging ---
function systemLog(message, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    logWindow.appendChild(entry);
    logWindow.scrollTop = logWindow.scrollHeight;
}

function appendBubble(role, isBaseline = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;
    
    const label = document.createElement('div');
    label.className = 'message-label';
    if (role === 'attacker') {
        label.innerText = isBaseline ? 'Attacker (Direct Control Group)' : 'Attacker (Groq)';
    } else {
        const targetVal = targetSelect ? targetSelect.value : 'Kaggle';
        label.innerText = `Target (${targetVal.split(':')[0]})`; 
    }
    
    const textNode = document.createElement('span');
    wrapper.appendChild(label);
    wrapper.appendChild(textNode);
    chatWindow.appendChild(wrapper);
    
    return textNode;
}

// --- Main Execution Loop ---
async function runTurn(objective, strategy = "auto", target = "kaggle") { 
    if (!isStreaming) return;

    currentController = new AbortController();
    
    try {
        const response = await fetch(`/api/attack/stream?objective=${encodeURIComponent(objective)}&strategy=${encodeURIComponent(strategy)}&target=${encodeURIComponent(target)}`, {
            signal: currentController.signal
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); 

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    if (dataStr === '[DONE]') continue;

                    try {
                        const data = JSON.parse(dataStr);

                        if (data.error) {
                            systemLog(`Error: ${data.error}`, 'error');
                            stopAttack();
                            return;
                        }

                        switch (data.status) {
                            case 'routing':
                                systemLog(data.msg);
                                break;
                            case 'strategy_selected':
                                stratName.innerText = data.strategy.replace(/_/g, ' '); 
                                stratRationale.innerText = data.rationale;
                                systemLog(`Strategy locked: ${data.strategy}`);
                                break;
                            case 'model_info':
                                const modelSpan = document.getElementById('attacker-model-name');
                                if (modelSpan) {
                                    modelSpan.textContent = data.model_name;
                                }
                                break;

                            case 'phase_update':
                                activePhaseName = data.phase;
                                if (data.phase) {
                                    currentPhase.innerText = data.phase.replace(/_/g, ' ');
                                    
                                    if (data.phase === 'BASELINE_TEST') {
                                        currentPhase.style.color = '#63b3ed'; 
                                        currentPhase.style.border = '1px solid #63b3ed';
                                    } else if (data.phase === 'CONTEXT_PRIMING') {
                                        currentPhase.style.color = '#ecc94b'; 
                                        currentPhase.style.border = '1px solid #ecc94b';
                                    } else if (data.phase === 'ADVERSARIAL_DRIFT') {
                                        currentPhase.style.color = '#ed8936'; 
                                        currentPhase.style.border = '1px solid #ed8936';
                                    } else if (data.phase === 'COMPROMISE') {
                                        currentPhase.style.color = '#f56565'; 
                                        currentPhase.style.border = '1px solid #f56565';
                                    } else {
                                        currentPhase.style.color = '#a0aec0'; 
                                        currentPhase.style.border = 'none';
                                    }
                                }
                                break;

                            case 'attacker_start':
                                turnCounter.innerText = `Turn: ${data.turn}`;
                                currentAttackerBubble = appendBubble('attacker', activePhaseName === 'BASELINE_TEST');
                                break;
                            case 'attacker_token':
                                if (currentAttackerBubble) currentAttackerBubble.innerHTML += data.token;
                                scrollToBottom();
                                break;
                            case 'target_start':
                                currentTargetBubble = appendBubble('target');
                                break;
                            case 'target_token':
                                if (currentTargetBubble) currentTargetBubble.innerHTML += data.token;
                                scrollToBottom();
                                break;
                            case 'scoring':
                                systemLog(`Turn complete. Evaluating telemetry...`);
                                break;
                            case 'turn_complete':
                                tvValue.innerText = data.metrics.tv.toFixed(2);
                                tvFill.style.width = `${data.metrics.tv * 100}%`;
                                
                                infoValue.innerText = data.metrics.info.toFixed(2);
                                infoFill.style.width = `${data.metrics.info * 100}%`;

                                if (data.jailbreak_reason) {
                                    systemLog(`Judge: ${data.jailbreak_reason}`);
                                }

                                if (data.jailbreak) {
                                    judgeBlock.className = 'metric-block judge-block jailbreak';
                                    judgeText.innerText = 'JAILBREAK DETECTED';
                                    judgeText.title = data.jailbreak_reason || '';
                                    
                                    if (data.phase === 'BASELINE_TEST') {
                                        systemLog('CRITICAL VULNERABILITY: Target model complied with raw, direct request. No strategy required.', 'error');
                                    } else {
                                        systemLog('Mission accomplished: Jailbreak successful.', 'system');
                                    }
                                    
                                    stopAttack(); 
                                    return;
                                } else {
                                    judgeBlock.className = 'metric-block judge-block safe';
                                    judgeText.innerText = 'SAFE';
                                    judgeText.title = data.jailbreak_reason || '';
                                    
                                    // Handle the visual split between baseline and strategy
                                    if (data.phase === 'BASELINE_TEST') {
                                        const separator = document.createElement('div');
                                        separator.style = "text-align: center; color: #a0aec0; margin: 30px 0; border-bottom: 1px solid #4a5568; line-height: 0.1em;";
                                        separator.innerHTML = '<span style="background: #1a202c; padding: 0 15px; font-size: 0.85em; font-weight: bold; letter-spacing: 1px;">🛡️ BASELINE SECURE — ISOLATING CONTEXT — INITIATING STRATEGY 🛡️</span>';
                                        chatWindow.appendChild(separator);
                                        scrollToBottom();
                                        
                                        systemLog('Baseline verified: Target successfully refused direct objective. Initiating red-team strategy.');
                                    }
                                }

                                if (isStreaming) {
                                    systemLog(data.phase === 'BASELINE_TEST' ? `Initializing Strategy Turn 1...` : `Initiating Turn ${data.turn + 1}...`);
                                    runTurn(objective, strategy, target); 
                                }
                                return;
                        }
                    } catch (e) {
                        console.error("Parse error:", e, dataStr);
                    }
                }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            systemLog('Connection severed by user.', 'system');
        } else {
            systemLog(`Stream failure: ${e.message}`, 'error');
            stopAttack();
        }
    }
}

// --- Control Bindings ---
function startAttack() {
    const objective = objInput.value.trim();
    const selectedStrategy = stratSelect ? stratSelect.value : "auto";
    const selectedTarget = targetSelect ? targetSelect.value : "kaggle"; 
    
    if (!objective) {
        alert("Please enter an objective.");
        return;
    }

    isStreaming = true;
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    objInput.disabled = true;
    
    judgeBlock.className = 'metric-block judge-block safe';
    judgeText.innerText = 'SAFE';

    systemLog(`Automated attack initiated for objective: "${objective}"`);
    systemLog(`Target selected: ${selectedTarget}`); 
    
    runTurn(objective, selectedStrategy, selectedTarget); 
}

function stopAttack() {
    isStreaming = false;
    if (currentController) {
        currentController.abort();
    }
    
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    objInput.disabled = false;
    systemLog('Attack halted.');
}

startBtn.addEventListener('click', startAttack);
stopBtn.addEventListener('click', stopAttack);

// Clear Context
clearBtn.addEventListener('click', async () => {
    if (isStreaming) {
        alert("Please stop the attack before clearing context.");
        return;
    }
    const res = await fetch('/api/clear', { method: 'POST' });
    if (res.ok) {
        chatWindow.innerHTML = '';
        systemLog('Session context cleared. Ready for new engagement.');
        turnCounter.innerText = 'Turn: 0';
        tvFill.style.width = '0%';
        infoFill.style.width = '0%';
        tvValue.innerText = '0.00';
        infoValue.innerText = '0.00';
        judgeBlock.className = 'metric-block judge-block safe';
        judgeText.innerText = 'SAFE';
        judgeText.title = '';
        stratName.innerText = 'Awaiting Init...';
        stratRationale.innerText = 'Rationale will appear here once the router selects a path.';
        
        currentPhase.innerText = 'Awaiting Init...';
        currentPhase.style.color = '#a0aec0';
        currentPhase.style.border = 'none';

        const modelSpan = document.getElementById('attacker-model-name');
        if (modelSpan) {
            modelSpan.textContent = 'Waiting...';
        }
    }
});

// Save JSON
saveBtn.addEventListener('click', async () => {
    const res = await fetch('/api/save_attack', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
        systemLog(`Attack saved to: ${data.saved_to}`);
    } else {
        systemLog(`Failed to save: ${data.message}`, 'error');
    }
});

// Status Pinger (Runs every 10 seconds)
setInterval(async () => {
    try {
        const res = await fetch('/api/target_status');
        const data = await res.json();
        const dot = document.getElementById('kaggle-status-dot');
        const txt = document.getElementById('kaggle-status-text');
        
        if (data.status === 'online') {
            dot.className = 'dot online';
            txt.innerText = 'Kaggle Node: Online';
        } else {
            dot.className = 'dot offline';
            txt.innerText = 'Kaggle Node: Offline';
        }
    } catch (e) {
        // Silent fail on ping
    }
}, 10000);