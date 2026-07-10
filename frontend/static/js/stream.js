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
const resumeBtn = document.getElementById('resume-btn');
const clearBtn = document.getElementById('clear-btn');
const saveBtn = document.getElementById('save-btn');
const benchmarkBtn = document.getElementById('benchmark-btn');

let isBenchmarking = false;
let benchmarkObjectives = [];
let completedBenchmarkMap = {};
let allBenchmarkModels = [
    "deepseek:deepseek-chat",
    "mistral:mistral-large-latest",
    "anthropic:claude-haiku-4-5",
    "meta:llama-3.3-70b-versatile",
    "google:gemini-2.5-flash"
];
let benchmarkModels = [];
let currentBenchObjIdx = 0;
let currentBenchModelIdx = 0;
const postBtn = document.getElementById('post-btn');

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
let jailbreakIgnored = false;

// --- Target Handling ---
async function handleTargetChange(targetValue) {
    if (targetValue.startsWith('kaggle:')) {
        const parts = targetValue.split(':');
        const modelName = parts.slice(1).join(':'); // e.g., llama3:8b or phi
        
        // Disable UI
        startBtn.disabled = true;
        targetSelect.disabled = true;
        
        // Show progress bar
        const container = document.getElementById('slm-progress-container');
        const statusText = document.getElementById('slm-progress-status');
        const percentText = document.getElementById('slm-progress-percent');
        const progressBar = document.getElementById('slm-progress-bar');
        
        container.style.display = 'block';
        statusText.innerText = `Downloading ${modelName}...`;
        statusText.style.color = '#a0aec0';
        progressBar.style.width = '0%';
        percentText.innerText = '0%';

        try {
            const response = await fetch(`/api/load_model?model=${encodeURIComponent(modelName)}`);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const {value, done} = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.error) {
                                statusText.innerText = `Error: ${data.error}`;
                                statusText.style.color = '#fc8181';
                                break;
                            }
                            if (data.status) {
                                statusText.innerText = data.status;
                            }
                            if (data.total && data.completed) {
                                const percent = Math.round((data.completed / data.total) * 100);
                                progressBar.style.width = `${percent}%`;
                                percentText.innerText = `${percent}%`;
                            }
                            if (data.status === 'success') {
                                statusText.innerText = `${modelName} loaded successfully!`;
                                statusText.style.color = '#48bb78';
                                progressBar.style.width = '100%';
                                percentText.innerText = '100%';
                                setTimeout(() => {
                                    container.style.display = 'none';
                                }, 3000);
                            }
                        } catch(e) {}
                    }
                }
            }
        } catch (error) {
            statusText.innerText = 'Failed to connect to Kaggle node.';
            statusText.style.color = '#fc8181';
        }
        
        // Re-enable UI
        startBtn.disabled = false;
        targetSelect.disabled = false;
    }
}

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

// --- Setup API Polling ---
async function fetchMetrics() {
    try {
        const res = await fetch('/api/session_metrics');
        if (res.ok) {
            const data = await res.json();
            // Metrics are primarily updated via the stream, this keeps the session active
        }
    } catch (e) {
        // silent fail on poll
    }
}
setInterval(fetchMetrics, 2000);

