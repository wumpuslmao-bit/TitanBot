import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../../restrictions.json');

export default {
    data: new SlashCommandBuilder()
        .setName('payout')
        .setDescription('Sends formatted Minecraft account details and tags the user.')
        .addStringOption(option =>
            option.setName('email')
                .setDescription('The account email')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('pass')
                .setDescription('The account password')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('combo')
                .setDescription('The email:pass combo string')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ping')
                .setRequired(true)),

    async execute(interaction) {
        // Role restrictions safety check from your codebase
        if (fs.existsSync(dbPath)) {
            try {
                const restrictions = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const requiredRoleId = restrictions['payout'] || restrictions['say']; // checks payout or say role rules
                
                if (requiredRoleId && !interaction.member.roles.cache.has(requiredRoleId)) {
                    return await interaction.reply({
                        content: '❌ **Access Denied:** You do not have the designated role required to execute this command.',
                        ephemeral: true
                    });
                }
            } catch (e) { console.error(e); }
        }

        // Pull the individual parameters from the command arguments
        const email = interaction.options.getString('email');
        const pass = interaction.options.getString('pass');
        const combo = interaction.options.getString('combo');
        const targetUser = interaction.options.getUser('user');

        // Construct your text block exactly as requested with Nitro formatting
        const outputMessage = 
`# <a:minecraft:1545768000836345987> Here is your (hopefully) permenant MCFA! <a:minecraft:1545768000836345987> 
** 📬 Email: ||\`\${email}\`||**
**  🔑 Pass: ||\`\${pass}\`||**
** <a:minecraft:1545768000836345987> Combo: ||\`\${combo}\`||**
# ARE WE <a:legit:1553335710583492648> ? 
# <a:minecraft:1545768000836345987> MAKE SURE TO VOUCH IF WORKS <a:minecraft:1545768000836345987> 
**Type:**
#  **\`Vouch (ping me @minehack_. ) for permenant mcfa LEGITTT\`**
-# Ping: ${targetUser}`;

        try {
            // 🛠️ FIX: Send directly to the channel to hide who triggered the command
            await interaction.channel.send({ content: outputMessage });

            // Silently acknowledge to the command author that it worked
            await interaction.reply({ content: '✅ Payout details deployed successfully!', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Failed to deploy message. Verify bot application permissions.', ephemeral: true });
        }
    },
};
