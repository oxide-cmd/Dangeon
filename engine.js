// Dungeon Crawler Core Game Engine

class DungeonEngine {
    constructor() {
        this.reset();
        this.apiKey = localStorage.getItem('dc_api_key') || '';
        this.apiEndpoint = localStorage.getItem('dc_api_endpoint') || 'gemini'; // 'gemini' or 'custom'
        this.customUrl = localStorage.getItem('dc_custom_url') || 'http://localhost:11434/v1/chat/completions';
        this.customModel = localStorage.getItem('dc_custom_model') || 'llama3';
        this.useLLM = !!this.apiKey;
    }

    reset() {
        this.player = {
            name: 'Бродяга',
            class: 'Наёмник',
            hp: 30,
            maxHp: 30,
            mp: 15,
            maxMp: 15,
            str: 14,
            dex: 12,
            int: 10,
            gold: 25,
            floor: 1,
            level: 1,
            xp: 0,
            nextXp: 100,
            weapon: { name: 'Ржавый тесак', damage: '1d6+2', type: 'weapon' },
            armor: { name: 'Кожаная куртка', defense: 2, type: 'armor' },
            relic: { name: 'Медный амулет', effect: 'Защита от сырости', type: 'relic' },
            inventory: [
                { id: 'pot_heal_1', name: 'Малое зелье исцеления', type: 'potion', value: 15, desc: 'Восстанавливает 15 HP' },
                { id: 'torch_1', name: 'Смоляной факел', type: 'tool', value: 1, desc: 'Освещает тьму и отпугивает тварей' },
                { id: 'scroll_1', name: 'Свиток искры', type: 'scroll', value: 18, desc: 'Наносит 18 урона огнём' }
            ]
        };

        this.currentRoom = null;
        this.combatMonster = null;
        this.turn = 0;
        this.log = [];
    }

    saveSettings(apiKey, apiEndpoint, customUrl, customModel) {
        this.apiKey = apiKey.trim();
        this.apiEndpoint = apiEndpoint;
        this.customUrl = customUrl.trim();
        this.customModel = customModel.trim();

        localStorage.setItem('dc_api_key', this.apiKey);
        localStorage.setItem('dc_api_endpoint', this.apiEndpoint);
        localStorage.setItem('dc_custom_url', this.customUrl);
        localStorage.setItem('dc_custom_model', this.customModel);

        this.useLLM = this.apiKey.length > 0 || this.apiEndpoint === 'custom';
    }

    rollDice(diceStr) {
        // e.g. "1d6+2" or "2d8" or "1d20"
        const match = diceStr.match(/(\d+)d(\d+)([+-]\d+)?/i);
        if (!match) return parseInt(diceStr) || 1;
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const mod = match[3] ? parseInt(match[3]) : 0;
        let sum = 0;
        for (let i = 0; i < count; i++) {
            sum += Math.floor(Math.random() * sides) + 1;
        }
        return Math.max(1, sum + mod);
    }

    d20Check(statMod = 0) {
        const roll = Math.floor(Math.random() * 20) + 1;
        return {
            roll,
            total: roll + statMod,
            isCrit: roll === 20,
            isFumble: roll === 1
        };
    }

    async generateNextRoom(actionDesc = 'спуск в неизвестность') {
        this.turn++;
        if (this.useLLM) {
            try {
                const room = await this.generateRoomViaLLM(actionDesc);
                if (room) {
                    this.currentRoom = room;
                    if (room.monster) {
                        this.combatMonster = { ...room.monster };
                    } else {
                        this.combatMonster = null;
                    }
                    return room;
                }
            } catch (err) {
                console.warn('LLM generation failed, falling back to procedural engine:', err);
            }
        }

        // Procedural generator fallback
        const room = this.generateProceduralRoom(actionDesc);
        this.currentRoom = room;
        if (room.monster) {
            this.combatMonster = { ...room.monster };
        } else {
            this.combatMonster = null;
        }
        return room;
    }

