# Ready Set Roll for 5e - FoundryVTT Module
![Latest Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FMangoFVTT%2Ffvtt-ready-set-roll-5e%2Fmaster%2Fmodule.json&label=Latest%20Release&prefix=v&query=$.version&colorB=blue&style=for-the-badge)
![Foundry Versions](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fraw.githubusercontent.com%2FMangoFVTT%2Ffvtt-ready-set-roll-5e%2Fmaster%2Fmodule.json&color=ff601e&label=Compatible%20Foundry%20Versions)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/MangoFVTT/fvtt-ready-set-roll-5e/total?style=for-the-badge&label=Module%20Downloads)

**Ready Set Roll** is a Foundry VTT module that accelerates the built in rolling system of the [Foundry DnD5e system](https://github.com/foundryvtt/dnd5e). It allows for quick rolls with advantage, disadadvantage, and other modifiers for skills, items, ability checks, and saving throws. This module is a complete rewrite and modernisation of [RedReign](https://github.com/RedReign)'s [Better Rolls for 5e](https://github.com/RedReign/FoundryVTT-BetterRolls5e) module, which is no longer supported, and no longer functional as of more recent versions of FoundryVTT. 

If you are feeling generous, and would like to support my work (MangoFYTT), you can do so through this [Paypal](https://www.paypal.com/paypalme/MangoFVTT) link, or through the sponsorship options in the sidebar. Thank you!

## Installation

### Method 1
1. Start up Foundry and click "Install Module" in the "Add-on Modules" tab.
2. Search for "Ready Set Roll" in the pop up window.
3. Click "Install" and the module should download and appear in your modules list.
4. Enjoy!

### Method 2
1. Start up Foundry and click "Install Module" in the "Add-on Modules" tab.
2. Paste one of the following into the "Manifest URL" field:
    - *Latest Release:* `https://raw.githubusercontent.com/MangoFVTT/fvtt-ready-set-roll-5e/master/module.json`
    - *Previous Releases:* A link to the `module.json` file from any of the [previous releases](https://github.com/MangoFVTT/fvtt-ready-set-roll-5e/releases).
3. Click "Install" and the module should download and appear in your modules list.
4. Enjoy!

## Compatibility
**IMPORTANT:** Ready Set Roll is not compatible with other modules which modify DnD5e rolls or chat cards (for example, [Midi-QOL](https://gitlab.com/tposney/midi-qol)). While it is possible that such modules may also still work, using their roll automation features alongside this module is likely to cause issues, and is not recommended.

### Verified Modules
The following modules have been verified as compatible from the specified module release onward. Note that updates to Foundry VTT or the module in question may cause incompatibilities that need to be re-tested. Furthermore, each verified module is tested with Ready Set Roll in isolation. Combining modules is likely to still work, however may cause issues. Always proceed with caution (keep backups) when installing and using multiple modules.
- [Dice So Nice](https://gitlab.com/riccisi/foundryvtt-dice-so-nice) <sup>(1.2.0+)</sup>

## Implemented Features

### Quick Rolls
- Rolls for skills, abilities, and items are outputted automatically to chat instead of relying on the default roll dialog system. These quick rolls can be enabled or disabled individually for each category of rolls, or bypassed in favour of the default behaviour by holding the dnd5e `Skip Dialog` key modifier when clicking the roll.
- Items will automatically output damage, calculate critical damage (taking into account system settings for powerful criticals or critical numerical modifiers), place area templates, print Save DC buttons, and a variety of other options that can all be configured independently for each item.
- Using modifier keys as set up in the dnd5e controls allows for the roll to immediately output with advantage or disadvantage, and will automatically add in any required additional rolls (e.g. for Elven Accuracy). Rolls with advantage or disadvantage highlight the correct roll, indicating which roll is used.

![quickrolls](https://github.com/MangoFVTT/fvtt-ready-set-roll-5e/assets/110994627/2fc0e9f8-c964-49cb-8b08-44086bf4a0f8)

- If the correct setting is enabled, quick rolls can also always display the maximum amount of correct dice for a roll (2 normally, 3 for an Elven Accuracy roll) even when the roll does not have advantage or disadvantage. This can be interchangeably combined with using modifier keys to grant a roll advantage or disadvantage, in which case the correct roll out of those displayed will be highlighted as normal.

![alwayson](https://github.com/MangoFVTT/fvtt-ready-set-roll-5e/assets/110994627/4b9c0312-7bd6-4232-af9f-ff11ad960a06)

### Retroactive Roll Editing
- If enabled via the module settings, quick rolls can be edited post creation, allowing for retroactively rolling advantage, disadvantage, or critical damage for a roll after it has already been created.
- Changes to the roll will automatically live edit the quick roll's chat card, displaying the new data alongside the already existing roll.

![retroactiveoverlay](https://github.com/MangoFVTT/fvtt-ready-set-roll-5e/assets/110994627/d73efc5b-cf47-4dca-a5af-6dff9c531359)

### Retroactive Bonus Manager
- **Post-Roll Bonuses**: You can seamlessly add bonuses (like Bardic Inspiration, Bless, or custom numeric values) to a roll *after* it has already been made in chat.
- **Smart Detection**: Injects a Plus (+) icon into Attack, Damage, Ability Check, Skill, and Saving Throw headers. Clicking this opens a custom dialog to select detected active effects on your actor, or input custom formulas.
- **Consumption Logic**: Supports "Once" effects and can automatically consume item uses (e.g., ticking down a Bardic Inspiration die) when a bonus is applied.

#### How to Configure Retroactive Bonuses
The Bonus Manager automatically detects **Active Effects** on your actor that are configured to provide a retroactive bonus. To create a compatible effect, add a change to an Active Effect with the following details:

* **Attribute Key**: `flags.rsr5e-addon.bonus`
* **Value Syntax**: `formula; type: [types]; [options]`

**Syntax Breakdown**
* **Formula**: The bonus to add (e.g., `1d4`, `+5`, or `@abilities.cha.mod`).
* **type**: (Optional) Restrict where the bonus appears. Use `attack`, `damage`, `check`, `save`, `skill`, or `any` (default). You can list multiple separated by commas.
* **once**: (Optional) If included, the Active Effect is deleted automatically after the bonus is used once.
* **consume**: (Optional) Consumes a usage from an item.
    * `consume: origin` — Consumes 1 use from the item that created the effect.
    * `consume: [Item Name or ID]` — Consumes 1 use from a specific named item on the actor.

**Examples**
1. **Bless**: `1d4; type: attack, save`
2. **Bardic Inspiration**: `1d8; type: attack, save, check, skill; once`
3. **Static Tactical Bonus**: `+2; type: attack`

#### How to Use in Play
1. Perform your roll as usual using Ready Set Roll.
2. In the Chat Card, look for the **Plus (+)** icon in the header of the roll section.
3. Click the icon to open the **Bonus Selector**.
4. Select one of your detected Active Effects or choose **Custom Bonus** to type in a formula.
5. Click **Apply Bonus** to update the roll result in place.

<img width="1199" height="624" alt="image" src="https://github.com/user-attachments/assets/9a53d49b-6163-43bd-a974-a282d3c0a360" />

### Individual Dice Rerolling & GM Fudging
- **Interactive Dice**: If enabled via the module settings, players can individually reroll specific dice by simply left-clicking on the die result within the chat card tooltip.
- **GM Fudging**: GMs have the added ability to silently control fate. By right-clicking any die result within a tooltip, the GM can manually input and set it to a specific number.
- Modifying dice will automatically recalculate the modifiers, update the totals, and live-edit the chat card to display the new results seamlessly.

### Apply Individual Damage
- If enabled via the module settings, each damage field in a quick roll chat card can apply damage or healing to selected or targeted tokens via overlay buttons. This extends core system behaviour (applying damage via context menus) to allow for the application of each damage field individually instead of as a single whole.
- Damage fields can be applied in a specific manner (damage or healing) regardless of the actual damage type. This is intended to allow Players or GMs to manually decide what to do with the damage field in the event of edge cases (such as a specific damage type healing instead of doing damage for a particular creature).

![damageoverlay](https://github.com/MangoFVTT/fvtt-ready-set-roll-5e/assets/110994627/f610f9be-9578-435a-abb5-bac082abe06f)

## Planned Features
- [See [FEATURE] Issues List](https://github.com/MangoFVTT/fvtt-ready-set-roll-5e/issues?q=is%3Aopen+is%3Aissue+label%3Afeature)

## Known Issues
- [See [BUG] Issues list](https://github.com/MangoFVTT/fvtt-ready-set-roll-5e/issues?q=is%3Aopen+is%3Aissue+label%3Abug+)

## Acknowledgements
- Atropos and the Foundry development team for making a truly fantastic VTT.
- RedReign for creating the original Better Rolls for 5e module, without which this module would not exist.
- All the wonderful folks on the Foundry VTT discord for their tireless community efforts.

## License
The source code is licensed under GPL-3.0.