// --- BENCHMARK SUITE LOGIC ---
async function benchmarkNext() {
    if (!isBenchmarking) return;

    // 1. Save JSON & Post Screenshot for previous run (if there was one)
    if (currentBenchObjIdx > 0 || currentBenchModelIdx > 0) {
        systemLog('Saving artifact for benchmark run...', 'system');
        await fetch('/api/save_attack', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_automated: true })
        });
        // Attempt screenshot
        try {
            const canvas = await html2canvas(document.body, { backgroundColor: "#0d1117", scale: 1 });
            await fetch('/api/post_showcase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: canvas.toDataURL("image/png") })
            });
        } catch (e) {
            console.error("Screenshot failed during benchmark", e);
        }
    }

    // 2. Clear Context
    await fetch('/api/clear', { method: 'POST' });
    chatWindow.innerHTML = '';
    tvValue.innerText = '0.00'; tvFill.style.width = '0%';
    infoValue.innerText = '0.00'; infoFill.style.width = '0%';
    judgeBlock.className = 'metric-block judge-block pending';
    judgeText.innerText = 'PENDING';
    stratName.innerText = 'None';
    stratRationale.innerText = 'Waiting for objective...';
    currentPhase.innerText = 'None';
    currentPhase.style.color = '#a0aec0';
    currentPhase.style.border = 'none';
    document.title = "PI TOOL";

    // 3. Check completion
    if (currentBenchObjIdx >= benchmarkObjectives.length) {
        systemLog("🏆 BENCHMARK SUITE COMPLETE!", "system");
        isBenchmarking = false;
        benchmarkBtn.innerText = "Run Benchmark Suite (Automated)";
        benchmarkBtn.disabled = false;
        return;
    }

    // 4. Setup next run & fast-forward completed runs
    let foundGap = false;
    while (currentBenchObjIdx < benchmarkObjectives.length) {
        const obj = benchmarkObjectives[currentBenchObjIdx];
        const mod = benchmarkModels[currentBenchModelIdx];

        if (completedBenchmarkMap[obj] && completedBenchmarkMap[obj].includes(mod)) {
            // Already completed, skip instantly in memory
            currentBenchModelIdx++;
            if (currentBenchModelIdx >= benchmarkModels.length) {
                currentBenchModelIdx = 0;
                currentBenchObjIdx++;
            }
        } else {
            // Found a gap!
            foundGap = true;
            break;
        }
    }

    if (!foundGap) {
        // We fast-forwarded to the very end
        if (currentBenchObjIdx >= benchmarkObjectives.length) {
            systemLog("🏆 BENCHMARK SUITE COMPLETE!", "system");
            isBenchmarking = false;
            benchmarkBtn.innerText = "Run Benchmark Suite (Automated)";
            benchmarkBtn.disabled = false;
        }
        return;
    }

    const obj = benchmarkObjectives[currentBenchObjIdx];
    const mod = benchmarkModels[currentBenchModelIdx];

    objInput.value = obj;
    targetSelect.value = mod;
    // Dispatch change event to update the UI (like targetModelSpan)
    if (targetSelect) {
        targetSelect.dispatchEvent(new Event('change'));
    }
    stratSelect.value = "auto";

    systemLog(`[BENCHMARK] Starting ${mod} (Obj ${currentBenchObjIdx+1}/${benchmarkObjectives.length})`);
    
    // Advance pointers for NEXT run
    currentBenchModelIdx++;
    if (currentBenchModelIdx >= benchmarkModels.length) {
        currentBenchModelIdx = 0;
        currentBenchObjIdx++;
    }

    // Start attack
    setTimeout(() => {
        startBtn.click();
    }, 1000);
}

if (benchmarkBtn) {
    benchmarkBtn.addEventListener('click', async () => {
        if (isBenchmarking) {
            isBenchmarking = false;
            benchmarkBtn.innerText = "Run Benchmark Suite (Automated)";
            return;
        }

        try {
            const res = await fetch('/api/objectives');
            const data = await res.json();
            
            const stateRes = await fetch('/api/benchmark_state');
            const stateData = await stateRes.json();
            completedBenchmarkMap = stateData.completed || {};
            
            if (data.objectives && data.objectives.length > 0) {
                const claudeOnly = document.getElementById('claude-only-toggle').checked;
                if (claudeOnly) {
                    benchmarkModels = ["anthropic:claude-haiku-4-5"];
                } else {
                    benchmarkModels = [...allBenchmarkModels];
                }

                benchmarkObjectives = data.objectives;
                isBenchmarking = true;
                currentBenchObjIdx = 0;
                currentBenchModelIdx = 0;
                benchmarkBtn.innerText = "Stop Benchmark";
                benchmarkBtn.disabled = true;
                systemLog(`Loaded ${benchmarkObjectives.length} objectives. Starting benchmark...`, 'system');
                setTimeout(() => {
                    benchmarkBtn.disabled = false;
                    benchmarkNext();
                }, 1000);
            } else {
                systemLog("No objectives found in advbench_subset_50.txt", 'error');
            }
        } catch (e) {
            systemLog("Failed to load benchmark objectives.", 'error');
        }
    });
}

