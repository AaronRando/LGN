const {
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle,
  REST, Routes, SlashCommandBuilder
} = require('discord.js');
const http = require('http');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const encuestas = new Map();

// ── Servidor HTTP (Glitch lo necesita para mantenerse vivo) ───────────────────
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot activo');
}).listen(3000, () => console.log('🌐 Servidor HTTP escuchando en puerto 3000'));

// ── Registro de comandos slash ────────────────────────────────────────────────
client.once('clientReady', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('encuesta')
      .setDescription('Crear encuesta de asistencia')
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .addStringOption(o => o.setName('texto').setDescription('Texto del evento').setRequired(true))
      .addStringOption(o => o.setName('hora').setDescription('Hora HH:MM').setRequired(true))
      .addRoleOption(o => o.setName('rol').setDescription('Rol a mencionar').setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Comandos slash registrados');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
});

// ── Construye el mensaje ──────────────────────────────────────────────────────
function buildMessage(enc) {
  const lista = arr =>
    arr.length === 0
      ? 'Nadie'
      : arr.map(u => `• ${u.displayName}${enc.motivos[u.id] ? ` *(${enc.motivos[u.id]})*` : ''}`).join('\n');

  return {
    content:
`📊 **${enc.texto}**
⏰ ${enc.hora}
📌 <@&${enc.rolId}>

━━━━━━━━━━━━━━

✅ **A tiempo (${enc.atiempo.length})**
${lista(enc.atiempo)}

🟡 **Tarde (${enc.tarde.length})**
${lista(enc.tarde)}

❌ **No vengo (${enc.novengo.length})**
${lista(enc.novengo)}`,
    components: [buildRow()]
  };
}

function buildRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('atiempo').setLabel('✅ A tiempo').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tarde').setLabel('🟡 Tarde').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('novengo').setLabel('❌ No vengo').setStyle(ButtonStyle.Danger)
  );
}

function quitarUsuario(enc, userId) {
  enc.atiempo = enc.atiempo.filter(u => u.id !== userId);
  enc.tarde   = enc.tarde.filter(u => u.id !== userId);
  enc.novengo = enc.novengo.filter(u => u.id !== userId);
  delete enc.motivos[userId];
}

// ── Interacciones ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  // /encuesta
  if (interaction.isChatInputCommand() && interaction.commandName === 'encuesta') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Solo los administradores pueden crear encuestas.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const texto = interaction.options.getString('texto');
      const hora  = interaction.options.getString('hora');
      const rol   = interaction.options.getRole('rol');

      const enc = { texto, hora, rolId: rol.id, atiempo: [], tarde: [], novengo: [], motivos: {} };

      const msg = await interaction.editReply({
        content:
`📊 **${texto}**
⏰ ${hora}
📌 <@&${rol.id}>

━━━━━━━━━━━━━━

✅ **A tiempo (0)**
Nadie

🟡 **Tarde (0)**
Nadie

❌ **No vengo (0)**
Nadie`,
        components: [buildRow()]
      });

      encuestas.set(msg.id, enc);

    } catch (err) {
      console.error('ERROR creando encuesta:', err);
      await interaction.editReply('❌ Error al crear la encuesta.');
    }
    return;
  }

  // Botones
  if (interaction.isButton()) {
    const enc = encuestas.get(interaction.message.id);
    if (!enc) {
      return interaction.reply({ content: '❌ Encuesta no disponible (el bot se reinició).', ephemeral: true });
    }

    const user = interaction.user;
    const userObj = {
      id: user.id,
      displayName: interaction.member?.displayName || user.username
    };

    quitarUsuario(enc, user.id);

    if (interaction.customId === 'atiempo') {
      enc.atiempo.push(userObj);
      await interaction.reply({ content: '✅ Registrado como **a tiempo**.', ephemeral: true });
      await interaction.message.edit(buildMessage(enc));
      return;
    }

    if (interaction.customId === 'novengo') {
      enc.novengo.push(userObj);
      await interaction.reply({ content: '❌ Registrado como **no vengo**.', ephemeral: true });
      await interaction.message.edit(buildMessage(enc));
      return;
    }

    if (interaction.customId === 'tarde') {
      if (!enc._pendingTarde) enc._pendingTarde = {};
      enc._pendingTarde[user.id] = userObj;

      const modal = new ModalBuilder()
        .setCustomId(`motivo_${interaction.message.id}`)
        .setTitle('Motivo del retraso');

      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('texto')
          .setLabel('¿Por qué llegas tarde?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(200)
      ));

      return interaction.showModal(modal);
    }
  }

  // Modal motivo tardanza
  if (interaction.isModalSubmit() && interaction.customId.startsWith('motivo_')) {
    const messageId = interaction.customId.replace('motivo_', '');
    const enc = encuestas.get(messageId);
    if (!enc) {
      return interaction.reply({ content: '❌ Encuesta no disponible.', ephemeral: true });
    }

    const motivo  = interaction.fields.getTextInputValue('texto');
    const user    = interaction.user;
    const userObj = enc._pendingTarde?.[user.id] || {
      id: user.id,
      displayName: interaction.member?.displayName || user.username
    };

    if (enc._pendingTarde) delete enc._pendingTarde[user.id];

    quitarUsuario(enc, user.id);
    enc.tarde.push(userObj);
    enc.motivos[user.id] = motivo;

    await interaction.reply({ content: `🟡 Registrado como **tarde**.\n📝 Motivo: *${motivo}*`, ephemeral: true });

    try {
      const channel = await client.channels.fetch(interaction.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.edit(buildMessage(enc));
    } catch (err) {
      console.error('Error editando mensaje tras modal:', err);
    }
  }
});

client.login(process.env.TOKEN);
