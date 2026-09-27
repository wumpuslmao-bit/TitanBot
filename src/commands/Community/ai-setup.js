import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  Type
} from 'discord.js';
import { GoogleGenAI } from '@google/genai';

// --- IN-MEMORY CONFIG STORE (Keyed by Guild ID) ---
// Keeps track of state, API key, system prompt/goals, and known server bots per server
const guildAiConfigs = new Map();

// --- DEFINED AI TOOLS FOR DISCORD ACTIONS ---
const botTools = [
  {
    name: 'kickUser',
    description: 'Kick a member from the Discord server.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        userId: { type: Type.STRING, description: 'The Discord User ID to kick' },
        reason: { type: Type.STRING, description: 'Reason for kicking' }
      },
      required: ['userId']
    }
  },
  {
    name: 'banUser',
    description: 'Ban a member from the Discord server.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        userId: { type: Type.STRING, description: 'The Discord User ID to ban' },
        reason: { type: Type.STRING, description: 'Reason for banning' }
      },
      required: ['userId']
    }
  },
  {
    name: 'createTicketChannel',
    description: 'Create a private support ticket channel for a user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: 'Reason or topic for the support ticket' }
      },
      required: ['topic']
    }
  },
  {
    name: 'startGiveaway',
    description: 'Announce and start a giveaway in the channel.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prize: { type: Type.STRING, description: 'The prize being given away' },
        durationMinutes: { type: Type.NUMBER, description: 'Duration in minutes' }
      },
      required: ['prize', 'durationMinutes']
    }
  },
  {
    name: 'runExternalBotCommand',
    description: 'Execute a command meant for another bot installed in the server (e.g., ticket bots, music bots).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetBotName: { type: Type.STRING, description: 'Name of the bot being targeted' },
        commandText: { type: Type.STRING, description: 'The exact command string to send (e.g. "!ticket create" or "/play")' }
      },
      required: ['commandText']
    }
  }
];

export default {
  data: new SlashCommandBuilder()
    .setName('ai-setup')
    .setDescription('Configure AI key, state, goal, or execute instructions')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Optional API Key (only needs to be entered once or when updating)
    .addStringOption(opt =>
      opt.setName('api-key')
        .setDescription('Your Gemini API key (only enter once or when changing)')
        .setRequired(false)
    )
    // Optional ON/OFF Toggle
    .addBooleanOption(opt =>
      opt.setName('status')
        .setDescription('Turn AI assistant ON (true) or OFF (false)')
        .setRequired(false)
    )
    // Optional Goal / Persona Instructions
    .addStringOption(opt =>
      opt.setName('goal')
        .setDescription('Define AI name, personality, and main goal (e.g., manage tickets, moderate, host giveaways)')
        .setRequired(false)
    )
    // Optional Direct Prompt / Action Execution
    .addStringOption(opt =>
      opt.setName('prompt')
        .setDescription('Action or question for the AI to process right now')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;

    // Load existing settings or initialize defaults
    let config = guildAiConfigs.get(guildId) || { 
      enabled: true, 
      apiKey: null, 
      goal: 'You are an AI assistant managing this server. Help moderate, create tickets, and manage community actions.' 
    };

    const inputKey = interaction.options.getString('api-key');
    const inputStatus = interaction.options.getBoolean('status');
    const inputGoal = interaction.options.getString('goal');
    const inputPrompt = interaction.options.getString('prompt');

    let updatesApplied = [];

    // Update API Key if provided
    if (inputKey) {
      config.apiKey = inputKey;
      updatesApplied.push('🔑 API Key updated');
    }

    // Update Status if provided
    if (inputStatus !== null) {
      config.enabled = inputStatus;
      updatesApplied.push(`⚡ Status set to **${inputStatus ? 'ON ✅' : 'OFF ❌'}**`);
    }

    // Update Goal / Persona if provided
    if (inputGoal) {
      config.goal = inputGoal;
      updatesApplied.push('🎯 Server Goal/Persona updated');
    }

    // Save configuration updates back to map
    guildAiConfigs.set(guildId, config);

    // If configuration options were passed without a prompt, reply with the settings summary
    if (!inputPrompt) {
      const summaryMessage = updatesApplied.length > 0 
        ? `✅ **Configuration Updated:**\n- ${updatesApplied.join('\n- ')}`
        : `⚙️ **Current AI Configuration:**\n- Status: **${config.enabled ? 'ON ✅' : 'OFF ❌'}**\n- Key Saved: **${config.apiKey ? 'Yes' : 'No (Using Environment Variable fallback)'}**\n- Goal: *"${config.goal}"*`;

      return interaction.reply({ content: summaryMessage, ephemeral: true });
    }

    // --- PROMPT EXECUTION SECTION ---
    if (!config.enabled) {
      return interaction.reply({ content: '⚠️ AI features are currently **DISABLED** for this server.', ephemeral: true });
    }

    const activeApiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return interaction.reply({ content: '⚠️ No Gemini API Key set. Pass your key in `/ai-setup api-key: <key>` or set `GEMINI_API_KEY` on Railway.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      // Get list of bots present in the guild so Gemini is aware of them
      const members = await interaction.guild.members.fetch();
      const botList = members
        .filter(member => member.user.bot)
        .map(bot => `${bot.user.username} (ID:${bot.id})`)
        .join(', ');

      // Build system prompt combining the server goal and detected bots
      const fullSystemInstruction = `${config.goal}\n\nList of active bots present in this server: [${botList || 'None'}]. If asked to run commands for other bots, use the runExternalBotCommand tool.`;

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: inputPrompt,
        config: {
          systemInstruction: fullSystemInstruction,
          tools: [{ functionDeclarations: botTools }]
        }
      });

      // Output conversational reply
      if (response.text) {
        await interaction.editReply(response.text);
      } else {
        await interaction.editReply('⚙️ Processing requested action...');
      }

      // Handle function execution calls
      const functionCalls = response.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          await handleToolExecution(call, interaction);
        }
      }
    } catch (err) {
      console.error('AI Processing Error:', err);
      await interaction.editReply('❌ Failed to process request. Ensure your API Key is valid.');
    }
  }
};

