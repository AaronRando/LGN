const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

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

(async () => {
  try {
    console.log('⏳ Registrando comandos...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Comandos registrados correctamente');
  } catch (err) {
    console.error(err);
  }
})();
