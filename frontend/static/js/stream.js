document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const objectiveInput = document.getElementById("objective");
    const btnStart = document.getElementById("btn-start");
    const btnClear = document.getElementById("btn-clear");
    const btnSave = document.getElementById("btn-save");
    const statusBadge = document.getElementById("status-badge");
    const terminalOutput = document.getElementById("terminal-output");
    
    const metricTv = document.getElementById("metric-tv");
    const metricInfo = document.getElementById("metric-info");
    const metricJb = document.getElementById("metric-jb");

    let eventSource = null;
    let currentBlock = null;

    // Check remote target availability on initialization
    checkTargetStatus();
    setInterval(checkTargetStatus, 15000); // Poll health status every 15 seconds

    async function checkTargetStatus() {
        try {
            const res = await fetch("/api/target_status");
            const data = await res.json();
            if (data.status === "online") {
                statusBadge.textContent = "Target Online";
                statusBadge.className = "badge online";
                btnStart.disabled = false;
            } else {
                statusBadge.textContent = "Target Offline";
                statusBadge.className = "badge offline";
                btnStart.disabled = true;
            }
        } catch (err) {
            statusBadge.textContent = "Connection Error";
            statusBadge.className = "badge offline";
            btnStart.disabled = true;
        }
    }

    // Append standard status messages to the terminal view
    function appendSystemMessage(text, className = "system-msg") {
        const msg = document.createElement("div");
        msg.className = className;
        msg.textContent = text;
        terminalOutput.appendChild(msg);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // Initialize or append a fresh conversation block
    function createTurnBlock(role) {
        const block = document.createElement("div");
        block.className = `turn-block ${role}`;
        
        const header = document.createElement("div");
        header.className = `${role}-header`;
        header.textContent = role === "attacker" ? "[>] ATTACKER:" : "[<] TARGET:";
        
        const content = document.createElement("span");
        
        block.appendChild(header);
        block.appendChild(content);
        terminalOutput.appendChild(block);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        
        return content;
    }

    // Execution action pipeline
    btnStart.addEventListener("click", () => {
        const objective = objectiveInput.value.trim();
        if (!objective) {
            alert("Please enter an optimization objective before proceeding.");
            return;
        }

        btnStart.disabled = true;
        objectiveInput.disabled = true;

        // Open live unidirectional stream mapping directly back to your Flask app core
        eventSource = new EventSource(`/api/attack/stream?objective=${encodeURIComponent(objective)}`);

        eventSource.onmessage = (event) => {
            const data = jsonParseSafe(event.data);
            if (!data) return;

            if (data.error) {
                appendSystemMessage(`[!] Error: ${data.error}`, "status-true");
                stopStream();
                return;
            }

            switch (data.status) {
                case "routing":
                    appendSystemMessage(`[*] Router: ${data.msg}`, "router-msg");
                    break;
                
                case "attacker_start":
                    appendSystemMessage(`\n--- TURN ${data.turn} ---`, "system-msg");
                    currentBlock = createTurnBlock("attacker");
                    break;

                case "attacker_token":
                    if (currentBlock) currentBlock.textContent += data.token;
                    terminalOutput.scrollTop = terminalOutput.scrollHeight;
                    break;

                case "target_start":
                    currentBlock = createTurnBlock("target");
                    break;

                case "target_token":
                    if (currentBlock) currentBlock.textContent += data.token;
                    terminalOutput.scrollTop = terminalOutput.scrollHeight;
                    break;

                case "scoring":
                    appendSystemMessage("[*] Evaluating turn metrics and scoring safety guardrails...", "system-msg");
                    break;

                case "turn_complete":
                    // Render current state parameters inside scorecard fields
                    metricTv.textContent = data.metrics.tv.toFixed(4);
                    metricInfo.textContent = data.metrics.info.toFixed(4);
                    
                    if (data.jailbreak) {
                        metricJb.textContent = "BREACHED";
                        metricJb.className = "metric-value status-true";
                        appendSystemMessage("[+] CRITICAL ALERT: Objective extracted successfully.", "score-msg breached");
                    } else {
                        metricJb.textContent = "FALSE";
                        metricJb.className = "metric-value status-false";
                        appendSystemMessage(`[-] Security Compliance Maintained | Trust Vector: ${data.metrics.tv}`, "score-msg");
                    }
                    
                    // Allow the user to trigger the next sequential attack turn manually
                    btnStart.textContent = "Next Turn";
                    btnStart.disabled = false;
                    stopStream();
                    break;
            }
        };

        eventSource.onerror = () => {
            appendSystemMessage("[!] Pipeline Stream Disconnected unexpectedly.", "status-true");
            stopStream();
        };
    });

    btnClear.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to completely purge the active memory logs?")) return;
        stopStream();
        
        try {
            await fetch("/api/clear", { method: "POST" });
            terminalOutput.innerHTML = '<div class="system-msg">Memory registers cleared. System standing by.</div>';
            metricTv.textContent = "0.0000";
            metricInfo.textContent = "0.0000";
            metricJb.textContent = "FALSE";
            metricJb.className = "metric-value status-false";
            
            objectiveInput.value = "";
            objectiveInput.disabled = false;
            btnStart.textContent = "Start Attack";
            checkTargetStatus();
        } catch (err) {
            alert("Failed to communicate clear state command to application server.");
        }
    });

    btnSave.addEventListener("click", async () => {
        try {
            const res = await fetch("/api/save_attack", { method: "POST" });
            const data = await res.json();
            if (data.status === "success") {
                alert(`Session exported successfully.\nSaved path: ${data.saved_to}`);
            } else {
                alert(`Export rejected: ${data.message}`);
            }
        } catch (err) {
            alert("Error running background export processing thread.");
        }
    });

    function stopStream() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    }

    function jsonParseSafe(str) {
        try { return JSON.parse(str); } 
        catch (e) { return null; }
    }
});