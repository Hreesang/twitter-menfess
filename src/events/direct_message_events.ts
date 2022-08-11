import { TwitterApi } from 'twitter-api-v2';
import { menfess } from '@/services/menfess';

export const directMessageEvents = (
  client: TwitterApi,
  directMessages: any[]
) => {
  directMessages.map(async (dm) => {
    console.log(dm);
    console.log(dm.message_create);
    console.log(dm.message_create.message_data);
    console.log(dm.message_create.message_data?.attachment);
    console.log(dm.message_create.message_data?.attachment?.media);

    menfess.process(client, dm);
  });
};
