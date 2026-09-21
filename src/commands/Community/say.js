const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Makes the bot repeat text, upload images, or display JSON embeds')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The text or custom emoji format you want the bot to say')
                .setRequired(false) // Changed to false so you can send JUST an image or JUST an embed
        )
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Upload an optional image for the bot to send')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('json_embed')
                .setDescription('Paste raw JSON code here to generate a custom embed')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        const userMessage = interaction.options.getString('message');
        const imageAttachment = interaction.options.getAttachment('image');
        const jsonEmbedString = interaction.options.getString('json_embed');

        // Check if the user completely forgot to fill out anything
        if (!userMessage && !imageAttachment && !jsonEmbedString) {
            return await interaction.reply({ 
                content: '❌ You must provide at least a text message, an image, or a JSON embed!', 
                ephemeral: true 
            });
        }

        const replyOptions = {};

        // 1. Handle Text Message
        if (userMessage) {
            replyOptions.content = userMessage;
        }

        // 2. Handle Image Upload
        if (imageAttachment) {
            replyOptions.files = [imageAttachment.url];
        }

        // 3. Handle JSON Embed parsing
        if (jsonEmbedString) {
            try {
                const parsedJson = JSON.parse(jsonEmbedString);
                // Accepts either a single embed object, or a full {"embeds": [...]} JSON block
                const embedData = parsedJson.embeds ? parsedJson.embeds[0] : parsedJson;
                
                const customEmbed = EmbedBuilder.from(embedData);
                replyOptions.embeds = [customEmbed];
            } catch (error) {
                return await interaction.reply({ 
                    content: `❌ **Invalid JSON Syntax:**\n\`\`\`${error.message}\`\`\``, 
                    ephemeral: true 
                });
            }
        }

        // Send everything together under the blue command header!
        await interaction.reply(replyOptions);
    },
};
