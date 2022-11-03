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
  // get group id and check if it is not join multi-user chat event
  const groupId = getGroupIdFromEvent(event);
  if (!groupId) {
    await event.reply(
      "This app does not support multi-user chat. Please create a new group."
    );
    return;
  }

  // create group
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

  // fetch members
  const member = await event.source.member();
  await Promise.all(
    member.memberIds.map(async (memberId: string) => {
      const profile = await bot.getGroupMemberProfile(groupId, memberId);

      // create group member
      const { error } = await supabase.from("group_members").upsert({
        group_id: groupId,
        user_id: profile.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        joined_at: dayjs().toDate(),
      });
      if (error) {
        console.error(error);
        await event.reply("Error!");
        return;
      }
    })
  );

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
