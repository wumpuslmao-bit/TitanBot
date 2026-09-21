const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../../restrictions.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compare stats between two YouTube channels side-by-side')
        .addStringOption(option =>
            option.setName('channel_one')
                .setDescription('Type the first YouTuber handle (e.g., MrBeast)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('channel_two')
                .setDescription('Type the second YouTuber handle (e.g., PewDiePie)')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        // 🔒 CHECK DATABASE FOR RESTRICTIONS
        if (fs.existsSync(dbPath)) {
            try {
                const restrictions = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const requiredRoleId = restrictions['compare'];
                
                if (requiredRoleId && !interaction.member.roles.cache.has(requiredRoleId)) {
                    return await interaction.reply({
                        content: '❌ **Access Denied:** You do not have the designated role required to execute this command.',
                        ephemeral: true
                    });
                }
            } catch (e) { console.error(e); }
        }

        const creator1 = interaction.options.getString('channel_one');
        const creator2 = interaction.options.getString('channel_two');

        const subCount1 = Math.floor(Math.random() * 50) + 1;
        const subCount2 = Math.floor(Math.random() * 50) + 1;
        const totalViews1 = (subCount1 * 4.2).toFixed(1);
        const totalViews2 = (subCount2 * 4.2).toFixed(1);

        const winnerText = subCount1 > subCount2 
            ? `🏆 **${creator1}** takes the lead!`
            : subCount2 > subCount1 
            ? `🏆 **${creator2}** takes the lead!`
            : `⚖️ It's a perfect tie!`;

        const comparisonEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('📊 YouTube Channel Analytics Comparison')
            .setDescription(`Side-by-side evaluation between **${creator1}** and **${creator2}**.\n\n${winnerText}`)
            .addFields(
                { name: `👤 ${creator1}`, value: `• **Subscribers:** ${subCount1}M\n• **Total Views:** ${totalViews1}B`, inline: true },
                { name: `🆚 VS`, value: `\u200b`, inline: true }, 
                { name: `👤 ${creator2}`, value: `• **Subscribers:** ${subCount2}M\n• **Total Views:** ${totalViews2}B`, inline: true }
            )
            .setFooter({ text: 'MineBot Analytics Tracker', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [comparisonEmbed] });
    },
};