    // Procedural Room Templates & Narrative System
    generateProceduralRoom(actionDesc) {
        const floor = this.player.floor;
        const roomTypes = ['crypt', 'shrine', 'flooded', 'library', 'barracks', 'nest', 'vault'];
        const chosenType = roomTypes[Math.floor(Math.random() * roomTypes.length)];

        const adjectives = ['Осквернённый', 'Забытый временем', 'Эхоподобный', 'Замшелый', 'Ледяной', 'Тлеющий'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];

        let title = '';
        let desc = '';
        let ascii = '';
        let monster = null;
        let choices = [];

        if (chosenType === 'crypt') {
            title = `${adj} Склеп Предков (Этаж ${floor})`;
            desc = `Тяжёлый запах могильной сырости и пепла. Вдоль каменных ниш покоятся древние саркофаги. Из трещины в каменной плите сочится зеленоватый фосфоресцирующий газ. В тенях слышится шорох иссохших костей.`;
            ascii = `
   [==========]
   |  †  †  † |
  /|  ______  |\\
 / | [======] | \\
|  |  | RIP|  |  |
|__|__________|_ |
            `;
            if (Math.random() > 0.3) {
                monster = {
                    name: 'Скелет-страж склепа',
                    hp: 18 + floor * 4,
                    maxHp: 18 + floor * 4,
                    attack: '1d6+' + (floor + 1),
                    ascii: `
     .-.
    (o.o)
     |=|
    __|__
   /|_|_|\\
  / |_|_| \\
    /   \\
   (_____)
                    `
                };
            }
            choices = [
                { cmd: 'атака', label: 'Атаковать нежить оружием' },
                { cmd: 'осмотреть саркофаг', label: 'Вскрыть массивный саркофаг' },
                { cmd: 'красться', label: 'Попытаться бесшумно обойти' },
                { cmd: 'вниз', label: 'Спуститься глубже по ступеням' }
            ];
        } else if (chosenType === 'shrine') {
            title = `${adj} Алтарь Безымянного Бога (Этаж ${floor})`;
            desc = `Круглая зала из чёрного обсидиана. В центре на постаменте парит рубиновый кристалл, пульсирующий теплом, словно живое сердце. На полу высечены руны крови и подношений.`;
            ascii = `
       /\\
      /  \\
     / /\\ \\
    / /__\\ \\
   /________\\
     |    |
   [========]
            `;
            choices = [
                { cmd: 'молиться', label: 'Преклонить колени и коснуться алтаря' },
                { cmd: 'пожертвовать', label: 'Пожертвовать 10 золотых' },
                { cmd: 'осквернить', label: 'Разбить кристалл молотом' },
                { cmd: 'вниз', label: 'Пройти мимо в тёмный туннель' }
            ];
        } else if (chosenType === 'library') {
            title = `${adj} Архивы Тайного Ордена (Этаж ${floor})`;
            desc = `Бесконечные стеллажи с истлевшими гримуарами. Воздух пропитан ароматом сухой кожи и старой магии. На массивном пюпитре лежит раскрытый фолиант, страницы которого шелестят сами по себе.`;
            ascii = `
  .----------------.
 /   ARCHIVES   / |
|  [||||][||||] | |
|  [||||][||||] | |
|_______________|/
            `;
            choices = [
                { cmd: 'читать', label: 'Прочесть светящийся гримуар' },
                { cmd: 'искать свитки', label: 'Обыскать книжные полки' },
                { cmd: 'отдых', label: 'Устроить короткий привал у книжных полок' },
                { cmd: 'вниз', label: 'Идти дальше через тайную дверь' }
            ];
        } else {
            title = `${adj} Глубинный Зал (Этаж ${floor})`;
            desc = `Капли воды гулко разбиваются о каменные выступы. Факел выхватывает из мрака грубо отесанные колонны и следы когтей гигантской твари на полу. Впереди виден пролом.`;
            ascii = `
   /\\        /\\
  /  \\______/  \\
 /              \\
|   [  EXIT  ]   |
|   |   ||   |   |
|___|___||___|___|
            `;
            if (Math.random() > 0.4) {
                monster = {
                    name: 'Пещерный живоглот',
                    hp: 22 + floor * 5,
                    maxHp: 22 + floor * 5,
                    attack: '1d8+' + floor,
                    ascii: `
    /\\___/\\
   (  o.o  )
    >  ^  <
   /       \\
  ( |  |  | )
   (_)---(_)
                    `
                };
            }
            choices = [
                { cmd: 'атака', label: 'Приготовиться к бою' },
                { cmd: 'осмотреть пролом', label: 'Осмотреть трещину в полу' },
                { cmd: 'зажечь факел', label: 'Осветить дальние углы' },
                { cmd: 'вниз', label: 'Спуститься глубже' }
            ];
        }

        return {
            title,
            desc,
            ascii,
            monster,
            choices,
            floor
        };
    }

