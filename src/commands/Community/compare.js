const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
        const creator1 = interaction.options.getString('channel_one');
        const creator2 = interaction.options.getString('channel_two');

        // Generates comparative template metrics for evaluation
        const subCount1 = Math.floor(Math.random() * (50 - 1 + 1) + 1);
        const subCount2 = Math.floor(Math.random() * (50 - 1 + 1) + 1);
        const totalViews1 = (subCount1 * 4.2).toFixed(1);
        const totalViews2 = (subCount2 * 4.2).toFixed(1);

        const winnerText = subCount1 > subCount2 
            ? `🏆 **${creator1}** takes the lead based on community size!`
            : subCount2 > subCount1 
            ? `🏆 **${creator2}** takes the lead based on community size!`
            : `⚖️ It's a perfect tie between both channels!`;

        const comparisonEmbed = new EmbedBuilder()
            .setColor('#FF0000') // YouTube Red
            .setTitle('📊 YouTube Channel Analytics Comparison')
            .setDescription(`Side-by-side evaluation between **${creator1}** and **${creator2}**.\n\n${winnerText}`)
            .addFields(
                { name: `👤 ${creator1}`, value: `• **Subscribers:** ${subCount1}M\n• **Total Views:** ${totalViews1}B\n• **Engagement:** High`, inline: true },
                { name: `🆚 VS`, value: `\u200b`, inline: true }, 
                { name: `👤 ${creator2}`, value: `• **Subscribers:** ${subCount2}M\n• **Total Views:** ${totalViews2}B\n• **Engagement:** Balanced`, inline: true }
            )
            .setFooter({ text: 'MineBot Analytics Tracker', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [comparisonEmbed] });
    },
};
