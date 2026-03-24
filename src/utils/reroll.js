import { RerollManager } from "./reroll.js";

// Import V2 API
const { ApplicationV2 } = foundry.applications.api;

export class BonusManager {
    static init(message, html) {
        const $html = html instanceof HTMLElement ? $(html) : html;

        if (!message.isAuthor && !game.user.isGM) return false;
        if (!$html || $html.length === 0) return false;

        $html.find('.rsr-damage-buttons button, .rsr-damage-buttons-xl button')
            .off('click.rsrFix')
            .on('click.rsrFix', (ev) => {
                ev.stopPropagation();
            });

        // --- DETECT SECTIONS ---
        const hasAttackSection = $html.find('.rsr-section-attack').length > 0;
        const hasDamageSection = $html.find('.rsr-section-damage').length > 0;

        const isDnd5eRoll = !!message.flags.dnd5e?.roll?.type;
        const isInitiative = message.flags.core?.initiativeRoll || 
                             (message.flavor && message.flavor.includes("Initiative")) ||
                             $html.find('.dice-flavor').text().includes("Initiative");

        if (!hasAttackSection && !hasDamageSection && !isDnd5eRoll && !isInitiative) return false;

        let injected = false;

        // --- INJECT BUTTONS ---
        if (hasAttackSection) {
            this.injectButton(message, $html, "attack", ".rsr-section-attack");
            injected = true;
        }
        
        if (hasDamageSection) {
            this.injectButton(message, $html, "damage", ".rsr-section-damage");
            injected = true;
        }

        let rollType = null;
        if (isInitiative) rollType = "initiative";
        else if (isDnd5eRoll) rollType = message.flags.dnd5e.roll.type;

        const validTypes = ["skill", "tool", "ability", "save", "death", "concentration", "initiative"];

        if (rollType && validTypes.includes(rollType)) {
            const label = rollType === "ability" ? "check" : rollType;
            this.injectButton(message, $html, label, ".message-header");
            injected = true;
        }

        return injected;
    }

    static injectButton(message, html, type, sectionSelector) {
        const section = html.find(sectionSelector);
        if (section.length === 0) return;

        if (section.find(`.rsr-addon-bonus-btn[data-type="${type}"]`).length > 0) return;

        let container = section.find('.rsr-header .rsr-title').first();
        if (container.length === 0) container = section.find('.rsr-header').first();
        if (container.length === 0) container = section.find('.message-sender').first(); 
        if (container.length === 0) container = section; 

        const titleType = type.charAt(0).toUpperCase() + type.slice(1);
        const btn = $(`<i class="fas fa-plus-circle rsr-addon-bonus-btn" data-type="${type}" title="Add Bonus to ${titleType}"></i>`);
        
        if (sectionSelector === ".message-header") {
            btn.css({ "margin-left": "8px", "align-self": "center", "font-size": "1.2em", "order": "10", "cursor": "pointer" });
            section.append(btn);
        } else {
            container.append(btn);
        }
        
        btn.click((ev) => {
            ev.preventDefault();
            ev.stopPropagation(); 
            this.openBonusDialog(message, type);
        });
    }

