const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

require('dotenv').config();

// ✅ INTENTS CORRECTOS PARA BOT REAL
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

let encuesta = null;

client.once('clientReady', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  // 🟢 mantiene el proceso activo (opcional)
  setInterval(() => {
    console.log("bot alive");
  }, 60000);
});

client.on('interactionCreate', async interaction => {

  // =========================
  // SLASH COMMAND /encuesta
  // =========================
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'encuesta') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: '❌ No tienes permisos para usar esto',
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
        content: `📊 **${texto}**\n⏰ Hora: ${hora}\n📌 Rol: ${rol}`,
        components: [row]
      });

      programarRecordatorio(interaction, encuesta);
    }
  }

  // =========================
  // BOTONES
  // =========================
  if (interaction.isButton()) {

    if (!encuesta) return;

    const user = interaction.user;

    // eliminar de todas las listas (permite cambiar voto)
    encuesta.atiempo = encuesta.atiempo.filter(u => u.id !== user.id);
    encuesta.tarde = encuesta.tarde.filter(u => u.id !== user.id);
    encuesta.novengo = encuesta.novengo.filter(u => u.id !== user.id);

    if (interaction.customId === 'atiempo') {
      encuesta.atiempo.push(user);

      return interaction.reply({
        content: '✅ Registrado como A TIEMPO',
        ephemeral: true
      });
    }

    if (interaction.customId === 'novengo') {
      encuesta.novengo.push(user);

      return interaction.reply({
        content: '❌ Registrado como NO VENGO',
        ephemeral: true
      });
    }

    if (interaction.customId === 'tarde') {

      const modal = new ModalBuilder()
        .setCustomId('motivoModal')
        .setTitle('Motivo del retraso');

      const input = new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('¿Por qué llegas tarde?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      await interaction.showModal(modal);
    }
  }

  // =========================
  // MODAL (MOTIVO TARDE)
  // =========================
  if (interaction.isModalSubmit()) {

    if (!encuesta) return;

    const user = interaction.user;
    const motivo = interaction.fields.getTextInputValue('motivo');

    // limpiar otras opciones
    encuesta.atiempo = encuesta.atiempo.filter(u => u.id !== user.id);
    encuesta.novengo = encuesta.novengo.filter(u => u.id !== user.id);

    encuesta.tarde.push(user);
    encuesta.motivos[user.id] = motivo;

    await interaction.reply({
      content: '🟡 Registrado como TARDE',
      ephemeral: true
    });
  }
});

// =========================
// RECORDATORIO 30 MIN ANTES
// =========================
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

      if (!encuesta) return;

      const canal = interaction.channel;

      const lista = [
        ...encuesta.atiempo.map(u => `<@${u.id}>`),
        ...encuesta.tarde.map(u => `<@${u.id}>`)
      ];

      canal.send({
        content:
          `⏰ **RECORDATORIO**\n` +
          `${encuesta.rol}\n\n` +
          `👥 Asistirán:\n${lista.join('\n') || 'Nadie todavía'}`
      });

    }, delay);

  } catch (err) {
    console.log('Error recordatorio:', err);
  }
}

client.login(process.env.TOKEN);
