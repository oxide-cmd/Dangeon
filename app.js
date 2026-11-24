// Dungeon Crawler UI Controller & App Logic

let currentTheme = localStorage.getItem('dc_theme') || 'theme-amber';
document.body.className = currentTheme;

// DOM Elements
const hpVal = document.getElementById('hpVal');
const hpBar = document.getElementById('hpBar');
const mpVal = document.getElementById('mpVal');
const goldVal = document.getElementById('goldVal');
const floorVal = document.getElementById('floorVal');
const levelVal = document.getElementById('levelVal');
const gearVal = document.getElementById('gearVal');
const asciiFrame = document.getElementById('asciiFrame');
const roomTitle = document.getElementById('roomTitle');
const roomDesc = document.getElementById('roomDesc');
const actionLog = document.getElementById('actionLog');
const choicesContainer = document.getElementById('choicesContainer');
const cmdInput = document.getElementById('cmdInput');
const submitBtn = document.getElementById('submitBtn');
const soundBtn = document.getElementById('soundBtn');
const themeBtn = document.getElementById('themeBtn');
const invBtn = document.getElementById('invBtn');
const settingsBtn = document.getElementById('settingsBtn');
const engineStatus = document.getElementById('engineStatus');

// Modals
const invModal = document.getElementById('invModal');
const settingsModal = document.getElementById('settingsModal');
const closeInvBtn = document.getElementById('closeInvBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const invList = document.getElementById('invList');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiEndpointSelect = document.getElementById('apiEndpointSelect');
const customUrlInput = document.getElementById('customUrlInput');
const customModelInput = document.getElementById('customModelInput');
const customUrlGroup = document.getElementById('customUrlGroup');
const customModelGroup = document.getElementById('customModelGroup');

// Typewriter state
let typingTimer = null;

function typewriter(element, text, speed = 12, onComplete = null) {
    if (typingTimer) clearInterval(typingTimer);
    element.textContent = '';
    let i = 0;
    typingTimer = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            if (i % 3 === 0 && soundFX.enabled) {
                soundFX.typeKey();
            }
            i++;
        } else {
            clearInterval(typingTimer);
            typingTimer = null;
            if (onComplete) onComplete();
        }
    }, speed);
}

function updateHUD() {
    const p = dungeonEngine.player;
    hpVal.textContent = `${p.hp}/${p.maxHp}`;
    const pct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    hpBar.style.width = `${pct}%`;
    mpVal.textContent = `${p.mp}/${p.maxMp}`;
    goldVal.textContent = `${p.gold} 🪙`;
    floorVal.textContent = `Этаж ${p.floor}`;
    levelVal.textContent = `${p.level} ур. (${p.xp}/${p.nextXp} XP)`;
    gearVal.textContent = `${p.weapon.name} / ${p.armor.name}`;

    if (dungeonEngine.useLLM) {
        engineStatus.textContent = '● AI MASTER ACTIVE';
        engineStatus.style.color = 'var(--success)';
    } else {
        engineStatus.textContent = '○ PROCEDURAL ENGINE';
        engineStatus.style.color = 'var(--text-dim)';
    }
}

function renderRoom(room) {
    roomTitle.textContent = room.title;
    asciiFrame.textContent = room.monster ? (room.monster.ascii || room.ascii) : room.ascii;
    typewriter(roomDesc, room.desc, 12, () => {
        renderChoices(room.choices);
    });
}

function renderChoices(choices) {
    choicesContainer.innerHTML = '';
    if (!choices || choices.length === 0) return;

    choices.forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `<span>▶</span> <span>${ch.label}</span>`;
        btn.onclick = () => {
            handleAction(ch.cmd);
        };
        choicesContainer.appendChild(btn);
    });
}

