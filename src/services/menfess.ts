import { downloadImage } from '@/helpers/media-downloader';
import path from 'path';
import { TweetV1, TwitterApi } from 'twitter-api-v2';

interface MenfessInput {
  senderId: string;
  text: string;
  mediaPath?: string;
}

interface FirstQueuedFess {
  menfess?: MenfessInput;
  tweet?: TweetV1;
}

class Menfess {
  private readonly keywords: Array<string> = ['!test', '!hello', '!world'];
  private readonly menfessIntervalMs = 60000; // 60 seconds

  private menfessQueue: Array<MenfessInput> = [];
  private menfessTimeout: NodeJS.Timeout | undefined;

  private isFess = (text: string): boolean => {
    for (let i = 0; i < this.keywords.length; i++) {
      if (text.match(this.keywords[i])) {
        return true;
      }
    }
    return false;
  };

  private splitText = (text: string) => {
    const texts: string[] = [];
    while (text.length) {
      let isSplitted = false;
      let pos: number;

      if (text.length > 260) {
        pos = 260;
        isSplitted = true;
      } else {
        pos = text.length;
      }

      if (isSplitted) {
        for (let i = pos - 1; i >= 0; i--) {
          if (text[i] === ' ') {
            pos = i;
            break;
          }
        }
      }

      texts.push(text.slice(0, pos));

      // Remove the whitespace at the end of the text
      pos += 1;

      if (pos >= text.length) {
        text = '';
      } else {
        text = text.slice(pos, text.length);
      }
    }

    return texts;
  };

  private sendFirstQueuedFess = async (
    client: TwitterApi
  ): Promise<FirstQueuedFess> => {
    if (!this.menfessQueue.length) {
      return { menfess: undefined, tweet: undefined };
    }

    const menfessInput = this.menfessQueue.shift() as MenfessInput;

    try {
      let mediaId: string | undefined;

      if (menfessInput.mediaPath) {
        mediaId = await client.v1.uploadMedia(menfessInput.mediaPath);
      }

      const texts = this.splitText(menfessInput.text);
      console.log(texts);

      let tweet: TweetV1 | undefined = undefined;
      let firstTweet: TweetV1 | undefined = undefined;

      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];

        let inReplyToTweet: string | undefined = undefined;
        if (tweet) {
          inReplyToTweet = tweet.id_str;
        }

        let status: string;
        if (i === texts.length - 1) {
          status = text;
        } else {
          status = text + ' (cont)';
        }

        tweet = await client.v1.tweet(status, {
          status: status,
          in_reply_to_status_id: inReplyToTweet,
          media_ids: inReplyToTweet ? undefined : mediaId,
        });

        if (!firstTweet) {
          firstTweet = tweet;
        }
      }

      return { menfess: menfessInput, tweet: firstTweet };
    } catch (error) {
      throw { menfess: menfessInput, error };
    }
  };

  private sendAllFess = (client: TwitterApi) => {
    // if an interval timer is running, then it will automatically send all
    // including the one that's been just added.

    if (this.menfessTimeout) {
      return;
    }

    const startInterval = async () => {
      console.log('Sending a menfess from the queue...');
      try {
        const { menfess, tweet } = await this.sendFirstQueuedFess(client);
        if (menfess && tweet) {
          const user = await client.v1.user({ user_id: menfess.senderId });
          console.log(`A menfess from @${user.screen_name} has been tweeted!`);
        }
      } catch (error: any) {
        if (error.menfess && error.error) {
          const menfess: MenfessInput = error.menfess;
          const user = await client.v1.user({ user_id: menfess.senderId });

          console.log(
            `An error error occured while tweeting a menfess from @${user.screen_name}.`
          );
          console.log(error.error);
        } else {
          console.log('An error occured while tweeting a menfess.');
          console.log(error);
        }
      }

      if (this.menfessQueue.length) {
        this.menfessTimeout = setTimeout(startInterval, this.menfessIntervalMs);
        console.log(
          'There is some menfess on the queue. Interval continues...'
        );
      } else {
        this.menfessTimeout = undefined;
        console.log('Menfess queue is empty! Interval has stopped.');
      }
    };

    this.menfessTimeout = setTimeout(startInterval, this.menfessIntervalMs);
    console.log('A menfess is detected on the queue. Interval starts...');
  };

  /*
  private startMenfessInterval = (client: TwitterApi) => {
    if (this.isMenfessIntervalStarted) {
      return;
    }

    const startInterval = async () => {
      setTimeout(async () => {
        console.log('Sending a queued fess...');
        const currentTick = Date.now();

        const { menfess, tweet } = await this.sendFirstQueuedFess(client);
        if (menfess && tweet) {
          const user = await client.v1.user({ user_id: menfess.senderId });
          console.log(
            `A menfess from @${user.screen_name} has been sent (tweet_id: ${
              tweet.id_str
            }, proccess time: ${Date.now() - currentTick}ms)`
          );
        } else {
          console.log('No queued menfess has been sent.');
        }

        console.log('Starting the next interval...');
        startInterval();
      }, 60000);
    };

    this.isMenfessIntervalStarted = true;
    startInterval();
  };
  */

  private add = (
    senderId: string,
    text: string,
    mediaPath: string | undefined
  ) => {
    this.menfessQueue.push({ senderId, text, mediaPath });
    return this.menfessQueue.length;
  };

  public process = async (client: TwitterApi, directMessage: any) => {
    const text: string = directMessage?.message_create?.message_data?.text;
    if (!this.isFess(text)) {
      return false;
    }

    const sender = await client.v1.user({
      user_id: directMessage.message_create.sender_id as string,
    });
    console.log(`Adding a menfess from @${sender.screen_name} to queue...`);

    try {
      const processTick = Date.now();
      const senderId: string = directMessage?.message_create?.sender_id ?? '';
      let mediaPath: string | undefined = undefined;

      const attachment =
        directMessage?.message_create?.message_data?.attachment;
      if (attachment?.type === 'media') {
        const mediaUrl = attachment.media.media_url as string;

        console.log('An attachment detected! Downloading the media...');
        mediaPath = await downloadImage(
          client,
          mediaUrl,
          `${sender.screen_name}-${attachment.media.id_str}`,
          path.extname(mediaUrl)
        );

        console.log(`Media has been successfully downloaded: ${mediaPath}`);
      }

      const number = this.add(senderId, text, mediaPath);
      const currentTick = Date.now();

      console.log(
        `${
          sender.screen_name
        }'s menfess has been added to the queue. (number: ${number}, processing time: ${
          currentTick - processTick
        }ms)`
      );

      this.sendAllFess(client);
    } catch (error) {
      console.log(
        `An error occured while processing @${sender.screen_name}'s menfess.`
      );
      console.log(error);
    }
  };
}

export const menfess = new Menfess();
