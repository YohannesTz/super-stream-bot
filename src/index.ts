import {
  Bot,
  Context,
  InlineKeyboard,
  InlineQueryResultBuilder,
  session,
  SessionFlavor,
} from "grammy";
import { Menu } from "@grammyjs/menu";
import dotenv from "dotenv";
import { io } from "socket.io-client";
import { MessageModel } from "./util/models";
import { getRandomInternetColor } from "./util/helpers";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import { v2 as cloudinary } from "cloudinary";
import { InlineQueryResult } from "grammy/types";

interface User {
  hexColor: string;
}

interface SessionData {
  users: Map<number, User>;
}

type MyContext = FileFlavor<Context> & Context & SessionFlavor<SessionData>;

dotenv.config();

const ENDPOINT = process.env.SOCKET_ENDPOINT as string;
console.log("Socket Endpoint: ", ENDPOINT);
const bot = new Bot<MyContext>(process.env.BOT_TOKEN as string);

bot.api.config.use(hydrateFiles(bot.token));
/* bot.use(
  session({
    initial: () => ({
      hexColor: getRandomInternetColor(),
    }),
  })
);
 */
/* bot.use((ctx: MyContext, next) => {
  if (!ctx.session.users) {
    ctx.session.users = new Map<number, User>();
  }
  return next();
}); */

bot.use(
  session({
    initial: () => ({
      users: new Map<number, User>(),
    }),
  })
);

bot.use((ctx: MyContext, next) => {
  if (!ctx.session.users) {
    ctx.session.users = new Map<number, User>();
  }
  return next();
});

function checkAndAdd(id: number, ctx: MyContext) {
  if (!ctx.session.users.has(id)) {
    const generatedHexColor = getRandomInternetColor();
    const user: User = {
      hexColor: generatedHexColor,
    };

    ctx.session.users.set(id, user);
  }
}

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

// Define the video interface
interface Video {
  title: string;
  url: string;
}

// Sample list of videos
const videos: Video[] = [
  { title: "Baby Crying", url: "https://example.com/baby_crying" },
  { title: "Funny Cats", url: "https://example.com/funny_cats" },
  { title: "Dancing Dogs", url: "https://example.com/dancing_dogs" },
];

// Function to search videos by title
function searchVideosByTitle(searchTerm: string): Video[] {
  const regex = new RegExp(searchTerm, "i");
  return videos.filter((video) => regex.test(video.title));
}

// Build a photo result.
InlineQueryResultBuilder.photo("id-0", "https://grammy.dev/images/grammY.png");

// Build a result that displays a photo but sends a text message.
InlineQueryResultBuilder.photo(
  "id-1",
  "https://grammy.dev/images/grammY.png"
).text("This text will be sent instead of the photo");

// Build a text result.
InlineQueryResultBuilder.article("id-2", "Inline Queries").text(
  "Great inline query docs: grammy.dev/plugins/inline-query"
);

// Pass further options to the result.
const keyboard = new InlineKeyboard().text("Aw yis", "call me back");
InlineQueryResultBuilder.article("id-3", "Hit me", {
  reply_markup: keyboard,
}).text("Push my buttons");

// Pass further options to the message content.
InlineQueryResultBuilder.article("id-4", "Inline Queries").text(
  "**Outstanding** docs: grammy.dev",
  { parse_mode: "MarkdownV2" }
);

bot.inlineQuery(/best bot (framework|library)/, async (ctx) => {
  // Create a single inline query result.
  const result = InlineQueryResultBuilder.article(
    "id:grammy-website",
    "grammY",
    {
      reply_markup: new InlineKeyboard().url(
        "grammY website",
        "https://grammy.dev/"
      ),
    }
  ).text(
    `<b>grammY</b> is the best way to create your own Telegram bots.
They even have a pretty website! 👇`,
    { parse_mode: "HTML" }
  );

  // Answer the inline query.
  await ctx.answerInlineQuery(
    [result], // answer with result list
    { cache_time: 30 * 24 * 3600 } // 30 days in seconds
  );
});

// Return empty result list for other queries.
bot.on("inline_query", (ctx) => ctx.answerInlineQuery([]));

bot.hears(/grug/i, async (ctx) => {
  //console.log(JSON.stringify(ctx, null, 2));
  await ctx.reply("grug is out! hunting... :(", {
    reply_to_message_id: ctx.msg.message_id,
  });
});

const menu = new Menu("movements")
  .text("^", (ctx) => ctx.reply("Forward!"))
  .row()
  .text("<", (ctx) => ctx.reply("Left!"))
  .text(">", (ctx) => ctx.reply("Right!"))
  .row()
  .text("v", (ctx) => ctx.reply("Backwards!"));

bot.use(menu);

bot.hears(/menu/i, async (ctx) => {
  console.log("Menu incoming...");
  await ctx.reply("Check out this menu:", { reply_markup: menu });
});

bot.on(":text", async (ctx) => {
  const message = ctx.message;
  console.log("on message is triggered!");
  if (message) {
    const { text, chat } = message;
    checkAndAdd(message.from.id, ctx);

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
        color: ctx.session.users.get(message.from.id)?.hexColor ?? "#fff",
      },
    };

    socket.emit("message", chatMessage);
  }
});

bot.on(":animation", async (ctx: MyContext) => {
  const message = ctx.message;

  if (message) {
    const { text, chat } = message;
    const file = await ctx.getFile();

    checkAndAdd(message.from.id, ctx);

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
        color: ctx.session.users.get(message.from.id)?.hexColor ?? "#fff",
      },
    };

    socket.emit("message", animationMessage);
  }
});

bot.on(":sticker", async (ctx: MyContext) => {
  const message = ctx.message;

  if (message) {
    const { text, chat } = message;
    const file = await ctx.getFile();

    checkAndAdd(message.from.id, ctx);

    const remoteURL = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    const uploadResult = await cloudinary.uploader.upload(remoteURL, {
      folder: "super-stream",
      resource_type: "auto",
      public_id: file.file_path,
    });

    const stickerMessage: MessageModel = {
      id: chat.id,
      content: {
        chatId: chat.id,
        type: "sticker",
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
        color: ctx.session.users.get(message.from.id)?.hexColor ?? "#fff",
      },
    };

    socket.emit("message", stickerMessage);
  }
});

bot.on(":photo", async (ctx: MyContext) => {
  const message = ctx.message;

  if (message) {
    const { chat } = message;
    const file = await ctx.getFile();

    checkAndAdd(message.from.id, ctx);

    const remoteURL = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    const uploadResult = await cloudinary.uploader.upload(remoteURL, {
      folder: "super-stream",
      resource_type: "auto",
      public_id: file.file_path,
    });

    const photoMessage: MessageModel = {
      id: chat.id,
      content: {
        chatId: chat.id,
        type: "photo",
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
        color: ctx.session.users.get(message.from.id)?.hexColor ?? "#fff",
      },
    };

    socket.emit("message", photoMessage);
  }
});

bot.start();
bot.catch((error) => {
  console.log(error);
});
