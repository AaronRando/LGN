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
// CLIENTE DISCORD
// ======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

let encuesta = null;

// ======================
// CUANDO EL BOT ESTÁ LISTO
// ======================
client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  // ======================
  // REGISTRO AUTOMÁTICO DE SLASH COMMAND
  // ======================
  const commands = [
    new SlashCommandBuilder()
      .setName('encuesta')
      .setDescription('Crear encuesta de asistencia')
      .addStringOption(option =>
        option.setName('texto')
          .setDescription('Texto de la encuesta')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('hora')
          .setDescription('Hora (ej: 20:00)')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option.setName('rol')
          .setDescription('Rol a mencionar')
          .setRequired(true)
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('✅ Slash command /encuesta registrado automáticamente');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
});

// ======================
// INTERACCIONES
// ======================
client.on('interactionCreate', async interaction => {

  // ======================
  // COMANDO /encuesta
  // ======================
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'encuesta') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: '❌ Solo administradores pueden usar esto',
          ephemeral: true
        });
      }

      const texto = interaction.options.getString('texto');
      const hora = interaction.options.getString('hora');
      const rol = interaction.options.getRole('rol');

      encuesta = {
        texto,
        hora,
        rol,
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
          .setStyle(ButtonStyle.Warning),

        new ButtonBuilder()
          .setCustomId('novengo')
          .setLabel('❌ No vengo')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: `📊 **${texto}**\n⏰ Hora: ${hora}\n📌 ${rol}`,
        components: [row]
      });

      programarRecordatorio(interaction, encuesta);
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

    await interaction.reply({ content: '🟡 Registrado como tarde', ephemeral: true });
  }
});

// ======================
// RECORDATORIO
// ======================
function programarRecordatorio(interaction, encuesta) {
  try {

    const [h, m] = encuesta.hora.split(':').map(Number);

    const ahora = new Date();
    const evento = new Date();

    evento.setHours(h);
    evento.setMinutes(m);
    evento.setSeconds(0);

    const aviso = new Date(evento.getTime() - 30 * 60000);

    const delay = aviso - ahora;

    if (delay <= 0) return;

    setTimeout(() => {

      const canal = interaction.channel;

      const lista = [
        ...encuesta.atiempo.map(u => `<@${u.id}>`),
        ...encuesta.tarde.map(u => `<@${u.id}>`)
      ];

      canal.send({
        content: `⏰ **RECORDATORIO**\n${encuesta.rol}\n\nAsistentes:\n${lista.join('\n') || 'Nadie'}`
      });

    }, delay);

  } catch (err) {
    console.log(err);
  }
}

client.login(process.env.TOKEN);
