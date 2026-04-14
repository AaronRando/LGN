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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// memoria temporal
let encuesta = null;

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {

  // ======================
  // COMANDO /encuesta
  // ======================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'encuesta') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '❌ No tienes permisos', ephemeral: true });
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
        new ButtonBuilder().setCustomId('atiempo').setLabel('✅ A tiempo').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tarde').setLabel('🟡 Tarde').setStyle(ButtonStyle.Warning),
        new ButtonBuilder().setCustomId('novengo').setLabel('❌ No vengo').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: `📊 **${texto}**\n⏰ Hora: ${hora}\n${rol}`,
        components: [row]
      });

      // ⏰ PROGRAMAR RECORDATORIO
      programarRecordatorio(interaction, encuesta);
    }
  }

  // ======================
  // BOTONES
  // ======================
  if (interaction.isButton()) {

    if (!encuesta) return;

    const user = interaction.user;

    // eliminar de todas las listas primero (permite cambiar voto)
    encuesta.atiempo = encuesta.atiempo.filter(u => u.id !== user.id);
    encuesta.tarde = encuesta.tarde.filter(u => u.id !== user.id);
    encuesta.novengo = encuesta.novengo.filter(u => u.id !== user.id);

    if (interaction.customId === 'atiempo') {
      encuesta.atiempo.push(user);
      return interaction.reply({ content: '✅ Te has puesto como A TIEMPO', ephemeral: true });
    }

    if (interaction.customId === 'novengo') {
      encuesta.novengo.push(user);
      return interaction.reply({ content: '❌ Te has puesto como NO VENGO', ephemeral: true });
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

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      await interaction.showModal(modal);
    }
  }

  // ======================
  // MODAL (motivo)
  // ======================
  if (interaction.isModalSubmit()) {

    if (!encuesta) return;

    const user = interaction.user;
    const motivo = interaction.fields.getTextInputValue('motivo');

    // limpiar listas
    encuesta.atiempo = encuesta.atiempo.filter(u => u.id !== user.id);
    encuesta.novengo = encuesta.novengo.filter(u => u.id !== user.id);

    encuesta.tarde.push(user);
    encuesta.motivos[user.id] = motivo;

    await interaction.reply({ content: '🟡 Te has puesto como TARDE', ephemeral: true });
  }
});

// ======================
// RECORDATORIO
// ======================
function programarRecordatorio(interaction, encuesta) {
  try {
    const [hora, minutos] = encuesta.hora.split(':').map(Number);

    const ahora = new Date();
    const evento = new Date();

    evento.setHours(hora);
    evento.setMinutes(minutos);
    evento.setSeconds(0);

    const aviso = new Date(evento.getTime() - 30 * 60000); // 30 min antes

    const tiempoEspera = aviso - ahora;

    if (tiempoEspera <= 0) return;

    setTimeout(() => {

      const canal = interaction.channel;

      const lista = [
        ...encuesta.atiempo.map(u => `<@${u.id}>`),
        ...encuesta.tarde.map(u => `<@${u.id}>`)
      ];

      canal.send({
        content: `⏰ RECORDATORIO\n${encuesta.rol}\n\nVan:\n${lista.join('\n') || 'Nadie'}`
      });

    }, tiempoEspera);

  } catch (err) {
    console.log("Error en recordatorio:", err);
  }
}

client.login(process.env.TOKEN);
