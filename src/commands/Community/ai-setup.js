import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, Type } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../../restrictions.json');
const configPath = path.join(__dirname, '../../../ai_config.json');

// Helper to load/save server configurations dynamically to disk
function getConfigs() {
    if (!fs.existsSync(configPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return {};
    }
}

function saveConfigs(data) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving AI config:', e);
    }
}

// Defined tools for Discord actions
const botTools = [
    {
        name: 'kickUser',
        description: 'Kick a member from the server.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                userId: { type: Type.STRING, description: 'Discord User ID' },
                reason: { type: Type.STRING, description: 'Reason for kick' }
            },
            required: ['userId']
        }
    },
    {
        name: 'banUser',
        description: 'Ban a member from the server.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                userId: { type: Type.STRING, description: 'Discord User ID' },
                reason: { type: Type.STRING, description: 'Reason for ban' }
            },
            required: ['userId']
        }
    },
    {
        name: 'createTicketChannel',
        description: 'Create a private ticket channel for support.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                topic: { type: Type.STRING, description: 'Topic or issue for ticket' }
            },
            required: ['topic']
        }
    },
    {
        name: 'startGiveaway',
        description: 'Announce and host a giveaway in the current channel.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                prize: { type: Type.STRING, description: 'Prize name' },
                durationMinutes: { type: Type.NUMBER, description: 'Duration in minutes' }
            },
            required: ['prize', 'durationMinutes']
        }
    },
    {
        name: 'runExternalBotCommand',
        description: 'Send a command targeted at another bot in the server.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                targetBotName: { type: Type.STRING, description: 'Name of the bot' },
                commandText: { type: Type.STRING, description: 'The command string (e.g. !ticket create)' }
            },
            required: ['commandText']
        }
    }
];

export default {
    data: new SlashCommandBuilder()
        .setName('ai-setup')
        .setDescription('Configure AI assistant settings, goals, API key, or execute commands')
        .addStringOption(option =>
            option.setName('api_key')
                .setDescription('Set or update your Gemini API key (saved permanently)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('status')
                .setDescription('Turn AI assistant ON or OFF')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('goal')
                .setDescription('Set main goal, identity, and behavior guidelines for the AI')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Prompt or command for the AI to process right now')
                .setRequired(false)
        ),

    async execute(interaction) {
        // --- RESTRICTION CHECK (Identical to say.js) ---
        if (fs.existsSync(dbPath)) {
            try {
                const restrictions = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const requiredRoleId = restrictions['ai-setup'];

                if (requiredRoleId && !interaction.member.roles.cache.has(requiredRoleId)) {
                    return await interaction.reply({
                        content: '❌ **Access Denied:** You do not have the designated role required to execute this command.',
                        ephemeral: true
                    });
                }
            } catch (e) { console.error(e); }
        }

        const guildId = interaction.guildId;
        const allConfigs = getConfigs();
        const guildConfig = allConfigs[guildId] || {
            enabled: true,
            apiKey: null,
            goal: 'You are an AI assistant managing this server. Help moderate, create tickets, and manage community actions.'
        };

        const apiKeyInput = interaction.options.getString('api_key');
        const statusInput = interaction.options.getBoolean('status');
        const goalInput = interaction.options.getString('goal');
        const promptInput = interaction.options.getString('prompt');

        let updates = [];

        if (apiKeyInput) {
            guildConfig.apiKey = apiKeyInput;
            updates.push('🔑 **API Key updated**');
        }

        if (statusInput !== null) {
            guildConfig.enabled = statusInput;
            updates.push(`⚡ **Status:** ${statusInput ? 'ON ✅' : 'OFF ❌'}`);
        }

        if (goalInput) {
            guildConfig.goal = goalInput;
            updates.push('🎯 **Server Goal/Identity updated**');
        }

        // Save updated config back to ai_config.json
        allConfigs[guildId] = guildConfig;
        saveConfigs(allConfigs);

        // If options were updated without a prompt, reply silently
        if (!promptInput) {
            const statusSummary = updates.length > 0
                ? `✅ **AI Configuration Saved:**\n- ${updates.join('\n- ')}`
                : `⚙️ **Current AI Configuration:**\n- **Status:** ${guildConfig.enabled ? 'ON ✅' : 'OFF ❌'}\n- **API Key Saved:** ${guildConfig.apiKey ? 'Yes' : 'No (Using process.env fallback)'}\n- **Goal:** *"${guildConfig.goal}"*`;

            return await interaction.reply({ content: statusSummary, ephemeral: true });
        }

        // Check active state & API Key
        if (!guildConfig.enabled) {
            return await interaction.reply({ content: '⚠️ AI assistant is currently **DISABLED** for this server.', ephemeral: true });
        }

        const activeKey = guildConfig.apiKey || process.env.GEMINI_API_KEY;
        if (!activeKey) {
            return await interaction.reply({ content: '⚠️ No API Key found. Pass `api_key` in `/ai-setup` or set `GEMINI_API_KEY` on Railway.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // Scan server bots for awareness
            const members = await interaction.guild.members.fetch();
            const botList = members
                .filter(m => m.user.bot)
                .map(b => `${b.user.username} (ID: ${b.id})`)
                .join(', ');

            const systemInstruction = `${guildConfig.goal}\n\nInstalled server bots: [${botList || 'None'}]. Use runExternalBotCommand to send commands for other bots.`;

            const ai = new GoogleGenAI({ apiKey: activeKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: promptInput,
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: botTools }]
                }
            });

            if (response.text) {
                await interaction.editReply(response.text);
            } else {
                await interaction.editReply('⚙️ Executing AI instructions...');
            }

            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                for (const call of functionCalls) {
                    await handleToolExecution(call, interaction);
                }
            }
        } catch (err) {
            console.error('AI Command Error:', err);
            await interaction.editReply('❌ Failed to process AI request. Verify that your API Key is valid.');
        }
    },
};