    static async openBonusDialog(message, type) {
        let actor = null;
        if (message.speaker.token) {
            const token = game.scenes.get(message.speaker.scene)?.tokens.get(message.speaker.token);
            actor = token?.actor;
        } else if (message.speaker.actor) {
            actor = game.actors.get(message.speaker.actor);
        }

        if (!actor) return ui.notifications.warn("No actor found for this message.");
        
        const rollData = actor.getRollData();
        const bonuses = [];

        // --- Auto-Detect if the original roll was a Crit ---
        let isOriginalCrit = false;
        if (type === "damage") {
            const dmgRoll = message.rolls.find(r => r instanceof CONFIG.Dice.DamageRoll || r.options?.critical !== undefined);
            if (dmgRoll) {
                isOriginalCrit = dmgRoll.options?.critical === true || 
                                 dmgRoll.options?.isCritical === true || 
                                 message.flags?.dnd5e?.roll?.isCritical === true;
            }
        }

        // --- 1. COLLECT CANDIDATE EFFECTS (Active Effects Only) ---
        const candidateEffects = [];
        const actorEffects = actor.appliedEffects || actor.effects; 
        
        actorEffects.forEach(e => {
            if (!e.disabled && !e.isSuppressed) {
                candidateEffects.push({ effect: e, source: "Actor" });
            }
        });

        // --- 2. PROCESS EFFECTS ---
        for (const entry of candidateEffects) {
            const effect = entry.effect;
            const changes = effect.changes.filter(c => c.key.trim() === "flags.rsr5e-addon.bonus");
            
            for (const change of changes) {
                const parts = change.value.split(";").map(s => s.trim());
                
                const typePart = parts.find(p => p.toLowerCase().startsWith("type:"));
                const consumePart = parts.find(p => p.toLowerCase().startsWith("consume"));
                const isOnce = parts.some(p => p.toLowerCase() === "once");

                // Parse consumption target and pre-fetch the item name for the UI
                let consumeTarget = null;
                let consumeItemName = null;
                
                if (consumePart) {
                    const split = consumePart.split(":");
                    consumeTarget = split.length > 1 ? split[1].trim() : "origin";
                    
                    if (consumeTarget === "origin" && effect.origin) {
                        const originParts = effect.origin.split('.');
                        const itemId = originParts[originParts.length - 1];
                        const item = actor.items.get(itemId);
                        if (item) {
                            consumeItemName = item.name;
                        } else {
                            const originDoc = await fromUuid(effect.origin);
                            if (originDoc && originDoc.documentName === "Item") consumeItemName = originDoc.name;
                            else consumeItemName = "Origin Item";
                        }
                    } else if (consumeTarget !== "origin") {
                        const item = actor.items.get(consumeTarget) || actor.items.find(i => i.name === consumeTarget);
                        if (item) consumeItemName = item.name;
                        else consumeItemName = consumeTarget; // Fallback to raw string
                    }
                }

                // Isolate the formula
                const formulaParts = parts.filter(p => 
                    !p.toLowerCase().startsWith("type:") && 
                    !p.toLowerCase().startsWith("consume") && 
                    p.toLowerCase() !== "once"
                );
                
                let rawFormula = formulaParts.length > 0 ? formulaParts[0] : "0";
                const resolvedFormula = this._resolveFormula(rawFormula, rollData);

                let allowedTypes = ["any"];
                if (typePart) {
                    const typeString = typePart.split(":")[1];
                    allowedTypes = typeString.split(",").map(t => t.trim().toLowerCase());
                }

                let isMatch = false;
                for (const allowedType of allowedTypes) {
                    if (allowedType === "all" || allowedType === "any") isMatch = true;
                    else if (allowedType === type) isMatch = true;
                    else if (allowedType === "check") {
                        if (["skill", "tool", "ability", "check", "initiative"].includes(type)) isMatch = true;
                    }
                    else if (allowedType === "save") {
                        if (["save", "death", "concentration"].includes(type)) isMatch = true;
                    }
                    else if (type === "check" && ["skill", "tool", "initiative"].includes(allowedType)) isMatch = true;
                    else if (allowedType === "attack" && type === "attack") isMatch = true;
                    else if (allowedType === "damage" && type === "damage") isMatch = true;

                    if (isMatch) break;
                }
                
                if (isMatch) {
                    bonuses.push({
                        effectId: effect.id,
                        origin: effect.origin,
                        name: effect.name,
                        icon: effect.img || effect.icon || "icons/svg/aura.svg",
                        rawFormula: rawFormula,
                        resolvedFormula: resolvedFormula,
                        isOnce: isOnce,
                        consumeTarget: consumeTarget,
                        consumeItemName: consumeItemName // Sent to the UI
                    });
                }
            }
        }

        // --- 3. RENDER APPLICATION V2 SELECTOR ---
        new BonusSelector({
            bonuses: bonuses,
            type: type,
            isCritDefault: isOriginalCrit,
            onSubmit: async (result) => {
                let bonusDef;
                
                if (result.isCustom) {
                    bonusDef = {
                        name: "Custom Bonus",
                        rawFormula: result.formula,
                        isOnce: false 
                    };
                } else {
                    bonusDef = bonuses[result.index];
                }

                if (bonusDef) {
                    await this.applyBonus(message, type, bonusDef, actor, result.applyCrit);
                }
            }
        }).render(true);
    }

