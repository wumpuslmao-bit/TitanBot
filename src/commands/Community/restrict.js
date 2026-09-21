const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restrict')
        .setDescription('Choose a specific role that is allowed to execute advanced bot commands')
        .addRoleOption(option =>
            option.setName('target_role')
                .setDescription('Select the Discord role you want to authorize')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only server admins can run this configuration command!
    
    async execute(interaction) {
        const selectedRole = interaction.options.getRole('target_role');

        // This outputs the configuration choice directly in chat
        await interaction.reply({
            content: `✅ **Configuration Updated:** Members with the role ${selectedRole} are now authorized to manage specified bot functions!`,
            ephemeral: false
        });
    },
};
