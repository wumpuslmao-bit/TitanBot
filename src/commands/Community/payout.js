import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
    // 1. Setup the command registration details matching your bot's system
    data: new SlashCommandBuilder()
        .setName('payout')
        .setDescription('Sends formatted Minecraft account details and tags the user.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // 🔒 Staff only
        .addStringOption(option =>
            option.setName('account')
                .setDescription('Enter details in format email:pass')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select the user to ping')
                .setRequired(true)),

    // 2. Main command logic
    async execute(interaction) {
        const inputCombo = interaction.options.getString('account');
        const targetUser = interaction.options.getUser('user');

        // Split the combo into email and password at the first colon
        const parts = inputCombo.split(':');
        
        // Safety check for correct format
        if (parts.length < 2) {
            return await interaction.reply({ 
                content: '❌ **Invalid format!** Please use the `email:pass` format structure.', 
                ephemeral: true 
            });
        }

        const email = parts[0];
        const password = parts.slice(1).join(':'); // Handles passwords with colons safely

        // Build a highly stylized Discord Embed box
        const payoutEmbed = new EmbedBuilder()
            .setColor('#2ecc71') // Green success theme
            .setTitle('<a:MINECRAFT:1552272708610297860> Minecraft Full Access (MCFA) Delivery')
            .setDescription(`Here are your account credentials. Click the black bars below to reveal them safely!`)
            .addFields(
                { name: '<a:email:1537480214634831963> Email', value: `||\`\${email}\`||`, inline: false },
                { name: '<a:password:1532425179991511040> Password', value: `||\`\${password}\`||`, inline: false },
                { name: '📋 Full Combo String', value: `||\`\${inputCombo}\`||`, inline: false }
            )
            .addFields(
                { name: '❓ ARE WE <a:legit:1440572514291028038>?', value: '⚡ **MAKE SURE TO VOUCH IF IT WORKS!**', inline: false },
                { name: '✍️ How to Vouch:', value: '`Vouch (ping me @minehack_. ) for permenant mcfa LEGITTT`', inline: false }
            )
            .setFooter({ text: 'TitanBot Payout System' })
            .setTimestamp();

        // Sends message to the channel and pings the specific user
        await interaction.reply({ 
            content: `👋 ${targetUser}, your payout is ready!`, 
            embeds: [payoutEmbed] 
        });
    },
};
