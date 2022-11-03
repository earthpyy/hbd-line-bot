import { serve } from "https://deno.land/std@0.161.0/http/server.ts";
import { linebot } from "https://deno.land/x/linebot@v1.1.0/mod.ts";
import { StatusCodes } from "https://deno.land/x/https_status_codes@v1.2.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";
import dayjs from "https://esm.sh/dayjs@v1.11.6";

const options = {
  channelId: Deno.env.get("LINE_CHANNEL_ID"),
  channelSecret: Deno.env.get("LINE_CHANNEL_SECRET"),
  channelAccessToken: Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN"),
};
const bot = linebot(options);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SECRET") ?? ""
);

function getGroupIdFromEvent(event: any) {
  return event.source.groupId;
}

bot.on("join", async (event: any) => {
  const groupId = getGroupIdFromEvent(event);
  if (!groupId) {
    await event.reply(
      "This app does not support multi-user chat. Please create a new group."
    );
    return;
  }

  const { error } = await supabase.from("groups").upsert({
    id: groupId,
    active: true,
    joined_at: dayjs().toDate(),
  });
  if (error) {
    console.error(error);
    await event.reply("Error!");
    return;
  }

  await event.reply("Hello!");
});

bot.on("leave", async (event: any) => {
  const { error } = await supabase
    .from("groups")
    .update({ active: false })
    .eq("id", getGroupIdFromEvent(event));
  if (error) {
    console.error(error);
  }
});

serve(async (req) => {
  const body = await req.text();
  const valid = bot.verify(body, req.headers.get("x-line-signature") ?? "");
  if (!valid) {
    return new Response(null, { status: StatusCodes.UNAUTHORIZED });
  }

  bot.parse(JSON.parse(body));

  return new Response();
});