async function handleToolExecution(call, interaction) {
    const { name, args } = call;

    if (name === 'banUser') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return await interaction.followUp({ content: "❌ You lack permission to ban members.", ephemeral: true });
        }
        const target = await interaction.guild.members.fetch(args.userId).catch(() => null);
        if (!target) return await interaction.followUp({ content: '❌ User not found.', ephemeral: true });

        await target.ban({ reason: args.reason || 'AI Execution' });
        await interaction.channel.send(`🔨 **Banned <@${args.userId}>** | Reason: ${args.reason || 'None'}`);
    }

    if (name === 'kickUser') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return await interaction.followUp({ content: "❌ You lack permission to kick members.", ephemeral: true });
        }
        const target = await interaction.guild.members.fetch(args.userId).catch(() => null);
        if (!target) return await interaction.followUp({ content: '❌ User not found.', ephemeral: true });

        await target.kick(args.reason || 'AI Execution');
        await interaction.channel.send(`👞 **Kicked <@${args.userId}>** | Reason: ${args.reason || 'None'}`);
    }

    if (name === 'createTicketChannel') {
        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            reason: args.topic || 'Support Ticket'
        });
        await ticketChannel.send(`🎟️ **Ticket Created for <@${interaction.user.id}>**\nTopic: ${args.topic}`);
        await interaction.channel.send(`✅ Created ticket channel: ${ticketChannel}`);
    }

    if (name === 'startGiveaway') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.followUp({ content: "❌ You lack permission to manage giveaways.", ephemeral: true });
        }
        await interaction.channel.send(`🎉 **GIVEAWAY STARTED!**\n**Prize:** ${args.prize}\n**Duration:** ${args.durationMinutes} minute(s)\nReact with 🎉 to enter!`);
    }

    if (name === 'runExternalBotCommand') {
        await interaction.channel.send(`${args.commandText}`);
        await interaction.channel.send(`🤖 *Forwarded command for bot ${args.targetBotName}*`);
    }
}