// --- HANDLER FOR EXECUTING DISCORD ACTIONS VIA AI ---
async function handleToolExecution(call, interaction) {
  const { name, args } = call;

  // 1. BAN USER
  if (name === 'banUser') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.followUp({ content: "❌ You don't have permission to ban members!", ephemeral: true });
    }
    const target = await interaction.guild.members.fetch(args.userId).catch(() => null);
    if (!target) return interaction.followUp({ content: '❌ User not found.', ephemeral: true });

    await target.ban({ reason: args.reason || 'Banned by AI Command' });
    await interaction.followUp(`🔨 Banned <@${args.userId}>. Reason: ${args.reason || 'None'}`);
  }

  // 2. KICK USER
  if (name === 'kickUser') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.followUp({ content: "❌ You don't have permission to kick members!", ephemeral: true });
    }
    const target = await interaction.guild.members.fetch(args.userId).catch(() => null);
    if (!target) return interaction.followUp({ content: '❌ User not found.', ephemeral: true });

    await target.kick(args.reason || 'Kicked by AI Command');
    await interaction.followUp(`👞 Kicked <@${args.userId}>. Reason: ${args.reason || 'None'}`);
  }

  // 3. CREATE TICKET CHANNEL
  if (name === 'createTicketChannel') {
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      reason: args.topic || 'Support Ticket'
    });
    await ticketChannel.send(`🎟️ **Ticket Created for <@${interaction.user.id}>**\nTopic:${args.topic}`);
    await interaction.followUp(`✅ Created support ticket channel: ${ticketChannel}`);
  }

  // 4. START GIVEAWAY
  if (name === 'startGiveaway') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.followUp({ content: "❌ You don't have permission to start giveaways!", ephemeral: true });
    }
    await interaction.followUp(`🎉 **GIVEAWAY STARTED!**\n**Prize:** ${args.prize}\n**Duration:** ${args.durationMinutes} minute(s)\nReact with 🎉 to enter!`);
  }

  // 5. RUN EXTERNAL BOT COMMAND
  if (name === 'runExternalBotCommand') {
    await interaction.channel.send(`${args.commandText}`);
    await interaction.followUp(`🤖 Forwarded command for bot **${args.targetBotName}**: \`${args.commandText}\``);
  }
}
