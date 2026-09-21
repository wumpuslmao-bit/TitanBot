const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../../restrictions.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Makes the bot repeat text, upload images, or display JSON embeds')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The text or custom emoji format you want the bot to say')
                .setRequired(false)
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
        // 🔒 CHECK DATABASE FOR RESTRICTIONS
        if (fs.existsSync(dbPath)) {
            try {
                const restrictions = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const requiredRoleId = restrictions['say'];
                
                // If a restriction exists and the user doesn't have the role, block them!
                if (requiredRoleId && !interaction.member.roles.cache.has(requiredRoleId)) {
                    return await interaction.reply({
                        content: '❌ **Access Denied:** You do not have the designated role required to execute this command.',
                        ephemeral: true
                    });
                }
            } catch (e) { console.error(e); }
        }

        const userMessage = interaction.options.getString('message');
        const imageAttachment = interaction.options.getAttachment('image');
        const jsonEmbedString = interaction.options.getString('json_embed');

        if (!userMessage && !imageAttachment && !jsonEmbedString) {
            return await interaction.reply({ content: '❌ You must provide at least text, an image, or a JSON embed!', ephemeral: true });
        }

        const replyOptions = {};
        if (userMessage) replyOptions.content = userMessage;
        if (imageAttachment) replyOptions.files = [imageAttachment.url];

        if (jsonEmbedString) {
            try {
                const parsedJson = JSON.parse(jsonEmbedString);
                const embedData = parsedJson.embeds ? parsedJson.embeds : parsedJson;
                replyOptions.embeds = [EmbedBuilder.from(embedData)];
            } catch (error) {
                return await interaction.reply({ content: `❌ **Invalid JSON Syntax:**\n\`\`\`${error.message}\`\`\``, ephemeral: true });
            }
        }

        await interaction.reply(replyOptions);
    },
};
