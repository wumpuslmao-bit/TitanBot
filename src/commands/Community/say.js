const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Makes the bot repeat what you type')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The text you want the bot to say')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        const userMessage = interaction.options.getString('message');
        await interaction.reply(userMessage);
    },
};