async function handleAction(inputStr) {
    if (!inputStr || !inputStr.trim()) return;
    const text = inputStr.trim();
    cmdInput.value = '';

    soundFX.startAmbientDrone();

    // Disable input while resolving
    cmdInput.disabled = true;
    submitBtn.disabled = true;
    actionLog.textContent = `> ${text}\n[Скрип камней и ожидание исхода...]`;

    try {
        const outcome = await dungeonEngine.executeAction(text);

        // Sound effect dispatch
        if (outcome.sound && soundFX[outcome.sound]) {
            soundFX[outcome.sound]();
        }

        updateHUD();

        actionLog.textContent = `> ${text}\n` + outcome.message;

        if (outcome.gameOver) {
            choicesContainer.innerHTML = `
                <button class="choice-btn" style="border-color: var(--danger); color: var(--danger)" onclick="restartGame()">
                    ☠ Начать сначала (Воскреснуть на 1 этаже)
                </button>
            `;
            cmdInput.disabled = true;
            submitBtn.disabled = true;
            return;
        }

        if (outcome.roomChanged) {
            renderRoom(dungeonEngine.currentRoom);
        } else if (dungeonEngine.combatMonster) {
            // Update monster ascii or choices if in combat
            asciiFrame.textContent = dungeonEngine.combatMonster.ascii || dungeonEngine.currentRoom.ascii;
            renderChoices([
                { cmd: 'атака', label: `Ударить мечом [${dungeonEngine.combatMonster.name}]` },
                { cmd: 'зелье', label: 'Выпить зелье исцеления' },
                { cmd: 'уклониться', label: 'Попытаться уклониться от удара' }
            ]);
        }
    } catch (err) {
        console.error(err);
        actionLog.textContent = `> Ошибка выполнения: ` + err.message;
    } finally {
        cmdInput.disabled = false;
        submitBtn.disabled = false;
        cmdInput.focus();
    }
}

function restartGame() {
    dungeonEngine.reset();
    updateHUD();
    actionLog.textContent = 'Ты снова очнулся у подножия забытых катакомб...';
    cmdInput.disabled = false;
    submitBtn.disabled = false;
    dungeonEngine.generateNextRoom('пробуждение у входа').then(room => {
        renderRoom(room);
    });
}

// Open / Close Modals
function renderInventory() {
    invList.innerHTML = '';
    const inv = dungeonEngine.player.inventory;
    if (inv.length === 0) {
        invList.innerHTML = '<li style="color: var(--text-dim); padding: 8px 0;">Твой мешок пуст.</li>';
        return;
    }

    inv.forEach(item => {
        const li = document.createElement('li');
        li.className = 'inventory-item';
        li.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${item.desc}</div>
            </div>
            ${item.type === 'potion' ? `<button class="btn-retro" onclick="useItem('${item.id}')">Пить</button>` : ''}
        `;
        invList.appendChild(li);
    });
}

window.useItem = function(id) {
    handleAction('зелье');
    invModal.style.display = 'none';
};

invBtn.onclick = () => {
    renderInventory();
    invModal.style.display = 'flex';
};
closeInvBtn.onclick = () => { invModal.style.display = 'none'; };

settingsBtn.onclick = () => {
    apiKeyInput.value = dungeonEngine.apiKey;
    apiEndpointSelect.value = dungeonEngine.apiEndpoint;
    customUrlInput.value = dungeonEngine.customUrl;
    customModelInput.value = dungeonEngine.customModel;
    toggleCustomInputs();
    settingsModal.style.display = 'flex';
};
closeSettingsBtn.onclick = () => { settingsModal.style.display = 'none'; };

function toggleCustomInputs() {
    const isCustom = apiEndpointSelect.value === 'custom';
    customUrlGroup.style.display = isCustom ? 'block' : 'none';
    customModelGroup.style.display = isCustom ? 'block' : 'none';
}
apiEndpointSelect.onchange = toggleCustomInputs;

saveSettingsBtn.onclick = () => {
    dungeonEngine.saveSettings(
        apiKeyInput.value,
        apiEndpointSelect.value,
        customUrlInput.value,
        customModelInput.value
    );
    settingsModal.style.display = 'none';
    updateHUD();
    soundFX.levelUp();
};

// Theme switcher
const themes = ['theme-amber', 'theme-green', 'theme-scroll'];
themeBtn.onclick = () => {
    const nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
    currentTheme = themes[nextIdx];
    document.body.className = currentTheme;
    localStorage.setItem('dc_theme', currentTheme);
    soundFX.typeKey();
};

// Sound toggle
soundBtn.onclick = () => {
    const enabled = soundFX.toggleMute();
    soundBtn.textContent = enabled ? '🔊 ЗВУК' : '🔇 ТИШИНА';
};

// Input listeners
submitBtn.onclick = () => handleAction(cmdInput.value);
cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleAction(cmdInput.value);
    }
});

// Start Game on Load
window.addEventListener('DOMContentLoaded', async () => {
    updateHUD();
    actionLog.textContent = 'Тьма расступается. Ты достаёшь факел... Нажми любое действие или введи команду.';
    const initialRoom = await dungeonEngine.generateNextRoom('первый вдох в подземелье');
    renderRoom(initialRoom);
});
