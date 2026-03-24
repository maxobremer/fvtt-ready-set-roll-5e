import { MODULE_SHORT } from "../module/const.js";
import { ROLL_TYPE } from "./roll.js";
import { SETTING_NAMES, SettingsUtility } from "./settings.js";

/**
 * Utility class to handle rerolling and fudging individual dice on the canvas.
 */
export class RerollManager {
    static registerGlobalListener() {
        // Listen for clicks on the document to catch dice result interactions
        $(document).on("mousedown", ".dice-tooltip .dice-rolls .roll.die", (event) => {
            if (!SettingsUtility.getSettingValue(SETTING_NAMES.REROLL_EVERYONE)) return;
            
            const dieElement = $(event.currentTarget);
            const messageElement = dieElement.closest(".chat-message");
            const messageId = messageElement.data("messageId");
            const message = game.messages.get(messageId);

            if (!message) return;

            // Handle Right-Click (GM Fudge)
            if (event.button === 2) {
                if (!game.user.isGM || !SettingsUtility.getSettingValue(SETTING_NAMES.FUDGE_GM)) return;
                this._handleFudge(message, dieElement);
            } 
            // Handle Left-Click (Player/Author Reroll)
            else if (event.button === 0) {
                const canReroll = game.user.isGM || 
                                 (message.isAuthor && SettingsUtility.getSettingValue(SETTING_NAMES.REROLL_PLAYERS));
                if (!canReroll) return;
                this._handleReroll(message, dieElement);
            }
        });
    }

    static async _handleReroll(message, dieElement) {
        const { rollIndex, termIndex, resultIndex } = this._getDiePath(dieElement);
        const rolls = [...message.rolls];
        const targetRoll = rolls[rollIndex];
        const targetTerm = targetRoll.terms[termIndex];
        
        // Create a new roll for just one die
        const newDieRoll = await new Roll(`1d${targetTerm.faces}`).evaluate();
        const newResult = newDieRoll.dice[0].results[0];
        
        // Update the original result
        targetTerm.results[resultIndex].result = newResult.result;
        
        // Re-evaluate modifiers (Advantage/Disadvantage highlighting)
        this._recalculateModifiers(targetTerm);

        // Force Foundry to re-evaluate the total
        targetRoll._total = targetRoll._evaluateTotal();
        
        await message.update({ rolls: rolls });
        ui.notifications.info(`Rerolled die: New result is ${newResult.result}`);
    }

    static async _handleFudge(message, dieElement) {
        const { rollIndex, termIndex, resultIndex } = this._getDiePath(dieElement);
        
        new Dialog({
            title: "Fudge Die Result",
            content: `<input type="number" id="fudge-value" placeholder="Enter new value" autofocus>`,
            buttons: {
                fudge: {
                    label: "Fudge It",
                    callback: async (html) => {
                        const newVal = parseInt(html.find("#fudge-value").val());
                        if (isNaN(newVal)) return;

                        const rolls = [...message.rolls];
                        const targetRoll = rolls[rollIndex];
                        const targetTerm = targetRoll.terms[termIndex];

                        targetTerm.results[resultIndex].result = newVal;
                        
                        // Re-evaluate modifiers (Advantage/Disadvantage highlighting)
                        this._recalculateModifiers(targetTerm);

                        targetRoll._total = targetRoll._evaluateTotal();

                        await message.update({ rolls: rolls });
                    }
                }
            }
        }).render(true);
    }

    /**
     * Resets die result states and re-runs Advantage/Disadvantage logic.
     * @private
     */
    static _recalculateModifiers(targetTerm) {
        if (targetTerm.modifiers.some(m => m.includes("kh") || m.includes("kl"))) {
            // Reset states so Foundry can re-determine which to discard
            targetTerm.results.forEach(r => {
                r.discarded = false;
                r.active = true;
            });
            // Foundry internal method to re-apply "Keep Highest/Lowest" logic
            targetTerm._evaluateModifiers();
        }
    }

    static _getDiePath(dieElement) {
        // Find the index of the tool-tip part (e.g., separate entries for d20 and constant bonuses)
        const tooltipPart = dieElement.closest(".tooltip-part");
        const allParts = dieElement.closest(".dice-tooltip").find(".tooltip-part");
        const termIndex = allParts.index(tooltipPart);

        // Find the index of the roll (usually 0 for RSR, but helps if multiple rolls exist)
        const diceRoll = dieElement.closest(".dice-roll");
        const allDiceRolls = dieElement.closest(".message-content").find(".dice-roll");
        const rollIndex = Math.max(0, allDiceRolls.index(diceRoll));

        const resultIndex = dieElement.index();

        return { rollIndex, termIndex, resultIndex };
    }
}