    static async applyBonus(message, type, bonusDef, actor, applyCrit = false) {
        try {
            // --- HANDLE CONSUMPTION FIRST ---
            if (bonusDef.consumeTarget) {
                let itemToConsume = null;

                if (bonusDef.consumeTarget === "origin" && bonusDef.origin) {
                    // Extract the Item ID from the end of the origin UUID
                    const parts = bonusDef.origin.split('.');
                    const itemId = parts[parts.length - 1];
                    
                    // Directly fetch the item from the specific token/actor making the roll
                    itemToConsume = actor.items.get(itemId);
                    
                    // Fallback to name-matching if ID fails for any reason
                    if (!itemToConsume) {
                        const originDoc = await fromUuid(bonusDef.origin);
                        if (originDoc && originDoc.documentName === "Item") {
                            itemToConsume = actor.items.find(i => i.name === originDoc.name);
                        }
                    }
                } else if (bonusDef.consumeTarget !== "origin") {
                    itemToConsume = actor.items.get(bonusDef.consumeTarget) || actor.items.find(i => i.name === bonusDef.consumeTarget);
                }

                if (itemToConsume) {
                    const uses = itemToConsume.system?.uses;
                    
                    // Modern D&D5e (v3.0+) check: uses 'spent' instead of 'value'
                    if (uses && uses.max) {
                        const remaining = uses.value; 
                        const spent = uses.spent || 0; 

                        if (remaining > 0) {
                            await itemToConsume.update({"system.uses.spent": spent + 1});
                            ui.notifications.info(`Consumed 1 use from ${itemToConsume.name}.`);
                        } else {
                            return ui.notifications.warn(`Cannot apply bonus: ${itemToConsume.name} has no uses left!`);
                        }
                    } else {
                        ui.notifications.warn(`${itemToConsume.name} has no uses configured.`);
                    }
                } else {
                    return ui.notifications.error(`Could not find the target item to consume uses from.`);
                }
            }

            // --- FIND TARGET ROLL FIRST TO INHERIT CONFIGURATION ---
            let targetRollIndex = -1;
            if (type === "damage") {
                targetRollIndex = message.rolls.findIndex(r => r instanceof CONFIG.Dice.DamageRoll);
            } else {
                targetRollIndex = message.rolls.findIndex(r => r instanceof CONFIG.Dice.D20Roll);
            }

            if (targetRollIndex === -1) {
                if (message.rolls.length > 0) targetRollIndex = 0;
                else return ui.notifications.error("Could not find target roll in message.");
            }

            const originalRoll = message.rolls[targetRollIndex];
            const TargetRollClass = originalRoll.constructor;
            
            // Clone the original roll's options to prevent the mergeObject error
            let rollOptions = foundry.utils.deepClone(originalRoll.options) || {};

            // --- EVALUATE FORMULA ---
            const rollData = actor.getRollData();
            const cleanFormula = this._resolveFormula(bonusDef.rawFormula, rollData);
            
            if (!cleanFormula || cleanFormula.trim() === "") {
                return ui.notifications.warn("Invalid bonus formula.");
            }

            // --- CRIT HANDLING ---
            if (type === "damage" && applyCrit) {
                rollOptions.critical = true;
                rollOptions.multiplyNumeric = game.settings.get("dnd5e", "criticalDamageModifiers") ?? false;
                rollOptions.maximizeCritical = game.settings.get("dnd5e", "criticalDamageMaxDice") ?? false;
            }

            // Create the bonus roll securely using the inherited options
            const bonusRoll = new TargetRollClass(cleanFormula, rollData, rollOptions);
            await bonusRoll.evaluate();

            const originalTerms = originalRoll.terms.map(t => foundry.utils.deepClone(t));
            const newTerms = [
                ...originalTerms,
                new foundry.dice.terms.OperatorTerm({operator: "+"}),
                ...bonusRoll.terms
            ];

            const newRoll = TargetRollClass.fromTerms(newTerms);
            newRoll.options = rollOptions; 
            newRoll._total = originalRoll.total + bonusRoll.total;
            newRoll._evaluated = true; 

            const rolls = [...message.rolls];
            rolls[targetRollIndex] = newRoll;

            if (message.flags["rsr5e"]) {
                await message.update({ rolls: rolls });
            } else {
                const newContent = await newRoll.render();
                await message.update({ rolls: rolls, content: newContent });
            }

            if (type === "initiative") {
                const messageSceneId = message.speaker.scene;
                const targetCombat = game.combats.find(c => c.scene?.id === messageSceneId) || game.combat;
                if (targetCombat) {
                    const combatant = targetCombat.combatants.find(c => 
                        (c.tokenId && c.tokenId === message.speaker.token) || 
                        (c.actorId && c.actorId === message.speaker.actor)
                    );
                    if (combatant) await targetCombat.setInitiative(combatant.id, newRoll.total);
                }
            }

            // Clean up if it was a one-time effect
            if (bonusDef.isOnce && bonusDef.effectId) {
                const effect = actor.effects.get(bonusDef.effectId);
                if (effect) await effect.delete();
            }
            ui.notifications.info(`Applied ${bonusDef.name} (+${bonusRoll.total}).`);

        } catch (err) {
            console.error("RSR Addon | Error applying bonus:", err);
            ui.notifications.error(`Error applying bonus: ${err.message}`);
        }
    }

