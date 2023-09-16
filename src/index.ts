import { Bot, Context } from "grammy";
import dotenv from "dotenv";
import { io } from "socket.io-client";
import { MessageModel } from "./util/models";
import { getRandomInternetColor } from "./util/helpers";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import { v2 as cloudinary } from "cloudinary";

type MyContext = FileFlavor<Context>;

dotenv.config();

const ENDPOINT = process.env.SOCKET_ENDPOINT as string;
console.log("Socket Endpoint: ", ENDPOINT);
const bot = new Bot<MyContext>(process.env.BOT_TOKEN as string);
bot.api.config.use(hydrateFiles(bot.token));

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME as string,
  api_key: process.env.CLOUD_API_KEY as string,
  api_secret: process.env.API_SECRET as string,
});

const connect = () => {
  const socket = io(ENDPOINT, {
    reconnectionAttempts: 5,
  });

  console.log("trying to connect.. ");

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
  });

  return socket;
};

const socket = connect();

console.log("is Connected: ", socket.connected);

bot.hears(/grug/i, async (ctx) => {
  console.log(JSON.stringify(ctx, null, 2));
  await ctx.reply("grug is out! hunting... :(", {
    reply_to_message_id: ctx.msg.message_id,
  });
});

bot.on(":text", (ctx) => {
  const message = ctx.message;
  console.log("on message is triggered!");
  if (message) {
    const { text, chat } = message;

    const chatMessage: MessageModel = {
      id: chat.id,
      content: {
        chatId: chat?.id ?? 0,
        type: "text",
        date: Date.now(),
        text: text || "",
      },
      author: {
        id: message.from.id,
        firstName: message.from.first_name,
        username: message.from.username as string,
        isBot: message.from.is_bot,
        currentBadge: "normal",
        color: getRandomInternetColor(),
      },
    };

    socket.emit("message", chatMessage);
  }
});

bot.on(":animation", async (ctx: Context) => {
  const message = ctx.message;

  if (message) {
    const { text, chat } = message;
    const file = await ctx.getFile();

    const remoteURL = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    const uploadResult = await cloudinary.uploader.upload(remoteURL, {
      folder: "super-stream",
      resource_type: "auto",
      public_id: file.file_path,
    });

    console.log(uploadResult);

    const animationMessage: MessageModel = {
      id: chat.id,
      content: {
        chatId: chat.id,
        type: "animation",
        date: Date.now(),
        fileId: message.document?.file_id ?? "not found",
        mime_type: message.document?.mime_type ?? "not found",
        file_name: uploadResult.url ?? "not found",
      },
      author: {
        id: message.from.id,
        firstName: message.from.first_name,
        username: message.from.username as string,
        isBot: message.from.is_bot,
        currentBadge: "normal",
        color: getRandomInternetColor(),
      },
    };

    socket.emit("message", animationMessage);
  }
});

bot.on(":sticker", async (ctx: Context) => {
  const message = ctx.message;

  if (message) {
    const { text, chat } = message;
    const file = await ctx.getFile();

    const remoteURL = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    const uploadResult = await cloudinary.uploader.upload(remoteURL, {
      folder: "super-stream",
      resource_type: "auto",
      public_id: file.file_path,
    });

    const animationMessage: MessageModel = {
      id: chat.id,
      content: {
        chatId: chat.id,
        type: "animation",
        date: Date.now(),
        fileId: message.document?.file_id ?? "not found",
        mime_type: message.document?.mime_type ?? "not found",
        file_name: uploadResult.url ?? "not found",
      },
      author: {
        id: message.from.id,
        firstName: message.from.first_name,
        username: message.from.username as string,
        isBot: message.from.is_bot,
        currentBadge: "normal",
        color: getRandomInternetColor(),
      },
    };

    socket.emit("message", animationMessage);
    //ctx.reply(`Sticker detected... result: ${uploadResult.url}`);
  }
});

bot.start();
bot.catch((error) => {
  console.log(error);
});
