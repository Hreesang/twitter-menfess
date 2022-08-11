import { Autohook } from 'twitter-autohook';
import { TwitterApi } from 'twitter-api-v2';
import * as dotenv from 'dotenv';
dotenv.config();

import { directMessageEvents } from '@/events/direct_message_events';

const accessToken = process.env.TWITTER_ACCESS_TOKEN ?? '';
const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET ?? '';
const consumerKey = process.env.TWITTER_CONSUMER_KEY ?? '';
const consumerKeySecret = process.env.TWITTER_CONSUMER_KEY_SECRET ?? '';
const webhookEnv = process.env.TWITTER_WEBHOOK_ENV ?? '';

const client = new TwitterApi({
  appKey: consumerKey,
  appSecret: consumerKeySecret,
  accessToken: accessToken,
  accessSecret: accessTokenSecret,
});

(async () => {
  const webhook = new Autohook({
    token: accessToken,
    token_secret: accessTokenSecret,
    consumer_key: consumerKey,
    consumer_secret: consumerKeySecret,
    env: webhookEnv,
  });
  await webhook.removeWebhooks();

  webhook.on('event', (e) => {
    if (e.direct_message_events) {
      directMessageEvents(client, e.direct_message_events);
    }
  });

  await webhook.start();
  await webhook.subscribe({
    oauth_token: accessToken,
    oauth_token_secret: accessTokenSecret,
  });
})();