    static _resolveFormula(formula, rollData, logging = false) {
        if (!formula || typeof formula !== 'string' || !formula.includes("@")) return formula;
        
        return formula.replace(/@([a-zA-Z0-9._-]+)/g, (match, term) => {
            let value = foundry.utils.getProperty(rollData, term);
            if (value === undefined) return match;

            if (typeof value === 'object' && value !== null) {
                if ('number' in value && 'faces' in value) return `${value.number}d${value.faces}`;
                if ('number' in value && 'die' in value) return `${value.number}${value.die}`;
                if ('value' in value) return value.value;
                if ('total' in value) return value.total;
                if ('formula' in value) return value.formula;
                return "0"; 
            }
            return String(value);
        });
    }
}

// ==========================================================
//  APPLICATION V2 CLASS
// ==========================================================
class BonusSelector extends ApplicationV2 {
    constructor(options) {
        super(options);
        this.bonuses = options.bonuses;
        this.type = options.type;
        this.isCritDefault = options.isCritDefault || false; 
        this.onSubmitCallback = options.onSubmit;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "rsr-bonus-selector",
        classes: ["rsr-bonus-window"],
        window: {
            title: "Apply Retroactive Bonus",
            icon: "fas fa-dice-d20",
            resizable: false,
            width: 440
        },
        position: {
            width: 440,
            height: "auto"
        },
        form: {
            handler: BonusSelector.prototype._handleSubmit,
            closeOnSubmit: true
        }
    };

