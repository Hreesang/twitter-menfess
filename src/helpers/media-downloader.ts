import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import OAuth1Helper from 'twitter-api-v2/dist/client-mixins/oauth1.helper';
import fs from 'fs';
import path from 'path';

const getOAuthHeader = (
  client: TwitterApi,
  url: string,
  method: 'GET' | 'POST'
) => {
  const consumerKey = client['_requestMaker'].consumerToken ?? '';
  const consumerSecret = client['_requestMaker'].consumerSecret ?? '';
  const accessToken = client['_requestMaker'].accessToken ?? '';
  const accessSecret = client['_requestMaker'].accessSecret ?? '';

  const oauth = new OAuth1Helper({
    consumerKeys: { key: consumerKey, secret: consumerSecret },
  });
  const authorization = oauth.authorize(
    { url, method },
    { key: accessToken, secret: accessSecret }
  );
  return oauth.toHeader(authorization);
};

export const downloadImage = async (
  client: TwitterApi,
  url: string,
  uniqueName: string,
  extension: string
) => {
  try {
    const authorization = getOAuthHeader(client, url, 'GET');
    const response = await axios.get(url, {
      headers: authorization,
      responseType: 'arraybuffer',
    });

    const filePath = path.resolve('media', uniqueName + extension);
    fs.writeFileSync(filePath, response.data, { flag: 'w' });

    return filePath;
  } catch (e) {
    throw e;
  }
};