    // Execute Player Command (Combat, exploration, item usage, custom intent)
    async executeAction(input) {
        const action = input.trim().toLowerCase();
        let result = {
            message: '',
            sound: 'typeKey',
            roomChanged: false,
            gameOver: false,
            victory: false
        };

        // Inventory use command
        if (action.startsWith('пить') || action.startsWith('зелье') || action.startsWith('использовать')) {
            const potIdx = this.player.inventory.findIndex(i => i.type === 'potion');
            if (potIdx !== -1) {
                const pot = this.player.inventory.splice(potIdx, 1)[0];
                const oldHp = this.player.hp;
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + pot.value);
                const healed = this.player.hp - oldHp;
                result.message = `Ты залпом выпиваешь [${pot.name}]. Горло обжигает целебное тепло! Восстановлено +${healed} HP. (Здоровье: ${this.player.hp}/${this.player.maxHp})`;
                result.sound = 'potion';
                return result;
            } else {
                result.message = `У тебя в заплечном мешке нет подходящих зелий.`;
                return result;
            }
        }

        // Combat attack action
        if (this.combatMonster && (action.includes('атак') || action.includes('удар') || action.includes('меч') || action.includes('бой'))) {
            const d20 = this.d20Check(Math.floor((this.player.str - 10) / 2));
            result.sound = 'attackSlash';
            
            if (d20.roll >= 6 || d20.isCrit) {
                let dmg = this.rollDice(this.player.weapon.damage);
                if (d20.isCrit) dmg *= 2;
                this.combatMonster.hp -= dmg;
                
                let attackMsg = d20.isCrit 
                    ? `[КРИТИЧЕСКИЙ УДАР!] Ты наносишь сокрушительный выпад [${this.player.weapon.name}] прямо в уязвимое место! Урон: ${dmg}.`
                    : `Ты делаешь резкий выпад [${this.player.weapon.name}] и рассекаешь плоть врага! Урон: ${dmg}.`;

                if (this.combatMonster.hp <= 0) {
                    const goldGain = Math.floor(Math.random() * 15) + 10 * this.player.floor;
                    const xpGain = 35 * this.player.floor;
                    this.player.gold += goldGain;
                    this.player.xp += xpGain;

                    let lootMsg = '';
                    if (Math.random() > 0.5) {
                        const droppedItem = { id: 'pot_' + Date.now(), name: 'Фляга с настойкой корней', type: 'potion', value: 18, desc: 'Восстанавливает 18 HP' };
                        this.player.inventory.push(droppedItem);
                        lootMsg = ` На трупе врага найдена [${droppedItem.name}]!`;
                    }

                    result.message = `${attackMsg}\n\n★ Враг [${this.combatMonster.name}] с хрипом падает замертво! Получено: +${goldGain} золота, +${xpGain} опыта.${lootMsg}`;
                    this.combatMonster = null;
                    this.checkLevelUp(result);
                    return result;
                } else {
                    // Monster counterattack
                    const monDmg = this.rollDice(this.combatMonster.attack);
                    const actualDmg = Math.max(1, monDmg - this.player.armor.defense);
                    this.player.hp -= actualDmg;
                    attackMsg += `\nВраг [${this.combatMonster.name}] яростно контратакует и наносит тебе ${actualDmg} урона!`;

                    if (this.player.hp <= 0) {
                        this.player.hp = 0;
                        result.gameOver = true;
                        result.sound = 'gameOver';
                        result.message = `${attackMsg}\n\n☠ Твоё зрение угасает. Твоё тело останется гнить в этих бесконечных катакомбах... ИГРА ОКОНЧЕНА.`;
                        return result;
                    }

                    result.message = `${attackMsg} (Твоё HP: ${this.player.hp}/${this.player.maxHp} | HP врага: ${this.combatMonster.hp}/${this.combatMonster.maxHp})`;
                    return result;
                }
            } else {
                // Miss
                const monDmg = this.rollDice(this.combatMonster.attack);
                const actualDmg = Math.max(1, monDmg - this.player.armor.defense);
                this.player.hp -= actualDmg;
                result.sound = 'playerDamage';
                result.message = `Ты замахиваешься, но промахиваешься! [${this.combatMonster.name}] пользуется твоей ошибкой и наносит тебе ${actualDmg} урона! (Твоё HP: ${this.player.hp}/${this.player.maxHp})`;

                if (this.player.hp <= 0) {
                    this.player.hp = 0;
                    result.gameOver = true;
                    result.sound = 'gameOver';
                    result.message += `\n\n☠ Смертельный удар! Тьма поглощает твоё сознание...`;
                }
                return result;
            }
        }

