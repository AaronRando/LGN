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
  SlashCommandBuilder
} = require('discord.js');

require('dotenv').config();

// ======================
// CLIENTE
// ======================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let encuesta = null;

// ======================
// READY
// ======================
client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('encuesta')
      .setDescription('Crear encuesta de asistencia')
      .addStringOption(o =>
        o.setName('texto').setDescription('Texto').setRequired(true))
      .addStringOption(o =>
        o.setName('hora').setDescription('Hora HH:MM').setRequired(true))
      .addRoleOption(o =>
        o.setName('rol').setDescription('Rol a mencionar').setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('✅ Slash command registrado');
  } catch (err) {
    console.log('❌ Error registrando comandos:', err);
  }
});

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
      return interaction.reply({
        content: '❌ Solo administradores',
        ephemeral: true
      });
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

      // ======================
      // BOTONES (FIX REAL)
      // ======================
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('atiempo')
          .setLabel('✅ A tiempo')
          .setStyle(3), // SUCCESS

        new ButtonBuilder()
          .setCustomId('tarde')
          .setLabel('🟡 Tarde')
          .setStyle(1), // PRIMARY

        new ButtonBuilder()
          .setCustomId('novengo')
          .setLabel('❌ No vengo')
          .setStyle(4) // DANGER
      );

      await interaction.editReply({
        content:
          `📊 **${texto}**\n` +
          `⏰ ${hora}\n` +
          `📌 <@&${rol.id}>`,
        components: [row]
      });

      programarRecordatorio(client, encuesta);

    } catch (err) {
      console.log("❌ ERROR ENCUESTA:", err);
      await interaction.editReply("❌ Error creando la encuesta");
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
      return interaction.reply({ content: '✅ A tiempo', ephemeral: true });
    }

    if (interaction.customId === 'novengo') {
      encuesta.novengo.push(user);
      return interaction.reply({ content: '❌ No vengo', ephemeral: true });
    }

    if (interaction.customId === 'tarde') {

      const modal = new ModalBuilder()
        .setCustomId('motivoModal')
        .setTitle('Motivo del retraso');

      const input = new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('Motivo')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      await interaction.showModal(modal);
    }
  }

  // ======================
  // MODAL
  // ======================
  if (interaction.isModalSubmit()) {

    if (!encuesta) return;

    const user = interaction.user;
    const motivo = interaction.fields.getTextInputValue('motivo');

    encuesta.atiempo = encuesta.atiempo.filter(u => u.id !== user.id);
    encuesta.novengo = encuesta.novengo.filter(u => u.id !== user.id);

    encuesta.tarde.push(user);
    encuesta.motivos[user.id] = motivo;

    await interaction.reply({
      content: '🟡 Registrado como tarde',
      ephemeral: true
    });
  }
});

// ======================
// RECORDATORIO
// ======================
function programarRecordatorio(client, encuesta) {

  try {

    const [h, m] = encuesta.hora.split(':').map(Number);

    const ahora = new Date();
    const evento = new Date();

    evento.setHours(h, m, 0, 0);

    const aviso = new Date(evento.getTime() - 30 * 60000);

    const delay = aviso - ahora;

    if (delay <= 0) return;

    setTimeout(() => {

      const canal = client.channels.cache.get(encuesta.canalId);
      if (!canal) return;

      const lista = [
        ...encuesta.atiempo.map(u => `<@${u.id}>`),
        ...encuesta.tarde.map(u => `<@${u.id}>`)
      ];

      canal.send({
        content:
          `⏰ **RECORDATORIO**\n` +
          `<@&${encuesta.rolId}>\n\n` +
          `${lista.join('\n') || 'Nadie confirmado'}`
      });

    }, delay);

  } catch (err) {
    console.log("❌ ERROR RECORDATORIO:", err);
  }
}

client.login(process.env.TOKEN);