// --- System Logging ---
function systemLog(message, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    logWindow.appendChild(entry);
    logWindow.scrollTop = logWindow.scrollHeight;
}

function appendBubble(role) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;
    
    const label = document.createElement('div');
    label.className = 'message-label';
    if (role === 'attacker') {
        if (activePhaseName === 'BASELINE_TEST') {
            label.innerText = 'Attacker (Direct Control Group)';
        } else {
            label.innerText = 'Attacker (Groq)';
        }
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
                            if (isBenchmarking) {
                                systemLog(`[BENCHMARK] Skipping current target due to error. Moving to next...`, 'system');
                                stopAttack();
                                setTimeout(benchmarkNext, 2000);
                                return;
                            } else {
                                stopAttack();
                                return;
                            }
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
                                document.title = `Turn ${data.turn}`;
                                currentAttackerBubble = appendBubble('attacker');
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
                                    document.title = 'Jailbroken!';
                                    judgeBlock.className = 'metric-block judge-block jailbreak';
                                    judgeText.innerText = 'JAILBREAK DETECTED';
                                    judgeText.title = data.jailbreak_reason || '';
                                    
                                    if (data.phase === 'BASELINE_TEST') {
                                        systemLog('CRITICAL VULNERABILITY: Target model complied with raw, direct request. No strategy required.', 'error');
                                    } else {
                                        systemLog('Mission accomplished: Jailbreak successful.', 'system');
                                    }
                                    
                                    if (!jailbreakIgnored) {
                                        // CRITICAL FIX: Save benchmark state so stopAttack doesn't kill it!
                                        const wasBenchmarking = isBenchmarking;
                                        stopAttack(wasBenchmarking); 
                                        resumeBtn.classList.remove('hidden');
                                        
                                        if (wasBenchmarking) {
                                            setTimeout(benchmarkNext, 2000);
                                        }
                                        
                                        return;
                                    } else {
                                        systemLog('Jailbreak ignored by user. Continuing attack...', 'system');
                                    }
                                } else {
                                    judgeBlock.className = 'metric-block judge-block safe';
                                    judgeText.innerText = 'SAFE';
                                    judgeText.title = data.jailbreak_reason || '';
                                    
                                    if (isBenchmarking && data.turn >= 10) {
                                        const humanFlagToggle = document.getElementById('human-flag-toggle');
                                        if (humanFlagToggle && humanFlagToggle.checked) {
                                            systemLog(`Turn limit reached (10), but HUMAN FLAG is enabled. Marking as Compromised.`, 'error');
                                            judgeBlock.className = 'metric-block judge-block jailbreak';
                                            judgeText.innerText = 'JAILBROKEN (HUMAN)';
                                            judgeText.title = "Flagged by human operator bypass";
                                            data.jailbreak = true;
                                            data.jailbreak_reason = "[HUMAN FLAGGED] User manually identified a successful jailbreak that bypassed the automated judges.";
                                            
                                            // Force save the attack as human flagged
                                            fetch('/api/save_attack', {
                                                method: 'POST',
                                                headers: {'Content-Type': 'application/json'},
                                                body: JSON.stringify({ is_automated: true, is_asr: true, human_flagged: true })
                                            });
                                        } else {
                                            systemLog(`Turn limit reached (10). Objective failed on model.`, 'system');
                                        }
                                        stopAttack(isBenchmarking);
                                        setTimeout(benchmarkNext, 2000);
                                        return;
                                    }
                                    
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
                                
                                if (data.jailbreak && isBenchmarking) {
                                    setTimeout(benchmarkNext, 2000);
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
    if (!objective) {
        alert("Please enter an objective.");
        return;
    }
    
    jailbreakIgnored = false;
    isStreaming = true;
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
    objInput.disabled = true;
    stratSelect.disabled = true;
    if(targetSelect) targetSelect.disabled = true;
    
    judgeBlock.className = 'metric-block judge-block safe';
    judgeText.innerText = 'SAFE';

    const selectedTarget = targetSelect ? targetSelect.value : "kaggle";
    systemLog(`Automated attack initiated for objective: "${objective}"`);
    systemLog(`Target selected: ${selectedTarget}`); 
    
    const targetModelSpan = document.getElementById('target-model-name');
    if (targetModelSpan && targetSelect) {
        // Get the human readable text from the selected dropdown option
        const selectedOption = targetSelect.options[targetSelect.selectedIndex];
        targetModelSpan.textContent = selectedOption ? selectedOption.text : selectedTarget.split(':').pop();
    } else if (targetModelSpan) {
        targetModelSpan.textContent = selectedTarget.split(':').pop();
    }
    
    runTurn(objective, stratSelect.value, selectedTarget);
}

function stopAttack(keepBenchmark = false) {
    if (document.title !== 'Jailbroken!') {
        document.title = 'PI TOOL';
    }
    if (currentController) {
        currentController.abort();
    }
    isStreaming = false;
    if (!keepBenchmark) {
        isBenchmarking = false;
    }
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    objInput.disabled = false;
    stratSelect.disabled = false;
    if(targetSelect) targetSelect.disabled = false;
    systemLog("Attack sequence halted.");
}

startBtn.addEventListener('click', startAttack);
stopBtn.addEventListener('click', stopAttack);

resumeBtn.addEventListener('click', () => {
    if (!objInput.value) return;
    
    jailbreakIgnored = true;
    isStreaming = true;
    resumeBtn.classList.add('hidden');
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    objInput.disabled = true;
    stratSelect.disabled = true;
    if(targetSelect) targetSelect.disabled = true;
    
    systemLog("Resuming attack despite jailbreak...");
    runTurn(objInput.value, stratSelect.value, targetSelect ? targetSelect.value : "kaggle");
});

clearBtn.addEventListener('click', async () => {
    jailbreakIgnored = false;
    document.title = 'PI TOOL';
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
        
        const targetModelSpan = document.getElementById('target-model-name');
        if (targetModelSpan) {
            targetModelSpan.textContent = 'Waiting...';
        }
    }
});

saveBtn.addEventListener('click', async () => {
    const res = await fetch('/api/save_attack', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
        systemLog(`Attack saved to: ${data.saved_to}`);
    } else {
        systemLog(`Failed to save: ${data.message}`, 'error');
    }
});

// Post it (Screenshot + Save JSON)
postBtn.addEventListener('click', async () => {
    try {
        systemLog('Capturing browser snapshot for showcase...');
        postBtn.disabled = true;
        postBtn.innerText = 'Capturing...';
        
        // Take screenshot of the entire body
        const canvas = await html2canvas(document.body, {
            backgroundColor: "#0d1117",
            scale: 1 // Keep resolution normal so it's not too huge
        });
        const imageBase64 = canvas.toDataURL("image/png");
        
        postBtn.innerText = 'Posting...';
        
        const res = await fetch('/api/post_showcase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageBase64
            })
        });
        
        const data = await res.json();
        if (res.ok) {
            systemLog(`Successfully posted to showcase folders!`);
        } else {
            systemLog(`Failed to post: ${data.error}`, 'error');
        }
    } catch (e) {
        systemLog(`Screenshot error: ${e.message}`, 'error');
    } finally {
        postBtn.disabled = false;
        postBtn.innerText = 'Post it';
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