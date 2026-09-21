import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../../restrictions.json');

function saveRestriction(commandName, roleId) {
    let data = {};
    if (fs.existsSync(dbPath)) {
        try { data = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { data = {}; }
    }
    data[commandName] = roleId;
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

export default {
    data: new SlashCommandBuilder()
        .setName('restrict')
        .setDescription('Assign a specific command to a specific role')
        .addRoleOption(option =>
            option.setName('target_role')
                .setDescription('The role that you want to add command access to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('command_name')
                .setDescription('The command to unlock for this role')
                .setRequired(true)
                .addChoices(
                    { name: 'say', value: 'say' },
                    { name: 'compare', value: 'compare' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const selectedRole = interaction.options.getRole('target_role');
        const chosenCommand = interaction.options.getString('command_name');

        saveRestriction(chosenCommand, selectedRole.id);

        await interaction.reply({
            content: `✅ **Permissions Updated:** Only users with the role ${selectedRole} can now use the \`/\${chosenCommand}\` command!`,
            ephemeral: false
        });
    },
};