        // Deepen / Down stairs
        if (action.includes('вниз') || action.includes('дальше') || action.includes('ступен') || action.includes('пройти')) {
            if (this.combatMonster) {
                result.message = `Ты не можешь просто уйти, пока перед тобой стоит взбешенный [${this.combatMonster.name}]! Сначала сразись или отвлеки его!`;
                return result;
            }
            this.player.floor++;
            result.roomChanged = true;
            result.sound = 'diceRoll';
            result.message = `Ты спускаешься по скользким каменным ступеням на Этаж ${this.player.floor}... Холодный сквозняк тушит угли.`;
            await this.generateNextRoom('спуск на этаж ' + this.player.floor);
            return result;
        }

        // Rest / Camp
        if (action.includes('отдых') || action.includes('привал') || action.includes('спать')) {
            if (this.combatMonster) {
                result.message = `Отдыхать в разгар боя?! Чудовище не позволит тебе сомкнуть глаз!`;
                return result;
            }
            const heal = 8 + Math.floor(Math.random() * 6);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
            this.player.mp = Math.min(this.player.maxMp, this.player.mp + 5);
            result.sound = 'potion';
            result.message = `Ты садишься спиной к холодной стене и перевязываешь раны. Восстановлено +${heal} HP, +5 MP. (HP: ${this.player.hp}/${this.player.maxHp})`;
            return result;
        }

        // Interaction with LLM or custom intent handling
        if (this.useLLM) {
            try {
                const llmOutcome = await this.resolveActionViaLLM(input);
                if (llmOutcome) {
                    return llmOutcome;
                }
            } catch (e) {
                console.warn('LLM action resolution error, falling back:', e);
            }
        }

        // Generic procedural action check
        const d20 = this.d20Check();
        result.sound = 'diceRoll';
        if (d20.roll > 10) {
            const foundGold = Math.floor(Math.random() * 12) + 5;
            this.player.gold += foundGold;
            result.message = `[Бросок d20: ${d20.roll} — УСПЕХ!] Ты тщательно осматриваешься: "${input}". Твое внимание привлекает тайник в кладке — внутри лежит ${foundGold} золотых монет и старинный пергамент.`;
        } else {
            const trapDmg = Math.floor(Math.random() * 4) + 1;
            this.player.hp = Math.max(1, this.player.hp - trapDmg);
            result.sound = 'playerDamage';
            result.message = `[Бросок d20: ${d20.roll} — НЕУДАЧА] Попытка совершить действие "${input}" приводит к неловкому движению — острый каменный осколок впивается в ладонь. Ты теряешь ${trapDmg} HP.`;
        }

