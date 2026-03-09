const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});


// ---------------- POINTS STORAGE ----------------

let points = {};
if (fs.existsSync("points.json")) {
  points = JSON.parse(fs.readFileSync("points.json"));
}

function savePoints() {
  fs.writeFileSync("points.json", JSON.stringify(points, null, 2));
}


// ---------------- SHOP MEMORY ----------------

let shopSent = false;
if (fs.existsSync("shop_sent.json")) {
  shopSent = JSON.parse(fs.readFileSync("shop_sent.json")).sent;
}


// ---------------- ROLE IDS ----------------

const roleIDs = {
  picperms: "1470124633662554275",
  loyal: "1480160181626208377",
  vip: "1479182235499495455",
  gold: "1480160407456059512"
};


// ---------------- SHOP ITEMS ----------------

const shopItems = [
  { label: "Pic Perms", value: "picperms", cost: 250 },
  { label: "Loyal role", value: "loyal", cost: 500 },
  { label: "Vip role", value: "vip", cost: 1000 },
  { label: "Gold role", value: "gold", cost: 1500 }
];


// ---------------- SHOP EMBED ----------------

function createShopEmbed() {
  return new EmbedBuilder()
    .setTitle("Casio Shop")
    .setColor("#010101")
    .setDescription("Purchase a role using your points")
    .setImage("https://media.discordapp.net/attachments/1422258959548551230/1480216888473813128/IMG_2877.gif");
}

function createShopMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("shop_menu")
      .setPlaceholder("Choose a role to buy")
      .addOptions(
        shopItems.map(item => ({
          label: `${item.label} — ${item.cost} pts`,
          value: item.value
        }))
      )
  );
}


// ---------------- PROFILE CARD GENERATOR (GRADIENT UI) ----------------

async function generatePointsCard(member, userPoints) {

  const canvas = createCanvas(900, 260);
  const ctx = canvas.getContext("2d");

  // background gradient
  const gradient = ctx.createLinearGradient(0, 0, 900, 0);
  gradient.addColorStop(0, "#3b3b3b");
  gradient.addColorStop(1, "#111111");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // avatar
  const avatar = await loadImage(
    member.user.displayAvatarURL({ extension: "png", size: 256 })
  );

  ctx.save();
  ctx.beginPath();
  ctx.arc(90, 90, 55, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 35, 35, 110, 110);
  ctx.restore();

  // avatar border
  ctx.beginPath();
  ctx.arc(90, 90, 60, 0, Math.PI * 2);
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 4;
  ctx.stroke();

  // username
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText(member.displayName, 170, 90);

  // user id
  ctx.fillStyle = "#b9b9b9";
  ctx.font = "24px sans-serif";
  ctx.fillText(`ID ${member.id}`, 170, 125);

  // divider line
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 160);
  ctx.lineTo(840, 160);
  ctx.stroke();

  // points label
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("POINTS", 150, 215);

  // simple points icon
  ctx.beginPath();
  ctx.arc(95, 205, 15, 0, Math.PI * 2);
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 3;
  ctx.stroke();

  // points number
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(userPoints.toString(), 760, 215);

  return canvas.toBuffer();
}


// ---------------- READY EVENT ----------------

client.on("ready", async () => {

  console.log(`Logged in as ${client.user.tag}`);

  if (!shopSent) {

    const channel = await client.channels.fetch("1478843399007113428");

    if (channel) {
      await channel.send({
        embeds: [createShopEmbed()],
        components: [createShopMenu()]
      });

      fs.writeFileSync("shop_sent.json", JSON.stringify({ sent: true }));
      console.log("Casio Shop embed sent (first time only).");
    }
  }
});


// ---------------- MESSAGE POINTS SYSTEM ----------------

client.on("messageCreate", (msg) => {

  if (msg.author.bot) return;

  if (!points[msg.author.id]) points[msg.author.id] = 0;

  points[msg.author.id] += 1;

  savePoints();
});


// ---------------- COMMANDS ----------------

client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  const args = msg.content.trim().split(" ");
  const cmd = args[0].toLowerCase();

  // POINTS CARD
  if (cmd === ".points") {

    const userPoints = points[msg.author.id] || 0;

    try {
      const card = await generatePointsCard(msg.member, userPoints);
      const attachment = new AttachmentBuilder(card, { name: "points.png" });

      msg.reply({ files: [attachment] });

    } catch (err) {
      console.error(err);
      msg.reply("❌ Error generating your profile card.");
    }
  }

  // SHOP COMMAND
  if (cmd === ".shop") {

    msg.reply({
      embeds: [createShopEmbed()],
      components: [createShopMenu()]
    });

  }

});


// ---------------- SHOP PURCHASE ----------------

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "shop_menu") return;

  const choice = interaction.values[0];
  const item = shopItems.find(i => i.value === choice);

  if (!item) return;

  const userPoints = points[interaction.user.id] || 0;

  if (userPoints < item.cost) {
    return interaction.reply({
      content: `❌ You need **${item.cost} pts**, but you only have **${userPoints} pts**.`,
      ephemeral: true
    });
  }

  points[interaction.user.id] -= item.cost;
  savePoints();

  const role = interaction.guild.roles.cache.get(roleIDs[choice]);
  const member = interaction.guild.members.cache.get(interaction.user.id);

  if (role) {
    await member.roles.add(role);
  }

  interaction.reply({
    content: `✅ You bought **${item.label}** for **${item.cost} pts**!`,
    ephemeral: true
  });

});


// ---------------- LOGIN ----------------

client.login("MTQ4MDE1NzA3MDQ1MDg4ODc0Ng.G4iLS5.q4QhQN1sbO4PG0UgkDzsSSd35wsn5Kak39Grno");