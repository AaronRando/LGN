const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let encuesta = null;
let messageId = null;
let channelId = null;

// ======================
// READY + COMANDOS
// ======================
client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('encuesta')
      .setDescription('Crear encuesta estilo Apollo')
      .addStringOption(o =>
        o.setName('texto').setDescription('Texto').setRequired(true))
      .addStringOption(o =>
        o.setName('hora').setDescription('Hora HH:MM').setRequired(true))
      .addRoleOption(o =>
        o.setName('rol').setDescription('Rol').setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash command registrado');
  } catch (err) {
    console.log(err);
  }
});

// ======================
// FORMATO MENSAJE (APOLLO STYLE)
// ======================
function buildMessage() {

  return {
    content:
`📊 **${encuesta.texto}**
⏰ ${encuesta.hora}
📌 <@&${encuesta.rolId}>

━━━━━━━━━━━━━━

✅ **A tiempo (${encuesta.atiempo.length})**
${encuesta.atiempo.map(u => `• ${u.username}`).join('\n') || 'Nadie'}

🟡 **Tarde (${encuesta.tarde.length})**
${encuesta.tarde.map(u => `• ${u.username}`).join('\n') || 'Nadie'}

❌ **No vengo (${encuesta.novengo.length})**
${encuesta.novengo.map(u => `• ${u.username}`).join('\n') || 'Nadie'}
`
  };
}

// ======================
// INTERACCIONES
// ======================
client.on('interactionCreate', async interaction => {

  // ======================
  // /encuesta
  // ======================
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName !== 'encuesta') return;

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Solo admins', ephemeral: true });
    }

    await interaction.deferReply();

    try {

      const texto = interaction.options.getString('texto');
      const hora = interaction.options.getString('hora');
      const rol = interaction.options.getRole('rol');

      encuesta = {
        texto,
        hora,
        rolId: rol.id,
        canalId: interaction.channel.id,
        atiempo: [],
        tarde: [],
        novengo: [],
        motivos: {}
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('atiempo')
          .setLabel('✅ A tiempo')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('tarde')
          .setLabel('🟡 Tarde')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('novengo')
          .setLabel('❌ No vengo')
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.editReply({
        content:
`📊 **${texto}**
⏰ ${hora}
📌 <@&${rol.id}>`,
        components: [row]
      });

      messageId = msg.id;
      channelId = interaction.channel.id;

    } catch (err) {
      console.log("ERROR:", err);
      await interaction.editReply("❌ Error creando encuesta");
    }
  }

  // ======================
  // BOTONES
  // ======================
  if (interaction.isButton()) {

    if (!encuesta) return;

    const user = interaction.user;

    encuesta.atiempo = encuesta.atiempo.filter(u => u.id !== user.id);
    encuesta.tarde = encuesta.tarde.filter(u => u.id !== user.id);
    encuesta.novengo = encuesta.novengo.filter(u => u.id !== user.id);

    if (interaction.customId === 'atiempo') {
      encuesta.atiempo.push(user);
      await interaction.reply({ content: '✅ A tiempo', ephemeral: true });
    }

    if (interaction.customId === 'novengo') {
      encuesta.novengo.push(user);
      await interaction.reply({ content: '❌ No vengo', ephemeral: true });
    }

    if (interaction.customId === 'tarde') {

      const modal = new ModalBuilder()
        .setCustomId('motivo')
        .setTitle('Motivo del retraso');

      const input = new TextInputBuilder()
        .setCustomId('texto')
        .setLabel('Motivo')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      await interaction.showModal(modal);
    }

    // 🔥 ACTUALIZAR MENSAJE TIPO APOLLO
    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);

    await message.edit(buildMessage());
  }

  // ======================
  // MODAL
  // ======================
  if (interaction.isModalSubmit()) {

    const motivo = interaction.fields.getTextInputValue('texto');

    encuesta.tarde.push(interaction.user);
    encuesta.motivos[interaction.user.id] = motivo;

    await interaction.reply({ content: '🟡 Registrado como tarde', ephemeral: true });

    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);

    await message.edit(buildMessage());
  }
});

// ======================
client.login(process.env.TOKEN);