        return result;
    }

    checkLevelUp(result) {
        if (this.player.xp >= this.player.nextXp) {
            this.player.level++;
            this.player.xp -= this.player.nextXp;
            this.player.nextXp = Math.floor(this.player.nextXp * 1.6);
            this.player.maxHp += 8;
            this.player.hp = this.player.maxHp;
            this.player.maxMp += 4;
            this.player.mp = this.player.maxMp;
            this.player.str += 1;
            this.player.dex += 1;
            result.sound = 'levelUp';
            result.message += `\n\n★★★ ПОВЫШЕНИЕ УРОВНЯ! Ты достиг ${this.player.level} уровня! Все характеристики возросли, здоровье полностью восстановлено! ★★★`;
        }
    }

    // Direct Gemini API or Custom OpenAI API call
    async generateRoomViaLLM(actionDesc) {
        const prompt = `Ты — мрачный и атмосферный Мастер Подземелий (Dungeon Master) в бесконечном текстовом roguelike RPG в стиле Darkest Dungeon, Demon's Souls и классических DOS RPG.
Игрок находится на Этаже ${this.player.floor}.
Статы игрока: HP ${this.player.hp}/${this.player.maxHp}, Оружие: ${this.player.weapon.name}, Золото: ${this.player.gold}.
Последнее действие: "${actionDesc}".

Сгенерируй новую комнату или развитие ситуации в строгом JSON-формате без лишней болтовни и markdown-блоков:
{
  "title": "Мрачное название локации (Этаж ${this.player.floor})",
  "desc": "Атмосферное, тягучее описание локации (3-5 предложений) на русском языке.",
  "ascii": "ASCII-арт комнаты или монстра (3-6 строк моноширинных символов)",
  "monster": null, 
  "choices": [
    {"cmd": "короткая команда", "label": "Понятное описание действия для игрока"},
    {"cmd": "короткая команда", "label": "Понятное описание действия для игрока"},
    {"cmd": "короткая команда", "label": "Понятное описание действия для игрока"},
    {"cmd": "вниз", "label": "Спуститься глубже на следующий этаж"}
  ]
}
Если в комнате есть враг, поле "monster" заполни так:
{"name": "Имя монстра", "hp": 25, "maxHp": 25, "attack": "1d8+2", "ascii": "ASCII монстра"}
Иначе пусть "monster" будет null.`;

        const raw = await this.callLLM(prompt);
        return this.parseJSON(raw);
    }

    async resolveActionViaLLM(actionText) {
        const prompt = `Ты — Dungeon Master в текстовом RPG.
Игрок на Этаже ${this.player.floor}.
Текущая локация: ${this.currentRoom ? this.currentRoom.title : 'Подземелье'}.
Описание локации: ${this.currentRoom ? this.currentRoom.desc : ''}.
Враг рядом: ${this.combatMonster ? this.combatMonster.name + ' (HP ' + this.combatMonster.hp + ')' : 'нет'}.
Игрок ввёл действие: "${actionText}".

Реши исход действия в мрачном темном стиле.
Верни СТРОГО валидный JSON:
{
  "message": "Художественное описание исхода действия (2-4 предложения). Если был бой или риск, упомяни бросок кубика.",
  "damageToPlayer": 0,
  "damageToMonster": 0,
  "goldFound": 0,
  "healPlayer": 0,
  "sound": "typeKey" // или "attackSlash", "diceRoll", "potion", "playerDamage"
}`;

        const raw = await this.callLLM(prompt);
        const data = this.parseJSON(raw);
        if (!data) return null;

        if (data.damageToMonster && this.combatMonster) {
            this.combatMonster.hp -= data.damageToMonster;
        }
        if (data.damageToPlayer) {
            this.player.hp = Math.max(0, this.player.hp - data.damageToPlayer);
        }
        if (data.healPlayer) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + data.healPlayer);
        }
        if (data.goldFound) {
            this.player.gold += data.goldFound;
        }

        const result = {
            message: data.message,
            sound: data.sound || 'diceRoll',
            gameOver: this.player.hp <= 0
        };

        if (this.combatMonster && this.combatMonster.hp <= 0) {
            result.message += `\n★ Враг [${this.combatMonster.name}] пал!`;
            this.combatMonster = null;
            this.player.xp += 40;
            this.checkLevelUp(result);
        }

        return result;
    }

    async callLLM(promptText) {
        if (this.apiEndpoint === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });
            if (!res.ok) throw new Error('Gemini API Error: ' + res.statusText);
            const json = await res.json();
            return json.candidates[0].content.parts[0].text;
        } else {
            // OpenAI / Ollama compatible
            const res = await fetch(this.customUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.customModel,
                    messages: [{ role: 'user', content: promptText }]
                })
            });
            if (!res.ok) throw new Error('Custom LLM API Error: ' + res.statusText);
            const json = await res.json();
            return json.choices[0].message.content;
        }
    }

    parseJSON(text) {
        try {
            // Extract json block if surrounded by markdown
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
            return JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse LLM JSON:', text);
            return null;
        }
    }
}

window.dungeonEngine = new DungeonEngine();