    async _renderHTML(context, options) {
        let html = `
        <div class="rsr-bonus-content" style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">
            <p style="margin: 0; color: var(--color-text-primary);">
                Select a bonus to apply to the <strong>${this.type} roll</strong>:
            </p>
            <div class="rsr-bonus-list" style="display: flex; flex-direction: column; gap: 6px;">
        `;

        const customIcon = "icons/magic/life/crosses-trio-red.webp";
        const customChecked = this.bonuses.length === 0 ? "checked" : "";
        
        html += `
            <div class="form-group" style="display:flex; flex-direction: column; padding: 8px; border: 1px solid var(--color-border-light-2); border-radius: 4px; background: var(--color-bg-light);">
                <div style="display:flex; align-items:center;">
                    <input type="radio" name="bonusIndex" value="custom" id="bonus-custom" ${customChecked} style="margin-right: 12px;">
                    <label for="bonus-custom" style="display:flex; align-items:center; cursor:pointer; flex:1; margin:0; user-select: none;">
                        <img src="${customIcon}" width="32" height="32" style="border:none; margin-right:12px; flex-shrink:0;">
                        <span style="font-weight:bold; font-size: 1.1em; color: var(--color-text-primary);">Custom Bonus</span>
                    </label>
                </div>
                
                <div class="custom-input-container" style="margin-top: 8px; margin-left: 44px; display: ${customChecked ? 'block' : 'none'};">
                    <input type="text" name="customFormula" placeholder="e.g. +5 or 1d4" style="width: 100%; box-sizing: border-box; background: var(--color-bg-light); color: var(--color-text-primary); border: 1px solid var(--color-border-dark);">
                </div>
            </div>`;

        this.bonuses.forEach((b, i) => {
            const displayFormula = b.rawFormula !== b.resolvedFormula 
                ? `${b.rawFormula} ⮕ <strong>${b.resolvedFormula}</strong>` 
                : b.rawFormula;
            
            const checked = (i === 0) ? "checked" : "";

            // Evaluate Consumption badge UI
            let consumeBadge = "";
            if (b.consumeItemName) {
                consumeBadge = `<span style="font-size: 0.85em; color: var(--color-text-danger); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                    <i class="fas fa-battery-quarter"></i> Consumes 1 use of ${b.consumeItemName}
                </span>`;
            } else if (b.isOnce) {
                consumeBadge = `<span style="font-size: 0.85em; color: var(--color-text-danger); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                    <i class="fas fa-bolt"></i> Consumes this effect
                </span>`;
            }

            html += `
            <div class="form-group" style="display:flex; align-items:center; padding: 8px; border: 1px solid var(--color-border-light-2); border-radius: 4px; background: var(--color-bg-light);">
                <input type="radio" name="bonusIndex" value="${i}" id="bonus-${i}" ${checked} style="margin-right: 12px;">
                <label for="bonus-${i}" style="display:flex; align-items:center; cursor:pointer; flex:1; margin:0; user-select: none;">
                    <img src="${b.icon}" width="32" height="32" style="border:none; margin-right:12px; flex-shrink:0;">
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <span style="font-weight:bold; font-size: 1.1em; line-height: 1.2; color: var(--color-text-primary);">${b.name}</span>
                        <span style="font-size:0.9em; color: var(--color-text-secondary);">${displayFormula}</span>
                        ${consumeBadge}
                    </div>
                </label>
            </div>`;
        });

        html += `</div>`; 

        if (this.type === "damage") {
            const critChecked = this.isCritDefault ? "checked" : "";
            html += `
            <div class="form-group" style="display:flex; align-items:center; margin-top: 5px; padding: 10px; border: 1px solid var(--color-border-highlight); border-radius: 4px; background: rgba(255, 0, 0, 0.05);">
                <input type="checkbox" name="applyCrit" id="applyCrit" ${critChecked} style="margin-right: 12px; width: 16px; height: 16px; cursor:pointer;">
                <label for="applyCrit" style="cursor:pointer; font-weight:bold; color: var(--color-text-primary); margin:0; user-select:none; display:flex; align-items:center;">
                    <i class="fas fa-bullseye" style="color: var(--color-text-danger); margin-right: 8px;"></i>
                    Roll as Critical Hit
                </label>
            </div>`;
        }

        html += `
            <div class="form-footer" style="margin-top: 10px; display: flex; justify-content: flex-end;">
                <button type="submit" class="save" style="width: auto; min-width: 120px;">
                    <i class="fas fa-dice-d20"></i> Apply Bonus
                </button>
            </div>
        </div>
        `;

        const div = document.createElement("div");
        div.innerHTML = html;

        const customInputContainer = div.querySelector('.custom-input-container');
        const customInput = div.querySelector('input[name="customFormula"]');
        const allRadios = div.querySelectorAll('input[name="bonusIndex"]');

        allRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === "custom") {
                    customInputContainer.style.display = 'block';
                    customInput.focus();
                } else {
                    customInputContainer.style.display = 'none';
                }
            });
        });

        return div;
    }

    _replaceHTML(result, content, options) {
        content.replaceChildren(result);
    }

    async _handleSubmit(event, form, formData) {
        const indexValue = formData.object.bonusIndex;
        const customFormula = formData.object.customFormula;
        const applyCrit = formData.object.applyCrit === true || formData.object.applyCrit === "on";

        if (this.onSubmitCallback) {
            if (indexValue === "custom") {
                if (!customFormula || customFormula.trim() === "") {
                    return ui.notifications.warn("Please enter a custom bonus formula.");
                }
                
                await this.onSubmitCallback({
                    isCustom: true,
                    formula: customFormula,
                    applyCrit: applyCrit
                });
            } else if (indexValue !== undefined) {
                await this.onSubmitCallback({
                    isCustom: false,
                    index: parseInt(indexValue),
                    applyCrit: applyCrit
                });
            }
        }
    }
}