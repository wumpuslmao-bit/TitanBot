import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../../restrictions.json');

// Helper function to fetch clean channel stats using handles or usernames
async function getChannelStats(channelName, apiKey) {
    // Standardize handle formatting strings (remove @ if the user typed it)
    const cleanName = channelName.replace('@', '').trim();
    
    // Step 1: Search for the channel ID using the handle/name string
    const searchUrl = `https://googleapis.com{encodeURIComponent(cleanName)}&key=${apiKey}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
        return null;
    }

    const channelId = searchData.items[0].id.channelId;
    const channelTitle = searchData.items[0].snippet.title;

    // Step 2: Fetch detailed statistics for that specific channel ID
    const statsUrl = `https://googleapis.com{channelId}&key=${apiKey}`;
    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();

    if (!statsData.items || statsData.items.length === 0) {
        return null;
    }

    const stats = statsData.items[0].statistics;
    const thumbnail = statsData.items[0].snippet.thumbnails.default.url;

    return {
        title: channelTitle,
        subscribers: parseInt(stats.subscriberCount || 0),
        views: parseInt(stats.viewCount || 0),
        thumbnail: thumbnail
    };
}

// Utility to format raw large numbers with clean commas/compact letters
function formatNum(num) {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
}

export default {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compare real live stats between two YouTube channels side-by-side')
        .addStringOption(option =>
            option.setName('channel_one')
                .setDescription('Type the first YouTuber handle or name (e.g., MrBeast)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('channel_two')
                .setDescription('Type the second YouTuber handle or name (e.g., PewDiePie)')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        // 🔒 CHECK DATABASE FOR ROLE RESTRICTIONS
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

        // Grab API Key from Railway Variables securely
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            return await interaction.reply({
                content: '❌ **Configuration Error:** The YouTube API key is missing from Railway settings.',
                ephemeral: true
            });
        }

        // Defer reply since fetching live APIs can take a few seconds
        await interaction.deferReply();

        const input1 = interaction.options.getString('channel_one');
        const input2 = interaction.options.getString('channel_two');

        try {
            // Fetch live API statistics side-by-side
            const data1 = await getChannelStats(input1, apiKey);
            const data2 = await getChannelStats(input2, apiKey);

            if (!data1 || !data2) {
                return await interaction.editReply({
                    content: `❌ Could not find data. Please double check that **"${!data1 ? input1 : input2}"** is typed correctly!`
                });
            }

            // Figure out who actually wins based on factual live API returns
            let winnerText = '';
            if (data1.subscribers > data2.subscribers) {
                winnerText = `🏆 **${data1.title}** takes the lead based on subscriber size!`;
            } else if (data2.subscribers > data1.subscribers) {
                winnerText = `🏆 **${data2.title}** takes the lead based on subscriber size!`;
            } else {
                winnerText = `⚖️ It's a perfect subscriber tie between both channels!`;
            }

            const comparisonEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('📊 Live YouTube Channel Analytics Comparison')
                .setDescription(`Factual side-by-side evaluation between **${data1.title}** and **${data2.title}**.\n\n${winnerText}`)
                .addFields(
                    { name: `👤 ${data1.title}`, value: `• **Subscribers:** ${formatNum(data1.subscribers)}\n• **Total Views:** ${formatNum(data1.views)}`, inline: true },
                    { name: `🆚 VS`, value: `\u200b`, inline: true }, 
                    { name: `👤 ${data2.title}`, value: `• **Subscribers:** ${formatNum(data2.subscribers)}\n• **Total Views:** ${formatNum(data2.views)}`, inline: true }
                )
                .setThumbnail(data1.thumbnail) // Displays first channel profile icon thumbnail automatically!
                .setFooter({ text: 'MineBot Live API Tracker', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [comparisonEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ An error occurred while reaching YouTube servers. Try again later!'
            });
        }
    },
};
