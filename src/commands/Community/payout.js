const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('payout')
        .setDescription('Sends formatted Minecraft account details and tags the user.')
        .addStringOption(option =>
            option.setName('account')
                .setDescription('Enter details in format email:pass')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select the user to ping')
                .setRequired(true)),

    async execute(interaction) {
        const inputCombo = interaction.options.getString('account');
        const targetUser = interaction.options.getUser('user');

        // Split the combo into email and password at the first colon
        const parts = inputCombo.split(':');
        
        if (parts.length < 2) {
            return interaction.reply({ 
                content: '❌ Invalid format! Please use the `email:pass` format.', 
                ephemeral: true 
            });
        }

        const email = parts[0];
        // Rejoin remaining parts in case the password itself contains a colon
        const password = parts.slice(1).join(':');

        // Construct the output message with custom emojis and spoiler tags
        const outputMessage = 
`# <a:MINECRAFT:1552272708610297860> Here is your (hopefully) permenant MCFA! <a:MINECRAFT:1552272708610297860>
** <a:email:1537480214634831963> Email: ||\`${email}\`||**
** <:password:1532425179991511040> Pass: ||\`${password}\`||**
** <a:MINECRAFT:1552272708610297860>Combo: ||\`${inputCombo}\`||**
# ARE WE <a:legit:1440572514291028038>? 
# <a:MINECRAFT:1552272708610297860> MAKE SURE TO VOUCH IF WORKS <a:MINECRAFT:1552272708610297860>
**Type:**
#  **\`Vouch (ping me @minehack_. ) for permenant mcfa LEGITTT\`**
-# Ping: ${targetUser}`;

        // Send the response
        await interaction.reply({ content: outputMessage });
    },
};
